import { describe, expect, it } from 'vitest'
import { preserveUnitContextResearchFields } from '@/lib/context/framework-apply'
import type { UnitContextRecord } from '@/lib/context/types'

function unitRecord(overrides: Partial<UnitContextRecord> = {}): UnitContextRecord {
  const now = new Date().toISOString()
  return {
    id: 'unit-record',
    kind: 'unit',
    bookId: 'book-1',
    unitId: 'unit-1',
    unitTitle: 'Unit 1',
    theme: 'Community',
    bigIdeas: ['Students explore belonging.'],
    crossCurricularLinks: ['social studies'],
    targetLanguageDomains: ['vocabulary'],
    sourcePageRange: { startPage: 10, endPage: 20 },
    scanProfile: 'balanced',
    contextVersion: 'v1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('preserveUnitContextResearchFields', () => {
  it('keeps existing big ideas and cross-curricular links when apply produces empty lists', () => {
    const existing = unitRecord()
    const next = unitRecord({
      theme: 'Community',
      bigIdeas: [],
      crossCurricularLinks: [],
      targetLanguageDomains: ['grammar', 'writing'],
    })

    expect(preserveUnitContextResearchFields(next, existing)).toEqual({
      ...next,
      bigIdeas: existing.bigIdeas,
      crossCurricularLinks: existing.crossCurricularLinks,
    })
  })

  it('keeps framework-provided research when notes mapped real unit labels', () => {
    const existing = unitRecord()
    const next = unitRecord({
      bigIdeas: ['New big idea from notes'],
      crossCurricularLinks: ['science'],
    })

    expect(preserveUnitContextResearchFields(next, existing)).toEqual(next)
  })

  it('does not invent research when no existing unit exists', () => {
    const next = unitRecord({ bigIdeas: [], crossCurricularLinks: [] })
    expect(preserveUnitContextResearchFields(next, null)).toBe(next)
  })
})
