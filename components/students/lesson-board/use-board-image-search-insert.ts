'use client'

import { useCallback, type MutableRefObject } from 'react'
import { toast } from 'sonner'
import type { BookPageAnnotationHandle } from '@/components/students/book-page-annotation-layer'
import { useSavedWords } from '@/components/students/fullscreen-book-overlay/hooks/useSavedWords'
import type { BoardImageInsertRequest } from '@/lib/lesson-board/board-image-insert'
import {
  fetchFlashcardTranslation,
  formatFlashcardChineseLine,
  parseFlashcardChineseLineParts,
} from '@/lib/lesson-board/flashcard-translate-client'
import { FLASHCARD_PLACEHOLDER_ZH } from '@/lib/lesson-board/lesson-board-flashcard-layout'

/**
 * Inserts a searched picture or flashcard onto the lesson board (via whiteboard annotation handle).
 */
export function useBoardImageSearchInsert(args: {
  studentId: string
  wbAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
}) {
  const { studentId, wbAnnRef } = args
  const { saveWord } = useSavedWords({
    studentId,
    onPersistenceError: (message) => toast.error(message),
  })

  return useCallback(
    async (request: BoardImageInsertRequest) => {
      const word = request.word.trim()
      const showPinyin = request.showPinyin !== false
      const isGif = request.mediaType === 'gif'
      let ok = false
      let savedToVocab = false
      if (request.mode === 'flashcard') {
        if (!word) {
          toast.error('Type a word to search before adding a flashcard.')
          return false
        }
        let chineseLine = request.chineseLine?.trim()
        let vocabChinese = request.vocabChinese?.trim()
        let vocabPinyin = request.vocabPinyin?.trim() ?? ''
        if (!chineseLine) {
          const translation = await fetchFlashcardTranslation(word, request.contextHint)
          if (translation) {
            vocabChinese = translation.chinese
            vocabPinyin = translation.pinyin
            chineseLine = formatFlashcardChineseLine(translation, { showPinyin })
          } else {
            chineseLine = FLASHCARD_PLACEHOLDER_ZH
          }
        }
        ok =
          (await wbAnnRef.current?.insertFlashcardFromSearchUrl?.(
            request.fullUrl,
            word,
            chineseLine,
          )) ?? false
        if (ok) {
          if (request.saveToVocab && chineseLine !== FLASHCARD_PLACEHOLDER_ZH) {
            const parsed = parseFlashcardChineseLineParts(chineseLine)
            const chinese = vocabChinese || parsed?.chinese
            if (chinese) {
              saveWord({
                source: word,
                chinese,
                pinyin: vocabPinyin || parsed?.pinyin || '',
                imageUrl: request.fullUrl,
              })
              savedToVocab = true
            }
          }
          if (chineseLine !== FLASHCARD_PLACEHOLDER_ZH) {
            const base = isGif ? 'Flashcard added (GIF)' : 'Flashcard added'
            toast.success(savedToVocab ? `${base} · saved to your word list` : base)
          } else {
            toast.warning('Flashcard added — could not translate; edit Chinese on the board.')
          }
        } else {
          toast.error(
            wbAnnRef.current
              ? 'Could not add flashcard — try another image.'
              : 'Open the lesson board first, then add again.',
          )
        }
      } else {
        ok =
          (await wbAnnRef.current?.insertImageFromSearchUrl?.(request.fullUrl, word || undefined)) ??
          false
        if (ok) {
          toast.success(isGif ? 'GIF added' : 'Picture added')
        } else {
          toast.error(
            wbAnnRef.current
              ? 'Could not add picture — try another image.'
              : 'Open the lesson board first, then add again.',
          )
        }
      }
      return ok
    },
    [saveWord, wbAnnRef],
  )
}
