import { describe, expect, it } from 'vitest'
import { prepSectionIdToPersist } from '@/lib/students/prep-section-save'

describe('prepSectionIdToPersist', () => {
  const optionIds = ['part-vocab', 'part-story']

  it('does not clear the lesson when the book list is not ready', () => {
    expect(
      prepSectionIdToPersist({
        booksReady: false,
        pickerSectionId: 'part-story',
        optionIds: [],
      }),
    ).toBeUndefined()
    expect(
      prepSectionIdToPersist({
        booksReady: false,
        pickerSectionId: undefined,
        optionIds: [],
      }),
    ).toBeUndefined()
  })

  it('keeps a saved lesson whose id is not in the current list', () => {
    expect(
      prepSectionIdToPersist({
        booksReady: true,
        pickerSectionId: 'part-story',
        optionIds: [],
      }),
    ).toBeUndefined()
  })

  it('stores a lesson that is in the list', () => {
    expect(
      prepSectionIdToPersist({
        booksReady: true,
        pickerSectionId: 'part-story',
        optionIds,
      }),
    ).toBe('part-story')
  })

  it('clears the lesson when the teacher emptied the picker', () => {
    expect(
      prepSectionIdToPersist({
        booksReady: true,
        pickerSectionId: '',
        optionIds,
      }),
    ).toBeNull()
  })

  it('leaves the lesson alone before the picker is filled in', () => {
    expect(
      prepSectionIdToPersist({
        booksReady: true,
        pickerSectionId: undefined,
        optionIds,
      }),
    ).toBeUndefined()
  })
})
