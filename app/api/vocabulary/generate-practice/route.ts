import { NextResponse } from 'next/server'
import { getVocabularyStore } from '@/lib/vocabulary/file-store'
import { generateMeaningMatchPracticeItems } from '@/lib/vocabulary/practice-generator'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const setId = typeof body?.setId === 'string' ? body.setId.trim() : ''
    const requestedCount = Number(body?.requestedCount ?? 6)
    if (!setId) return NextResponse.json({ ok: false, error: 'setId is required.' }, { status: 400 })
    const store = getVocabularyStore()
    const set = await store.getSet(setId)
    if (!set) return NextResponse.json({ ok: false, error: 'Vocabulary set not found.' }, { status: 404 })
    const items = generateMeaningMatchPracticeItems(set, requestedCount)
    if (items.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Need at least two approved vocabulary entries to generate practice.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ ok: true, items, type: 'meaning_match' })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to generate practice items.' }, { status: 500 })
  }
}
