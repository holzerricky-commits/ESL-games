export type BoardImageInsertMode = 'picture' | 'flashcard'

export const BOARD_IMAGE_INSERT_MODE_STORAGE_KEY = 'lesson-board:image-insert-mode-v1'

export type BoardImageInsertRequest = {
  fullUrl: string
  word: string
  mode: BoardImageInsertMode
  /** Optional disambiguation for search + translate (e.g. "river water", "insect"). */
  contextHint?: string
  /** When set, flashcard insert skips translate (user picked a meaning). */
  chineseLine?: string
  /** Flashcard footer: include pinyin in parentheses when true. */
  showPinyin?: boolean
  /** Source media for toast copy (GIFs save as a still frame on the board). */
  mediaType?: 'static' | 'gif'
  /** When true (flashcard only), also write to the translate-dock saved-words notebook. */
  saveToVocab?: boolean
  /** Structured Chinese for vocab save (preferred over parsing chineseLine). */
  vocabChinese?: string
  vocabPinyin?: string
}

export const FLASHCARD_SAVE_TO_VOCAB_STORAGE_KEY = 'lesson-board:flashcard-save-to-vocab-v1'

export function readFlashcardSaveToVocab(): boolean {
  try {
    return globalThis.sessionStorage?.getItem(FLASHCARD_SAVE_TO_VOCAB_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeFlashcardSaveToVocab(save: boolean): void {
  try {
    globalThis.sessionStorage?.setItem(FLASHCARD_SAVE_TO_VOCAB_STORAGE_KEY, save ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export const FLASHCARD_SHOW_PINYIN_STORAGE_KEY = 'lesson-board:flashcard-show-pinyin-v1'

export function readFlashcardShowPinyin(): boolean {
  try {
    const stored = globalThis.sessionStorage?.getItem(FLASHCARD_SHOW_PINYIN_STORAGE_KEY)
    if (stored === '0') return false
    return true
  } catch {
    return true
  }
}

export function writeFlashcardShowPinyin(show: boolean): void {
  try {
    globalThis.sessionStorage?.setItem(FLASHCARD_SHOW_PINYIN_STORAGE_KEY, show ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** Default for the "Make flashcard" checkbox on the image pick confirm step. */
export function readBoardImageInsertMode(): BoardImageInsertMode {
  try {
    const stored = globalThis.sessionStorage?.getItem(BOARD_IMAGE_INSERT_MODE_STORAGE_KEY)
    return stored === 'flashcard' ? 'flashcard' : 'picture'
  } catch {
    return 'picture'
  }
}

/** Persists whether the next image pick should default to flashcard. */
export function writeBoardImageInsertMode(mode: BoardImageInsertMode): void {
  try {
    globalThis.sessionStorage?.setItem(BOARD_IMAGE_INSERT_MODE_STORAGE_KEY, mode)
  } catch {
    /* ignore quota / private mode */
  }
}
