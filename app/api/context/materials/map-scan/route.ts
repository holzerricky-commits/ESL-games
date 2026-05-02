import { NextResponse } from 'next/server'
import {
  analyzeMaterialsForMappings,
  readMaterialMappings,
  readStoredMaterials,
  resolveBookAndFolder,
} from '@/lib/context/materials-map'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { bookId?: unknown; materialIds?: unknown }
    const bookId = String(body.bookId ?? '').trim()
    if (!bookId) return NextResponse.json({ ok: false, error: 'bookId is required.' }, { status: 400 })
    const resolved = await resolveBookAndFolder(bookId)
    if (!resolved) return NextResponse.json({ ok: false, error: 'Book not found.' }, { status: 404 })
    const allMaterials = await readStoredMaterials(resolved.bookFolder)
    const requestedIds = Array.isArray(body.materialIds)
      ? new Set(body.materialIds.map((item) => String(item ?? '').trim()).filter(Boolean))
      : null
    const materials = requestedIds && requestedIds.size > 0
      ? allMaterials.filter((item) => requestedIds.has(item.id))
      : allMaterials
    const existingMappings = await readMaterialMappings(resolved.bookFolder)
    const analysis = await analyzeMaterialsForMappings(bookId, resolved.book, materials, resolved.bookFolder)
    return NextResponse.json({
      ok: true,
      materialsCount: materials.length,
      totalMaterialsCount: allMaterials.length,
      processedCount: analysis.processedCount,
      skippedCount: analysis.skipped.length,
      skipped: analysis.skipped,
      errors: analysis.errors,
      analysisByMaterial: analysis.analysisByMaterial,
      existingMappingsCount: existingMappings.length,
      suggestions: analysis.suggestions,
      existingMappings,
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to scan material mappings.' }, { status: 500 })
  }
}
