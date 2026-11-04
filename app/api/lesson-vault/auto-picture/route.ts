import { NextRequest, NextResponse } from 'next/server'
import { findAndStoreAutoPicture, glossForVaultWord, storePictureChoice } from '@/lib/lesson-vault/auto-picture-server'
import { isSafeVaultCardId, isSafeVaultOwnerId } from '@/lib/lesson-vault/picture-paths'

function recordId(value: unknown): string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : ''
}

export const runtime = 'nodejs'

/**
 * POST { studentId, cardId, word, sentence, forceSearch? } → finds and stores a picture for a blank card,
 * and returns a short gloss for an empty meaning.
 * POST { studentId, cardId, word, sentence, meaningOnly: true } → gloss only (card already has a picture).
 * POST { studentId, cardId, choiceUrl } → stores that choice as the card's picture (strip swap).
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  const studentId = typeof body.studentId === 'string' ? body.studentId : ''
  const cardId = typeof body.cardId === 'string' ? body.cardId : ''
  if (!isSafeVaultOwnerId(studentId) || !isSafeVaultCardId(cardId)) {
    return NextResponse.json({ error: 'Invalid card.' }, { status: 400 })
  }

  if (typeof body.choiceUrl === 'string') {
    const url = await storePictureChoice(studentId, cardId, body.choiceUrl)
    return url
      ? NextResponse.json({ url })
      : NextResponse.json({ error: 'That picture could not be downloaded.' }, { status: 502 })
  }

  const word = typeof body.word === 'string' ? body.word.trim().slice(0, 80) : ''
  if (!word) return NextResponse.json({ error: 'Missing word.' }, { status: 400 })
  const sentence = typeof body.sentence === 'string' ? body.sentence.slice(0, 400) : ''
  const lesson = {
    word,
    sentence,
    bookId: recordId(body.bookId),
    unitId: recordId(body.unitId),
    lessonId: recordId(body.lessonId),
    partId: recordId(body.partId),
  }
  if (body.meaningOnly === true) {
    const gloss = await glossForVaultWord(lesson)
    return NextResponse.json({ gloss })
  }
  const result = await findAndStoreAutoPicture({
    studentId,
    cardId,
    forceSearch: body.forceSearch === true,
    ...lesson,
  })
  return NextResponse.json(result)
}
