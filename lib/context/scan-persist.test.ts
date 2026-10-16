import { describe, expect, it } from 'vitest'
import {
  lessonScanHasUsableModelFields,
  resolveScannedContextSave,
  unitScanHasUsableModelFields,
} from '@/lib/context/scan-persist'
import type { LessonContextRecord, UnitContextRecord } from '@/lib/context/types'

function unit(overrides?: Partial<UnitContextRecord>): UnitContextRecord {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    id: 'unit-1',
    kind: 'unit',
    bookId: 'book-1',
    unitId: 'unit-1',
    theme: 'People and Communities',
    bigIdeas: ['citizenship'],
    crossCurricularLinks: ['social studies'],
    targetLanguageDomains: ['vocabulary in context'],
    sourcePageRange: { startPage: 1, endPage: 12 },
    scanProfile: 'balanced',
    contextVersion: 'v1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function lesson(overrides?: Partial<LessonContextRecord>): LessonContextRecord {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    id: 'lesson-1',
    kind: 'lesson',
    bookId: 'book-1',
    unitId: 'unit-1',
    lessonId: 'lesson-1',
    textType: 'realistic fiction',
    lessonGoals: ['describe characters'],
    comprehensionSkill: 'story structure',
    strategy: 'compare and contrast',
    essentialQuestions: ['What makes a community strong?'],
    languageFocus: { grammarNotes: ['subjects'], writingNotes: [] },
    sourcePageRange: { startPage: 4, endPage: 10 },
    scanProfile: 'balanced',
    contextVersion: 'v1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('resolveScannedContextSave', () => {
  it('rejects fallback scans so existing unit research is not replaced', () => {
    const existing = unit()
    const fallback = unit({
      theme: 'Unit theme',
      bigIdeas: ['Students connect reading to community themes.'],
      createdAt: '2026-08-25T11:00:00.000Z',
      updatedAt: '2026-08-25T11:00:00.000Z',
    })
    const decision = resolveScannedContextSave({ source: 'fallback', record: fallback }, existing)
    expect(decision).toEqual({ action: 'reject' })
  })

  it('rejects fallback scans even when nothing is saved yet', () => {
    const fallback = unit({ theme: 'Unit theme' })
    const decision = resolveScannedContextSave({ source: 'fallback', record: fallback }, null)
    expect(decision).toEqual({ action: 'reject' })
  })

  it('saves model scans and keeps the original createdAt', () => {
    const existing = unit({ createdAt: '2026-04-01T00:00:00.000Z' })
    const scanned = unit({
      theme: 'A New Theme',
      createdAt: '2026-08-25T11:00:00.000Z',
      updatedAt: '2026-08-25T11:00:00.000Z',
    })
    const decision = resolveScannedContextSave({ source: 'model', record: scanned }, existing)
    expect(decision.action).toBe('save')
    if (decision.action !== 'save') return
    expect(decision.record.theme).toBe('A New Theme')
    expect(decision.record.createdAt).toBe('2026-04-01T00:00:00.000Z')
    expect(decision.record.updatedAt).toBe('2026-08-25T11:00:00.000Z')
  })

  it('saves first-time model scans as-is', () => {
    const scanned = lesson({ comprehensionSkill: 'cause and effect' })
    const decision = resolveScannedContextSave({ source: 'model', record: scanned }, null)
    expect(decision).toEqual({ action: 'save', record: scanned })
  })
})

describe('usable model field checks', () => {
  it('treats empty unit JSON as unusable', () => {
    expect(unitScanHasUsableModelFields({})).toBe(false)
  })

  it('treats a unit theme as usable', () => {
    expect(unitScanHasUsableModelFields({ theme: 'Community' })).toBe(true)
  })

  it('treats empty lesson JSON as unusable', () => {
    expect(lessonScanHasUsableModelFields({})).toBe(false)
  })

  it('treats lesson goals as usable', () => {
    expect(lessonScanHasUsableModelFields({ lessonGoals: ['identify setting'] })).toBe(true)
  })
})
