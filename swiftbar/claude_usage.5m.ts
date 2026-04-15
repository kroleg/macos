#!/usr/bin/env -S /Users/vitaliy/.local/bin/deno run --allow-net --allow-read --allow-env --allow-run

// <swiftbar.title>Claude Usage</swiftbar.title>
// <swiftbar.version>1.0.0</swiftbar.version>
// <swiftbar.desc>Shows Claude Code rate limit usage (5h and weekly windows)</swiftbar.desc>
// <swiftbar.hideAboutMenuItem>true</swiftbar.hideAboutMenuItem>
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

async function fetchUsage(token: string): Promise<UsageData | null> {
  try {
    const resp = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: AbortSignal.timeout(10_000),
    })
    if (!resp.ok) return null
    const data = await resp.json()

    const clamp = (v: number) => Math.max(0, Math.min(100, v))
    return {
      fiveHourRemaining: clamp(100 - (data.five_hour?.utilization ?? 0)),
      weeklyRemaining: clamp(100 - (data.seven_day?.utilization ?? 0)),
      fiveHourResetsAt: data.five_hour?.resets_at ? new Date(data.five_hour.resets_at) : undefined,
      weeklyResetsAt: data.seven_day?.resets_at ? new Date(data.seven_day.resets_at) : undefined,
    }
  } catch {
    return null
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

function color(remaining: number): string | null {
  if (remaining <= 10) return '#FF3B30'
  if (remaining <= 30) return '#FF9500'
  return null
}

// ── Fetch data ─────────────────────────────────────────────────────────────────

const creds = await getCredentials()

if (!creds) {
  console.log('☁ auth? | color=#999999 sfimage=cloud.fill')
  console.log('---')
  console.log('No Claude credentials found')
  console.log('Sign in via Claude Code to enable usage tracking')
  Deno.exit(0)
}

const usage = await fetchUsage(creds.accessToken)

if (!usage) {
  console.log('☁ err | color=#FF3B30 sfimage=cloud.fill')
  console.log('---')
  console.log('Failed to fetch usage data | color=#FF3B30')
  console.log('Refresh | refresh=true')
  Deno.exit(0)
}

const { fiveHourRemaining, weeklyRemaining, fiveHourResetsAt, weeklyResetsAt } = usage
const fiveHourLeft = Math.round(fiveHourRemaining)
const weeklyLeft = Math.round(weeklyRemaining)

// Pick the worse (lower remaining) for the menu bar color
const menuColor = color(Math.min(fiveHourRemaining, weeklyRemaining))

const fiveReset = timeUntil(fiveHourResetsAt)
const weekReset = timeUntil(weeklyResetsAt)

// ── Menu bar line ──────────────────────────────────────────────────────────────
// Show weekly only when < 50% left to reduce clutter
const weeklyPart = weeklyLeft < 50 ? ` w:${weeklyLeft}%` : ''
const fiveResetPart = fiveReset ? ` · ${fiveReset}` : ''
const colorPart = menuColor ? ` | color=${menuColor}` : ''
console.log(`5h:${fiveHourLeft}%${weeklyPart}${fiveResetPart}${colorPart}`)

// ── Dropdown ───────────────────────────────────────────────────────────────────
console.log('---')

const fiveColor = color(fiveHourRemaining)
const weeklyColor = color(weeklyRemaining)

console.log(`5-hour window | size=11 color=#888888`)
console.log(
  `${bar(fiveHourRemaining)}  ${fiveHourLeft}% left${fiveReset ? `  · resets in ${fiveReset}` : ''} | font=Menlo size=12${fiveColor ? ` color=${fiveColor}` : ''}`,
)

console.log('---')

console.log(`7-day window | size=11 color=#888888`)
console.log(
  `${bar(weeklyRemaining)}  ${weeklyLeft}% left${weekReset ? `  · resets in ${weekReset}` : ''} | font=Menlo size=12${weeklyColor ? ` color=${weeklyColor}` : ''}`,
)

console.log('---')
console.log(`Updated ${new Date().toLocaleTimeString()} | size=11 color=#888888`)
console.log('Refresh | refresh=true')
