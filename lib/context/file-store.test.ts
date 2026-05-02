import { describe, expect, it } from 'vitest'
import { FileContextStore } from '@/lib/context/file-store'
import type { LessonContextRecord, UnitContextRecord } from '@/lib/context/types'

function unitRecord(id: string): UnitContextRecord {
  const now = new Date().toISOString()
  return {
    id,
    kind: 'unit',
    bookId: 'book-1',
    unitId: 'unit-1',
    theme: 'community',
    bigIdeas: ['people help each other'],
    crossCurricularLinks: ['social studies'],
    targetLanguageDomains: ['vocabulary'],
    sourcePageRange: { startPage: 1, endPage: 3 },
    scanProfile: 'balanced',
    contextVersion: 'v1',
    createdAt: now,
    updatedAt: now,
  }
}

function lessonRecord(id: string): LessonContextRecord {
  const now = new Date().toISOString()
  return {
    id,
    kind: 'lesson',
    bookId: 'book-1',
    unitId: 'unit-1',
    lessonId: 'lesson-1',
    textType: 'story',
    lessonGoals: ['identify characters'],
    comprehensionSkill: 'story structure',
    strategy: 'compare and contrast',
    essentialQuestions: ['What are parts of a story?'],
    languageFocus: { grammarNotes: [], writingNotes: [] },
    sourcePageRange: { startPage: 4, endPage: 8 },
    scanProfile: 'balanced',
    contextVersion: 'v1',
    createdAt: now,
    updatedAt: now,
  }
}

describe('FileContextStore', () => {
  it('saves and retrieves unit/lesson contexts', async () => {
    const store = new FileContextStore()
    const suffix = Date.now().toString()
    const unit = unitRecord(`unit-${suffix}`)
    const lesson = lessonRecord(`lesson-${suffix}`)
    await store.saveUnitContext(unit)
    await store.saveLessonContext(lesson)

    const readUnit = await store.getUnitContext(unit.bookId, unit.unitId)
    expect(readUnit?.id).toBe(unit.id)

    const readLesson = await store.getLessonContext(lesson.bookId, lesson.unitId, lesson.lessonId)
    expect(readLesson?.id).toBe(lesson.id)

    const list = await store.listContextsForUnit('book-1', 'unit-1')
    expect(list.unit).not.toBeNull()
    expect(list.lessons.length).toBeGreaterThan(0)
  })
})
