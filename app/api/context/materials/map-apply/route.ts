import { NextResponse } from 'next/server'
import {
  readMaterialMappings,
  resolveBookAndFolder,
  saveMaterialMappings,
  type MaterialLinkMapping,
} from '@/lib/context/materials-map'

export const runtime = 'nodejs'

function sanitizeMappings(bookId: string, raw: unknown): MaterialLinkMapping[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const src = item as Partial<MaterialLinkMapping>
      const materialId = String(src.materialId ?? '').trim()
      if (!materialId) return null
      const confidenceRaw = String(src.confidence ?? '').trim()
      const confidence: 'high' | 'medium' | 'low' =
        confidenceRaw === 'high' || confidenceRaw === 'medium' ? confidenceRaw : 'low'
      return {
        materialId,
        bookId,
        unitId: typeof src.unitId === 'string' ? src.unitId.trim() || undefined : undefined,
        lessonId: typeof src.lessonId === 'string' ? src.lessonId.trim() || undefined : undefined,
        partId: typeof src.partId === 'string' ? src.partId.trim() || undefined : undefined,
        confidence,
        reason: typeof src.reason === 'string' ? src.reason.trim() || 'Manual mapping apply' : 'Manual mapping apply',
        sourceFilePath: typeof src.sourceFilePath === 'string' ? src.sourceFilePath.trim() || undefined : undefined,
        evidenceSnippet: typeof src.evidenceSnippet === 'string' ? src.evidenceSnippet.trim() || undefined : undefined,
        evidencePage:
          typeof src.evidencePage === 'number' && Number.isFinite(src.evidencePage) && src.evidencePage > 0
            ? Math.floor(src.evidencePage)
            : null,
        lessonProfileSnapshot:
          src.lessonProfileSnapshot && typeof src.lessonProfileSnapshot === 'object'
            ? (src.lessonProfileSnapshot as MaterialLinkMapping['lessonProfileSnapshot'])
            : undefined,
        mappedAt: new Date().toISOString(),
      } satisfies MaterialLinkMapping
    })
    .filter((item): item is MaterialLinkMapping => !!item)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { bookId?: unknown; mappings?: unknown }
    const bookId = String(body.bookId ?? '').trim()
    if (!bookId) return NextResponse.json({ ok: false, error: 'bookId is required.' }, { status: 400 })
    const resolved = await resolveBookAndFolder(bookId)
    if (!resolved) return NextResponse.json({ ok: false, error: 'Book not found.' }, { status: 404 })
    const incoming = sanitizeMappings(bookId, body.mappings)
    if (!incoming.length) return NextResponse.json({ ok: false, error: 'No mappings provided.' }, { status: 400 })
    const existing = await readMaterialMappings(resolved.bookFolder)
    const incomingIds = new Set(incoming.map((item) => item.materialId))
    const merged = [...incoming, ...existing.filter((item) => !incomingIds.has(item.materialId))]
    await saveMaterialMappings(resolved.bookFolder, merged)
    return NextResponse.json({ ok: true, savedCount: incoming.length, totalCount: merged.length })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to apply mappings.' }, { status: 500 })
  }
}
