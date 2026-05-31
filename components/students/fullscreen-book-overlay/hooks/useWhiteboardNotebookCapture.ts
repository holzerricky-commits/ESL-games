import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  buildExportBaseName,
  canvasToBlob,
  captureElementToCanvas,
  settleLayout,
  uploadStudentWorkBlob,
} from '@/lib/books/book-capture'
import { mapPdfPageToDisplayLabel, type PageNumberingMode } from '@/lib/books/page-numbering'
import { requestSpreadSessionFlush } from '@/lib/books/spread-session-events'
import { appendStudentClassLessonNotebookWhiteboardCapture } from '@/lib/students/selectors'
import type { BookLibraryPayload } from '@/lib/books/types'

const SAVE_DEBOUNCE_MS = 2500

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Could not read capture image.'))
    reader.readAsDataURL(blob)
  })
}

interface UseWhiteboardNotebookCaptureArgs {
  studentId: string
  activeClassSessionId: string | null
  notebookEditable: boolean
  lessonPaperSectionId: string | null
  lessonPaperPrimarySectionId: string | null
  lessonPaperDocUpdatedAt: string | null
  selectedBookId: string | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  selectedBook: BookLibraryPayload['books'][number] | null
  numPages: number | null
  numberingMode: PageNumberingMode
  bookPageAtCapture: number
  currentNotebookPageSpanKey: string
  currentTocPartKey: string
  currentTocPartTitle: string
  wbCaptureRootRef: React.MutableRefObject<HTMLDivElement | null>
  annotationMode: string
  setAnnotationMode: (mode: string) => void
  isLessonPaperOpen: boolean
  setIsLessonPaperOpen: (open: boolean) => void
  applyNotebookHtml: (html: string, docUpdatedAt: string) => void
  getNotebookHtmlForSave: () => string
  onNotebookIntent?: () => void
}

export function useWhiteboardNotebookCapture(args: UseWhiteboardNotebookCaptureArgs) {
  const [whiteboardCaptureBusy, setWhiteboardCaptureBusy] = useState(false)
  const lastSaveRef = useRef<{ key: string; at: number } | null>(null)

  const saveWhiteboardToNotebook = useCallback(async () => {
    if (!args.activeClassSessionId) {
      toast.error('Start a live class to save to the lesson notebook.')
      return
    }
    if (!args.notebookEditable) {
      toast.error('Notebook saving is only available during a live class.')
      return
    }
    if (!args.selectedBookId || !args.selectedUnit) {
      toast.error('Open a book unit first.')
      return
    }

    const sectionId = args.lessonPaperSectionId?.trim() || args.lessonPaperPrimarySectionId?.trim()
    if (!sectionId) {
      toast.error('Notebook is still loading. Try again in a moment.')
      return
    }

    const dedupeKey = `${args.activeClassSessionId}:${args.bookPageAtCapture}`
    const now = Date.now()
    if (
      lastSaveRef.current &&
      lastSaveRef.current.key === dedupeKey &&
      now - lastSaveRef.current.at < SAVE_DEBOUNCE_MS
    ) {
      toast.message('Whiteboard already saved — wait a moment before saving again.')
      return
    }

    const rootEl = args.wbCaptureRootRef.current
    if (!rootEl) {
      toast.error('Whiteboard is not ready to capture yet.')
      return
    }

    requestSpreadSessionFlush()
    setWhiteboardCaptureBusy(true)
    const prevSelect = args.annotationMode === 'select'
    if (prevSelect) args.setAnnotationMode('pen')

    try {
      await settleLayout()
      await settleLayout()
      const canvas = await captureElementToCanvas(rootEl)
      const blob = await canvasToBlob(canvas, 'png', 0.92)
      const dataUrl = await blobToDataUrl(blob)
      if (!dataUrl) {
        toast.error('Capture produced an empty image.')
        return
      }

      let storagePath: string | undefined
      try {
        const base = buildExportBaseName({
          bookId: args.selectedBookId,
          unitId: args.selectedUnit.id,
          page: args.bookPageAtCapture,
          kind: 'whiteboard-notebook',
        })
        const uploaded = await uploadStudentWorkBlob({
          studentId: args.studentId,
          baseName: base,
          blob,
          category: 'lesson-notes',
          meta: {
            bookId: args.selectedBookId,
            unitId: args.selectedUnit.id,
            page: args.bookPageAtCapture,
            captureKind: 'whiteboard-notebook',
            classSessionId: args.activeClassSessionId,
          },
        })
        storagePath = uploaded.relativePath
      } catch {
        // Notebook still gets an inline data URL if disk upload fails.
      }

      const pageLabel = mapPdfPageToDisplayLabel(
        args.bookPageAtCapture,
        args.selectedBook,
        args.selectedUnit,
        args.numPages,
        args.numberingMode,
      )
      const caption = `Whiteboard · Page ${pageLabel}`

      args.onNotebookIntent?.()
      const baseHtml = args.getNotebookHtmlForSave()

      const result = appendStudentClassLessonNotebookWhiteboardCapture(args.studentId, args.activeClassSessionId, {
        sectionId,
        imageSrc: dataUrl,
        storagePath,
        caption,
        bookId: args.selectedBookId,
        unitId: args.selectedUnit.id,
        pageSpanKey: args.currentNotebookPageSpanKey,
        whiteboardPage: args.bookPageAtCapture,
        tocPartKey: args.currentTocPartKey || undefined,
        lessonPartLabel: args.currentTocPartTitle || undefined,
        clientDocUpdatedAt: args.lessonPaperDocUpdatedAt ?? undefined,
        baseHtml,
      })

      if (!result.ok) {
        if (result.conflict && typeof result.latestHtml === 'string') {
          args.applyNotebookHtml(result.latestHtml, result.latestUpdatedAt ?? args.lessonPaperDocUpdatedAt ?? '')
        }
        toast.error(result.error)
        return
      }

      lastSaveRef.current = { key: dedupeKey, at: now }
      args.applyNotebookHtml(result.html, result.docUpdatedAt)
      if (!args.isLessonPaperOpen) args.setIsLessonPaperOpen(true)
      toast.success('Whiteboard saved to lesson notebook.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save whiteboard to notebook.')
    } finally {
      if (prevSelect) args.setAnnotationMode('select')
      setWhiteboardCaptureBusy(false)
    }
  }, [args])

  return { saveWhiteboardToNotebook, whiteboardCaptureBusy }
}
