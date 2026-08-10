import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  readBoardImageInsertMode,
  readFlashcardSaveToVocab,
  writeBoardImageInsertMode,
  writeFlashcardSaveToVocab,
  BOARD_IMAGE_INSERT_MODE_STORAGE_KEY,
  FLASHCARD_SAVE_TO_VOCAB_STORAGE_KEY,
} from '@/lib/lesson-board/board-image-insert'

describe('flashcard save-to-vocab preference', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults save-to-vocab to off', () => {
    expect(readFlashcardSaveToVocab()).toBe(false)
  })

  it('persists save-to-vocab preference in sessionStorage', () => {
    writeFlashcardSaveToVocab(true)
    expect(sessionStorage.getItem(FLASHCARD_SAVE_TO_VOCAB_STORAGE_KEY)).toBe('1')
    expect(readFlashcardSaveToVocab()).toBe(true)
    writeFlashcardSaveToVocab(false)
    expect(readFlashcardSaveToVocab()).toBe(false)
  })
})

describe('flashcard default on image pick', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults insert mode to picture', () => {
    expect(readBoardImageInsertMode()).toBe('picture')
  })

  it('persists flashcard as default insert mode', () => {
    writeBoardImageInsertMode('flashcard')
    expect(sessionStorage.getItem(BOARD_IMAGE_INSERT_MODE_STORAGE_KEY)).toBe('flashcard')
    expect(readBoardImageInsertMode()).toBe('flashcard')
    writeBoardImageInsertMode('picture')
    expect(readBoardImageInsertMode()).toBe('picture')
  })
})
