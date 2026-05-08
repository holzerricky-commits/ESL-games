import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  applyWatermarkToCanvas,
  buildExportBaseName,
  buildPdfPacketBaseName,
  canvasToBlob,
  captureElementToCanvas,
  copyImageBlobToClipboard,
  cropCanvas,
  domRectToCanvasCrop,
  relativePathUnderStudentWork,
  settleLayout,
  uploadStudentWorkBlob,
  type BookCaptureFormat,
} from '@/lib/books/book-capture'
import { clampPdfPage, getUnitReaderBounds } from '@/lib/books/page-range'
import { saveUnitPage } from '@/lib/books/progress'
import type { BookLibraryPayload } from '@/lib/books/types'

interface UseCaptureExportControllerArgs {
  selectedBookId: string | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  selectedBook: BookLibraryPayload['books'][number] | null
  numPages: number | null
  pdfFrom: string
  pdfTo: string
  isSinglePageMode: boolean
  pageNumber: number
  studentId: string
  hideChromeForCapture: boolean
  watermarkEnabled: boolean
  studentName?: string
  annotationMode: string
  setAnnotationMode: (v: any) => void
  isWhiteboardOpen: boolean
  selectedUnitId: string | null
  annotationTargetPage: number
  whiteboardPage: number
  captureFormat: BookCaptureFormat
  jpegQuality: number
  setPageNumber: (v: number) => void
  setIsSinglePageMode: (v: boolean) => void
  setPdfDialogOpen: (v: boolean) => void
  getCurrentPageCaptureEl: () => HTMLElement | null
  leftPageCaptureRef: React.MutableRefObject<HTMLDivElement | null>
  pageAreaRef: React.MutableRefObject<HTMLDivElement | null>
}

export function useCaptureExportController(args: UseCaptureExportControllerArgs) {
  const [captureFormat, setCaptureFormat] = useState<BookCaptureFormat>(args.captureFormat)
  const [jpegQuality, setJpegQuality] = useState(args.jpegQuality)
  const [hideChromeForCapture, setHideChromeForCapture] = useState(args.hideChromeForCapture)
  const [watermarkEnabled, setWatermarkEnabled] = useState(args.watermarkEnabled)
  const [suppressChrome, setSuppressChrome] = useState(false)
  const [regionSelectOpen, setRegionSelectOpen] = useState(false)
  const [captureBusy, setCaptureBusy] = useState(false)
  const [captionDialog, setCaptionDialog] = useState<{ fileRel: string } | null>(null)
  const [captionDraft, setCaptionDraft] = useState('')
  const [pdfDialogOpen, setPdfDialogOpenState] = useState(false)
  const [pdfFrom, setPdfFrom] = useState(args.pdfFrom)
  const [pdfTo, setPdfTo] = useState(args.pdfTo)
  const [pdfExporting, setPdfExporting] = useState(false)
  const [pdfProgressLabel, setPdfProgressLabel] = useState<string | null>(null)
  const [hasLastImageCapture, setHasLastImageCapture] = useState(false)
  const lastCaptureBlobRef = useRef<Blob | null>(null)

  const formatWatermarkDateLine = useCallback(() => {
    const d = new Date()
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }, [])

  const runImageCapture = useCallback(
    async (opts: {
      kind: 'full' | 'page' | 'region'
      regionCss?: DOMRect | Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>
    }): Promise<void> => {
      const rootEl = opts.kind === 'full' || opts.kind === 'region' ? args.pageAreaRef.current : args.getCurrentPageCaptureEl()
      if (!rootEl) {
        toast.error('Nothing to capture yet.')
        return
      }
      if (!args.selectedBookId || !args.selectedUnit) {
        toast.error('Open a book unit first.')
        return
      }

      const metaPage = args.isWhiteboardOpen ? args.whiteboardPage : args.isSinglePageMode ? args.pageNumber : args.annotationTargetPage
      setCaptureBusy(true)
      const prevLaser = args.annotationMode === 'laser'
      if (prevLaser) args.setAnnotationMode('pen')
      const useSuppress = hideChromeForCapture
      if (useSuppress) setSuppressChrome(true)
      await settleLayout(); await settleLayout()
      try {
        let canvas = await captureElementToCanvas(rootEl)
        if (opts.kind === 'region' && opts.regionCss) {
          const cropPx = domRectToCanvasCrop(canvas, opts.regionCss, rootEl.offsetWidth, rootEl.offsetHeight)
          canvas = cropCanvas(canvas, cropPx)
        }
        if (watermarkEnabled && args.studentName?.trim()) {
          canvas = applyWatermarkToCanvas(canvas, `${args.studentName.trim()} · ${formatWatermarkDateLine()}`)
        }
        const blob = await canvasToBlob(canvas, captureFormat, jpegQuality)
        lastCaptureBlobRef.current = blob
        setHasLastImageCapture(true)
        const base = buildExportBaseName({ bookId: args.selectedBookId, unitId: args.selectedUnit.id, page: metaPage, kind: opts.kind === 'full' ? 'full' : opts.kind === 'page' ? 'page' : 'region' })
        const { relativePath } = await uploadStudentWorkBlob({
          studentId: args.studentId,
          baseName: base,
          blob,
          category: 'exports-book-review',
          meta: {
            bookId: args.selectedBookId,
            unitId: args.selectedUnit.id,
            page: metaPage,
            captureKind: opts.kind,
            format: captureFormat,
            watermarked: watermarkEnabled,
            studentName: args.studentName?.trim(),
            exportedAt: new Date().toISOString(),
            unitTitle: args.selectedUnit.title,
          },
        })
        toast.success(`Saved ${relativePath}`)
        setCaptionDialog({ fileRel: relativePathUnderStudentWork(relativePath) })
        setCaptionDraft('')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Capture failed')
      } finally {
        if (useSuppress) setSuppressChrome(false)
        if (prevLaser) args.setAnnotationMode('laser')
        setCaptureBusy(false)
        await settleLayout()
      }
    },
    [args, captureFormat, formatWatermarkDateLine, hideChromeForCapture, jpegQuality, watermarkEnabled],
  )

  const runPdfPacketExport = useCallback(async (): Promise<void> => {
    if (args.isWhiteboardOpen) {
      toast.error('Close the whiteboard before exporting a page-range PDF.')
      return
    }
    if (!args.selectedBookId || !args.selectedUnit || args.numPages == null) {
      toast.error('Open a book unit first.')
      return
    }
    const bounds = getUnitReaderBounds(args.selectedUnit, args.numPages, args.selectedBook ?? undefined)
    const from = Math.max(bounds.min, Math.min(bounds.max, parseInt(pdfFrom, 10) || bounds.min))
    const to = Math.max(from, Math.min(bounds.max, parseInt(pdfTo, 10) || from))
    if (to - from + 1 > 40) {
      toast.error('Select at most 40 pages for one PDF.')
      return
    }
    const prevSpread = args.isSinglePageMode
    const prevPage = args.pageNumber
    const prevLaser = args.annotationMode === 'laser'
    if (prevLaser) args.setAnnotationMode('pen')
    setPdfExporting(true)
    setPdfDialogOpenState(false)
    args.setPdfDialogOpen(false)
    setCaptureBusy(true)
    const useSuppress = hideChromeForCapture
    if (useSuppress) setSuppressChrome(true)
    const jpegDataUrls: string[] = []
    let pageW = 0, pageH = 0
    try {
      args.setIsSinglePageMode(true)
      await settleLayout()
      for (let p = from; p <= to; p++) {
        setPdfProgressLabel(`Rendering page ${p} of ${to}…`)
        args.setPageNumber(p)
        await new Promise<void>((r) => setTimeout(() => r(), 420))
        await settleLayout(); await settleLayout()
        const el = args.leftPageCaptureRef.current
        if (!el) throw new Error('Page surface not ready')
        let canvas = await captureElementToCanvas(el)
        if (watermarkEnabled && args.studentName?.trim()) {
          canvas = applyWatermarkToCanvas(canvas, `${args.studentName.trim()} · ${formatWatermarkDateLine()}`)
        }
        if (p === from) { pageW = canvas.width; pageH = canvas.height }
        jpegDataUrls.push(canvas.toDataURL('image/jpeg', 0.92))
      }
      const { jsPDF } = await import('jspdf/dist/jspdf.es.min.js')
      const orientation = pageW >= pageH ? 'landscape' : 'portrait'
      const doc = new jsPDF({ orientation, unit: 'px', format: [pageW, pageH] })
      jpegDataUrls.forEach((dataUrl, i) => {
        if (i > 0) doc.addPage([pageW, pageH], orientation === 'landscape' ? 'l' : 'p')
        doc.addImage(dataUrl, 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST')
      })
      const pdfBlob = doc.output('blob')
      const base = buildPdfPacketBaseName({ bookId: args.selectedBookId, unitId: args.selectedUnit.id, pageFrom: from, pageTo: to })
      const typedPdf = new File([pdfBlob], `${base}.pdf`, { type: 'application/pdf' })
      const { relativePath } = await uploadStudentWorkBlob({
        studentId: args.studentId,
        baseName: base,
        blob: typedPdf,
        category: 'exports-book-review',
        meta: { bookId: args.selectedBookId, unitId: args.selectedUnit.id, pageFrom: from, pageTo: to, captureKind: 'pdf-packet', format: 'pdf', watermarked: watermarkEnabled, studentName: args.studentName?.trim(), exportedAt: new Date().toISOString(), unitTitle: args.selectedUnit.title },
      })
      toast.success(`Saved ${relativePath}`)
      setCaptionDialog({ fileRel: relativePathUnderStudentWork(relativePath) })
      setCaptionDraft('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF export failed')
    } finally {
      args.setIsSinglePageMode(prevSpread)
      args.setPageNumber(prevPage)
      if (args.selectedBookId && args.selectedUnitId && args.numPages != null && args.selectedUnit) {
        const bounds = getUnitReaderBounds(args.selectedUnit, args.numPages, args.selectedBook ?? undefined)
        saveUnitPage(args.selectedBookId, args.selectedUnitId, clampPdfPage(prevPage, bounds))
      }
      if (useSuppress) setSuppressChrome(false)
      if (prevLaser) args.setAnnotationMode('laser')
      setPdfProgressLabel(null)
      setPdfExporting(false)
      setCaptureBusy(false)
      await settleLayout()
    }
  }, [args, formatWatermarkDateLine, hideChromeForCapture, pdfFrom, pdfTo, watermarkEnabled])

  const copyLastCaptureToClipboard = useCallback(async (): Promise<void> => {
    const b = lastCaptureBlobRef.current
    if (!b) return
    try {
      let clipBlob: Blob = b
      if (b.type !== 'image/png') {
        const url = URL.createObjectURL(b)
        try {
          const img = document.createElement('img')
          img.decoding = 'async'
          img.src = url
          await img.decode()
          const c = document.createElement('canvas')
          c.width = img.naturalWidth
          c.height = img.naturalHeight
          c.getContext('2d')?.drawImage(img, 0, 0)
          clipBlob = await canvasToBlob(c, 'png')
        } finally {
          URL.revokeObjectURL(url)
        }
      }
      await copyImageBlobToClipboard(clipBlob)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Clipboard copy failed.')
    }
  }, [])

  return {
    captureFormat, setCaptureFormat,
    jpegQuality, setJpegQuality,
    hideChromeForCapture, setHideChromeForCapture,
    watermarkEnabled, setWatermarkEnabled,
    suppressChrome, setSuppressChrome,
    regionSelectOpen, setRegionSelectOpen,
    captureBusy, setCaptureBusy,
    captionDialog, setCaptionDialog,
    captionDraft, setCaptionDraft,
    pdfDialogOpen, setPdfDialogOpen: setPdfDialogOpenState,
    pdfFrom, setPdfFrom,
    pdfTo, setPdfTo,
    pdfExporting, setPdfExporting,
    pdfProgressLabel, setPdfProgressLabel,
    hasLastImageCapture, setHasLastImageCapture,
    runImageCapture,
    runPdfPacketExport,
    copyLastCaptureToClipboard,
  }
}
