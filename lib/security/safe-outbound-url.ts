import { lookup } from 'node:dns/promises'
import net from 'node:net'

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet'] as const
const MAX_REDIRECTS = 5

function normalizeHostname(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }
  const [a, b] = parts
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10.0.0.0/8
  if (a === 127) return true // 127.0.0.0/8
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
  if (a >= 224) return true // multicast / reserved
  return false
}

function expandIpv4MappedFromHexPair(left: string, right: string): string | null {
  if (!/^[0-9a-f]{1,4}$/i.test(left) || !/^[0-9a-f]{1,4}$/i.test(right)) return null
  const n = (Number.parseInt(left, 16) << 16) + Number.parseInt(right, 16)
  return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::' || lower === '::1') return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // ULA fc00::/7
  if (lower.startsWith('fe80:')) return true // link-local
  if (lower.startsWith('ff')) return true // multicast

  const dottedMapped = lower.match(/:ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
  if (dottedMapped?.[1]) return isBlockedIpv4(dottedMapped[1])

  const hexMapped = lower.match(/:ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (hexMapped?.[1] && hexMapped[2]) {
    const embedded = expandIpv4MappedFromHexPair(hexMapped[1], hexMapped[2])
    if (embedded) return isBlockedIpv4(embedded)
  }

  return false
}

/** True for loopback, private, link-local, CGNAT, and cloud metadata ranges. */
export function isBlockedIpAddress(ip: string): boolean {
  const normalized = normalizeHostname(ip)
  if (!normalized) return true
  if (net.isIPv4(normalized)) return isBlockedIpv4(normalized)
  if (net.isIPv6(normalized)) return isBlockedIpv6(normalized)
  return false
}

export function isBlockedOutboundHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname)
  if (!host) return true
  if (host === 'localhost') return true
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true
  if (net.isIP(host)) return isBlockedIpAddress(host)
  return false
}

/**
 * Ensures a URL is http(s) and does not target localhost / private / link-local hosts.
 * Resolves DNS so hostname→private-IP tricks are rejected.
 */
export async function assertSafeOutboundHttpUrl(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are supported.')
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed.')
  }

  const host = normalizeHostname(parsed.hostname)
  if (isBlockedOutboundHostname(host)) {
    throw new Error('URL targets a blocked private or local address.')
  }

  if (!net.isIP(host)) {
    let addresses: Array<{ address: string }>
    try {
      addresses = await lookup(host, { all: true, verbatim: true })
    } catch {
      throw new Error('Could not resolve URL hostname.')
    }
    if (!addresses.length) {
      throw new Error('Could not resolve URL hostname.')
    }
    for (const entry of addresses) {
      if (isBlockedIpAddress(entry.address)) {
        throw new Error('URL resolves to a blocked private or local address.')
      }
    }
  }

  return parsed
}

/** fetch() that re-validates each redirect target (default fetch would follow into private IPs). */
export async function fetchSafeOutboundUrl(
  rawUrl: string,
  init?: Omit<RequestInit, 'redirect'>,
): Promise<Response> {
  let current = await assertSafeOutboundHttpUrl(rawUrl)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current.toString(), {
      ...init,
      redirect: 'manual',
    })
    if (response.status < 300 || response.status >= 400) {
      return response
    }
    const location = response.headers.get('location')
    if (!location) {
      throw new Error('Redirect missing Location header.')
    }
    let next: URL
    try {
      next = new URL(location, current)
    } catch {
      throw new Error('Redirect Location is not a valid URL.')
    }
    current = await assertSafeOutboundHttpUrl(next.toString())
  }
  throw new Error('Too many redirects.')
}
