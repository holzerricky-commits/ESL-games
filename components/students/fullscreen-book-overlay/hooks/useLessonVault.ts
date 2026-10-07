'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { resolveLessonAndPartAtPdfPage } from '@/lib/books/interactive-vocab'
import type { BookLibraryPayload, BookLessonRecord } from '@/lib/books/types'
import {
  EMPTY_LESSON_VAULT_CARDS,
  getLessonVaultCardsForStudent,
  hydrateLessonVaultFromDisk,
  isLessonVaultHydrated,
  saveLessonVaultCard,
  subscribeLessonVault,
} from '@/lib/lesson-vault/disk-client'
import { cardsForLesson, type LessonVaultCard } from '@/lib/lesson-vault/types'

type SelectedBook = BookLibraryPayload['books'][number]
type SelectedUnit = SelectedBook['units'][number]

interface UseLessonVaultArgs {
  studentId: string
  selectedBook: SelectedBook | null
  selectedUnit: SelectedUnit | null
  pageNumber: number
  numPages: number | null
  /** Vault drawer is showing. */
  open: boolean
}

export function useLessonVault({ studentId, selectedBook, selectedUnit, pageNumber, numPages, open }: UseLessonVaultArgs) {
  useEffect(() => {
    void hydrateLessonVaultFromDisk()
  }, [])

  const studentCards = useSyncExternalStore(
    subscribeLessonVault,
    () => getLessonVaultCardsForStudent(studentId),
    () => EMPTY_LESSON_VAULT_CARDS,
  )

  const lessons: BookLessonRecord[] = useMemo(() => selectedUnit?.lessons ?? [], [selectedUnit])

  const pageLesson = useMemo(() => {
    if (!selectedBook || !selectedUnit) return null
    return resolveLessonAndPartAtPdfPage(selectedBook, selectedUnit, null, pageNumber, numPages)?.lesson ?? null
  }, [selectedBook, selectedUnit, pageNumber, numPages])

  const lessonCards = useCallback(
    (lessonId: string | null | undefined): LessonVaultCard[] => {
      if (!selectedBook || !selectedUnit || !lessonId) return EMPTY_LESSON_VAULT_CARDS
      return cardsForLesson(studentCards, { bookId: selectedBook.id, unitId: selectedUnit.id, lessonId })
    },
    [studentCards, selectedBook, selectedUnit],
  )

  const [viewedLessonId, setViewedLessonId] = useState<string | null>(null)

  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (open && !wasOpenRef.current) setViewedLessonId(pageLesson?.id ?? null)
    wasOpenRef.current = open
  }, [open, pageLesson?.id])

  useEffect(() => {
    setViewedLessonId(null)
  }, [selectedBook?.id, selectedUnit?.id])

  const viewedLesson = useMemo(
    () => (viewedLessonId ? (lessons.find((l) => l.id === viewedLessonId) ?? null) : null),
    [lessons, viewedLessonId],
  )

  const viewedIndex = viewedLesson ? lessons.findIndex((l) => l.id === viewedLesson.id) : -1

  const showPreviousLesson = useCallback(() => {
    if (viewedIndex > 0) setViewedLessonId(lessons[viewedIndex - 1]!.id)
  }, [lessons, viewedIndex])

  const showNextLesson = useCallback(() => {
    if (viewedIndex >= 0 && viewedIndex < lessons.length - 1) setViewedLessonId(lessons[viewedIndex + 1]!.id)
  }, [lessons, viewedIndex])

  const showPageLesson = useCallback(() => {
    if (pageLesson) setViewedLessonId(pageLesson.id)
  }, [pageLesson])

  const saveFromPage = useCallback(
    (input: { pdfPage: number; word: string; sentence: string }) => {
      if (!studentId.trim()) {
        toast.error('Open a student session to save words.')
        return
      }
      if (!selectedBook || !selectedUnit) return
      if (!isLessonVaultHydrated()) {
        toast.error('The vault is still loading. Try again in a moment.')
        return
      }
      const hit = resolveLessonAndPartAtPdfPage(selectedBook, selectedUnit, null, input.pdfPage, numPages)
      if (!hit) {
        toast.error('This page is not part of a lesson yet. Outline the book to use the vault.')
        return
      }
      const result = saveLessonVaultCard(
        studentId,
        {
          bookId: selectedBook.id,
          unitId: selectedUnit.id,
          lessonId: hit.lesson.id,
          lessonTitle: hit.lesson.title,
          partId: hit.part.id,
          partTitle: hit.part.title,
          word: input.word,
          sentence: input.sentence,
          pdfPage: input.pdfPage,
        },
        (message) => toast.error(message),
      )
      if (!result) return
      if (open) setViewedLessonId(hit.lesson.id)
      toast.success(
        result.mode === 'updated'
          ? `“${result.card.word}” is already in the vault — sentence updated.`
          : `“${result.card.word}” saved to the ${hit.lesson.title} vault.`,
      )
    },
    [studentId, selectedBook, selectedUnit, numPages, open],
  )

  return {
    pageLesson,
    pageLessonCount: lessonCards(pageLesson?.id).length,
    viewedLesson,
    viewedCards: lessonCards(viewedLesson?.id),
    hasPreviousLesson: viewedIndex > 0,
    hasNextLesson: viewedIndex >= 0 && viewedIndex < lessons.length - 1,
    showPreviousLesson,
    showNextLesson,
    showPageLesson,
    saveFromPage,
  }
}
