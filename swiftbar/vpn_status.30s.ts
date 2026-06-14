#!/usr/bin/env -S /Users/vitaliy/.local/bin/deno run --allow-net --allow-env

// <swiftbar.title>VPN Status</swiftbar.title>
// <swiftbar.version>2.0.0</swiftbar.version>
// <swiftbar.desc>Shows current device VPN policy and allows switching</swiftbar.desc>
// <swiftbar.hideAboutMenuItem>true</swiftbar.hideAboutMenuItem>
// <swiftbar.refreshOnOpen>true</swiftbar.refreshOnOpen>

// vpn.internal auto-identifies the caller by source IP, so the plugin doesn't
// need to know which local interface egresses - it sees whichever device the
// default route exits through.
const VPN_URL = 'http://vpn.internal'
const DEVICES_URL = 'http://devices.internal'
const SCRIPT_PATH = new URL(import.meta.url).pathname

interface Policy {
  id: string
  displayName: string
}

interface MePolicy {
  device: {
    name: string
    ip: string
    mac: string
    online: boolean
    policy: Policy | null
  }
  policies: Policy[]
}

async function fetchMe(): Promise<MePolicy | null> {
  try {
    const resp = await fetch(`${VPN_URL}/api/me/policy`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!resp.ok) return null
    return await resp.json() as MePolicy
  } catch {
    return null
  }
}

interface Whoami {
  device: { customName: string | null } | null
}

async function fetchWhoami(ip: string): Promise<Whoami | null> {
  try {
    const resp = await fetch(`${DEVICES_URL}/api/whoami?ip=${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!resp.ok) return null
    return await resp.json() as Whoami
  } catch {
    return null
  }
}

async function setPolicy(policyId: string | null): Promise<void> {
  await fetch(`${VPN_URL}/api/me/policy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policyId }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => {})
}

// Map of policy displayName → country flag emoji.
// Source data is in Russian; keep English fallbacks so renames don't silently break the icon.
const FLAGS: Record<string, string> = {
  'Литва': '🇱🇹',
  'Lithuania': '🇱🇹',
  'Латвия': '🇱🇻',
  'Latvia': '🇱🇻',
  'Финляндия': '🇫🇮',
  'Finland': '🇫🇮',
  'Эстония': '🇪🇪',
  'Estonia': '🇪🇪',
  'Германия': '🇩🇪',
  'Germany': '🇩🇪',
  'Нидерланды': '🇳🇱',
  'Netherlands': '🇳🇱',
  'США': '🇺🇸',
  'USA': '🇺🇸',
  'Великобритания': '🇬🇧',
  'UK': '🇬🇧',
}

function flagFor(name: string): string {
  return FLAGS[name] ?? `🔒 ${name}`
}

// ── Action mode ────────────────────────────────────────────────────────────────
if (Deno.args[0] === 'set-policy') {
  const policyId = Deno.args[1] === 'none' ? null : Deno.args[1]
  await setPolicy(policyId)
  Deno.exit(0)
}

// ── Display mode ───────────────────────────────────────────────────────────────
const me = await fetchMe()

if (!me) {
  console.log('VPN ?')
  console.log('---')
  console.log(`Could not reach ${VPN_URL} | color=#FF3B30`)
  Deno.exit(0)
}

const { device, policies } = me
const active = device.policy
const whoami = await fetchWhoami(device.ip)
const displayName = whoami?.device?.customName ?? device.name

// ── Menu bar ───────────────────────────────────────────────────────────────────
if (active) {
  console.log(`${flagFor(active.displayName)} VPN`)
} else {
  console.log(`VPN`)
}

// ── Dropdown ──────────────────────────────────────────────────────────────────
console.log('---')
console.log(`${displayName} | size=11 color=#888888`)
console.log(`IP: ${device.ip} | size=11 color=#888888`)
console.log('---')

const offActive = !active
console.log(
  `${offActive ? '✓ ' : ''}OFF | bash="${SCRIPT_PATH}" param1=set-policy param2=none refresh=true terminal=false`,
)

for (const policy of policies) {
  const isActive = active?.id === policy.id
  console.log(
    `${isActive ? '✓ ' : ''}${policy.displayName} | bash="${SCRIPT_PATH}" param1=set-policy param2=${policy.id} refresh=true terminal=false${isActive ? ' color=#34C759' : ''}`,
  )
}

console.log('---')
console.log('Refresh | refresh=true')
