import { NextResponse } from 'next/server'
import { getContextStore } from '@/lib/context/file-store'
import { scanUnitContext } from '@/lib/context/scan-service'
import type { UnitContextScanInput } from '@/lib/context/types'

const REQUEST_COOLDOWN_MS = 1200
const cooldown = new Map<string, number>()

function clientKey(req: Request): string {
  const xf = req.headers.get('x-forwarded-for') ?? ''
  return xf.split(',')[0]?.trim() || 'local'
}

function parseInput(body: unknown): UnitContextScanInput | null {
  const src = body as Partial<UnitContextScanInput> | undefined
  if (!src || typeof src.bookId !== 'string' || typeof src.unitId !== 'string') return null
  const startPage = Number(src.sourcePageRange?.startPage)
  const endPage = Number(src.sourcePageRange?.endPage)
  if (!Number.isFinite(startPage) || !Number.isFinite(endPage)) return null
  return {
    bookId: src.bookId.trim(),
    unitId: src.unitId.trim(),
    unitTitle: typeof src.unitTitle === 'string' ? src.unitTitle.trim() : undefined,
    sourcePageRange: { startPage, endPage },
    sectionSummary: typeof src.sectionSummary === 'string' ? src.sectionSummary : undefined,
    scanProfile: src.scanProfile,
  }
}

export async function POST(req: Request) {
  try {
    const key = clientKey(req)
    const now = Date.now()
    const last = cooldown.get(key) ?? 0
    if (now - last < REQUEST_COOLDOWN_MS) {
      return NextResponse.json({ ok: false, error: 'Please wait before scanning again.' }, { status: 429 })
    }
    cooldown.set(key, now)

    const body = await req.json()
    const input = parseInput(body)
    if (!input) return NextResponse.json({ ok: false, error: 'Invalid unit scan input.' }, { status: 400 })

    const store = getContextStore()
    const scanned = await scanUnitContext(input)
    const saved = await store.saveUnitContext(scanned)
    return NextResponse.json({ ok: true, context: saved })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to scan unit context.' }, { status: 500 })
  }
}
