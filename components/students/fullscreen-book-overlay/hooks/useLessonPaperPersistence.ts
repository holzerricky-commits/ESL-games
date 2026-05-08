import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import {
  getStudentClassSessionById,
  upsertStudentClassLessonNotebookDoc,
  upsertStudentClassLessonNotebookOverlayImages,
} from '@/lib/students/selectors'

type OverlayImage = { id: string; src: string; xNorm: number; yNorm: number; widthNorm: number }
type LessonPaperSaveState = 'idle' | 'typing' | 'saving' | 'saved' | 'error'
type LessonPaperHeader = { title: string; dateLabel: string; lessonPartLabel: string; pageLabel: string } | null

interface UseLessonPaperPersistenceArgs {
  studentId: string
  activeClassSessionId: string | null
  isLessonPaperOpen: boolean
  lessonPaperEditVersion: number
  lessonPaperOverlayImages: OverlayImage[]
  lessonPaperPrimarySectionId: string | null
  lessonPaperDraftStorageKey: string | null
  lessonPaperDocUpdatedAt: string | null
  lessonPaperAutoFollowReadingEnabled: boolean
  lessonPaperEditorRef: React.MutableRefObject<HTMLDivElement | null>
  lessonPaperHtmlRef: React.MutableRefObject<string>
  lessonPaperHasPendingChangesRef: React.MutableRefObject<boolean>
  lessonPaperHydratedRef: React.MutableRefObject<boolean>
  lessonPaperClassRef: React.MutableRefObject<string | null>
  lessonPaperSaveTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  setLessonPaperSectionId: (v: string | null) => void
  setLessonPaperHeader: (v: LessonPaperHeader) => void
  setLessonPaperBreadcrumb: (v: string) => void
  setLessonPaperOverlayImages: (v: OverlayImage[]) => void
  setLessonPaperDocUpdatedAt: (v: string | null) => void
  setLessonPaperHtml: (v: string) => void
  setLessonPaperSaveState: (v: LessonPaperSaveState) => void
}

export function useLessonPaperPersistence(args: UseLessonPaperPersistenceArgs) {
  const loadLessonPaperSection = useCallback(
    (session: NonNullable<ReturnType<typeof getStudentClassSessionById>>) => {
      const sections = session.lessonNotebookSession?.sections ?? []
      const targetSection = sections[0]
      if (!targetSection) return false
      const richDocEntry = targetSection.entries.find(
        (entry) => entry.layer === 'doc' && entry.payload?.kind === 'doc_richtext',
      )
      const overlayImagesEntry = targetSection.entries.find(
        (entry) => entry.layer === 'overlay' && entry.payload?.kind === 'overlay_images',
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
        typeof richDocEntry?.payload?.html === 'string' && richDocEntry.payload.html.trim() ? richDocEntry.payload.html : '<p></p>'
      const persistedOverlayImages = Array.isArray(overlayImagesEntry?.payload?.images)
        ? overlayImagesEntry.payload.images
            .filter(
              (item): item is OverlayImage =>
                !!item &&
                typeof item === 'object' &&
                typeof (item as { id?: unknown }).id === 'string' &&
                typeof (item as { src?: unknown }).src === 'string' &&
                Number.isFinite(Number((item as { xNorm?: unknown }).xNorm)) &&
                Number.isFinite(Number((item as { yNorm?: unknown }).yNorm)) &&
                Number.isFinite(Number((item as { widthNorm?: unknown }).widthNorm)),
            )
            .map((item) => ({
              id: item.id,
              src: item.src,
              xNorm: Math.max(0, Math.min(0.95, Number(item.xNorm))),
              yNorm: Math.max(0, Math.min(0.98, Number(item.yNorm))),
              widthNorm: Math.max(0.08, Math.min(0.9, Number(item.widthNorm))),
            }))
        : []
      const docUpdatedAt = richDocEntry?.updatedAt ?? null
      let hydratedHtml = docHtml
      let hydratedOverlayImages = persistedOverlayImages
      if (typeof window !== 'undefined' && args.activeClassSessionId) {
        const draftKey = `lesson-paper-draft::${args.studentId}::${args.activeClassSessionId}::${targetSection.sectionId}`
        try {
          const raw = localStorage.getItem(draftKey)
          if (raw) {
            const parsed = JSON.parse(raw) as {
              updatedAt?: string
              html?: string
              overlayImages?: OverlayImage[]
            }
            if (
              typeof parsed.html === 'string' &&
              parsed.html.trim() &&
              typeof parsed.updatedAt === 'string' &&
              (!docUpdatedAt || Date.parse(parsed.updatedAt) >= Date.parse(docUpdatedAt))
            ) {
              hydratedHtml = parsed.html
              if (Array.isArray(parsed.overlayImages)) {
                hydratedOverlayImages = parsed.overlayImages
                  .filter((item) => item && typeof item.id === 'string' && typeof item.src === 'string')
                  .slice(0, 40)
                  .map((item) => ({
                    id: item.id,
                    src: item.src,
                    xNorm: Math.max(0, Math.min(0.95, Number(item.xNorm))),
                    yNorm: Math.max(0, Math.min(0.98, Number(item.yNorm))),
                    widthNorm: Math.max(0.08, Math.min(0.9, Number(item.widthNorm))),
                  }))
              }
            }
          }
        } catch {
          // ignore corrupted draft payloads
        }
      }
      args.setLessonPaperSectionId(targetSection.sectionId)
      args.setLessonPaperOverlayImages(hydratedOverlayImages)
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
      args.setLessonPaperHtml('<p></p>')
      args.lessonPaperHtmlRef.current = '<p></p>'
      args.lessonPaperHasPendingChangesRef.current = false
      if (args.lessonPaperEditorRef.current) args.lessonPaperEditorRef.current.innerHTML = '<p></p>'
      return
    }
    const session = getStudentClassSessionById(args.studentId, args.activeClassSessionId)
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
      const fallback = '<p>Notebook will appear after class starts.</p>'
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
    if (!args.lessonPaperAutoFollowReadingEnabled) return
    if (!args.activeClassSessionId || !args.lessonPaperPrimarySectionId) return
    if (!args.lessonPaperHasPendingChangesRef.current) return
    const htmlForSave = args.lessonPaperEditorRef.current?.innerHTML ?? args.lessonPaperHtmlRef.current
    if (args.lessonPaperSaveTimerRef.current) clearTimeout(args.lessonPaperSaveTimerRef.current)
    args.lessonPaperSaveTimerRef.current = setTimeout(() => {
      args.setLessonPaperSaveState('saving')
      const docResult = upsertStudentClassLessonNotebookDoc(args.studentId, args.activeClassSessionId!, {
        sectionId: args.lessonPaperPrimarySectionId!,
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
        return
      }
      args.setLessonPaperDocUpdatedAt(docResult.docUpdatedAt)
      const overlayResult = upsertStudentClassLessonNotebookOverlayImages(args.studentId, args.activeClassSessionId!, {
        sectionId: args.lessonPaperPrimarySectionId!,
        images: args.lessonPaperOverlayImages,
      })
      if (!overlayResult.ok) {
        args.setLessonPaperSaveState('error')
        args.lessonPaperHasPendingChangesRef.current = false
        return
      }
      if (args.lessonPaperDraftStorageKey) {
        try {
          localStorage.removeItem(args.lessonPaperDraftStorageKey)
        } catch {
          // ignore
        }
      }
      args.lessonPaperHasPendingChangesRef.current = false
      args.setLessonPaperSaveState('saved')
    }, 1000)
    return () => {
      if (args.lessonPaperSaveTimerRef.current) clearTimeout(args.lessonPaperSaveTimerRef.current)
    }
  }, [args])

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
            overlayImages: args.lessonPaperOverlayImages,
          }),
        )
      } catch {
        // ignore storage quota errors
      }
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [args.lessonPaperDraftStorageKey, args.lessonPaperEditVersion, args.lessonPaperOverlayImages, args.lessonPaperEditorRef, args.lessonPaperHtmlRef])

  const flushLessonPaperSaveNow = useCallback(() => {
    if (!args.activeClassSessionId || !args.lessonPaperPrimarySectionId) return true
    const htmlForSave = args.lessonPaperEditorRef.current?.innerHTML ?? args.lessonPaperHtmlRef.current
    const docResult = upsertStudentClassLessonNotebookDoc(args.studentId, args.activeClassSessionId, {
      sectionId: args.lessonPaperPrimarySectionId,
      html: htmlForSave,
      clientDocUpdatedAt: args.lessonPaperDocUpdatedAt ?? undefined,
    })
    if (!docResult.ok) {
      if (docResult.conflict) {
        if (typeof docResult.latestHtml === 'string') {
          args.setLessonPaperHtml(docResult.latestHtml)
          args.lessonPaperHtmlRef.current = docResult.latestHtml
          if (args.lessonPaperEditorRef.current) args.lessonPaperEditorRef.current.innerHTML = docResult.latestHtml
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
    const overlayResult = upsertStudentClassLessonNotebookOverlayImages(args.studentId, args.activeClassSessionId, {
      sectionId: args.lessonPaperPrimarySectionId,
      images: args.lessonPaperOverlayImages,
    })
    if (!overlayResult.ok) {
      args.setLessonPaperSaveState('error')
      args.lessonPaperHasPendingChangesRef.current = false
      return false
    }
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
  }, [args])

  return { flushLessonPaperSaveNow }
}
