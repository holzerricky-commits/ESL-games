'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { resolveLessonAndPartAtPdfPage } from '@/lib/books/interactive-vocab'
import { lessonRefsForTeachingWeek } from '@/lib/books/lesson-peer'
import type { BookLibraryPayload } from '@/lib/books/types'
import {
  deleteLessonGrammarItem,
  EMPTY_LESSON_GRAMMAR_ITEMS,
  EMPTY_LESSON_GRAMMAR_RULES,
  getLessonGrammarItemsForStudent,
  getLessonGrammarRulesForStudent,
  hydrateLessonGrammarFromDisk,
  isLessonGrammarHydrated,
  patchLessonGrammarItem,
  saveLessonGrammarItem,
  saveLessonGrammarRule,
  saveNewLessonGrammarItems,
  subscribeLessonGrammar,
  undoDeleteLessonGrammarItem,
} from '@/lib/lesson-grammar/disk-client'
import {
  grammarItemsForLesson,
  grammarItemsForLessons,
  grammarRuleForLesson,
  grammarRuleForLessons,
  grammarSaveFromPick,
  grammarTargetText,
  type LessonGrammarItem,
  type LessonGrammarItemPatch,
} from '@/lib/lesson-grammar/types'

const UNDO_DELETE_MS = 6000

type SelectedBook = BookLibraryPayload['books'][number]
type SelectedUnit = SelectedBook['units'][number]

interface UseLessonGrammarArgs {
  studentId: string
  library: BookLibraryPayload | null
  selectedBook: SelectedBook | null
  selectedUnit: SelectedUnit | null
  numPages: number | null
}

export function useLessonGrammar({
  studentId,
  library,
  selectedBook,
  selectedUnit,
  numPages,
}: UseLessonGrammarArgs) {
  useEffect(() => {
    void hydrateLessonGrammarFromDisk()
  }, [])

  const studentItems = useSyncExternalStore(
    subscribeLessonGrammar,
    () => getLessonGrammarItemsForStudent(studentId),
    () => EMPTY_LESSON_GRAMMAR_ITEMS,
  )
  const studentRules = useSyncExternalStore(
    subscribeLessonGrammar,
    () => getLessonGrammarRulesForStudent(studentId),
    () => EMPTY_LESSON_GRAMMAR_RULES,
  )

  const lessonRef = useCallback(
    (lessonId: string | null | undefined) =>
      selectedBook && selectedUnit && lessonId
        ? { bookId: selectedBook.id, unitId: selectedUnit.id, lessonId }
        : null,
    [selectedBook, selectedUnit],
  )

  const libraryBooks = library?.books
  const lessonRefs = useCallback(
    (lessonId: string | null | undefined) => {
      if (!selectedBook || !selectedUnit || !lessonId) return []
      return lessonRefsForTeachingWeek(libraryBooks ?? [], selectedBook, selectedUnit, lessonId)
    },
    [libraryBooks, selectedBook, selectedUnit],
  )

  const lessonItems = useCallback(
    (lessonId: string | null | undefined): LessonGrammarItem[] => {
      const refs = lessonRefs(lessonId)
      return refs.length > 0 ? grammarItemsForLessons(studentItems, refs) : EMPTY_LESSON_GRAMMAR_ITEMS
    },
    [lessonRefs, studentItems],
  )

  const lessonRule = useCallback(
    (lessonId: string | null | undefined): string => grammarRuleForLessons(studentRules, lessonRefs(lessonId)),
    [lessonRefs, studentRules],
  )

  const saveFromPage = useCallback(
    (input: { pdfPage: number; word: string; sentence: string }) => {
      if (!studentId.trim()) {
        toast.error('Open a student session to save grammar sentences.')
        return
      }
      if (!selectedBook || !selectedUnit) return
      if (!isLessonGrammarHydrated()) {
        toast.error('Grammar is still loading. Try again in a moment.')
        return
      }
      const hit = resolveLessonAndPartAtPdfPage(selectedBook, selectedUnit, null, input.pdfPage, numPages)
      if (!hit) {
        toast.error('This page is not part of a lesson yet. Outline the book to save grammar.')
        return
      }
      const { sentence, target } = grammarSaveFromPick(input.word, input.sentence)
      const result = saveLessonGrammarItem(
        studentId,
        {
          bookId: selectedBook.id,
          unitId: selectedUnit.id,
          lessonId: hit.lesson.id,
          lessonTitle: hit.lesson.title,
          partId: hit.part.id,
          partTitle: hit.part.title,
          sentence,
          target,
          pdfPage: input.pdfPage,
        },
        (message) => toast.error(message),
      )
      if (!result) return
      const marked = grammarTargetText(result.item)
      const practising = marked ? ` — practising “${marked}”` : ''
      toast.success(
        result.mode === 'updated'
          ? `That sentence is already in ${hit.lesson.title} grammar${practising}.`
          : `Sentence saved to ${hit.lesson.title} grammar${practising}.`,
      )
    },
    [studentId, selectedBook, selectedUnit, numPages],
  )

  const updateItem = useCallback(
    (itemId: string, patch: LessonGrammarItemPatch): boolean => {
      const item = patchLessonGrammarItem(studentId, itemId, patch, (message) => toast.error(message))
      if (!item) toast.error('Could not update that sentence.')
      return item != null
    },
    [studentId],
  )

  const deleteItem = useCallback(
    (itemId: string): boolean => {
      const result = deleteLessonGrammarItem(studentId, itemId, (message) => toast.error(message))
      if (!result) {
        toast.error('Could not delete that sentence.')
        return false
      }
      const { removed, index } = result
      toast('Sentence removed from grammar.', {
        duration: UNDO_DELETE_MS,
        action: {
          label: 'Undo',
          onClick: () => undoDeleteLessonGrammarItem(studentId, removed, index, (message) => toast.error(message)),
        },
      })
      return true
    },
    [studentId],
  )

  const setRule = useCallback(
    (lessonId: string | null | undefined, text: string): boolean => {
      const ref = lessonRef(lessonId)
      if (!ref) return false
      const ok = saveLessonGrammarRule(studentId, ref, text, (message) => toast.error(message))
      if (!ok) toast.error('Could not save the grammar point.')
      return ok
    },
    [studentId, lessonRef],
  )

  const [generatingLessonId, setGeneratingLessonId] = useState<string | null>(null)

  /** AI drafts from the open page(s): grammar point plus marked sentences with wrong options. */
  const generateFromPages = useCallback(
    async (input: { lessonId: string | null; pdfPages: readonly number[]; grammarNotes: readonly string[] }) => {
      if (generatingLessonId) return
      if (!studentId.trim()) {
        toast.error('Open a student session to save grammar sentences.')
        return
      }
      if (!selectedBook || !selectedUnit || !input.lessonId) return
      if (!isLessonGrammarHydrated()) {
        toast.error('Grammar is still loading. Try again in a moment.')
        return
      }
      const lessonId = input.lessonId
      const lesson = selectedUnit.lessons?.find((l) => l.id === lessonId)
      if (!lesson) return
      const pageHits = input.pdfPages
        .filter((page) => page >= 1)
        .map((pdfPage) => ({
          pdfPage,
          hit: resolveLessonAndPartAtPdfPage(selectedBook, selectedUnit, lessonId, pdfPage, numPages),
        }))
        .filter((entry) => entry.hit?.lesson.id === lessonId)
      if (pageHits.length === 0) {
        toast.error(`Turn the book to a page of ${lesson.title} first, then generate.`)
        return
      }

      setGeneratingLessonId(lessonId)
      try {
        const ref = { bookId: selectedBook.id, unitId: selectedUnit.id, lessonId }
        const existing = grammarItemsForLesson(getLessonGrammarItemsForStudent(studentId), ref)
        const currentRule = grammarRuleForLesson(getLessonGrammarRulesForStudent(studentId), ref)
        const res = await fetch('/api/lesson-grammar/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId: selectedBook.id,
            unitId: selectedUnit.id,
            pdfPages: pageHits.map((entry) => entry.pdfPage),
            lessonTitle: lesson.title,
            grammarNotes: input.grammarNotes,
            rule: currentRule,
            existingSentences: existing.map((item) => item.sentence),
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          code?: string
          error?: string
          rule?: string
          items?: { sentence: string; target: string; distractors: string[] }[]
          pages?: number[]
        }
        if (!res.ok || !data.ok) {
          toast.error(
            data.code === 'no-text'
              ? 'This page has no readable text. Use “Make pages selectable” for this part, then try again.'
              : (data.error ?? 'Could not generate grammar practice.'),
          )
          return
        }

        const sourcePage = pageHits.find((entry) => data.pages?.includes(entry.pdfPage)) ?? pageHits[0]!
        const part = sourcePage.hit!.part
        const added =
          saveNewLessonGrammarItems(
            studentId,
            (data.items ?? []).map((item) => ({
              ...ref,
              lessonTitle: lesson.title,
              partId: part.id,
              partTitle: part.title,
              sentence: item.sentence,
              target: item.target,
              distractors: item.distractors,
              pdfPage: sourcePage.pdfPage,
              source: 'ai' as const,
            })),
            (message) => toast.error(message),
          ) ?? []

        const aiRule = data.rule?.trim() ?? ''
        const ruleSet = !currentRule.trim() && aiRule !== '' && setRule(lessonId, aiRule)
        const ruleNote = ruleSet ? ' and set the grammar point' : ''
        const offerRule = currentRule.trim() !== '' && aiRule !== '' && aiRule !== currentRule.trim()
        const message =
          added.length > 0
            ? `Added ${added.length} AI ${added.length === 1 ? 'sentence' : 'sentences'}${ruleNote}. Check them before class.`
            : `No new sentences — they are already in ${lesson.title} grammar.`
        toast.success(message, {
          description: offerRule ? `AI grammar point: “${aiRule}”` : undefined,
          duration: offerRule ? 10000 : undefined,
          action: offerRule ? { label: 'Use it', onClick: () => setRule(lessonId, aiRule) } : undefined,
        })
      } catch {
        toast.error('Could not reach the AI. Check your connection and try again.')
      } finally {
        setGeneratingLessonId(null)
      }
    },
    [generatingLessonId, studentId, selectedBook, selectedUnit, numPages, setRule],
  )

  return {
    lessonItems,
    lessonRule,
    saveFromPage,
    updateItem,
    deleteItem,
    setRule,
    generateFromPages,
    generatingLessonId,
  }
}

/** Grammar notes from the lesson's scanned teacher materials, offered as a starting rule. */
export function useLessonGrammarHints(
  ref: { bookId: string; unitId: string; lessonId: string } | null,
): string[] {
  const [hints, setHints] = useState<{ key: string; notes: string[] } | null>(null)
  const bookId = ref?.bookId ?? ''
  const unitId = ref?.unitId ?? ''
  const lessonId = ref?.lessonId ?? ''
  const key = `${bookId}/${unitId}/${lessonId}`

  useEffect(() => {
    if (!bookId || !unitId || !lessonId) return
    const requestKey = `${bookId}/${unitId}/${lessonId}`
    const qs = new URLSearchParams({ bookId, unitId, lessonId })
    let cancelled = false
    void fetch(`/api/context/get?${qs.toString()}`)
      .then((r) => r.json())
      .then((data: { ok?: boolean; context?: { languageFocus?: { grammarNotes?: unknown } } | null }) => {
        if (cancelled) return
        const raw = data.ok ? data.context?.languageFocus?.grammarNotes : undefined
        const notes = Array.isArray(raw)
          ? raw.filter((n): n is string => typeof n === 'string' && n.trim() !== '').map((n) => n.trim())
          : []
        setHints({ key: requestKey, notes: notes.slice(0, 4) })
      })
      .catch(() => {
        if (!cancelled) setHints({ key: requestKey, notes: [] })
      })
    return () => {
      cancelled = true
    }
  }, [bookId, unitId, lessonId])

  return hints?.key === key ? hints.notes : []
}
