import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ensureStudentClassLessonNotebookSession,
  getStudentClassSessionById,
  upsertStudentClassLessonNotebookDoc,
} from '@/lib/students/selectors'

const LESSON_PAPER_EMPTY_HTML = '<p><br></p>'

type LessonPaperSaveState = 'idle' | 'typing' | 'saving' | 'saved' | 'error'
type LessonPaperHeader = { title: string; dateLabel: string; lessonPartLabel: string; pageLabel: string } | null
type NotebookSection = NonNullable<
  NonNullable<ReturnType<typeof getStudentClassSessionById>>['lessonNotebookSession']
>['sections'][number]

/** Prefer the section that already holds the flowing doc; otherwise the first section. */
function resolveNotebookDocSection(sections: NotebookSection[]): NotebookSection | null {
  if (!sections.length) return null
  const withRichDoc = sections.find((section) =>
    section.entries.some((entry) => entry.layer === 'doc' && entry.payload?.kind === 'doc_richtext'),
  )
  return withRichDoc ?? sections[0] ?? null
}

interface UseLessonPaperPersistenceArgs {
  studentId: string
  activeClassSessionId: string | null
  isLessonPaperOpen: boolean
  lessonPaperEditVersion: number
  lessonPaperSectionId: string | null
  lessonPaperPrimarySectionId: string | null
  lessonPaperDraftStorageKey: string | null
  lessonPaperDocUpdatedAt: string | null
  lessonPaperEditorRef: React.MutableRefObject<HTMLDivElement | null>
  lessonPaperHtmlRef: React.MutableRefObject<string>
  lessonPaperHasPendingChangesRef: React.MutableRefObject<boolean>
  lessonPaperHydratedRef: React.MutableRefObject<boolean>
  lessonPaperClassRef: React.MutableRefObject<string | null>
  lessonPaperSaveTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  setLessonPaperSectionId: (v: string | null) => void
  setLessonPaperHeader: (v: LessonPaperHeader) => void
  setLessonPaperBreadcrumb: (v: string) => void
  setLessonPaperDocUpdatedAt: (v: string | null) => void
  setLessonPaperHtml: (v: string) => void
  setLessonPaperSaveState: (v: LessonPaperSaveState) => void
}

export function useLessonPaperPersistence(args: UseLessonPaperPersistenceArgs) {
  const resolveSaveSectionId = useCallback(() => {
    return args.lessonPaperSectionId?.trim() || args.lessonPaperPrimarySectionId?.trim() || null
  }, [args.lessonPaperSectionId, args.lessonPaperPrimarySectionId])

  const persistLessonPaper = useCallback(
    (htmlForSave: string): boolean => {
      const sectionId = resolveSaveSectionId()
      if (!args.activeClassSessionId || !sectionId) return false

      args.setLessonPaperSaveState('saving')
      const docResult = upsertStudentClassLessonNotebookDoc(args.studentId, args.activeClassSessionId, {
        sectionId,
        html: htmlForSave,
        clientDocUpdatedAt: args.lessonPaperDocUpdatedAt ?? undefined,
      })
      if (!docResult.ok) {
        if (docResult.conflict) {
          if (typeof docResult.latestHtml === 'string' && args.lessonPaperEditorRef.current) {
            args.lessonPaperEditorRef.current.innerHTML = docResult.latestHtml
            args.setLessonPaperHtml(docResult.latestHtml)
            args.lessonPaperHtmlRef.current = docResult.latestHtml
          }
          if (typeof docResult.latestUpdatedAt === 'string') {
            args.setLessonPaperDocUpdatedAt(docResult.latestUpdatedAt)
          }
          toast.error('Notebook save conflict detected. Latest saved version was restored.')
        }
        args.setLessonPaperSaveState('error')
        args.lessonPaperHasPendingChangesRef.current = false
        return false
      }
      args.setLessonPaperDocUpdatedAt(docResult.docUpdatedAt)
      if (args.lessonPaperDraftStorageKey) {
        try {
          localStorage.removeItem(args.lessonPaperDraftStorageKey)
        } catch {
          // ignore
        }
      }
      args.lessonPaperHasPendingChangesRef.current = false
      args.setLessonPaperSaveState('saved')
      return true
    },
    [args, resolveSaveSectionId],
  )

  const loadLessonPaperSection = useCallback(
    (session: NonNullable<ReturnType<typeof getStudentClassSessionById>>) => {
      const sections = session.lessonNotebookSession?.sections ?? []
      const targetSection = resolveNotebookDocSection(sections)
      if (!targetSection) return false
      const richDocEntry = targetSection.entries.find(
        (entry) => entry.layer === 'doc' && entry.payload?.kind === 'doc_richtext',
      )
      const headerEntry = targetSection.entries.find(
        (entry) => entry.layer === 'doc' && entry.payload?.kind === 'header_block',
      )
      const fallbackHeaderText = typeof headerEntry?.payload?.text === 'string' ? headerEntry.payload.text : ''
      const fallbackHeaderLines = fallbackHeaderText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      const fallbackDateLabel =
        fallbackHeaderLines.find((line) => line.toLowerCase().startsWith('date:'))?.replace(/^date:\s*/i, '') ?? ''
      const fallbackLessonPartLabel =
        fallbackHeaderLines.find((line) => line.toLowerCase().startsWith('class title:'))?.replace(/^class title:\s*/i, '') ??
        ''
      const fallbackPageLabel =
        fallbackHeaderLines
          .find((line) => line.toLowerCase().startsWith('active page span:'))
          ?.replace(/^active page span:\s*/i, '')
          .replace(/^p/i, '') ?? ''
      const headerBreadcrumb =
        typeof headerEntry?.payload?.breadcrumb === 'string' && headerEntry.payload.breadcrumb.trim()
          ? headerEntry.payload.breadcrumb.trim()
          : ''
      args.setLessonPaperHeader({
        title: (typeof headerEntry?.payload?.title === 'string' && headerEntry.payload.title.trim()) || 'Untitled section',
        dateLabel:
          (typeof headerEntry?.payload?.dateLabel === 'string' && headerEntry.payload.dateLabel.trim()) || fallbackDateLabel,
        lessonPartLabel:
          (typeof headerEntry?.payload?.lessonPartLabel === 'string' && headerEntry.payload.lessonPartLabel.trim()) ||
          fallbackLessonPartLabel,
        pageLabel:
          (typeof headerEntry?.payload?.pageLabel === 'string' && headerEntry.payload.pageLabel.trim()) || fallbackPageLabel,
      })
      args.setLessonPaperBreadcrumb(headerBreadcrumb)
      const docHtml =
        typeof richDocEntry?.payload?.html === 'string' && richDocEntry.payload.html.trim()
          ? richDocEntry.payload.html
          : LESSON_PAPER_EMPTY_HTML
      const docUpdatedAt = richDocEntry?.updatedAt ?? null
      let hydratedHtml = docHtml
      if (typeof window !== 'undefined' && args.activeClassSessionId) {
        const draftKey = `lesson-paper-draft::${args.studentId}::${args.activeClassSessionId}::${targetSection.sectionId}`
        try {
          const raw = localStorage.getItem(draftKey)
          if (raw) {
            const parsed = JSON.parse(raw) as { updatedAt?: string; html?: string }
            if (
              typeof parsed.html === 'string' &&
              parsed.html.trim() &&
              typeof parsed.updatedAt === 'string' &&
              (!docUpdatedAt || Date.parse(parsed.updatedAt) >= Date.parse(docUpdatedAt))
            ) {
              hydratedHtml = parsed.html
            }
          }
        } catch {
          // ignore corrupted draft payloads
        }
      }
      args.setLessonPaperSectionId(targetSection.sectionId)
      args.setLessonPaperDocUpdatedAt(docUpdatedAt)
      args.setLessonPaperHtml(hydratedHtml)
      args.lessonPaperHtmlRef.current = hydratedHtml
      args.lessonPaperHasPendingChangesRef.current = false
      if (args.lessonPaperEditorRef.current) args.lessonPaperEditorRef.current.innerHTML = hydratedHtml
      args.setLessonPaperSaveState('idle')
      return true
    },
    [args],
  )

  const hydrateLessonPaper = useCallback(() => {
    if (!args.activeClassSessionId) {
      args.lessonPaperClassRef.current = null
      args.lessonPaperHydratedRef.current = true
      args.setLessonPaperSectionId(null)
      args.setLessonPaperDocUpdatedAt(null)
      args.setLessonPaperHeader(null)
      args.setLessonPaperHtml(LESSON_PAPER_EMPTY_HTML)
      args.lessonPaperHtmlRef.current = LESSON_PAPER_EMPTY_HTML
      args.lessonPaperHasPendingChangesRef.current = false
      if (args.lessonPaperEditorRef.current) args.lessonPaperEditorRef.current.innerHTML = LESSON_PAPER_EMPTY_HTML
      return
    }
    let session = getStudentClassSessionById(args.studentId, args.activeClassSessionId)
    if (!session) {
      args.lessonPaperClassRef.current = args.activeClassSessionId
      args.lessonPaperHydratedRef.current = true
      args.setLessonPaperSectionId(null)
      args.setLessonPaperDocUpdatedAt(null)
      args.setLessonPaperHeader(null)
      args.setLessonPaperHtml(LESSON_PAPER_EMPTY_HTML)
      args.lessonPaperHtmlRef.current = LESSON_PAPER_EMPTY_HTML
      args.lessonPaperHasPendingChangesRef.current = false
      if (args.lessonPaperEditorRef.current) args.lessonPaperEditorRef.current.innerHTML = LESSON_PAPER_EMPTY_HTML
      return
    }
    if (!session.lessonNotebookSession?.sections?.length) {
      if (session.status === 'in_progress') {
        ensureStudentClassLessonNotebookSession(args.studentId, args.activeClassSessionId)
        session = getStudentClassSessionById(args.studentId, args.activeClassSessionId)
      }
    }
    if (!session?.lessonNotebookSession?.sections?.length) {
      args.lessonPaperClassRef.current = args.activeClassSessionId
      args.lessonPaperHydratedRef.current = true
      args.setLessonPaperSectionId(null)
      args.setLessonPaperDocUpdatedAt(null)
      args.setLessonPaperHeader({
        title: 'Untitled section',
        dateLabel: '',
        lessonPartLabel: '',
        pageLabel: '',
      })
      const fallback =
        session?.status === 'in_progress'
          ? LESSON_PAPER_EMPTY_HTML
          : '<p>Start this class to use the lesson notebook.</p>'
      args.setLessonPaperHtml(fallback)
      args.lessonPaperHtmlRef.current = fallback
      args.lessonPaperHasPendingChangesRef.current = false
      if (args.lessonPaperEditorRef.current) args.lessonPaperEditorRef.current.innerHTML = fallback
      return
    }
    loadLessonPaperSection(session)
    args.lessonPaperClassRef.current = args.activeClassSessionId
    args.lessonPaperHydratedRef.current = true
  }, [args, loadLessonPaperSection])

  useEffect(() => {
    if (!args.isLessonPaperOpen) return
    if (args.lessonPaperClassRef.current !== args.activeClassSessionId) {
      args.lessonPaperHydratedRef.current = false
    }
    if (!args.lessonPaperHydratedRef.current) hydrateLessonPaper()
  }, [args, hydrateLessonPaper])

  useEffect(() => {
    if (!args.isLessonPaperOpen) return
    if (!args.activeClassSessionId || !resolveSaveSectionId()) return
    if (!args.lessonPaperHasPendingChangesRef.current) return
    const htmlForSave = args.lessonPaperEditorRef.current?.innerHTML ?? args.lessonPaperHtmlRef.current
    if (args.lessonPaperSaveTimerRef.current) clearTimeout(args.lessonPaperSaveTimerRef.current)
    args.lessonPaperSaveTimerRef.current = setTimeout(() => {
      args.lessonPaperSaveTimerRef.current = null
      persistLessonPaper(htmlForSave)
    }, 1000)
    return () => {
      if (args.lessonPaperSaveTimerRef.current) clearTimeout(args.lessonPaperSaveTimerRef.current)
    }
  }, [
    args.isLessonPaperOpen,
    args.lessonPaperEditVersion,
    args.activeClassSessionId,
    args.lessonPaperSectionId,
    args.lessonPaperPrimarySectionId,
    args.lessonPaperDocUpdatedAt,
    persistLessonPaper,
    resolveSaveSectionId,
    args.lessonPaperEditorRef,
    args.lessonPaperHtmlRef,
    args.lessonPaperHasPendingChangesRef,
    args.lessonPaperSaveTimerRef,
  ])

  useEffect(() => {
    if (!args.lessonPaperDraftStorageKey) return
    const htmlForDraft = args.lessonPaperEditorRef.current?.innerHTML ?? args.lessonPaperHtmlRef.current
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          args.lessonPaperDraftStorageKey!,
          JSON.stringify({
            updatedAt: new Date().toISOString(),
            html: htmlForDraft,
          }),
        )
      } catch {
        // ignore storage quota errors
      }
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [args.lessonPaperDraftStorageKey, args.lessonPaperEditVersion, args.lessonPaperEditorRef, args.lessonPaperHtmlRef])

  const flushLessonPaperSaveNow = useCallback(() => {
    if (!args.lessonPaperHasPendingChangesRef.current) return true
    if (!args.activeClassSessionId || !resolveSaveSectionId()) return false
    if (args.lessonPaperSaveTimerRef.current) {
      clearTimeout(args.lessonPaperSaveTimerRef.current)
      args.lessonPaperSaveTimerRef.current = null
    }
    const htmlForSave = args.lessonPaperEditorRef.current?.innerHTML ?? args.lessonPaperHtmlRef.current
    return persistLessonPaper(htmlForSave)
  }, [args, persistLessonPaper, resolveSaveSectionId])

  return { flushLessonPaperSaveNow }
}
