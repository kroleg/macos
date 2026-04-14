#!/usr/bin/env -S /Users/vitaliy/.local/bin/deno run --allow-net --allow-env --allow-run

// <swiftbar.title>VPN Status</swiftbar.title>
// <swiftbar.version>1.0.0</swiftbar.version>
// <swiftbar.desc>Shows current device VPN policy and allows switching</swiftbar.desc>
// <swiftbar.hideAboutMenuItem>true</swiftbar.hideAboutMenuItem>
// <swiftbar.refreshOnOpen>true</swiftbar.refreshOnOpen>

const ADMIN_URL = 'http://admin.internal'
const SCRIPT_PATH = new URL(import.meta.url).pathname

interface Policy {
  id: string
  displayName: string
}

interface DeviceInfo {
  name: string
  ip: string
  mac: string
  policy: { id: string; displayName: string } | null
}

async function fetchDevice(ip: string): Promise<DeviceInfo | null> {
  try {
    const resp = await fetch(`${ADMIN_URL}/api/device/${ip}`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!resp.ok) return null
    return await resp.json() as DeviceInfo
  } catch {
    return null
  }
}

async function fetchPolicies(): Promise<Policy[]> {
  try {
    const resp = await fetch(`${ADMIN_URL}/api/policies`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!resp.ok) return []
    return await resp.json() as Policy[]
  } catch {
    return []
  }
}

async function setPolicy(mac: string, policyId: string | null): Promise<void> {
  await fetch(`${ADMIN_URL}/api/device/${mac}/policy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policyId }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => {})
}

async function getLocalIp(): Promise<string | null> {
  for (const iface of ['en0', 'en1', 'en2', 'en7']) {
    try {
      const cmd = new Deno.Command('/usr/sbin/ipconfig', {
        args: ['getifaddr', iface],
        stdout: 'piped',
        stderr: 'piped',
      })
      const out = await cmd.output()
      const ip = new TextDecoder().decode(out.stdout).trim()
      if (ip) return ip
    } catch { /* try next */ }
  }
  return null
}

// ── Action mode ────────────────────────────────────────────────────────────────
if (Deno.args[0] === 'set-policy') {
  const mac = Deno.args[1]
  const policyId = Deno.args[2] === 'none' ? null : Deno.args[2]
  await setPolicy(mac, policyId)
  Deno.exit(0)
}

// ── Display mode ───────────────────────────────────────────────────────────────
const ip = await getLocalIp()

if (!ip) {
  console.log('VPN ?')
  console.log('---')
  console.log('Could not determine local IP | color=#FF3B30')
  Deno.exit(0)
}

const [device, policies] = await Promise.all([fetchDevice(ip), fetchPolicies()])

if (!device) {
  console.log('VPN ?')
  console.log('---')
  console.log(`Could not reach ${ADMIN_URL} | color=#FF3B30`)
  Deno.exit(0)
}

const active = device.policy

// ── Menu bar ───────────────────────────────────────────────────────────────────
if (active) {
  console.log(`🔒 ${active.displayName} | color=#34C759`)
} else {
  console.log(`🔓 No VPN`)
}

// ── Dropdown ──────────────────────────────────────────────────────────────────
console.log('---')
console.log(`${device.name} | size=11 color=#888888`)
console.log(`IP: ${device.ip} | size=11 color=#888888`)
console.log('---')

const offActive = !active
console.log(
  `${offActive ? '✓ ' : ''}No VPN | bash="${SCRIPT_PATH}" param1=set-policy param2=${device.mac} param3=none refresh=true terminal=false`,
)

for (const policy of policies) {
  const isActive = active?.id === policy.id
  console.log(
    `${isActive ? '✓ ' : ''}${policy.displayName} | bash="${SCRIPT_PATH}" param1=set-policy param2=${device.mac} param3=${policy.id} refresh=true terminal=false${isActive ? ' color=#34C759' : ''}`,
  )
}

console.log('---')
console.log('Refresh | refresh=true')
