#!/usr/bin/env -S /Users/vitaliy/.local/share/mise/installs/deno/latest/bin/deno run --allow-net --allow-read --allow-env --allow-run --allow-write

// <bitbar.title>Claude Usage</bitbar.title>
// <bitbar.version>1.0.0</bitbar.version>
// <bitbar.desc>Shows Claude Code rate limit usage (5h and weekly windows)</bitbar.desc>
// <swiftbar.hideAbout>true</swiftbar.hideAbout>
// <swiftbar.refreshOnOpen>true</swiftbar.refreshOnOpen>

interface OAuthCredentials {
  accessToken: string
  expiresAt?: number
}

interface UsageData {
  fiveHourRemaining: number
  weeklyRemaining: number
  fiveHourResetsAt?: Date
  weeklyResetsAt?: Date
}

interface CachedUsage {
  fiveHourRemaining: number
  weeklyRemaining: number
  fiveHourResetsAt?: string
  weeklyResetsAt?: string
}

interface Cache {
  usage?: CachedUsage
  fetchedAt?: string
  nextAllowedAt?: string
}

const RATE_LIMIT_BACKOFF_MS = 30 * 60_000 // used when a 429 has no Retry-After header
const ERROR_BACKOFF_MS = 5 * 60_000

function cachePath(): string {
  const home = Deno.env.get('HOME') ?? ''
  return `${home}/.cache/swiftbar-claude-usage.json`
}

async function loadCache(): Promise<Cache> {
  try {
    return JSON.parse(await Deno.readTextFile(cachePath()))
  } catch {
    return {}
  }
}

async function saveCache(cache: Cache): Promise<void> {
  try {
    const path = cachePath()
    await Deno.mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true })
    await Deno.writeTextFile(path, JSON.stringify(cache))
  } catch {
    // best-effort; a failed write just means we retry on the next tick
  }
}

function toCached(usage: UsageData): CachedUsage {
  return {
    fiveHourRemaining: usage.fiveHourRemaining,
    weeklyRemaining: usage.weeklyRemaining,
    fiveHourResetsAt: usage.fiveHourResetsAt?.toISOString(),
    weeklyResetsAt: usage.weeklyResetsAt?.toISOString(),
  }
}

function fromCached(cached: CachedUsage): UsageData {
  return {
    fiveHourRemaining: cached.fiveHourRemaining,
    weeklyRemaining: cached.weeklyRemaining,
    fiveHourResetsAt: cached.fiveHourResetsAt ? new Date(cached.fiveHourResetsAt) : undefined,
    weeklyResetsAt: cached.weeklyResetsAt ? new Date(cached.weeklyResetsAt) : undefined,
  }
}

async function readKeychainCredentials(): Promise<OAuthCredentials | null> {
  try {
    const cmd = new Deno.Command('/usr/bin/security', {
      args: ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
      stdout: 'piped',
      stderr: 'piped',
    })
    const output = await cmd.output()
    if (!output.success) return null
    const raw = new TextDecoder().decode(output.stdout).trim()
    const parsed = JSON.parse(raw)
    const creds = parsed.claudeAiOauth ?? parsed
    if (typeof creds.accessToken !== 'string' || !creds.accessToken) return null
    return { accessToken: creds.accessToken, expiresAt: creds.expiresAt }
  } catch {
    return null
  }
}

async function readFileCredentials(): Promise<OAuthCredentials | null> {
  try {
    const home = Deno.env.get('HOME') ?? ''
    const text = await Deno.readTextFile(`${home}/.claude/.credentials.json`)
    const parsed = JSON.parse(text)
    const creds = parsed.claudeAiOauth ?? parsed
    if (typeof creds.accessToken !== 'string' || !creds.accessToken) return null
    return { accessToken: creds.accessToken, expiresAt: creds.expiresAt }
  } catch {
    return null
  }
}

async function getCredentials(): Promise<OAuthCredentials | null> {
  return (await readKeychainCredentials()) ?? (await readFileCredentials())
}

type FetchResult =
  | { kind: 'ok'; usage: UsageData }
  | { kind: 'rate-limited'; retryAfterMs?: number }
  | { kind: 'error'; status: string }

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return seconds * 1000
  const date = new Date(header)
  if (!Number.isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now())
  return undefined
}

async function fetchUsage(token: string): Promise<FetchResult> {
  try {
    const resp = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: AbortSignal.timeout(10_000),
    })
    if (resp.status === 429) {
      return { kind: 'rate-limited', retryAfterMs: parseRetryAfter(resp.headers.get('retry-after')) }
    }
    if (!resp.ok) return { kind: 'error', status: `${resp.status}` }
    const data = await resp.json()

    const clamp = (v: number) => Math.max(0, Math.min(100, v))
    return {
      kind: 'ok',
      usage: {
        fiveHourRemaining: clamp(100 - (data.five_hour?.utilization ?? 0)),
        weeklyRemaining: clamp(100 - (data.seven_day?.utilization ?? 0)),
        fiveHourResetsAt: data.five_hour?.resets_at ? new Date(data.five_hour.resets_at) : undefined,
        weeklyResetsAt: data.seven_day?.resets_at ? new Date(data.seven_day.resets_at) : undefined,
      },
    }
  } catch {
    return { kind: 'error', status: 'err' }
  }
}

function timeUntil(date?: Date): string {
  if (!date) return ''
  const ms = date.getTime() - Date.now()
  if (ms <= 0) return 'now'
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return `${days}d${remHours > 0 ? `${remHours}h` : ''}`
  }
  return `${hours}h${minutes > 0 ? `${minutes}m` : ''}`
}

function bar(remaining: number, width = 8): string {
  const used = 100 - remaining
  const filled = Math.round((used / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function colorAttr(remaining: number): string {
  if (remaining <= 10) return ' color=#FF3B30'
  if (remaining <= 30) return ' color=#FF9500'
  return ''
}

// ── Fetch data ─────────────────────────────────────────────────────────────────

const creds = await getCredentials()

if (!creds) {
  console.log('auth? | color=#999999 sfimage=key.fill sfcolor=#999999')
  console.log('---')
  console.log('No Claude credentials found')
  console.log('Sign in via Claude Code to enable usage tracking')
  Deno.exit(0)
}

const cache = await loadCache()
const now = Date.now()
const nextAllowedAt = cache.nextAllowedAt ? new Date(cache.nextAllowedAt).getTime() : 0

let usage: UsageData | undefined = cache.usage ? fromCached(cache.usage) : undefined
let stale = false
let statusNote: string | undefined

if (nextAllowedAt > now) {
  // Still in backoff from a previous rate-limit/error — don't hit the network again.
  stale = usage !== undefined
  statusNote = `rate limited — retrying in ${timeUntil(new Date(nextAllowedAt))}`
} else {
  const result = await fetchUsage(creds.accessToken)

  if (result.kind === 'ok') {
    usage = result.usage
    await saveCache({ usage: toCached(usage), fetchedAt: new Date(now).toISOString() })
  } else if (result.kind === 'rate-limited') {
    const backoffMs = result.retryAfterMs ?? RATE_LIMIT_BACKOFF_MS
    await saveCache({ ...cache, nextAllowedAt: new Date(now + backoffMs).toISOString() })
    stale = usage !== undefined
    statusNote = `rate limited — retrying in ${timeUntil(new Date(now + backoffMs))}`
  } else {
    await saveCache({ ...cache, nextAllowedAt: new Date(now + ERROR_BACKOFF_MS).toISOString() })
    stale = usage !== undefined
    statusNote = `error (${result.status}) — retrying in ${timeUntil(new Date(now + ERROR_BACKOFF_MS))}`
  }
}

if (!usage) {
  console.log('⚠︎ | color=#FF9500 sfimage=exclamationmark.triangle.fill sfcolor=#FF9500')
  console.log('---')
  console.log(`Failed to fetch usage data — ${statusNote} | color=#FF9500`)
  console.log('Refresh | refresh=true')
  Deno.exit(0)
}

const { fiveHourRemaining, weeklyRemaining, fiveHourResetsAt, weeklyResetsAt } = usage
const fiveHourLeft = Math.round(fiveHourRemaining)
const weeklyLeft = Math.round(weeklyRemaining)

// Pick the worse (lower remaining) for the menu bar color
const menuColorAttr = colorAttr(Math.min(fiveHourRemaining, weeklyRemaining))

const fiveReset = timeUntil(fiveHourResetsAt)
const weekReset = timeUntil(weeklyResetsAt)

// ── Menu bar line ──────────────────────────────────────────────────────────────
// 5-segment battery + hours until 5h reset
const segments = Math.round(fiveHourRemaining / 20)
const battery = segments === 0
  ? `${fiveHourLeft}%`
  : '▰'.repeat(segments) + '-'.repeat(5 - segments)
const resetHours = fiveHourResetsAt ? Math.max(0, fiveHourResetsAt.getTime() - Date.now()) / 3_600_000 : 0
// Show hours only when spending faster than natural rate (remaining < hours * 20%)
const overBudget = fiveHourRemaining < resetHours * 20
const resetPart = overBudget ? ` ${resetHours < 1 ? '<1h' : `${Math.round(resetHours)}h`}` : ''
const weeklyPart = weeklyLeft < 50 ? ` w:${weeklyLeft}%` : ''
console.log(`${battery}${resetPart}${weeklyPart}${menuColorAttr ? ` |${menuColorAttr}` : ''}`)

// ── Dropdown ───────────────────────────────────────────────────────────────────
console.log('---')

function printWindow(label: string, remaining: number, left: number, reset: string) {
  console.log(`${label} | size=11 color=#888888`)
  console.log(
    `${bar(remaining)}  ${left}% left${reset ? `  · resets in ${reset}` : ''} | font=Menlo size=12${colorAttr(remaining)}`,
  )
}

printWindow('5-hour window', fiveHourRemaining, fiveHourLeft, fiveReset)
console.log('---')
printWindow('7-day window', weeklyRemaining, weeklyLeft, weekReset)

console.log('---')
if (stale && statusNote) {
  console.log(`Cached data (${statusNote}) | size=11 color=#FF9500`)
} else {
  console.log(`Updated ${new Date().toLocaleTimeString()} | size=11 color=#888888`)
}
console.log('Refresh | refresh=true')
