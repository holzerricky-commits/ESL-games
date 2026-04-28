import { NextResponse } from 'next/server'
import { getVocabularyStore } from '@/lib/vocabulary/file-store'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const setId = url.searchParams.get('setId')?.trim()
  if (!setId) return NextResponse.json({ ok: false, error: 'setId is required.' }, { status: 400 })
  const store = getVocabularyStore()
  const set = await store.getSet(setId)
  if (!set) return NextResponse.json({ ok: false, error: 'Vocabulary set not found.' }, { status: 404 })
  return NextResponse.json({ ok: true, set })
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const setId = typeof body?.setId === 'string' ? body.setId.trim() : ''
    const entryId = typeof body?.entryId === 'string' ? body.entryId.trim() : ''
    const action = typeof body?.action === 'string' ? body.action : 'update'
    if (!setId) return NextResponse.json({ ok: false, error: 'setId is required.' }, { status: 400 })

    const store = getVocabularyStore()
    if (action === 'remove') {
      const updated = await store.removeEntry(setId, entryId)
      if (!updated) return NextResponse.json({ ok: false, error: 'Set or entry not found.' }, { status: 404 })
      return NextResponse.json({ ok: true, set: updated })
    }

    if (action === 'setStatus') {
      const status = typeof body?.status === 'string' ? body.status : ''
      if (status !== 'draft' && status !== 'approved' && status !== 'published') {
        return NextResponse.json({ ok: false, error: 'Invalid status.' }, { status: 400 })
      }
      const updated = await store.setStatus(setId, status)
      if (!updated) return NextResponse.json({ ok: false, error: 'Set not found.' }, { status: 404 })
      return NextResponse.json({ ok: true, set: updated })
    }

    if (!entryId) return NextResponse.json({ ok: false, error: 'entryId is required.' }, { status: 400 })
    const patch = {
      word: typeof body?.word === 'string' ? body.word : undefined,
      lemma: typeof body?.lemma === 'string' ? body.lemma : undefined,
      definition: typeof body?.definition === 'string' ? body.definition : undefined,
      examples: Array.isArray(body?.examples) ? body.examples.map(String) : undefined,
      synonyms: Array.isArray(body?.synonyms) ? body.synonyms.map(String) : undefined,
      antonyms: Array.isArray(body?.antonyms) ? body.antonyms.map(String) : undefined,
      sourcePage: Number.isFinite(Number(body?.sourcePage)) ? Number(body.sourcePage) : undefined,
      approved: typeof body?.approved === 'boolean' ? body.approved : undefined,
    }
    const updated = await store.updateEntry(setId, entryId, patch)
    if (!updated) return NextResponse.json({ ok: false, error: 'Set or entry not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, set: updated })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to update vocabulary set.' }, { status: 500 })
  }
}
