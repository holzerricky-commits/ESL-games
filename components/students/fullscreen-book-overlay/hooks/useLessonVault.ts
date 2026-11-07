'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { isVocabPartShelfTag } from '@/lib/books/book-part-shelf'
import { resolveLessonAndPartAtPdfPage } from '@/lib/books/interactive-vocab'
import { lessonRefsForTeachingWeek } from '@/lib/books/lesson-peer'
import { effectivePartStructureTag } from '@/lib/books/part-structure-tag'
import type { BookLibraryPayload, BookLessonRecord, BookLessonPartRecord } from '@/lib/books/types'
import type { PartContextVocabularyWord } from '@/lib/context/types'
import {
  deleteLessonVaultCard,
  EMPTY_LESSON_VAULT_CARDS,
  getLessonVaultCardsForStudent,
  hydrateLessonVaultFromDisk,
  isLessonVaultHydrated,
  moveLessonVaultCard,
  saveLessonVaultCard,
  saveLessonVaultReviewStatuses,
  seedLessonVaultFromInteractiveVocab,
  undoDeleteLessonVaultCard,
  setLessonVaultCardPicture,
  subscribeLessonVault,
  updateLessonVaultCard,
} from '@/lib/lesson-vault/disk-client'
import type { SeedInteractiveVocabPart } from '@/lib/lesson-vault/seed-from-interactive-vocab'
import {
  deleteLessonVaultPicture,
  storeRemotePictureForCard,
  uploadLessonVaultPicture,
} from '@/lib/lesson-vault/picture-client'
import { isLocalVaultPictureUrl } from '@/lib/lesson-vault/picture-paths'
import {
  cardsForLessons,
  cardsMissingPicture,
  type LessonVaultCard,
  type LessonVaultCardTextPatch,
  type LessonVaultReviewStatus,
} from '@/lib/lesson-vault/types'
import {
  cardsForStory,
  showStoryScopeChips,
  storyScopes,
  type StoryScope,
} from '@/lib/lesson-vault/story-scope'
import { dictionaryForm } from '@/lib/lesson-vault/dictionary-form'
import { requestVaultFlyIn } from '@/lib/lesson-vault/vault-drag'
import { useVaultAutoPictures } from './useVaultAutoPictures'
import { useVaultChinese } from './useVaultChinese'

const UNDO_DELETE_MS = 6000

type SelectedBook = BookLibraryPayload['books'][number]
type SelectedUnit = SelectedBook['units'][number]

function partPdfPageHint(part: BookLessonPartRecord): number {
  const hint = part.startPageHint ?? part.pdfPageRange?.start
  return hint != null && Number.isFinite(hint) && hint > 0 ? Math.floor(hint) : 1
}

async function fetchInteractiveVocabPartsForLesson(
  bookId: string,
  unitId: string,
  lesson: BookLessonRecord,
): Promise<SeedInteractiveVocabPart[]> {
  const vocabParts = (lesson.parts ?? []).filter((part) =>
    isVocabPartShelfTag(effectivePartStructureTag(part)),
  )
  if (vocabParts.length === 0) return []

  const settled = await Promise.all(
    vocabParts.map(async (part): Promise<SeedInteractiveVocabPart> => {
      const qs = new URLSearchParams({
        bookId,
        unitId,
        lessonId: lesson.id,
        partId: part.id,
      })
      try {
        const res = await fetch(`/api/context/get?${qs.toString()}`, { cache: 'no-store' })
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; context?: { interactiveVocabulary?: PartContextVocabularyWord[] } | null }
          | null
        const words =
          data?.ok && Array.isArray(data.context?.interactiveVocabulary)
            ? data.context.interactiveVocabulary
            : []
        return {
          partId: part.id,
          partTitle: part.title,
          pdfPage: partPdfPageHint(part),
          words,
        }
      } catch {
        return { partId: part.id, partTitle: part.title, pdfPage: partPdfPageHint(part), words: [] }
      }
    }),
  )
  return settled.filter((part) => part.words.length > 0)
}

interface UseLessonVaultArgs {
  studentId: string
  library: BookLibraryPayload | null
  selectedBook: SelectedBook | null
  selectedUnit: SelectedUnit | null
  pageNumber: number
  numPages: number | null
  /** Vault drawer is showing. */
  open: boolean
  /** Picture chosen for this word earlier in the session (picture search), if any. */
  getRecentPictureFor?: (word: string) => string | null
}

export function useLessonVault({
  studentId,
  library,
  selectedBook,
  selectedUnit,
  pageNumber,
  numPages,
  open,
  getRecentPictureFor,
}: UseLessonVaultArgs) {
  useEffect(() => {
    void hydrateLessonVaultFromDisk()
  }, [])

  const studentCards = useSyncExternalStore(
    subscribeLessonVault,
    () => getLessonVaultCardsForStudent(studentId),
    () => EMPTY_LESSON_VAULT_CARDS,
  )

  const { findingIds, queueAutoPictures, queueAutoMeanings, chooseAutoPicture } = useVaultAutoPictures()
  const { queueAutoChinese } = useVaultChinese()

  const interactiveVocabSeedKeyRef = useRef<string | null>(null)
  const interactiveVocabSeedingKeyRef = useRef<string | null>(null)

  const lessons: BookLessonRecord[] = useMemo(() => selectedUnit?.lessons ?? [], [selectedUnit])

  const pageHit = useMemo(() => {
    if (!selectedBook || !selectedUnit) return null
    return resolveLessonAndPartAtPdfPage(selectedBook, selectedUnit, null, pageNumber, numPages)
  }, [selectedBook, selectedUnit, pageNumber, numPages])
  const pageLesson = pageHit?.lesson ?? null
  const pagePartId = pageHit?.part.id ?? null

  const libraryBooks = library?.books
  const lessonCards = useCallback(
    (lessonId: string | null | undefined): LessonVaultCard[] => {
      if (!selectedBook || !selectedUnit || !lessonId) return EMPTY_LESSON_VAULT_CARDS
      const refs = lessonRefsForTeachingWeek(libraryBooks ?? [], selectedBook, selectedUnit, lessonId)
      return cardsForLessons(studentCards, refs)
    },
    [studentCards, libraryBooks, selectedBook, selectedUnit],
  )

  const [viewedLessonId, setViewedLessonId] = useState<string | null>(null)
  /** null = All stories in the lesson. */
  const [viewedPartId, setViewedPartId] = useState<string | null>(null)

  const wasOpenRef = useRef(false)
  const keepViewOnReopenRef = useRef(false)
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      if (keepViewOnReopenRef.current) keepViewOnReopenRef.current = false
      else {
        const lessonId = pageLesson?.id ?? null
        setViewedLessonId(lessonId)
        // Show all story sections; the panel expands the page's part by default.
        setViewedPartId(null)
      }
    }
    wasOpenRef.current = open
  }, [open, pageLesson, pagePartId, lessonCards])

  /** Next open keeps the lesson that was showing (e.g. returning from picture search). */
  const keepViewOnReopen = useCallback((keep: boolean = true) => {
    keepViewOnReopenRef.current = keep
  }, [])

  useEffect(() => {
    setViewedLessonId(null)
    setViewedPartId(null)
  }, [selectedBook?.id, selectedUnit?.id])

  const viewedLesson = useMemo(
    () => (viewedLessonId ? (lessons.find((l) => l.id === viewedLessonId) ?? null) : null),
    [lessons, viewedLessonId],
  )

  /** Prefill vault from book Vocabulary-part interactiveVocabulary once per student/lesson. */
  useEffect(() => {
    const sid = studentId.trim()
    if (!sid || !selectedBook || !selectedUnit) return
    const lesson = viewedLesson ?? pageLesson
    if (!lesson) return
    const key = `${sid}::${selectedBook.id}::${selectedUnit.id}::${lesson.id}`
    if (interactiveVocabSeedKeyRef.current === key) return
    if (interactiveVocabSeedingKeyRef.current === key) return

    let cancelled = false
    interactiveVocabSeedingKeyRef.current = key
    void (async () => {
      const ok = await hydrateLessonVaultFromDisk()
      if (cancelled || !ok) {
        if (interactiveVocabSeedingKeyRef.current === key) interactiveVocabSeedingKeyRef.current = null
        return
      }
      try {
        const parts = await fetchInteractiveVocabPartsForLesson(selectedBook.id, selectedUnit.id, lesson)
        if (cancelled) return
        const added = seedLessonVaultFromInteractiveVocab(
          sid,
          {
            bookId: selectedBook.id,
            unitId: selectedUnit.id,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            parts,
          },
          undefined,
        )
        if (cancelled) return
        if (interactiveVocabSeedingKeyRef.current === key) {
          interactiveVocabSeedKeyRef.current = key
          interactiveVocabSeedingKeyRef.current = null
        }
        if (added && added.length > 0) {
          queueAutoPictures(sid, added)
          queueAutoChinese(sid, added)
        }
      } catch {
        if (interactiveVocabSeedingKeyRef.current === key) interactiveVocabSeedingKeyRef.current = null
      }
    })()

    return () => {
      cancelled = true
      if (interactiveVocabSeedingKeyRef.current === key) interactiveVocabSeedingKeyRef.current = null
    }
  }, [
    studentId,
    selectedBook,
    selectedUnit,
    viewedLesson,
    pageLesson,
    open,
    queueAutoPictures,
    queueAutoChinese,
  ])

  const lessonAllCards = useMemo(
    () => lessonCards(viewedLesson?.id),
    [lessonCards, viewedLesson?.id],
  )

  const storyScopeList: StoryScope[] = useMemo(
    () => storyScopes(lessonAllCards, viewedLesson?.parts ?? []),
    [lessonAllCards, viewedLesson?.parts],
  )

  const showStoryChips = showStoryScopeChips(storyScopeList)

  useEffect(() => {
    if (viewedPartId == null) return
    if (!storyScopeList.some((scope) => scope.partId === viewedPartId)) setViewedPartId(null)
  }, [storyScopeList, viewedPartId])

  const viewedCards = useMemo(
    () => cardsForStory(lessonAllCards, showStoryChips ? viewedPartId : null),
    [lessonAllCards, showStoryChips, viewedPartId],
  )

  const viewedIndex = viewedLesson ? lessons.findIndex((l) => l.id === viewedLesson.id) : -1

  const showPreviousLesson = useCallback(() => {
    if (viewedIndex > 0) {
      setViewedLessonId(lessons[viewedIndex - 1]!.id)
      setViewedPartId(null)
    }
  }, [lessons, viewedIndex])

  const showNextLesson = useCallback(() => {
    if (viewedIndex >= 0 && viewedIndex < lessons.length - 1) {
      setViewedLessonId(lessons[viewedIndex + 1]!.id)
      setViewedPartId(null)
    }
  }, [lessons, viewedIndex])

  const showPageLesson = useCallback(() => {
    if (!pageLesson) return
    setViewedLessonId(pageLesson.id)
    setViewedPartId(null)
  }, [pageLesson])

  const setViewedStory = useCallback((partId: string | null) => {
    setViewedPartId(partId)
  }, [])

  const saveFromPage = useCallback(
    (input: { pdfPage: number; word: string; sentence: string; from?: { x: number; y: number } }) => {
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
          imageUrl:
            getRecentPictureFor?.(dictionaryForm(input.word, input.sentence)) ||
            getRecentPictureFor?.(input.word) ||
            '',
        },
        (message) => toast.error(message),
      )
      if (!result) return
      if (input.from) requestVaultFlyIn({ word: result.card.word, from: input.from })
      if (open) {
        setViewedLessonId(hit.lesson.id)
        setViewedPartId(hit.part.id)
      }
      const remoteUrl = result.card.imageUrl
      if (remoteUrl && !isLocalVaultPictureUrl(remoteUrl)) {
        const cardId = result.card.id
        void storeRemotePictureForCard(studentId, cardId, remoteUrl).then((localUrl) => {
          if (!localUrl) return
          const current = getLessonVaultCardsForStudent(studentId).find((c) => c.id === cardId)
          if (current?.imageUrl === remoteUrl) setLessonVaultCardPicture(studentId, cardId, localUrl, undefined, 'search')
        })
      }
      if (!result.card.imageUrl) queueAutoPictures(studentId, [result.card], { retry: result.mode === 'updated' })
      else if (!result.card.meaning.trim()) queueAutoMeanings(studentId, [result.card])
      if (!result.card.chinese.trim()) queueAutoChinese(studentId, [result.card])
      const withPicture = result.card.imageUrl ? ' with its picture' : ''
      toast.success(
        result.mode === 'updated'
          ? `“${result.card.word}” is already in the vault — sentence updated.`
          : `“${result.card.word}” saved to the ${hit.lesson.title} vault${withPicture}.`,
      )
    },
    [
      studentId,
      selectedBook,
      selectedUnit,
      numPages,
      open,
      getRecentPictureFor,
      queueAutoPictures,
      queueAutoMeanings,
      queueAutoChinese,
    ],
  )

  useEffect(() => {
    if (!open) return
    const sid = studentId.trim()
    const lessonId = viewedLesson?.id
    if (!sid || !lessonId) return
    const cards = lessonCards(lessonId)
    queueAutoMeanings(sid, cards)
    queueAutoChinese(sid, cards)
  }, [open, studentId, viewedLesson, studentCards, lessonCards, queueAutoMeanings, queueAutoChinese])

  /** Automatic search for this lesson's blank cards (also re-tries ones that found nothing). */
  const findMissingPictures = useCallback(
    (cards: readonly LessonVaultCard[]) => queueAutoPictures(studentId, cardsMissingPicture(cards), { retry: true }),
    [studentId, queueAutoPictures],
  )

  const retryAutoPicture = useCallback(
    (card: LessonVaultCard) => queueAutoPictures(studentId, [card], { retry: true }),
    [studentId, queueAutoPictures],
  )

  const chooseCardPicture = useCallback(
    (cardId: string, index: number) => chooseAutoPicture(studentId, cardId, index),
    [studentId, chooseAutoPicture],
  )

  const applyCardPicture = useCallback(
    (cardId: string, imageUrl: string, source: 'search' | 'own'): boolean => {
      const card = setLessonVaultCardPicture(studentId, cardId, imageUrl, (message) => toast.error(message), source)
      if (!card) toast.error('Could not add the picture to that card.')
      return card != null
    },
    [studentId],
  )

  /** Web pictures are downloaded into the card's file; the link is kept if that fails. */
  const setCardPicture = useCallback(
    async (cardId: string, imageUrl: string): Promise<boolean> => {
      if (!imageUrl.trim()) return false
      const stored = isLocalVaultPictureUrl(imageUrl)
        ? imageUrl
        : await storeRemotePictureForCard(studentId, cardId, imageUrl)
      return applyCardPicture(cardId, stored ?? imageUrl, 'search')
    },
    [studentId, applyCardPicture],
  )

  const setCardPictureFromFile = useCallback(
    async (cardId: string, file: Blob): Promise<boolean> => {
      if (!studentId.trim()) {
        toast.error('Open a student session to add pictures.')
        return false
      }
      try {
        const url = await uploadLessonVaultPicture(studentId, cardId, file)
        if (!url) {
          toast.error('Could not save the picture.')
          return false
        }
        const ok = applyCardPicture(cardId, url, 'own')
        if (ok) toast.success('Picture added to the card.')
        return ok
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save the picture.')
        return false
      }
    },
    [studentId, applyCardPicture],
  )

  const deleteCard = useCallback(
    (cardId: string): boolean => {
      const result = deleteLessonVaultCard(studentId, cardId, (message) => toast.error(message))
      if (!result) {
        toast.error('Could not delete that card.')
        return false
      }
      const { removed, index } = result
      toast(`“${removed.word}” removed from the vault.`, {
        duration: UNDO_DELETE_MS,
        action: {
          label: 'Undo',
          onClick: () => undoDeleteLessonVaultCard(studentId, removed, index, (message) => toast.error(message)),
        },
      })
      if (isLocalVaultPictureUrl(removed.imageUrl)) {
        window.setTimeout(() => {
          const back = getLessonVaultCardsForStudent(studentId).some((c) => c.id === removed.id)
          if (!back) void deleteLessonVaultPicture(studentId, removed.id)
        }, UNDO_DELETE_MS + 1000)
      }
      return true
    },
    [studentId],
  )

  const moveCard = useCallback(
    (cardId: string, lessonId: string): boolean => {
      const target = lessons.find((l) => l.id === lessonId)
      if (!target) return false
      const result = moveLessonVaultCard(
        studentId,
        cardId,
        { lessonId: target.id, lessonTitle: target.title },
        (message) => toast.error(message),
      )
      if (!result) {
        toast.error('Could not move that card.')
        return false
      }
      if (!result.ok) {
        toast.error(
          result.reason === 'duplicate'
            ? `${target.title} already has that word.`
            : 'Could not move that card.',
        )
        return false
      }
      toast.success(`“${result.card.word}” moved to ${target.title}.`)
      return true
    },
    [studentId, lessons],
  )

  const saveReviewStatuses = useCallback(
    (
      updates: readonly { cardId: string; status: LessonVaultReviewStatus }[],
      options?: { quiet?: boolean },
    ): boolean => {
      const ok = saveLessonVaultReviewStatuses(studentId, updates, (message) => toast.error(message))
      if (!ok) toast.error('Could not save this review.')
      else if (!options?.quiet) toast.success('Review saved.')
      return ok
    },
    [studentId],
  )

  const updateCardText = useCallback(
    (cardId: string, patch: LessonVaultCardTextPatch): boolean => {
      const card = updateLessonVaultCard(studentId, cardId, patch, (message) => toast.error(message))
      if (!card) toast.error('Could not update that card.')
      else if (!card.chinese.trim()) queueAutoChinese(studentId, [card])
      return card != null
    },
    [studentId, queueAutoChinese],
  )

  /** Generate or regenerate sentence and/or meaning for one vault card. */
  const generateCardText = useCallback(
    async (
      cardId: string,
      fields: 'sentence' | 'meaning' | 'both',
    ): Promise<LessonVaultCardTextPatch | null> => {
      const sid = studentId.trim()
      const card = getLessonVaultCardsForStudent(sid).find((c) => c.id === cardId)
      if (!sid || !card) {
        toast.error('Could not update that card.')
        return null
      }
      const needSentence = fields === 'sentence' || fields === 'both'
      const needMeaning = fields === 'meaning' || fields === 'both'
      const regenerate =
        (needSentence && Boolean(card.sentence.trim())) || (needMeaning && Boolean(card.meaning.trim()))
      try {
        const res = await fetch('/api/lesson-vault/generate-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: card.word,
            sentence: card.sentence,
            meaning: card.meaning,
            fields,
            regenerate,
          }),
        })
        const payload = (await res.json().catch(() => null)) as
          | { sentence?: string; meaning?: string; error?: string }
          | null
        if (!res.ok) {
          toast.error(payload?.error?.trim() || 'Could not generate text for that card.')
          return null
        }
        const nextSentence = needSentence ? (payload?.sentence ?? '').trim() : card.sentence
        const nextMeaning = needMeaning ? (payload?.meaning ?? '').trim() : card.meaning
        if (needSentence && !nextSentence) {
          toast.error('Could not write a sentence for that word.')
          return null
        }
        if (needMeaning && !nextMeaning) {
          toast.error('Could not write a meaning for that word.')
          return null
        }
        const patch: LessonVaultCardTextPatch = {
          word: card.word,
          sentence: nextSentence,
          meaning: nextMeaning,
        }
        const updated = updateLessonVaultCard(sid, cardId, patch, (message) => toast.error(message))
        if (!updated) {
          toast.error('Could not update that card.')
          return null
        }
        if (!updated.chinese.trim()) queueAutoChinese(sid, [updated])
        return patch
      } catch {
        toast.error('Could not generate text for that card.')
        return null
      }
    },
    [studentId, queueAutoChinese],
  )

  return {
    lessons,
    lessonCards,
    pageLesson,
    pagePartId,
    updateCardText,
    generateCardText,
    saveReviewStatuses,
    deleteCard,
    moveCard,
    setCardPicture,
    setCardPictureFromFile,
    keepViewOnReopen,
    pageLessonCount: lessonCards(pageLesson?.id).length,
    viewedLesson,
    viewedCards,
    lessonAllCards,
    storyScopes: storyScopeList,
    showStoryChips,
    viewedPartId: showStoryChips ? viewedPartId : null,
    setViewedStory,
    hasPreviousLesson: viewedIndex > 0,
    hasNextLesson: viewedIndex >= 0 && viewedIndex < lessons.length - 1,
    showPreviousLesson,
    showNextLesson,
    showPageLesson,
    saveFromPage,
    findingPictureIds: findingIds,
    findMissingPictures,
    retryAutoPicture,
    chooseCardPicture,
    queueAutoChinese,
  }
}
