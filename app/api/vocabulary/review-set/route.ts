import { NextResponse } from 'next/server'
import { getVocabularyStore } from '@/lib/vocabulary/file-store'
import { getVocabularyRiskScore } from '@/lib/vocabulary/risk'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const setId = url.searchParams.get('setId')?.trim()
  if (!setId) return NextResponse.json({ ok: false, error: 'setId is required.' }, { status: 400 })
  const sortBy = url.searchParams.get('sortBy')?.trim() ?? 'none'
  const onlyFlags = url.searchParams.get('onlyFlags') === 'true'
  const excludeApproved = url.searchParams.get('excludeApproved') === 'true'
  const store = getVocabularyStore()
  const set = await store.getSet(setId)
  if (!set) return NextResponse.json({ ok: false, error: 'Vocabulary set not found.' }, { status: 404 })
  let entries = [...set.entries]
  if (onlyFlags) entries = entries.filter((entry) => (entry.reviewFlags ?? []).length > 0)
  if (excludeApproved) entries = entries.filter((entry) => !entry.approved)
  if (sortBy === 'risk') {
    entries.sort((a, b) => {
      const risk = getVocabularyRiskScore(b) - getVocabularyRiskScore(a)
      if (risk !== 0) return risk
      return (a.word ?? '').localeCompare(b.word ?? '')
    })
  } else if (sortBy === 'confidence') {
    entries.sort((a, b) => (a.confidence ?? 0.5) - (b.confidence ?? 0.5))
  } else if (sortBy === 'alpha') {
    entries.sort((a, b) => (a.word ?? '').localeCompare(b.word ?? ''))
  }
  return NextResponse.json({ ok: true, set: { ...set, entries } })
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

    if (action === 'bulkApproveHighConfidence') {
      const minConfidenceRaw = Number(body?.minConfidence)
      const minConfidence = Number.isFinite(minConfidenceRaw) ? Math.max(0, Math.min(1, minConfidenceRaw)) : 0.75
      const updated = await store.bulkUpdateEntries(
        setId,
        (entry) =>
          !entry.approved &&
          (entry.confidence ?? 0.5) >= minConfidence &&
          !(entry.reviewFlags ?? []).map((f) => f.toLowerCase()).includes('off_scope'),
        { approved: true },
      )
      if (!updated) return NextResponse.json({ ok: false, error: 'Set not found.' }, { status: 404 })
      return NextResponse.json({ ok: true, set: updated })
    }

    if (action === 'bulkApproveVisible') {
      const entryIds = Array.isArray(body?.entryIds) ? body.entryIds.map(String) : []
      const idSet = new Set(entryIds)
      const updated = await store.bulkUpdateEntries(
        setId,
        (entry) =>
          idSet.has(entry.id) &&
          !(entry.reviewFlags ?? []).map((f) => f.toLowerCase()).includes('off_scope'),
        { approved: true },
      )
      if (!updated) return NextResponse.json({ ok: false, error: 'Set not found.' }, { status: 404 })
      return NextResponse.json({ ok: true, set: updated })
    }

    if (action === 'bulkClearFlags') {
      const entryIds = Array.isArray(body?.entryIds) ? body.entryIds.map(String) : []
      const idSet = new Set(entryIds)
      const updated = await store.bulkUpdateEntries(setId, (entry) => idSet.has(entry.id), { reviewFlags: [] })
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
      relevanceTags: Array.isArray(body?.relevanceTags) ? body.relevanceTags.map(String) : undefined,
      confidence: Number.isFinite(Number(body?.confidence)) ? Number(body.confidence) : undefined,
      reviewFlags: Array.isArray(body?.reviewFlags) ? body.reviewFlags.map(String) : undefined,
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
