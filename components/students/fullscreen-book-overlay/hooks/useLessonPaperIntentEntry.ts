import { useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { ensureStudentClassLessonNotebookPageSpanSection } from '@/lib/students/selectors'

export type NotebookIntentTrigger = 'typing' | 'paste' | 'whiteboard_capture' | 'vocab_save' | 'start_note'

interface UseLessonPaperIntentEntryArgs {
  activeClassSessionId: string | null
  lessonPaperPrimarySectionId: string | null
  studentId: string
  currentNotebookPageSpanKey: string
  currentLessonPartPageSpanKey: string
  currentTocPartKey: string
  currentTocPartTitle: string
  currentTocBreadcrumb: string
  vocabReaderPartTitle?: string
  lessonPartOrderByKey: Record<string, number>
  lessonPaperEditorRef: MutableRefObject<HTMLDivElement | null>
  lessonPaperHtmlRef: MutableRefObject<string>
  lessonPaperLastPartContextKeyRef: MutableRefObject<string | null>
  appendLessonPaperContextHeading: (
    contextKey: string,
    title: string,
    pageSpanKey: string,
    insertionMode?: 'append' | 'prependBeforeFirstHeading',
    options?: { scrollIntoView?: boolean },
  ) => void
}

export function useLessonPaperIntentEntry(args: UseLessonPaperIntentEntryArgs) {
  const lastEnsuredPartKeyRef = useRef<string | null>(null)
  const ensureInFlightRef = useRef(false)

  const ensureNotebookPartOnIntent = useCallback(
    (trigger: NotebookIntentTrigger) => {
      void trigger
      if (!args.activeClassSessionId || !args.lessonPaperPrimarySectionId) return

      const title = (args.vocabReaderPartTitle ?? args.currentTocPartTitle ?? args.currentNotebookPageSpanKey).trim()
      const partContextKey =
        args.currentTocPartKey || `part-title::${title.toLowerCase().replace(/\s+/g, '-')}`
      const contextKey = `part::${partContextKey}`
      const marker = `data-notebook-context="${contextKey}"`
      const html = args.lessonPaperEditorRef.current?.innerHTML ?? args.lessonPaperHtmlRef.current

      if (html.includes(marker)) {
        lastEnsuredPartKeyRef.current = contextKey
        args.lessonPaperLastPartContextKeyRef.current = contextKey
        return
      }

      if (lastEnsuredPartKeyRef.current === contextKey || ensureInFlightRef.current) return
      ensureInFlightRef.current = true

      try {
        const ensured = ensureStudentClassLessonNotebookPageSpanSection(args.studentId, args.activeClassSessionId, {
          pageSpanKey: args.currentNotebookPageSpanKey,
          title: title || args.currentNotebookPageSpanKey,
          tocPartKey: args.currentTocPartKey || undefined,
          lessonPartLabel: args.currentTocPartTitle || undefined,
          breadcrumb: args.currentTocBreadcrumb || undefined,
        })
        if (!ensured.ok) return

        const previousPartContextKey = args.lessonPaperLastPartContextKeyRef.current
        const previousOrder =
          previousPartContextKey?.startsWith('part::') &&
          args.lessonPartOrderByKey[previousPartContextKey.slice(6)] !== undefined
            ? args.lessonPartOrderByKey[previousPartContextKey.slice(6)]
            : Number.MAX_SAFE_INTEGER
        const currentOrder =
          args.lessonPartOrderByKey[partContextKey] !== undefined
            ? args.lessonPartOrderByKey[partContextKey]
            : Number.MAX_SAFE_INTEGER
        const insertionMode =
          previousPartContextKey && currentOrder < previousOrder ? 'prependBeforeFirstHeading' : 'append'

        args.appendLessonPaperContextHeading(
          contextKey,
          title || args.currentNotebookPageSpanKey,
          args.currentLessonPartPageSpanKey,
          insertionMode,
          { scrollIntoView: trigger === 'start_note' || trigger === 'typing' },
        )
        lastEnsuredPartKeyRef.current = contextKey
        args.lessonPaperLastPartContextKeyRef.current = contextKey
      } finally {
        ensureInFlightRef.current = false
      }
    },
    [args],
  )

  const resetNotebookIntentDedupe = useCallback(() => {
    lastEnsuredPartKeyRef.current = null
    ensureInFlightRef.current = false
  }, [])

  return { ensureNotebookPartOnIntent, resetNotebookIntentDedupe }
}
