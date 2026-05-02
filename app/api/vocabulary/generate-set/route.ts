import { NextResponse } from 'next/server'
import { getVocabularyStore } from '@/lib/vocabulary/file-store'
import { generateVocabularySet } from '@/lib/vocabulary/generate-from-pages'
import type { VocabularySourceContext } from '@/lib/vocabulary/types'

const REQUEST_COOLDOWN_MS = 1500
const requestCooldown = new Map<string, number>()

function getClientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  return forwarded.split(',')[0]?.trim() || 'local'
}

function parseContext(body: unknown): VocabularySourceContext | null {
  const src = body as Partial<VocabularySourceContext> | undefined
  const startPage = Number(src?.pageRange?.startPage)
  const endPage = Number(src?.pageRange?.endPage)
  if (!src) return null
  if (
    typeof src.studentId !== 'string' ||
    typeof src.classId !== 'string' ||
    typeof src.classTitle !== 'string' ||
    typeof src.bookId !== 'string' ||
    typeof src.unitId !== 'string'
  ) {
    return null
  }
  if (!Number.isFinite(startPage) || !Number.isFinite(endPage)) return null
  return {
    studentId: src.studentId.trim(),
    classId: src.classId.trim(),
    classTitle: src.classTitle.trim(),
    bookId: src.bookId.trim(),
    unitId: src.unitId.trim(),
    sectionId: typeof src.sectionId === 'string' ? src.sectionId.trim() : undefined,
    sectionTitle: typeof src.sectionTitle === 'string' ? src.sectionTitle.trim() : undefined,
    pageRange: {
      startPage: Math.max(1, Math.floor(startPage)),
      endPage: Math.max(1, Math.floor(endPage)),
    },
  }
}

export async function POST(req: Request) {
  try {
    const now = Date.now()
    const key = getClientKey(req)
    const last = requestCooldown.get(key) ?? 0
    if (now - last < REQUEST_COOLDOWN_MS) {
      return NextResponse.json({ ok: false, error: 'Please wait a moment before generating again.' }, { status: 429 })
    }
    requestCooldown.set(key, now)

    const body = await req.json()
    const context = parseContext(body?.context)
    if (!context) {
      return NextResponse.json({ ok: false, error: 'Invalid generation context.' }, { status: 400 })
    }
    const requestedCount = Number(body?.requestedCount ?? 12)
    const seedWords = Array.isArray(body?.seedWords) ? body.seedWords.map(String) : []
    const unitContext =
      body?.unitContext && typeof body.unitContext === 'object'
        ? {
            theme: typeof body.unitContext.theme === 'string' ? body.unitContext.theme : undefined,
            bigIdeas: Array.isArray(body.unitContext.bigIdeas) ? body.unitContext.bigIdeas.map(String) : undefined,
            targetLanguageDomains: Array.isArray(body.unitContext.targetLanguageDomains)
              ? body.unitContext.targetLanguageDomains.map(String)
              : undefined,
          }
        : undefined
    const lessonContext =
      body?.lessonContext && typeof body.lessonContext === 'object'
        ? {
            textType: typeof body.lessonContext.textType === 'string' ? body.lessonContext.textType : undefined,
            comprehensionSkill:
              typeof body.lessonContext.comprehensionSkill === 'string'
                ? body.lessonContext.comprehensionSkill
                : undefined,
            strategy: typeof body.lessonContext.strategy === 'string' ? body.lessonContext.strategy : undefined,
            essentialQuestions: Array.isArray(body.lessonContext.essentialQuestions)
              ? body.lessonContext.essentialQuestions.map(String)
              : undefined,
          }
        : undefined
    const outcomeContext =
      body?.outcomeContext && typeof body.outcomeContext === 'object'
        ? {
            introducedWords: Array.isArray(body.outcomeContext.introducedWords)
              ? body.outcomeContext.introducedWords.map(String)
              : undefined,
            practicedWords: Array.isArray(body.outcomeContext.practicedWords)
              ? body.outcomeContext.practicedWords.map(String)
              : undefined,
            reviewedWords: Array.isArray(body.outcomeContext.reviewedWords)
              ? body.outcomeContext.reviewedWords.map(String)
              : undefined,
            learnedWords: Array.isArray(body.outcomeContext.learnedWords)
              ? body.outcomeContext.learnedWords.map(String)
              : undefined,
            dueReviewWords: Array.isArray(body.outcomeContext.dueReviewWords)
              ? body.outcomeContext.dueReviewWords.map(String)
              : undefined,
          }
        : undefined
    const feedbackContext =
      body?.feedbackContext && typeof body.feedbackContext === 'object'
        ? {
            tooEasyCount: Number.isFinite(Number(body.feedbackContext.tooEasyCount))
              ? Number(body.feedbackContext.tooEasyCount)
              : undefined,
            offThemeCount: Number.isFinite(Number(body.feedbackContext.offThemeCount))
              ? Number(body.feedbackContext.offThemeCount)
              : undefined,
            wrongSkillSupportCount: Number.isFinite(Number(body.feedbackContext.wrongSkillSupportCount))
              ? Number(body.feedbackContext.wrongSkillSupportCount)
              : undefined,
            editedMeaningCount: Number.isFinite(Number(body.feedbackContext.editedMeaningCount))
              ? Number(body.feedbackContext.editedMeaningCount)
              : undefined,
            recentlyRemovedWords: Array.isArray(body.feedbackContext.recentlyRemovedWords)
              ? body.feedbackContext.recentlyRemovedWords.map(String)
              : undefined,
          }
        : undefined

    const store = getVocabularyStore()
    const generated = await generateVocabularySet({
      context,
      requestedCount,
      seedWords,
      unitContext,
      lessonContext,
      outcomeContext,
      feedbackContext,
    })
    const saved = await store.saveDraftSet(generated)
    return NextResponse.json({ ok: true, set: saved })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to generate vocabulary set.' }, { status: 500 })
  }
}
