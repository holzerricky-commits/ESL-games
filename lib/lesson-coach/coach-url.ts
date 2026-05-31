export function buildCoachPagePath(sessionId: string): string {
  return `/lesson/coach?session=${encodeURIComponent(sessionId)}`
}

export function buildCoachUrlFromRequest(req: Request, sessionId: string): string {
  const url = new URL(req.url)
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '') ?? 'http'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host
  return `${proto}://${host}${buildCoachPagePath(sessionId)}`
}

export function buildCoachUrlFromOrigin(origin: string, sessionId: string): string {
  const base = origin.replace(/\/$/, '')
  return `${base}${buildCoachPagePath(sessionId)}`
}

export function isLocalhostHost(host: string): boolean {
  return host === 'localhost' || host.startsWith('127.0.0.1') || host.startsWith('localhost:')
}
