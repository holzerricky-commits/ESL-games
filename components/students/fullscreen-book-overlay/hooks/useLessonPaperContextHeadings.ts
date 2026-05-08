import { useCallback, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import { ensureStudentClassLessonNotebookPageSpanSection } from '@/lib/students/selectors'

interface UseLessonPaperContextHeadingsArgs {
  isLessonPaperOpen: boolean
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
  lessonPaperScrollRef: MutableRefObject<HTMLDivElement | null>
  lessonPaperHtmlRef: MutableRefObject<string>
  lessonPaperLastInputAtRef: MutableRefObject<number>
  lessonPaperScrollTimerRef: MutableRefObject<number[]>
  lessonPaperHasPendingChangesRef: MutableRefObject<boolean>
  lessonPaperLastPartContextKeyRef: MutableRefObject<string | null>
  setLessonPaperHtml: (value: string) => void
  setLessonPaperEditVersion: (updater: (v: number) => number) => void
  setLessonPaperSaveState: (updater: (prev: 'idle' | 'typing' | 'saving' | 'saved' | 'error') => 'idle' | 'typing' | 'saving' | 'saved' | 'error') => void
  scheduleLessonPaperEditorFocus: (placeCaretAtEnd?: boolean) => void
  focusLessonPaperMarkerForTyping: (markerId: string) => void
}

export function useLessonPaperContextHeadings(args: UseLessonPaperContextHeadingsArgs) {
  const scrollLessonPaperHeadingIntoFocus = useCallback((markerId: string) => {
    const editor = args.lessonPaperEditorRef.current
    const scrollHost = args.lessonPaperScrollRef.current
    if (!editor || !scrollHost) return
    if (Date.now() - args.lessonPaperLastInputAtRef.current < 280) return
    const jumpHeadingNearTop = () => {
      if (Date.now() - args.lessonPaperLastInputAtRef.current < 280) return
      const headingEl = editor.querySelector(`[data-notebook-marker="${markerId}"]`) as HTMLElement | null
      if (!headingEl) return
      const targetTop = Math.max(0, headingEl.offsetTop - 8)
      scrollHost.scrollTo({ top: targetTop, behavior: 'smooth' })
    }
    for (const timerId of args.lessonPaperScrollTimerRef.current) clearTimeout(timerId)
    args.lessonPaperScrollTimerRef.current = []
    window.requestAnimationFrame(() => {
      jumpHeadingNearTop()
      args.lessonPaperScrollTimerRef.current.push(window.setTimeout(jumpHeadingNearTop, 40))
      args.lessonPaperScrollTimerRef.current.push(window.setTimeout(jumpHeadingNearTop, 120))
      args.lessonPaperScrollTimerRef.current.push(window.setTimeout(() => args.focusLessonPaperMarkerForTyping(markerId), 150))
    })
  }, [args])

  const appendLessonPaperContextHeading = useCallback(
    (
      contextKey: string,
      title: string,
      pageSpanKey: string,
      insertionMode: 'append' | 'prependBeforeFirstHeading' = 'append',
    ) => {
      if (!contextKey.trim()) return
      const marker = `data-notebook-context="${contextKey}"`
      const markerId = contextKey.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
      const editor = args.lessonPaperEditorRef.current
      const currentHtml = editor?.innerHTML ?? args.lessonPaperHtmlRef.current
      if (currentHtml.includes(marker)) {
        scrollLessonPaperHeadingIntoFocus(markerId)
        return
      }
      const headingTitle = title.trim() || pageSpanKey
      const pageLabel = pageSpanKey.replace(/^p/i, '')
      const headingHtml = `<p><br/></p><p><br/></p><div ${marker} data-notebook-marker="${markerId}" style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:6px 0 12px 0;padding:0 0 6px 0;border-bottom:1px dashed rgba(74,59,42,0.22);"><h3 style="margin:0;font-size:1.55rem;line-height:1.2;font-weight:700;letter-spacing:0.01em;color:rgba(72,92,139,0.72);">${headingTitle}</h3><span style="font-size:0.86rem;line-height:1.2;font-weight:600;letter-spacing:0.03em;color:rgba(74,59,42,0.58);white-space:nowrap;">${pageLabel}</span></div><p><br/></p>`
      const firstMarkerIndex = currentHtml.search(/data-notebook-context="part::/i)
      const nextHtml =
        insertionMode === 'prependBeforeFirstHeading' && firstMarkerIndex >= 0
          ? `${currentHtml.slice(0, firstMarkerIndex)}${headingHtml}${currentHtml.slice(firstMarkerIndex)}`
          : insertionMode === 'prependBeforeFirstHeading'
            ? `${headingHtml}${currentHtml}`
            : `${currentHtml}${headingHtml}`
      args.setLessonPaperHtml(nextHtml)
      args.lessonPaperHtmlRef.current = nextHtml
      args.lessonPaperHasPendingChangesRef.current = true
      args.setLessonPaperEditVersion((v) => v + 1)
      if (editor) editor.innerHTML = nextHtml
      args.setLessonPaperSaveState((prev) => (prev === 'saving' ? prev : 'idle'))
      scrollLessonPaperHeadingIntoFocus(markerId)
      args.scheduleLessonPaperEditorFocus(false)
    },
    [args, scrollLessonPaperHeadingIntoFocus],
  )

  useEffect(() => {
    if (!args.isLessonPaperOpen) return
    if (!args.activeClassSessionId || !args.lessonPaperPrimarySectionId) return
    const title = (args.vocabReaderPartTitle ?? args.currentNotebookPageSpanKey).trim() || args.currentNotebookPageSpanKey
    const ensured = ensureStudentClassLessonNotebookPageSpanSection(args.studentId, args.activeClassSessionId, {
      pageSpanKey: args.currentNotebookPageSpanKey,
      title,
      tocPartKey: args.currentTocPartKey || undefined,
      lessonPartLabel: args.currentTocPartTitle || undefined,
      breadcrumb: args.currentTocBreadcrumb || undefined,
    })
    if (!ensured.ok) return
    const partContextKey =
      args.currentTocPartKey || `part-title::${(args.currentTocPartTitle || title).toLowerCase().replace(/\s+/g, '-')}`
    const contextKey = `part::${partContextKey}`
    const previousPartContextKey = args.lessonPaperLastPartContextKeyRef.current
    const previousOrder =
      previousPartContextKey?.startsWith('part::') && args.lessonPartOrderByKey[previousPartContextKey.slice(6)] !== undefined
        ? args.lessonPartOrderByKey[previousPartContextKey.slice(6)]
        : Number.MAX_SAFE_INTEGER
    const currentOrder =
      args.lessonPartOrderByKey[partContextKey] !== undefined
        ? args.lessonPartOrderByKey[partContextKey]
        : Number.MAX_SAFE_INTEGER
    const insertionMode =
      previousPartContextKey && currentOrder < previousOrder ? 'prependBeforeFirstHeading' : 'append'
    appendLessonPaperContextHeading(contextKey, title, args.currentLessonPartPageSpanKey, insertionMode)
    args.lessonPaperLastPartContextKeyRef.current = contextKey
  }, [args, appendLessonPaperContextHeading])

  return { scrollLessonPaperHeadingIntoFocus, appendLessonPaperContextHeading }
}
