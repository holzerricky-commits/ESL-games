import { NextResponse } from 'next/server'
import { getVocabularyStore } from '@/lib/vocabulary/file-store'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const setId = typeof body?.setId === 'string' ? body.setId.trim() : ''
    if (!setId) return NextResponse.json({ ok: false, error: 'setId is required.' }, { status: 400 })
    const store = getVocabularyStore()
    const set = await store.getSet(setId)
    if (!set) return NextResponse.json({ ok: false, error: 'Vocabulary set not found.' }, { status: 404 })

    const hasEntries = set.entries.length > 0
    const allApproved = set.entries.every((entry) => entry.approved)
    if (!hasEntries || !allApproved) {
      return NextResponse.json(
        { ok: false, error: 'All entries must be approved before publishing.' },
        { status: 400 },
      )
    }

    const updated = await store.setStatus(setId, 'published')
    if (!updated) return NextResponse.json({ ok: false, error: 'Failed to publish set.' }, { status: 500 })
    return NextResponse.json({
      ok: true,
      set: updated,
      publishedWords: updated.entries.map((entry) => entry.word),
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to publish vocabulary set.' }, { status: 500 })
  }
}
