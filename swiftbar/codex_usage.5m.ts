#!/usr/bin/env -S DENO_NO_UPDATE_CHECK=1 /Users/vitaliy/.local/share/mise/installs/deno/latest/bin/deno run --allow-net --allow-read --allow-env --allow-run --allow-write

// <swiftbar.title>Codex Usage</swiftbar.title>
// <swiftbar.version>1.3.0</swiftbar.version>
// <swiftbar.desc>Shows Codex rate limit usage (5h and weekly windows) from local session logs</swiftbar.desc>
// <swiftbar.hideAboutMenuItem>true</swiftbar.hideAboutMenuItem>
// <swiftbar.refreshOnOpen>false</swiftbar.refreshOnOpen>

const home = Deno.env.get('HOME') ?? ''
const cacheDir = `${home}/.cache/swiftbar`
const cacheFile = `${cacheDir}/codex_usage.json`
const lockFile = `${cacheDir}/codex_usage.lock`
const PLUGIN_NAME = 'codex_usage.5m.ts'
const STALE_SECONDS = 60

interface RateLimitWindow {
  used_percent: number
  window_minutes: number
  resets_at: number
}

interface RateLimits {
  limit_id: string
  primary: RateLimitWindow
  secondary: RateLimitWindow | null
  plan_type: string | null
  rate_limit_reached_type: string | null
}

interface CachedUsage {
  rateLimits: RateLimits
  recordedAt: number  // unix seconds — timestamp of the most recent JSONL event used
  fetchedAt: number   // unix seconds — when we last scanned
}

async function scanUsage(): Promise<Omit<CachedUsage, 'fetchedAt'> | null> {
  const sessionsDir = `${home}/.codex/sessions`
  try {
    const cmd = new Deno.Command('/usr/bin/find', {
      args: [sessionsDir, '-name', '*.jsonl'],
      stdout: 'piped',
      stderr: 'piped',
    })
    const out = await cmd.output()
    const files = new TextDecoder().decode(out.stdout)
      .trim().split('\n').filter(Boolean).sort().reverse()

    // Scan the most recent files. Across concurrent sessions the server-side
    // used_percent can differ in the same window — keep the highest (most
    // conservative / most used) value. Break early once we've seen events from
    // all files within the top segment.
    let bestRateLimits: RateLimits | null = null
    let bestRecordedAt = 0

    for (const file of files.slice(0, 20)) {
      try {
        const text = await Deno.readTextFile(file)
        for (const line of text.trim().split('\n')) {
          try {
            const ev = JSON.parse(line)
            // Codex writes rate_limits next to payload in current session
            // logs. Older log formats placed it inside payload.
            const rateLimits = ev?.rate_limits ?? ev?.payload?.rate_limits
            if (
              ev?.type === 'event_msg' &&
              ev?.payload?.type === 'token_count' &&
              rateLimits?.primary
            ) {
              const ts = Math.floor(new Date(ev.timestamp).getTime() / 1000)
              const rl: RateLimits = rateLimits
              // Prefer the event from the current (latest) reset window.
              // Within the same window prefer highest used_percent (most conservative).
              if (
                !bestRateLimits ||
                rl.primary.resets_at > bestRateLimits.primary.resets_at ||
                (rl.primary.resets_at === bestRateLimits.primary.resets_at &&
                  (rl.primary.used_percent > bestRateLimits.primary.used_percent ||
                    (rl.primary.used_percent === bestRateLimits.primary.used_percent &&
                      ts > bestRecordedAt)))
              ) {
                bestRateLimits = rl
                bestRecordedAt = ts
              }
            }
          } catch { /* skip malformed lines */ }
        }
      } catch { /* skip unreadable files */ }
    }

    if (!bestRateLimits || !bestRecordedAt) return null
    return { rateLimits: bestRateLimits, recordedAt: bestRecordedAt }
  } catch {
    return null
  }
}

async function acquireLock(): Promise<boolean> {
  try {
    const stat = await Deno.stat(lockFile).catch(() => null)
    if (stat?.mtime && Date.now() - stat.mtime.getTime() < 30_000) return false
    await Deno.mkdir(cacheDir, { recursive: true })
    await Deno.writeTextFile(lockFile, String(Date.now()))
    return true
  } catch {
    return false
  }
}

async function scanAndCache(): Promise<void> {
  if (!await acquireLock()) {
    console.error('Codex usage refresh skipped: lock is active or unavailable')
    return
  }
  try {
    const raw = await scanUsage()
    if (!raw) {
      console.error('Codex usage refresh found no rate limit events')
      return
    }
    const cached: CachedUsage = { ...raw, fetchedAt: Math.floor(Date.now() / 1000) }
    await Deno.mkdir(cacheDir, { recursive: true })
    await Deno.writeTextFile(cacheFile, JSON.stringify(cached))
  } finally {
    await Deno.remove(lockFile).catch(() => {})
    new Deno.Command('/usr/bin/open', {
      args: ['-g', `swiftbar://refreshplugin?name=${PLUGIN_NAME}`],
    }).spawn().unref()
  }
}

function spawnRefresh(): void {
  const scriptPath = new URL(import.meta.url).pathname
  new Deno.Command(Deno.execPath(), {
    args: [
      'run', '--allow-read', '--allow-write',
      '--allow-env', '--allow-run', scriptPath, '--refresh',
    ],
    detached: true,
    stdout: 'null',
    stderr: 'null',
  }).spawn().unref()
}

function timeUntil(unixSecs: number): string {
  const ms = unixSecs * 1000 - Date.now()
  if (ms <= 0) return ''
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return `${days}d${remHours > 0 ? `${remHours}h` : ''}`
  }
  return `${hours}h${minutes}m`
}

function timeSince(unixSecs: number): string {
  const ms = Date.now() - unixSecs * 1000
  if (ms <= 0) return 'just now'
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 60) return `${totalMinutes}m ago`
  const hours = Math.floor(totalMinutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function bar(usedPercent: number, width = 8): string {
  const filled = Math.round((usedPercent / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function ansiPct(remaining: number): string {
  const val = Math.round(remaining)
  if (remaining <= 10) return `\x1b[38;2;255;59;48m${val}%\x1b[0m`
  if (remaining <= 30) return `\x1b[38;2;255;149;0m${val}%\x1b[0m`
  return `${val}%`
}

function ansiBar(usedPercent: number, remaining: number): string {
  const b = bar(usedPercent)
  if (remaining <= 10) return `\x1b[38;2;255;59;48m${b}\x1b[0m`
  if (remaining <= 30) return `\x1b[38;2;255;149;0m${b}\x1b[0m`
  return b
}

// ── Background refresh mode ────────────────────────────────────────────────────

if (Deno.args.includes('--refresh')) {
  await scanAndCache()
  Deno.exit(0)
}

// ── Read cache ─────────────────────────────────────────────────────────────────

let cache: CachedUsage | null = null
try { cache = JSON.parse(await Deno.readTextFile(cacheFile)) } catch { /* no cache */ }

const nowSecs = Date.now() / 1000
const stale = !cache || nowSecs - cache.fetchedAt > STALE_SECONDS

if (!cache) {
  console.log(`⚡… | color=#10A37F`)
  console.log('---')
  console.log('↻ Loading… | color=#888888')
  spawnRefresh()
  Deno.exit(0)
}

if (stale) spawnRefresh()

// ── Render from cache ──────────────────────────────────────────────────────────

const { rateLimits, recordedAt, fetchedAt } = cache

// A window is "from a previous period" when resets_at is already in the past.
// We still show the data (dimmed) — it's the last known usage before the reset.
const primaryPrev = rateLimits.primary.resets_at < nowSecs
const secondary = rateLimits.secondary
const secondaryPrev = secondary !== null && secondary.resets_at < nowSecs

const primaryRemaining = Math.round(100 - rateLimits.primary.used_percent)
const secondaryRemaining = secondary ? Math.round(100 - secondary.used_percent) : 0

// Menu bar: use last known data. For an expired window treat as fresh (full)
// so we don't show a false alarm — we genuinely don't know current usage.
const menuRemaining = primaryPrev ? 100 : primaryRemaining

const primaryReset = primaryPrev ? 'prev' : timeUntil(rateLimits.primary.resets_at)
const titlePrimary = !primaryPrev && primaryReset
  ? `${primaryReset}:${ansiPct(menuRemaining)}`
  : ansiPct(menuRemaining)

const secondaryTitle = secondary
  ? ` w:${ansiPct(secondaryPrev ? 100 : secondaryRemaining)}`
  : ''
console.log(`⚡${titlePrimary}${secondaryTitle} | ansi=true`)

console.log('---')
if (stale) {
  console.log('↻ Refreshing… | size=11 color=#888888')
  console.log('---')
}

function printWindow(
  label: string,
  usedPercent: number,
  remaining: number,
  resetsAt: number,
  isPrev: boolean,
) {
  if (isPrev) {
    console.log(`${label} | size=11 color=#888888`)
    console.log(
      `${bar(usedPercent)}  ${remaining}% left  · prev window, reset ${timeSince(resetsAt)} | font=Menlo size=12 color=#888888`,
    )
  } else {
    const reset = timeUntil(resetsAt)
    const resetPart = reset ? `  · resets in ${reset}` : ''
    console.log(`${label} | size=11 color=#888888`)
    console.log(`${ansiBar(usedPercent, remaining)}  ${ansiPct(remaining)} left${resetPart} | font=Menlo size=12 ansi=true`)
  }
}

function windowLabel(minutes: number): string {
  if (minutes % (60 * 24 * 7) === 0) return `${minutes / (60 * 24 * 7)}-week window`
  if (minutes % (60 * 24) === 0) return `${minutes / (60 * 24)}-day window`
  if (minutes % 60 === 0) return `${minutes / 60}-hour window`
  return `${minutes}-minute window`
}

printWindow(windowLabel(rateLimits.primary.window_minutes), rateLimits.primary.used_percent, primaryRemaining, rateLimits.primary.resets_at, primaryPrev)
if (secondary) {
  console.log('---')
  printWindow(windowLabel(secondary.window_minutes), secondary.used_percent, secondaryRemaining, secondary.resets_at, secondaryPrev)
}

if (rateLimits.plan_type) {
  console.log('---')
  console.log(`Plan: ${rateLimits.plan_type} | size=11 color=#888888`)
}

const ageStr = timeSince(fetchedAt)
console.log('---')
console.log(`Session data from ${new Date(recordedAt * 1000).toLocaleTimeString()} | size=11 color=#888888`)
console.log(`Updated ${ageStr} | size=11 color=#888888`)
console.log('Refresh | refresh=true')
