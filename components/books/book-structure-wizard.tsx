'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  BookMarked,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Ghost,
  Languages,
  Link2,
  PenLine,
  Pointer,
  Pencil,
  Trash2,
} from 'lucide-react'
import { BookCoverThumbnail } from '@/components/books/book-cover-thumbnail'
import {
  StructureWizardField,
  StructureWizardFieldRow,
  StructureWizardStepPanel,
} from '@/components/books/structure-wizard-step-panel'
import { StructureWizardStepper } from '@/components/books/structure-wizard-stepper'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { bookHasCustomCover } from '@/lib/books/book-cover-display'
import { toast } from 'sonner'
import type { BookLessonPartRecord, BookLessonRecord, BookLibraryPayload, BookRecord } from '@/lib/books/types'
import { captureTocRangeAsJpegs } from '@/lib/books/capture-toc-images-client'
import { detectTocPdfRangeFromFileUrl } from '@/lib/books/detect-toc-range-client'
import { BOOK_OUTLINE_PAGE_BADGE_CLASS, bookOutlinePartStoryShellClass } from '@/components/books/book-outline-part-row'
import { getPartPrimaryLabel } from '@/lib/books/part-section-display'
import {
  partVisualKindFromStructureTag,
  storySubtitleForVisualKind,
} from '@/lib/books/book-part-visual-kind'
import { normalizeLessonsStructureTags, resolvePartStructureTag } from '@/lib/books/part-structure-tag'
import { draftsToUnits, type TocUnitDraft } from '@/lib/books/toc-import'
import { formatTocChunkTitle } from '@/lib/books/lesson-title'
import { resolveTocExtractProfileForBook, tocChunkLabelStyleForProfile } from '@/lib/books/toc-extract-profile'
import { pageRangeForIndex } from '@/lib/books/toc-page-range'
import { bookHasTocMapping, stripBookTocMapping } from '@/lib/books/strip-book-toc-mapping'
import {
  ManualStoryReconcileDialog,
  type ManualStoryReconcileCandidateRow,
  type ManualStoryReconcileDecisionRow,
} from '@/components/books/manual-story-reconcile-dialog'
import {
  buildPageAlignmentRuntime,
  mergeCoverIntoHiddenPages,
  resolveEffectiveAnchorToPdfPage,
} from '@/lib/books/page-alignment-runtime'
import { resolveStoryTitleThumbPdfPage } from '@/lib/books/story-thumb-pdf-page'
import { SpreadPageCluster } from '@/components/books/spread-page-cluster'
import {
  computeSpreadClusterMetrics,
  computeSpreadFitScale,
  computeSpreadPageWidth,
} from '@/lib/books/spread-viewport-layout'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DEFAULT_SPREAD_GUTTER_PULL_RATIO,
  resolveSpreadGutterPullRatio,
} from '@/lib/books/spread-gutter'
import {
  advanceFurthestStructureWizardStep,
  canContinueFromToc,
  canEnterReview,
  initialStructureWizardStep,
  isStructureWizardStepReachable,
  type StructureWizardStep,
} from '@/lib/books/structure-wizard-steps'
import { cn } from '@/lib/utils'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), { ssr: false })
const PdfPage = dynamic(() => import('react-pdf').then((mod) => mod.Page), { ssr: false })
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const
const DEFAULT_PREVIEW_PAGE_ASPECT_RATIO = 1 / 1.414

function parsePositiveInt(raw: string): number | null {
  const n = Math.floor(Number.parseInt(raw.trim(), 10))
  return Number.isFinite(n) && n >= 1 ? n : null
}

function clampPreviewPageNumber(page: number, totalPages: number | null): number {
  const rounded = Math.max(1, Math.floor(page))
  return totalPages == null ? rounded : Math.min(rounded, totalPages)
}

function formatPageSpan(start: number | null, end: number | null): string {
  if (start == null) return '(—)'
  if (end == null || end <= start) return `(${start})`
  return `(${start}-${end})`
}

function pageInputValue(page: number | undefined): string {
  return typeof page === 'number' && Number.isFinite(page) ? String(page) : ''
}

function nearestVisiblePage(current: number, visiblePages: number[]): number {
  if (!visiblePages.length) return 1
  if (visiblePages.includes(current)) return current
  const next = visiblePages.find((page) => page >= current)
  return next ?? visiblePages[visiblePages.length - 1]!
}

function firstMappedLessonStart(lessons: BookLessonRecord[]): number | null {
  let minStart: number | null = null
  for (const lesson of lessons) {
    const start = typeof lesson.startPageHint === 'number' ? Math.round(lesson.startPageHint) : null
    if (start == null) continue
    if (minStart == null || start < minStart) minStart = start
  }
  return minStart
}

function parsePageListInput(raw: string): number[] {
  const out = new Set<number>()
  const tokens = raw.split(/[,\s]+/).map((token) => token.trim()).filter(Boolean)
  for (const token of tokens) {
    if (/^\d+-\d+$/.test(token)) {
      const [left, right] = token.split('-').map((part) => Number.parseInt(part, 10))
      if (!Number.isFinite(left) || !Number.isFinite(right)) continue
      const start = Math.max(1, Math.min(left, right))
      const end = Math.max(1, Math.max(left, right))
      for (let page = start; page <= end; page++) out.add(page)
      continue
    }
    const page = Number.parseInt(token, 10)
    if (Number.isFinite(page) && page >= 1) out.add(page)
  }
  return [...out].sort((a, b) => a - b)
}

function stringifyPageListInput(pages: number[]): string {
  return [...new Set(pages)].sort((a, b) => a - b).join(', ')
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items]
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function mergeExtractedStructureBatches(
  batches: Array<{ drafts: TocUnitDraft[]; lessonsByUnit: BookLessonRecord[][] }>,
): { drafts: TocUnitDraft[]; lessonsByUnit: BookLessonRecord[][] } {
  const mergedDrafts: TocUnitDraft[] = []
  const mergedLessons: BookLessonRecord[][] = []
  for (const batch of batches) {
    for (let i = 0; i < batch.drafts.length; i++) {
      const nextDraft = batch.drafts[i]
      const nextLessons = batch.lessonsByUnit[i] ?? []
      const prevDraft = mergedDrafts[mergedDrafts.length - 1]
      const prevLessons = mergedLessons[mergedLessons.length - 1] ?? []
      const shouldMergeWithPrev =
        !!prevDraft &&
        prevDraft.title.trim().toLowerCase() === nextDraft.title.trim().toLowerCase()
      if (!shouldMergeWithPrev) {
        mergedDrafts.push(nextDraft)
        mergedLessons.push(nextLessons)
        continue
      }
      const combinedLessons = [...prevLessons, ...nextLessons]
      combinedLessons.sort(
        (a, b) =>
          (typeof a.startPageHint === 'number' ? a.startPageHint : Number.MAX_SAFE_INTEGER)
          - (typeof b.startPageHint === 'number' ? b.startPageHint : Number.MAX_SAFE_INTEGER),
      )
      mergedLessons[mergedLessons.length - 1] = combinedLessons
      if (
        typeof nextDraft.startPageHint === 'number' &&
        (typeof prevDraft.startPageHint !== 'number' || nextDraft.startPageHint < prevDraft.startPageHint)
      ) {
        mergedDrafts[mergedDrafts.length - 1] = { ...prevDraft, startPageHint: nextDraft.startPageHint }
      }
    }
  }
  return { drafts: mergedDrafts, lessonsByUnit: mergedLessons }
}

function makeUnitFileUrl(filePath: string): string {
  return `/api/book-file?path=${encodeURIComponent(filePath)}`
}

function uniqueSortedFilePaths(book: BookRecord): string[] {
  return [...new Set(book.units.map((u) => u.filePath))].sort()
}

function fileBasename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const slash = normalized.lastIndexOf('/')
  return slash >= 0 ? normalized.slice(slash + 1) : normalized
}

function newBookChildId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

function stampDraftsFilePath(drafts: TocUnitDraft[], filePath: string): TocUnitDraft[] {
  const path = filePath.trim()
  if (!path) return drafts
  return drafts.map((d) => ({ ...d, filePath: path }))
}

function restoreOutlineDraftsFromBook(book: BookRecord): {
  drafts: TocUnitDraft[]
  lessonsByUnitIndex: BookLessonRecord[][]
  hasMapping: boolean
} {
  const hasMapping = bookHasTocMapping(book)
  if (!hasMapping) {
    return { drafts: [], lessonsByUnitIndex: [], hasMapping: false }
  }
  const drafts: TocUnitDraft[] = book.units.map((unit) => ({
    id: unit.id,
    title: unit.title,
    needsReview: false,
    filePath: unit.filePath,
    ...(typeof unit.startPageHint === 'number' ? { startPageHint: unit.startPageHint } : {}),
    ...(typeof unit.endPageHint === 'number' ? { endPageHint: unit.endPageHint } : {}),
    ...(unit.anchorConfidence ? { anchorConfidence: unit.anchorConfidence } : {}),
    ...(unit.anchorSource ? { anchorSource: unit.anchorSource } : {}),
  }))
  const lessonsByUnitIndex = book.units.map((unit) =>
    normalizeLessonsStructureTags(structuredClone(unit.lessons ?? [])),
  )
  return { drafts, lessonsByUnitIndex, hasMapping: true }
}

export type BookStructureManifestSaveMeta = {
  bookId: string
  focusUnitId?: string
}

export interface BookStructureWizardProps {
  library: BookLibraryPayload
  preferredBookId: string | null
  preferredFilePath: string | null
  onManifestSaved: (payload: BookLibraryPayload, meta?: BookStructureManifestSaveMeta) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function BookStructureWizard({ library, preferredBookId, preferredFilePath, onManifestSaved, open: controlledOpen, onOpenChange }: BookStructureWizardProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [bookId, setBookId] = useState('')
  const [sourceFilePath, setSourceFilePath] = useState('')
  const [tocFrom, setTocFrom] = useState('1')
  const [tocTo, setTocTo] = useState('3')
  const [notCountedPdfPagesInput, setNotCountedPdfPagesInput] = useState('')
  const [hiddenPdfPagesInput, setHiddenPdfPagesInput] = useState('')
  const [previewPage, setPreviewPage] = useState(1)
  const [previewPageJumpDraft, setPreviewPageJumpDraft] = useState('1')
  const [previewPageJumpFocused, setPreviewPageJumpFocused] = useState(false)
  const [previewNumPages, setPreviewNumPages] = useState<number | null>(null)
  const [pdfReady, setPdfReady] = useState(false)
  const [drafts, setDrafts] = useState<TocUnitDraft[]>([])
  const [lessonsByUnitIndex, setLessonsByUnitIndex] = useState<BookLessonRecord[][]>([])
  const [aiExtracting, setAiExtracting] = useState(false)
  const [wizardStep, setWizardStep] = useState<StructureWizardStep>('toc')
  const [furthestStep, setFurthestStep] = useState<StructureWizardStep>('toc')
  const [tocRangeAtExtract, setTocRangeAtExtract] = useState<{ from: number; to: number } | null>(null)
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [reconcileBusy, setReconcileBusy] = useState(false)
  const [reconcileCandidates, setReconcileCandidates] = useState<ManualStoryReconcileCandidateRow[]>([])
  const [reconcilePending, setReconcilePending] = useState(false)
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [stagedExtractionEnabled, setStagedExtractionEnabled] = useState(false)
  const [tocDetectStatus, setTocDetectStatus] = useState<'idle' | 'scanning' | 'ready' | 'failed'>('idle')
  const [tocDetectMessage, setTocDetectMessage] = useState<string | null>(null)
  const [tocDetectSuggestion, setTocDetectSuggestion] = useState<{
    from: number
    to: number
    confidence: 'high' | 'medium' | 'low'
  } | null>(null)
  const tocDetectRunIdRef = useRef(0)
  const tocAutoDetectPathRef = useRef<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastNumPages, setLastNumPages] = useState<number | null>(null)
  const [structureUnitIdx, setStructureUnitIdx] = useState(0)
  const [previewPageAspectRatio, setPreviewPageAspectRatio] = useState(DEFAULT_PREVIEW_PAGE_ASPECT_RATIO)
  const [previewViewportSize, setPreviewViewportSize] = useState({ w: 0, h: 0 })
  const previewViewportRef = useRef<HTMLDivElement | null>(null)
  const previewViewportRoRef = useRef<ResizeObserver | null>(null)

  const attachPreviewViewport = useCallback((el: HTMLDivElement | null) => {
    previewViewportRoRef.current?.disconnect()
    previewViewportRoRef.current = null
    previewViewportRef.current = el
    if (!el) {
      setPreviewViewportSize({ w: 0, h: 0 })
      return
    }
    const sync = () => {
      const bounds = el.getBoundingClientRect()
      if (!(bounds.width > 0) || !(bounds.height > 0)) return
      setPreviewViewportSize({ w: bounds.width, h: bounds.height })
    }
    sync()
    requestAnimationFrame(sync)
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    previewViewportRoRef.current = ro
  }, [])

  const [selectedUnitIndicesForMerge, setSelectedUnitIndicesForMerge] = useState<Set<number>>(() => new Set())
  const [openLessonId, setOpenLessonId] = useState<string | null>(null)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [unitTocRangeById, setUnitTocRangeById] = useState<Record<string, { from: string; to: string }>>({})
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const libraryRef = useRef(library)
  libraryRef.current = library

  const selectedBook = useMemo(() => library.books.find((b) => b.id === bookId) ?? null, [library.books, bookId])
  const sourcePathsForBook = useMemo(
    () => (selectedBook ? uniqueSortedFilePaths(selectedBook) : []),
    [selectedBook],
  )

  const resetWizardChrome = useCallback(() => {
    setSelectedUnitIndicesForMerge(new Set())
    setOpenLessonId(null)
    setEditingFieldId(null)
    setUnitTocRangeById({})
    setTocFrom('1')
    setTocTo('3')
    setAiMessage(null)
    setStagedExtractionEnabled(false)
    setTocDetectStatus('idle')
    setTocDetectMessage(null)
    setTocDetectSuggestion(null)
    tocDetectRunIdRef.current += 1
    tocAutoDetectPathRef.current = null
  }, [])

  const applyBookSession = useCallback(
    (book: BookRecord, preferredFile: string | null | undefined) => {
      setBookId(book.id)
      const paths = uniqueSortedFilePaths(book)
      const nextPath =
        (preferredFile && paths.includes(preferredFile) ? preferredFile : null) ?? paths[0] ?? ''
      setSourceFilePath(nextPath)
      const restored = restoreOutlineDraftsFromBook(book)
      setDrafts(restored.drafts)
      setLessonsByUnitIndex(restored.lessonsByUnitIndex)
      setStructureUnitIdx(0)
      const startStep = initialStructureWizardStep(restored.hasMapping)
      setWizardStep(startStep)
      setFurthestStep(startStep)
      setTocRangeAtExtract(null)
      setReconcilePending(false)
      setReconcileCandidates([])
      setReconcileOpen(false)
      resetWizardChrome()
    },
    [resetWizardChrome],
  )

  // Load the preferred book when the wizard opens — do not reload on every library refresh
  // (that was wiping in-progress AI drafts / wrong-book drafts).
  useEffect(() => {
    if (!open) return
    const books = libraryRef.current.books
    const first = books[0]
    const initialBook = (preferredBookId && books.find((b) => b.id === preferredBookId)) ?? first
    if (!initialBook) return
    applyBookSession(initialBook, preferredFilePath)
  }, [open, preferredBookId, preferredFilePath, applyBookSession])

  const tocRange = useMemo(() => {
    const from = parsePositiveInt(tocFrom)
    const to = parsePositiveInt(tocTo)
    if (from == null || to == null || from > to) return null
    return { from, to }
  }, [tocFrom, tocTo])
  const notCountedPdfPages = useMemo(() => parsePageListInput(notCountedPdfPagesInput), [notCountedPdfPagesInput])
  const hiddenPdfPagesParsed = useMemo(() => parsePageListInput(hiddenPdfPagesInput), [hiddenPdfPagesInput])
  const hiddenPdfPages = useMemo(
    () => mergeCoverIntoHiddenPages(hiddenPdfPagesParsed),
    [hiddenPdfPagesParsed],
  )
  const canRunAi = Boolean(sourceFilePath && tocRange && !aiExtracting)
  const tocPageCount = useMemo(() => {
    if (!tocRange) return 0
    return tocRange.to - tocRange.from + 1
  }, [tocRange])
  const recommendStagedExtraction = tocPageCount >= 6
  const previewUrl = sourceFilePath ? makeUnitFileUrl(sourceFilePath) : null

  const runTocAutoDetect = useCallback(
    async (options?: { applyRange?: boolean }) => {
      if (!previewUrl) {
        setTocDetectStatus('failed')
        setTocDetectSuggestion(null)
        setTocDetectMessage('Add a PDF source file before detecting contents pages.')
        return
      }
      const runId = ++tocDetectRunIdRef.current
      setTocDetectStatus('scanning')
      setTocDetectMessage('Scanning early pages for a table of contents…')
      setTocDetectSuggestion(null)
      try {
        const result = await detectTocPdfRangeFromFileUrl(previewUrl, {
          onProgress: (message) => {
            if (runId !== tocDetectRunIdRef.current) return
            setTocDetectMessage(message)
          },
        })
        if (runId !== tocDetectRunIdRef.current) return
        if (!result.ok) {
          setTocDetectStatus('failed')
          setTocDetectSuggestion(null)
          if (result.reason === 'no_text') {
            setTocDetectMessage(
              'No selectable text in early pages (common with scans). Set the PDF range by hand and check the preview.',
            )
          } else if (result.reason === 'no_file') {
            setTocDetectMessage('No PDF loaded yet.')
          } else {
            setTocDetectMessage(
              'Couldn’t spot a contents section automatically. Set From/To by hand and confirm in the preview.',
            )
          }
          return
        }
        const { proposal } = result
        setTocDetectSuggestion({
          from: proposal.from,
          to: proposal.to,
          confidence: proposal.confidence,
        })
        setTocDetectStatus('ready')
        const confidenceLabel =
          proposal.confidence === 'high' ? 'Strong match' : proposal.confidence === 'medium' ? 'Likely match' : 'Weak match'
        setTocDetectMessage(
          `${confidenceLabel}: PDF pages ${proposal.from}–${proposal.to}. Check the preview, then continue.`,
        )
        if (options?.applyRange !== false) {
          setTocFrom(String(proposal.from))
          setTocTo(String(proposal.to))
          setPreviewPage(proposal.from)
          setPreviewPageJumpDraft(String(proposal.from))
        }
      } catch {
        if (runId !== tocDetectRunIdRef.current) return
        setTocDetectStatus('failed')
        setTocDetectSuggestion(null)
        setTocDetectMessage('Detection failed. Set the PDF range by hand.')
      }
    },
    [previewUrl],
  )

  useEffect(() => {
    if (!open || wizardStep !== 'toc' || !previewUrl || !sourceFilePath) return
    if (tocAutoDetectPathRef.current === sourceFilePath) return
    tocAutoDetectPathRef.current = sourceFilePath
    void runTocAutoDetect({ applyRange: true })
  }, [open, wizardStep, previewUrl, sourceFilePath, runTocAutoDetect])

  const alignmentRuntime = useMemo(
    () => buildPageAlignmentRuntime(previewNumPages, hiddenPdfPagesParsed, notCountedPdfPages),
    [previewNumPages, hiddenPdfPagesParsed, notCountedPdfPages],
  )
  const visiblePreviewPages = alignmentRuntime.visiblePdfPages
  const previewLeftPage = useMemo(
    () => nearestVisiblePage(previewPage, visiblePreviewPages),
    [previewPage, visiblePreviewPages],
  )
  const previewRightPage = useMemo(() => {
    const idx = visiblePreviewPages.indexOf(previewLeftPage)
    if (idx < 0) return null
    return visiblePreviewPages[idx + 1] ?? null
  }, [previewLeftPage, visiblePreviewPages])
  const previewLeftEffective = alignmentRuntime.effectivePageByPdf.get(previewLeftPage) ?? null
  const previewRightEffective = previewRightPage != null
    ? (alignmentRuntime.effectivePageByPdf.get(previewRightPage) ?? null)
    : null

  const effectiveHintFromPdfPreview = useCallback(
    (pdfPage: number): number => {
      const vis = nearestVisiblePage(pdfPage, visiblePreviewPages)
      let p = vis
      while (p >= 1) {
        const e = alignmentRuntime.effectivePageByPdf.get(p)
        if (e != null) return e
        p -= 1
      }
      return 1
    },
    [alignmentRuntime, visiblePreviewPages],
  )

  const effectiveHintForNewAnchors = useMemo(
    () => previewLeftEffective ?? effectiveHintFromPdfPreview(previewLeftPage),
    [previewLeftEffective, previewLeftPage, effectiveHintFromPdfPreview],
  )

  const clampEffectiveDraftHint = useCallback(
    (value: number): number => {
      const max =
        alignmentRuntime.effectiveTotal > 0
          ? alignmentRuntime.effectiveTotal
          : previewNumPages ?? 10_000_000
      return Math.max(1, Math.min(Math.round(value), max))
    },
    [alignmentRuntime.effectiveTotal, previewNumPages],
  )

  const selectedUnitPageRange = useMemo(() => {
    if (!drafts?.length) return { start: null as number | null, end: null as number | null }
    return pageRangeForIndex(drafts, structureUnitIdx, 1, lastNumPages)
  }, [drafts, structureUnitIdx, lastNumPages])
  const selectedUnitFirstLessonStart = useMemo(() => {
    const lessons = lessonsByUnitIndex[structureUnitIdx] ?? []
    return firstMappedLessonStart(lessons)
  }, [lessonsByUnitIndex, structureUnitIdx])
  const selectedUnitCoverRange = useMemo(() => {
    const start = selectedUnitPageRange.start
    const firstLesson = selectedUnitFirstLessonStart
    if (start == null || firstLesson == null) return { start: null as number | null, end: null as number | null }
    if (firstLesson <= start) return { start: null as number | null, end: null as number | null }
    return { start, end: firstLesson - 1 }
  }, [selectedUnitFirstLessonStart, selectedUnitPageRange.start])

  const clampPreviewPage = useCallback((page: number, totalPages = previewNumPages) => {
    return clampPreviewPageNumber(page, totalPages)
  }, [previewNumPages])

  const resolveAnchorToPdfPage = useCallback((anchorPage: number): number | null => {
    const mapped = resolveEffectiveAnchorToPdfPage(anchorPage, alignmentRuntime)
    if (mapped != null) return mapped
    return clampPreviewPage(anchorPage)
  }, [alignmentRuntime, clampPreviewPage])

  useEffect(() => {
    let mounted = true
    async function setupPdfWorker() {
      const { pdfjs } = await import('react-pdf')
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      if (mounted) setPdfReady(true)
    }
    void setupPdfWorker()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!open) return
    if (recommendStagedExtraction) setStagedExtractionEnabled(true)
  }, [open, recommendStagedExtraction])

  useEffect(() => {
    setUnitTocRangeById((prev) => {
      const next: Record<string, { from: string; to: string }> = {}
      for (let i = 0; i < drafts.length; i++) {
        const draft = drafts[i]
        if (!draft) continue
        const existing = prev[draft.id]
        if (existing) {
          next[draft.id] = existing
          continue
        }
        const range = pageRangeForIndex(drafts, i, 1, lastNumPages)
        next[draft.id] = {
          from: range.start != null ? String(range.start) : '',
          to: range.end != null ? String(range.end) : '',
        }
      }
      return next
    })
  }, [drafts, lastNumPages])

  useEffect(() => {
    setPreviewNumPages(null)
    setLastNumPages(null)
    setPreviewPage(1)
  }, [sourceFilePath])

  useEffect(() => {
    if (!selectedBook || !sourceFilePath) {
      setNotCountedPdfPagesInput('')
      setHiddenPdfPagesInput('')
      return
    }
    const saved = selectedBook.pageAlignmentByFile?.[sourceFilePath]
    setNotCountedPdfPagesInput(stringifyPageListInput(saved?.notCountedPdfPages ?? []))
    setHiddenPdfPagesInput(stringifyPageListInput(mergeCoverIntoHiddenPages(saved?.hiddenPdfPages)))
  }, [selectedBook, sourceFilePath])

  /** Preview only — seam overlap editing retired from structure wizard. */
  const previewSpreadGutterPullRatio = useMemo(() => {
    if (!selectedBook) return DEFAULT_SPREAD_GUTTER_PULL_RATIO
    return resolveSpreadGutterPullRatio(selectedBook, sourceFilePath || null)
  }, [selectedBook, sourceFilePath])

  useEffect(() => {
    setPreviewPageAspectRatio(DEFAULT_PREVIEW_PAGE_ASPECT_RATIO)
  }, [sourceFilePath])

  useEffect(() => () => {
    previewViewportRoRef.current?.disconnect()
    previewViewportRoRef.current = null
  }, [])

  const previewSpreadPageWidth = useMemo(() => {
    const { w, h } = previewViewportSize
    if (!(w > 0) || !(h > 0)) return 320
    // Wizard preview: size pages only (no open-book frame chrome) so more of the PDF is visible.
    return computeSpreadPageWidth(w, h, previewPageAspectRatio, 1, false)
  }, [previewViewportSize, previewPageAspectRatio])

  const previewCluster = useMemo(
    () => computeSpreadClusterMetrics(previewSpreadPageWidth, previewPageAspectRatio, previewSpreadGutterPullRatio),
    [previewSpreadPageWidth, previewPageAspectRatio, previewSpreadGutterPullRatio],
  )

  const previewFitScale = useMemo(
    () =>
      computeSpreadFitScale(
        previewViewportSize.w,
        previewViewportSize.h,
        previewCluster.spreadOverlayWidthPx,
        previewCluster.pageCanvasHeightPx,
        false,
      ),
    [previewViewportSize, previewCluster.spreadOverlayWidthPx, previewCluster.pageCanvasHeightPx],
  )

  const onPreviewPdfPageLoadSuccess = useCallback(
    (page: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => {
      const ow = page.originalWidth ?? page.width
      const oh = page.originalHeight ?? page.height
      if (!(ow > 0) || !(oh > 0)) return
      const ratio = ow / oh
      if (Number.isFinite(ratio) && ratio > 0) setPreviewPageAspectRatio(ratio)
    },
    [],
  )

  function goToPreviewPage(nextPage: number) {
    setPreviewPage(clampPreviewPage(nearestVisiblePage(nextPage, visiblePreviewPages)))
  }

  const commitPreviewPageJump = useCallback(() => {
    const raw = previewPageJumpDraft.trim()
    const match = raw.match(/^(\d+)/)
    if (!match) {
      setPreviewPageJumpDraft(String(previewLeftEffective ?? previewLeftPage))
      return
    }
    const anchor = parseInt(match[1]!, 10)
    if (!Number.isFinite(anchor)) return
    const pdfPage = resolveEffectiveAnchorToPdfPage(anchor, alignmentRuntime)
    if (pdfPage != null) {
      goToPreviewPage(pdfPage)
      return
    }
    if (previewNumPages != null) {
      goToPreviewPage(clampPreviewPageNumber(anchor, previewNumPages))
    }
  }, [
    alignmentRuntime,
    previewLeftEffective,
    previewLeftPage,
    previewNumPages,
    previewPageJumpDraft,
    visiblePreviewPages,
  ])

  function goToMappedAnchorPage(anchorPage: number | null | undefined) {
    if (typeof anchorPage !== 'number' || !Number.isFinite(anchorPage)) return
    const targetPdfPage = resolveEffectiveAnchorToPdfPage(anchorPage, alignmentRuntime)
    if (targetPdfPage == null) return
    goToPreviewPage(targetPdfPage)
  }

  function goToPreviewSpread(direction: -1 | 1) {
    if (!visiblePreviewPages.length) return
    const leftIndex = Math.max(0, visiblePreviewPages.indexOf(previewLeftPage))
    const nextLeftIndex = Math.max(0, Math.min(leftIndex + direction * 2, visiblePreviewPages.length - 1))
    const nextPage = visiblePreviewPages[nextLeftIndex] ?? previewLeftPage
    goToPreviewPage(nextPage)
  }

  function onPreviewDocumentLoadSuccess(meta: { numPages: number }) {
    setPreviewNumPages(meta.numPages)
    setLastNumPages(meta.numPages)
    setPreviewPage((page) => nearestVisiblePage(Math.min(Math.max(1, page), meta.numPages), visiblePreviewPages))
  }

  useEffect(() => {
    if (!visiblePreviewPages.length) return
    if (!visiblePreviewPages.includes(previewPage)) {
      setPreviewPage(nearestVisiblePage(previewPage, visiblePreviewPages))
    }
  }, [previewPage, visiblePreviewPages])

  useEffect(() => {
    if (previewPageJumpFocused) return
    setPreviewPageJumpDraft(String(previewLeftEffective ?? previewLeftPage))
  }, [previewLeftEffective, previewLeftPage, previewPageJumpFocused])

  useEffect(() => {
    setPreviewPageJumpFocused(false)
  }, [sourceFilePath])

  const tocExtractProfile = useMemo(
    () => (selectedBook ? resolveTocExtractProfileForBook(selectedBook) : 'journeys'),
    [selectedBook],
  )

  const extractBatchesWithAi = useCallback(async (
    images: Array<{ pdfPage: number; mimeType: string; base64: string }>,
    numPages: number,
  ): Promise<{ drafts: TocUnitDraft[]; lessonsByUnit: BookLessonRecord[][] }> => {
    const chunks = stagedExtractionEnabled
      ? (function planStagedBatches() {
          if (images.length <= 3) return [images]
          const phaseCount = images.length >= 9 ? 3 : 2
          const out: typeof images[] = []
          for (let phase = 0; phase < phaseCount; phase++) {
            const start = Math.floor((phase * images.length) / phaseCount)
            const end = Math.floor(((phase + 1) * images.length) / phaseCount)
            out.push(images.slice(start, end))
          }
          return out.filter((batch) => batch.length > 0)
        })()
      : chunkArray(images, 3)
    const extractedBatches: Array<{ drafts: TocUnitDraft[]; lessonsByUnit: BookLessonRecord[][] }> = []
    for (let i = 0; i < chunks.length; i++) {
      const phaseLabel = stagedExtractionEnabled ? `phase ${i + 1}/${chunks.length}` : `batch ${i + 1}/${chunks.length}`
      let body: { drafts?: TocUnitDraft[]; lessonsByUnit?: BookLessonRecord[][]; error?: string } | null = null
      let phaseSucceeded = false
      for (let attempt = 1; attempt <= 2 && !phaseSucceeded; attempt++) {
        setAiMessage(`Extracting structure with Gemini... ${phaseLabel}${attempt > 1 ? ' (retry)' : ''}`)
        const res = await fetch('/api/books/toc-extract-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: chunks[i],
            totalPdfPages: numPages,
            notCountedPdfPages,
            profile: tocExtractProfile,
          }),
        })
        body = (await res.json()) as {
          drafts?: TocUnitDraft[]
          lessonsByUnit?: BookLessonRecord[][]
          error?: string
        }
        phaseSucceeded = res.ok && !!body.drafts?.length
        if (!phaseSucceeded && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 700))
        }
      }
      if (!phaseSucceeded || !body?.drafts?.length) {
        throw new Error(body?.error ?? `AI extraction failed on ${phaseLabel}.`)
      }
      extractedBatches.push({
        drafts: body.drafts,
        lessonsByUnit: body.lessonsByUnit ?? body.drafts.map(() => []),
      })
    }
    const merged = mergeExtractedStructureBatches(extractedBatches)
    if (!merged.drafts.length) throw new Error('AI extraction produced no units.')
    return merged
  }, [notCountedPdfPages, stagedExtractionEnabled, tocExtractProfile])

  const maybeOfferManualStoryReconcile = useCallback(
    async (
      nextDrafts: TocUnitDraft[],
      nextLessons: BookLessonRecord[][],
      filePath: string,
    ) => {
      if (!selectedBook || !nextDrafts.length) return
      try {
        const res = await fetch('/api/reading-stories/reconcile-after-outline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'preview',
            bookId: selectedBook.id,
            drafts: nextDrafts,
            lessonsByUnit: nextLessons,
            fallbackFilePath: filePath,
          }),
        })
        const body = (await res.json()) as {
          ok?: boolean
          needed?: boolean
          candidates?: ManualStoryReconcileCandidateRow[]
          error?: string
        }
        if (!res.ok || !body.ok) return
        if (body.needed && body.candidates?.length) {
          setReconcileCandidates(body.candidates)
          setReconcilePending(true)
          setReconcileOpen(true)
        } else {
          setReconcileCandidates([])
          setReconcilePending(false)
        }
      } catch {
        // Non-blocking — outline still works without reconcile.
      }
    },
    [selectedBook],
  )

  const applyManualStoryReconcile = useCallback(
    async (decisions: ManualStoryReconcileDecisionRow[]) => {
      if (!selectedBook || !decisions.length) return
      setReconcileBusy(true)
      try {
        const res = await fetch('/api/reading-stories/reconcile-after-outline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'apply',
            bookId: selectedBook.id,
            decisions,
          }),
        })
        const body = (await res.json()) as {
          ok?: boolean
          merged?: number
          kept?: number
          deleted?: number
          errors?: string[]
          error?: string
        }
        if (!res.ok || !body.ok) {
          toast.error(body.error ?? 'Could not update manual stories.')
          return
        }
        const bits: string[] = []
        if (body.merged) bits.push(`merged ${body.merged}`)
        if (body.kept) bits.push(`kept ${body.kept}`)
        if (body.deleted) bits.push(`deleted ${body.deleted}`)
        toast.success(bits.length ? `Stories: ${bits.join(', ')}.` : 'Manual stories updated.')
        if (body.errors?.length) {
          toast.message(`Some stories need a look (${body.errors.length}).`)
        }
        setReconcilePending(false)
        setReconcileOpen(false)
        setReconcileCandidates([])
      } catch {
        toast.error('Could not update manual stories.')
      } finally {
        setReconcileBusy(false)
      }
    },
    [selectedBook],
  )

  const runExtractWithAi = useCallback(async () => {
    if (!tocRange || !sourceFilePath) return
    setAiExtracting(true)
    setAiMessage('Rendering TOC pages...')
    try {
      const fileUrl = makeUnitFileUrl(sourceFilePath)
      const { images, numPages } = await captureTocRangeAsJpegs(fileUrl, tocRange.from, tocRange.to, {
        onProgress: setAiMessage,
      })
      setLastNumPages(numPages)
      const merged = await extractBatchesWithAi(images, numPages)
      const stamped = stampDraftsFilePath(merged.drafts, sourceFilePath)
      const normalizedLessons = merged.lessonsByUnit.map((lessons) =>
        normalizeLessonsStructureTags(lessons, tocExtractProfile),
      )
      setDrafts(stamped)
      setLessonsByUnitIndex(normalizedLessons)
      setStructureUnitIdx(0)
      setSelectedUnitIndicesForMerge(new Set())
      setOpenLessonId(null)
      setEditingFieldId(null)
      setAiMessage(`Extracted ${merged.drafts.length} units.`)
      if (tocRange) setTocRangeAtExtract({ from: tocRange.from, to: tocRange.to })
      setFurthestStep((prev) => advanceFurthestStructureWizardStep(prev, 'extract'))
      setWizardStep('review')
      toast.success(`Extracted ${merged.drafts.length} units.`)
      void maybeOfferManualStoryReconcile(stamped, normalizedLessons, sourceFilePath)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'AI extraction failed.'
      setAiMessage(message)
      toast.error(message)
    } finally {
      setAiExtracting(false)
    }
  }, [
    extractBatchesWithAi,
    maybeOfferManualStoryReconcile,
    sourceFilePath,
    tocExtractProfile,
    tocRange,
  ])

  const runExtractForUnit = useCallback(async (unitIndex: number) => {
    const unit = drafts[unitIndex]
    if (!unit || !sourceFilePath) return
    const rangeInput = unitTocRangeById[unit.id]
    const fromEffective = parsePositiveInt(rangeInput?.from ?? '')
    const toEffective = parsePositiveInt(rangeInput?.to ?? '')
    if (fromEffective == null || toEffective == null || fromEffective > toEffective) {
      toast.error('Enter a valid TOC page range for this unit.')
      return
    }
    const fromPdf = resolveAnchorToPdfPage(fromEffective)
    const toPdf = resolveAnchorToPdfPage(toEffective)
    if (fromPdf == null || toPdf == null) {
      toast.error('Could not map this TOC range to current PDF pages.')
      return
    }
    const pdfFrom = Math.min(fromPdf, toPdf)
    const pdfTo = Math.max(fromPdf, toPdf)
    setAiExtracting(true)
    setAiMessage(`Rendering unit ${unitIndex + 1} TOC pages...`)
    try {
      const fileUrl = makeUnitFileUrl(sourceFilePath)
      const { images, numPages } = await captureTocRangeAsJpegs(fileUrl, pdfFrom, pdfTo, {
        onProgress: setAiMessage,
      })
      setLastNumPages(numPages)
      const merged = await extractBatchesWithAi(images, numPages)
      let bestIndex = 0
      for (let i = 1; i < merged.drafts.length; i++) {
        const prevLen = merged.lessonsByUnit[bestIndex]?.length ?? 0
        const nextLen = merged.lessonsByUnit[i]?.length ?? 0
        if (nextLen > prevLen) bestIndex = i
      }
      const replacementDraft = merged.drafts[bestIndex]
      const replacementLessons = merged.lessonsByUnit[bestIndex] ?? []
      if (!replacementDraft) throw new Error('Unit extraction returned no units.')
      setDrafts((prev) =>
        prev.map((draft, i) =>
          i === unitIndex
            ? {
                ...draft,
                ...replacementDraft,
                id: draft.id,
                filePath: sourceFilePath || draft.filePath,
              }
            : draft,
        ),
      )
      setLessonsByUnitIndex((prev) =>
        prev.map((lessons, i) =>
          i === unitIndex ? normalizeLessonsStructureTags(replacementLessons, tocExtractProfile) : lessons,
        ),
      )
      setStructureUnitIdx(unitIndex)
      setOpenLessonId(null)
      setEditingFieldId(null)
      setAiMessage(`Re-extracted Unit ${unitIndex + 1}.`)
      toast.success(`Re-extracted Unit ${unitIndex + 1}.`)
      const nextDrafts = drafts.map((draft, i) =>
        i === unitIndex
          ? {
              ...draft,
              ...replacementDraft,
              id: draft.id,
              filePath: sourceFilePath || draft.filePath,
            }
          : draft,
      )
      const nextLessons = lessonsByUnitIndex.map((lessons, i) =>
        i === unitIndex ? normalizeLessonsStructureTags(replacementLessons, tocExtractProfile) : lessons,
      )
      void maybeOfferManualStoryReconcile(nextDrafts, nextLessons, sourceFilePath)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unit extraction failed.'
      setAiMessage(message)
      toast.error(message)
    } finally {
      setAiExtracting(false)
    }
  }, [
    drafts,
    extractBatchesWithAi,
    lessonsByUnitIndex,
    maybeOfferManualStoryReconcile,
    resolveAnchorToPdfPage,
    sourceFilePath,
    tocExtractProfile,
    unitTocRangeById,
  ])

  function addUnit() {
    const unitIndex = drafts.length
    const nextDraft: TocUnitDraft = {
      id: newBookChildId('unit'),
      title: `Unit ${unitIndex + 1}`,
      needsReview: false,
      startPageHint: effectiveHintForNewAnchors,
      ...(sourceFilePath ? { filePath: sourceFilePath } : {}),
    }
    setDrafts((prev) => [...prev, nextDraft])
    setLessonsByUnitIndex((prev) => [...prev, []])
    setSelectedUnitIndicesForMerge(new Set())
    setStructureUnitIdx(unitIndex)
    setOpenLessonId(null)
  }

  function toggleUnitMergeSelection(unitIndex: number) {
    setSelectedUnitIndicesForMerge((prev) => {
      const next = new Set(prev)
      if (next.has(unitIndex)) next.delete(unitIndex)
      else next.add(unitIndex)
      return next
    })
  }

  function mergeSelectedUnits() {
    const selected = [...selectedUnitIndicesForMerge].sort((a, b) => a - b)
    if (selected.length < 2) return
    const keepIndex = selected[0]!
    const selectedSet = new Set(selected)

    const mergedLessons = selected
      .flatMap((idx) => lessonsByUnitIndex[idx] ?? [])
      .sort(
        (a, b) =>
          (typeof a.startPageHint === 'number' ? a.startPageHint : Number.MAX_SAFE_INTEGER)
          - (typeof b.startPageHint === 'number' ? b.startPageHint : Number.MAX_SAFE_INTEGER),
      )

    const nextDrafts = drafts.filter((_, idx) => !selectedSet.has(idx) || idx === keepIndex)
    const nextLessonsByUnit: BookLessonRecord[][] = []
    let writeIndex = 0
    for (let readIndex = 0; readIndex < drafts.length; readIndex++) {
      if (readIndex === keepIndex) {
        nextLessonsByUnit[writeIndex] = normalizeLessonsStructureTags(mergedLessons, tocExtractProfile)
        writeIndex += 1
        continue
      }
      if (selectedSet.has(readIndex)) continue
      nextLessonsByUnit[writeIndex] = lessonsByUnitIndex[readIndex] ?? []
      writeIndex += 1
    }

    setDrafts(nextDrafts)
    setLessonsByUnitIndex(nextLessonsByUnit)
    setStructureUnitIdx(Math.max(0, Math.min(keepIndex, nextDrafts.length - 1)))
    setSelectedUnitIndicesForMerge(new Set())
    setOpenLessonId(null)
    toast.success(`Merged ${selected.length} units into Unit ${keepIndex + 1}.`)
  }

  function setUnitCoverFromPreview(unitIndex: number, page: number) {
    const nearest = nearestVisiblePage(page, visiblePreviewPages)
    const nextCoverHint =
      alignmentRuntime.effectivePageByPdf.get(nearest) ?? effectiveHintFromPdfPreview(page)
    setDrafts((prev) => prev.map((draft, i) => (i === unitIndex ? { ...draft, startPageHint: nextCoverHint } : draft)))
    setStructureUnitIdx(unitIndex)
    toast.success(`Unit ${unitIndex + 1} cover starts at printed page ${nextCoverHint}.`)
  }

  const canEditAlignment = wizardStep === 'align' || wizardStep === 'extract' || wizardStep === 'review'
  const tocRangeDirtyAfterExtract = Boolean(
    tocRangeAtExtract &&
      tocRange &&
      (tocRange.from !== tocRangeAtExtract.from || tocRange.to !== tocRangeAtExtract.to) &&
      drafts.length > 0,
  )

  function goToWizardStep(step: StructureWizardStep) {
    if (!isStructureWizardStepReachable(step, furthestStep)) return
    setWizardStep(step)
  }

  function continueFromToc() {
    if (!canContinueFromToc(Boolean(tocRange))) {
      toast.error('Enter a valid TOC from–to range.')
      return
    }
    setFurthestStep((prev) => advanceFurthestStructureWizardStep(prev, 'toc'))
    setWizardStep('align')
  }

  function continueFromAlign() {
    setFurthestStep((prev) => advanceFurthestStructureWizardStep(prev, 'align'))
    setWizardStep('extract')
  }

  function toggleCurrentPageIgnored() {
    if (!canEditAlignment) return
    const current = new Set(notCountedPdfPages)
    if (current.has(previewLeftPage)) current.delete(previewLeftPage)
    else current.add(previewLeftPage)
    setNotCountedPdfPagesInput(stringifyPageListInput([...current]))
  }

  function toggleIgnoredPage(page: number) {
    if (!canEditAlignment) return
    const current = new Set(notCountedPdfPages)
    if (current.has(page)) current.delete(page)
    else current.add(page)
    setNotCountedPdfPagesInput(stringifyPageListInput([...current]))
  }

  function toggleHiddenPage(page: number) {
    if (!canEditAlignment) return
    if (page === 1) return
    const current = new Set(hiddenPdfPages)
    if (current.has(page)) current.delete(page)
    else current.add(page)
    setHiddenPdfPagesInput(stringifyPageListInput(mergeCoverIntoHiddenPages([...current])))
  }

  function addLesson(unitIndex: number) {
    const chunkStyle = tocChunkLabelStyleForProfile(tocExtractProfile)
    setLessonsByUnitIndex((prev) => {
      const next = [...prev]
      while (next.length <= unitIndex) next.push([])
      const n = (next[unitIndex] ?? []).length + 1
      next[unitIndex] = [
        ...(next[unitIndex] ?? []),
        {
          id: newBookChildId('lesson'),
          title: formatTocChunkTitle(n, '', chunkStyle),
          startPageHint: effectiveHintForNewAnchors,
          parts: [],
        },
      ]
      return next
    })
  }

  function updateDraftTitle(unitIndex: number, title: string) {
    setDrafts((prev) => {
      if (!prev) return prev
      return prev.map((draft, i) => (i === unitIndex ? { ...draft, title } : draft))
    })
  }

  function updateDraftStartPage(unitIndex: number, value: string) {
    const page = parsePositiveInt(value)
    setDrafts((prev) => {
      if (!prev) return prev
      return prev.map((draft, i) => {
        if (i !== unitIndex) return draft
        if (page == null) {
          const { startPageHint: _startPageHint, ...rest } = draft
          return rest
        }
        return { ...draft, startPageHint: clampEffectiveDraftHint(page) }
      })
    })
    if (page != null) {
      const hint = clampEffectiveDraftHint(page)
      const targetPdf = resolveEffectiveAnchorToPdfPage(hint, alignmentRuntime)
      if (targetPdf != null) setPreviewPage(nearestVisiblePage(targetPdf, visiblePreviewPages))
    }
  }

  function updateLessonTitle(unitIndex: number, lessonIndex: number, title: string) {
    setLessonsByUnitIndex((prev) => {
      const next = [...prev]
      const unitLessons = [...(next[unitIndex] ?? [])]
      const lesson = unitLessons[lessonIndex]
      if (!lesson) return prev
      unitLessons[lessonIndex] = { ...lesson, title }
      next[unitIndex] = unitLessons
      return next
    })
  }

  function updateLessonStartPage(unitIndex: number, lessonIndex: number, value: string) {
    const page = parsePositiveInt(value)
    setLessonsByUnitIndex((prev) => {
      const next = [...prev]
      const unitLessons = [...(next[unitIndex] ?? [])]
      const lesson = unitLessons[lessonIndex]
      if (!lesson) return prev
      if (page == null) {
        const { startPageHint: _startPageHint, ...rest } = lesson
        unitLessons[lessonIndex] = rest
      } else {
        unitLessons[lessonIndex] = { ...lesson, startPageHint: clampEffectiveDraftHint(page) }
      }
      next[unitIndex] = unitLessons
      return next
    })
    if (page != null) {
      const hint = clampEffectiveDraftHint(page)
      const targetPdf = resolveEffectiveAnchorToPdfPage(hint, alignmentRuntime)
      if (targetPdf != null) setPreviewPage(nearestVisiblePage(targetPdf, visiblePreviewPages))
    }
  }

  function addLessonPart(unitIndex: number, lessonIndex: number) {
    setLessonsByUnitIndex((prev) => {
      const next = [...prev]
      const unitLessons = [...(next[unitIndex] ?? [])]
      const lesson = unitLessons[lessonIndex]
      if (!lesson) return prev
      const partNumber = (lesson.parts ?? []).length + 1
      const title = `Part ${partNumber}`
      const part: BookLessonPartRecord = {
        id: newBookChildId('part'),
        title,
        startPageHint: effectiveHintForNewAnchors,
      }
      unitLessons[lessonIndex] = { ...lesson, parts: [...(lesson.parts ?? []), part] }
      next[unitIndex] = unitLessons
      return next
    })
  }

  function updateLessonPartStartPage(unitIndex: number, lessonIndex: number, partIndex: number, value: string) {
    const page = parsePositiveInt(value)
    setLessonsByUnitIndex((prev) => {
      const next = [...prev]
      const unitLessons = [...(next[unitIndex] ?? [])]
      const lesson = unitLessons[lessonIndex]
      if (!lesson) return prev
      const parts = [...(lesson.parts ?? [])]
      const part = parts[partIndex]
      if (!part) return prev
      if (page == null) {
        const { startPageHint: _startPageHint, ...rest } = part
        parts[partIndex] = rest
      } else {
        parts[partIndex] = { ...part, startPageHint: clampEffectiveDraftHint(page) }
      }
      unitLessons[lessonIndex] = { ...lesson, parts }
      next[unitIndex] = unitLessons
      return next
    })
    if (page != null) {
      const hint = clampEffectiveDraftHint(page)
      const targetPdf = resolveEffectiveAnchorToPdfPage(hint, alignmentRuntime)
      if (targetPdf != null) setPreviewPage(nearestVisiblePage(targetPdf, visiblePreviewPages))
    }
  }

  function updateLessonPartTitle(unitIndex: number, lessonIndex: number, partIndex: number, title: string) {
    setLessonsByUnitIndex((prev) => {
      const next = [...prev]
      const unitLessons = [...(next[unitIndex] ?? [])]
      const lesson = unitLessons[lessonIndex]
      if (!lesson) return prev
      const parts = [...(lesson.parts ?? [])]
      const part = parts[partIndex]
      if (!part) return prev
      parts[partIndex] = { ...part, title }
      unitLessons[lessonIndex] = { ...lesson, parts }
      next[unitIndex] = unitLessons
      return next
    })
  }

  function saveManifest() {
    void (async () => {
      if (!selectedBook || !sourceFilePath || !drafts?.length) return
      if (tocRangeDirtyAfterExtract) {
        toast.error('TOC range changed after extract. Re-extract the outline before saving.')
        setWizardStep('extract')
        return
      }
      if (!canEnterReview(drafts.length > 0)) {
        toast.error('Extract an outline before saving.')
        return
      }
      if (reconcilePending && reconcileCandidates.length > 0) {
        setReconcileOpen(true)
        toast.message('Choose what to do with your manual stories — or Decide later, then Save again.')
      }
      setSaving(true)
      try {
        const units = draftsToUnits(sourceFilePath, drafts, lessonsByUnitIndex)
        const focusUnitId = drafts[structureUnitIdx]?.id
        const nextPayload: BookLibraryPayload = {
          books: library.books.map((b) => {
            if (b.id !== selectedBook.id) return b
            const nextPageAlignmentByFile = {
              ...(selectedBook.pageAlignmentByFile ?? {}),
              ...(sourceFilePath
                ? {
                    [sourceFilePath]: {
                      notCountedPdfPages,
                      hiddenPdfPages: mergeCoverIntoHiddenPages(hiddenPdfPages),
                    },
                  }
                : {}),
            }
            // Seam overlap retired from this wizard — preserve existing book gutter fields.
            return {
              ...selectedBook,
              units,
              pageAlignmentByFile: nextPageAlignmentByFile,
            }
          }),
        }
        const res = await fetch('/api/books/manifest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextPayload),
        })
        const body = (await res.json()) as BookLibraryPayload | { error?: string }
        if (!res.ok) throw new Error('error' in body && body.error ? body.error : 'Save failed.')
        onManifestSaved(body as BookLibraryPayload, {
          bookId: selectedBook.id,
          ...(focusUnitId ? { focusUnitId } : {}),
        })
        setOpen(false)
        toast.success(
          `Saved outline for ${selectedBook.title}: ${units.length} unit${units.length === 1 ? '' : 's'}.`,
        )
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Save failed.')
      } finally {
        setSaving(false)
      }
    })()
  }

  function toggleLessonExpanded(lessonId: string) {
    setOpenLessonId((prev) => (prev === lessonId ? null : lessonId))
  }

  const isReviewLayout = wizardStep === 'review'

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className={cn(
          'flex flex-col overflow-hidden',
          isReviewLayout
            ? 'h-[94vh] w-[98vw] max-h-[94vh] gap-3 p-4 sm:max-w-[min(1800px,98vw)] sm:p-5'
            : 'h-[min(860px,92vh)] w-[min(1100px,96vw)] gap-2 p-3 sm:max-w-[1100px] sm:p-4',
        )}
      >
        <DialogTitle className="sr-only">Structure-first book mapping</DialogTitle>
        <DialogDescription className="sr-only">
          Map book structure: find TOC, align pages, extract outline, then review.
        </DialogDescription>

        <div className="flex min-h-0 min-w-0 shrink-0 flex-col gap-1.5 border-b border-border/50 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            {selectedBook && (bookHasCustomCover(selectedBook) || (previewUrl && pdfReady)) ? (
              <BookCoverThumbnail
                book={selectedBook}
                unitId={`${bookId}-structure-map-cover`}
                width={32}
                pdfReady={pdfReady}
                label="Cover"
                className="shadow-sm ring-1 ring-border/50"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold tracking-tight">
                {selectedBook?.title ?? 'Book'}
              </h2>
              <p className="truncate font-mono text-[10px] text-muted-foreground" title={sourceFilePath || undefined}>
                {sourceFilePath ? fileBasename(sourceFilePath) : 'No source file'}
                {lastNumPages != null ? ` · ${lastNumPages} PDF pages` : ''}
              </p>
            </div>
          </div>
          <StructureWizardStepper current={wizardStep} furthest={furthestStep} onSelect={goToWizardStep} />
        </div>

        <div
          className={cn(
            'grid min-h-0 min-w-0 flex-1 gap-3 overflow-hidden',
            isReviewLayout
              ? 'xl:grid-cols-[minmax(0,1fr)_minmax(520px,44vw)]'
              : 'grid-cols-1 grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] sm:grid-rows-none',
          )}
        >
          <div
            className={cn(
              'min-h-0 overflow-y-auto',
              isReviewLayout ? 'flex flex-col overflow-hidden pr-1' : 'max-h-[40vh] pr-0.5 sm:max-h-none',
            )}
          >
            {wizardStep === 'toc' ? (
              <StructureWizardStepPanel
                stepNumber={1}
                title="Find the table of contents"
                description="We scan early PDF pages and suggest a range. Confirm in the preview, or edit From/To."
                className="w-full"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8"
                    disabled={!previewUrl || tocDetectStatus === 'scanning'}
                    onClick={() => {
                      tocAutoDetectPathRef.current = sourceFilePath || null
                      void runTocAutoDetect({ applyRange: true })
                    }}
                  >
                    {tocDetectStatus === 'scanning' ? 'Scanning…' : 'Find contents pages'}
                  </Button>
                  {tocDetectSuggestion ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={tocDetectStatus === 'scanning'}
                      onClick={() => {
                        setTocFrom(String(tocDetectSuggestion.from))
                        setTocTo(String(tocDetectSuggestion.to))
                        setPreviewPage(tocDetectSuggestion.from)
                        setPreviewPageJumpDraft(String(tocDetectSuggestion.from))
                        toast.success(
                          `Using suggested PDF pages ${tocDetectSuggestion.from}–${tocDetectSuggestion.to}.`,
                        )
                      }}
                    >
                      Use suggestion ({tocDetectSuggestion.from}–{tocDetectSuggestion.to})
                    </Button>
                  ) : null}
                </div>
                {tocDetectMessage ? (
                  <p
                    className={
                      tocDetectStatus === 'failed'
                        ? 'rounded-md border border-amber-500/30 bg-amber-50/80 px-2.5 py-1.5 text-[11px] leading-snug text-amber-950'
                        : tocDetectStatus === 'ready'
                          ? 'rounded-md border border-emerald-500/25 bg-emerald-50/70 px-2.5 py-1.5 text-[11px] leading-snug text-emerald-950'
                          : 'text-[11px] leading-snug text-muted-foreground'
                    }
                  >
                    {tocDetectMessage}
                  </p>
                ) : null}
                <StructureWizardFieldRow>
                  <StructureWizardField label="From" htmlFor="structure-toc-from">
                    <Input
                      id="structure-toc-from"
                      type="number"
                      min={1}
                      className="h-8 tabular-nums"
                      value={tocFrom}
                      onChange={(e) => setTocFrom(e.target.value)}
                    />
                  </StructureWizardField>
                  <span className="pb-2 text-sm text-muted-foreground" aria-hidden>
                    –
                  </span>
                  <StructureWizardField label="To" htmlFor="structure-toc-to">
                    <Input
                      id="structure-toc-to"
                      type="number"
                      min={1}
                      className="h-8 tabular-nums"
                      value={tocTo}
                      onChange={(e) => setTocTo(e.target.value)}
                    />
                  </StructureWizardField>
                  <span className="pb-2 text-[11px] text-muted-foreground">PDF pages</span>
                </StructureWizardFieldRow>
                {recommendStagedExtraction ? (
                  <label className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/25 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border"
                      checked={stagedExtractionEnabled}
                      onChange={(e) => setStagedExtractionEnabled(e.target.checked)}
                    />
                    <span>
                      Staged extraction for long TOCs
                      <span className="ml-1.5 rounded bg-amber-100/70 px-1 py-px text-[10px] font-medium text-amber-950">
                        recommended
                      </span>
                    </span>
                  </label>
                ) : null}
                {tocRangeDirtyAfterExtract ? (
                  <p className="rounded-md border border-amber-500/30 bg-amber-50/80 px-2.5 py-1.5 text-[11px] leading-snug text-amber-950">
                    TOC range changed since the last extract. Re-extract before saving.
                  </p>
                ) : null}
              </StructureWizardStepPanel>
            ) : null}

            {wizardStep === 'align' ? (
              <StructureWizardStepPanel
                stepNumber={2}
                title="Align PDF to book pages"
                description="Mark cover or roman pages so TOC page 6 is the real page 6. Use ghost / trash on the preview, or type lists."
                className="w-full"
                footer={
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={continueFromAlign}>
                    Pages already match — skip
                  </Button>
                }
              >
                <div className="grid gap-3">
                  <StructureWizardField
                    label="Not counted"
                    htmlFor="structure-not-counted"
                    hint="Visible in preview, skipped for printed numbering."
                    widthClassName="w-full"
                  >
                    <Input
                      id="structure-not-counted"
                      className="h-8 font-mono text-xs"
                      placeholder="e.g. 8,9, 120-122"
                      value={notCountedPdfPagesInput}
                      onChange={(e) => setNotCountedPdfPagesInput(e.target.value)}
                    />
                  </StructureWizardField>
                  <StructureWizardField
                    label="Hidden"
                    htmlFor="structure-hidden"
                    hint="Removed from spread navigation. Cover (page 1) stays omitted."
                    widthClassName="w-full"
                  >
                    <Input
                      id="structure-hidden"
                      className="h-8 font-mono text-xs"
                      placeholder="e.g. 12,13 or 120-121"
                      value={hiddenPdfPagesInput}
                      onChange={(e) => setHiddenPdfPagesInput(e.target.value)}
                    />
                  </StructureWizardField>
                </div>
              </StructureWizardStepPanel>
            ) : null}

            {wizardStep === 'extract' ? (
              <StructureWizardStepPanel
                stepNumber={3}
                title="Extract outline"
                description={
                  tocRange
                    ? `AI reads TOC pages ${tocRange.from}–${tocRange.to} and builds units and sections.`
                    : 'AI reads your TOC pages and builds units and sections.'
                }
                className="w-full"
                footer={
                  drafts.length > 0 && !tocRangeDirtyAfterExtract ? (
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => goToWizardStep('review')}>
                      Continue to review
                    </Button>
                  ) : null
                }
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {tocExtractProfile === 'wonders_workshop'
                      ? 'Wonders Workshop rules'
                      : tocExtractProfile === 'wonders_literature'
                        ? 'Wonders Literature rules'
                        : 'Journeys lesson rules'}
                  </span>
                  {tocRange ? (
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      Pages {tocRange.from}–{tocRange.to}
                    </span>
                  ) : null}
                </div>
                {recommendStagedExtraction ? (
                  <label className="flex items-start gap-2 text-[11px] leading-snug text-muted-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border"
                      checked={stagedExtractionEnabled}
                      onChange={(e) => setStagedExtractionEnabled(e.target.checked)}
                    />
                    Staged extraction (safer for long TOCs)
                  </label>
                ) : null}
                <Button
                  type="button"
                  className="h-9 w-full sm:w-auto sm:min-w-[10rem]"
                  onClick={() => void runExtractWithAi()}
                  disabled={!canRunAi}
                >
                  {aiExtracting ? 'Extracting…' : drafts.length ? 'Re-extract outline' : 'Extract outline'}
                </Button>
                {aiMessage ? (
                  <p className="rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5 font-mono text-[11px] leading-snug text-muted-foreground">
                    {aiMessage}
                  </p>
                ) : null}
                {tocRangeDirtyAfterExtract ? (
                  <p className="text-[11px] leading-snug text-amber-800">
                    TOC range changed — run extract again before saving.
                  </p>
                ) : null}
              </StructureWizardStepPanel>
            ) : null}

            {wizardStep === 'review' && drafts?.length ? (
              <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm">
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/55 bg-muted/35 px-3 py-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Step 4 of 4
                      </p>
                      <span className="text-[13px] font-semibold text-foreground">Units</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={mergeSelectedUnits}
                        disabled={selectedUnitIndicesForMerge.size < 2}
                      >
                        Merge
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addUnit}>
                        Add
                      </Button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                  {drafts.map((draft, unitIndex) => {
                    const range = pageRangeForIndex(drafts, unitIndex, 1, lastNumPages)
                    const thumbEffective = range.start ?? 1
                    const thumbPdfPage =
                      resolveEffectiveAnchorToPdfPage(thumbEffective, alignmentRuntime) ??
                      clampPreviewPageNumber(thumbEffective, previewNumPages)
                    const isActive = structureUnitIdx === unitIndex
                    const titleFieldId = `unit-title-${unitIndex}`
                    const startFieldId = `unit-start-${unitIndex}`
                    const unitRangeInput = unitTocRangeById[draft.id]
                    const fromEffective = parsePositiveInt(unitRangeInput?.from ?? '')
                    const toEffective = parsePositiveInt(unitRangeInput?.to ?? '')
                    const validEffectiveRange =
                      fromEffective != null &&
                      toEffective != null &&
                      fromEffective <= toEffective
                    const fromPdfResolved = validEffectiveRange ? resolveAnchorToPdfPage(fromEffective) : null
                    const toPdfResolved = validEffectiveRange ? resolveAnchorToPdfPage(toEffective) : null
                    const validResolvedRange = fromPdfResolved != null && toPdfResolved != null
                    const resolvedFrom = validResolvedRange ? Math.min(fromPdfResolved, toPdfResolved) : null
                    const resolvedTo = validResolvedRange ? Math.max(fromPdfResolved, toPdfResolved) : null
                    return (
                      <div key={draft.id} className={`group flex gap-3 rounded-lg border border-transparent p-1.5 transition ${isActive ? 'border-primary/20 bg-muted/40' : 'hover:border-border/60 hover:bg-muted/25'}`}>
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0 rounded border-border"
                          checked={selectedUnitIndicesForMerge.has(unitIndex)}
                          onChange={() => toggleUnitMergeSelection(unitIndex)}
                          aria-label={`Select unit ${unitIndex + 1} for merge`}
                        />
                        <button
                          type="button"
                          className="shrink-0 overflow-hidden"
                          onClick={() => {
                            setStructureUnitIdx(unitIndex)
                            goToMappedAnchorPage(thumbEffective)
                            setOpenLessonId(null)
                          }}
                          aria-label={`Select unit ${unitIndex + 1}`}
                        >
                          {previewUrl && pdfReady ? (
                            <PdfDocument
                              file={previewUrl}
                              options={PDF_DOCUMENT_OPTIONS}
                              loading={<span className="block w-[76px] text-xs text-muted-foreground">Loading...</span>}
                            >
                              <PdfPage pageNumber={thumbPdfPage} width={76} renderTextLayer={false} renderAnnotationLayer={false} />
                            </PdfDocument>
                          ) : (
                            <span className="block w-[76px] text-xs text-muted-foreground">No preview</span>
                          )}
                        </button>
                        <div className="min-w-0 flex-1 py-1">
                          <button
                            type="button"
                            className="block w-full text-left"
                            onClick={() => {
                              setStructureUnitIdx(unitIndex)
                              goToMappedAnchorPage(thumbEffective)
                              setOpenLessonId(null)
                            }}
                          >
                            <p className="text-sm font-semibold">Unit {unitIndex + 1}</p>
                          </button>
                          <div className="group/title mt-1 flex items-center justify-between gap-2 text-sm">
                            {editingFieldId === titleFieldId ? (
                              <Input
                                autoFocus
                                value={draft.title}
                                onChange={(e) => updateDraftTitle(unitIndex, e.target.value)}
                                onBlur={() => setEditingFieldId(null)}
                              />
                            ) : (
                              <>
                                <span className="truncate text-muted-foreground">{draft.title || 'Untitled unit'}</span>
                                <button type="button" className="opacity-0 transition group-hover/title:opacity-100" onClick={() => setEditingFieldId(titleFieldId)} aria-label="Edit unit title">
                                  <Pencil size={14} />
                                </button>
                              </>
                            )}
                          </div>
                          <div className="group/page mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            {editingFieldId === startFieldId ? (
                              <Input
                                autoFocus
                                type="number"
                                min={1}
                                value={pageInputValue(draft.startPageHint)}
                                onChange={(e) => updateDraftStartPage(unitIndex, e.target.value)}
                                onBlur={() => setEditingFieldId(null)}
                              />
                            ) : (
                              <>
                                <span>{formatPageSpan(range.start, range.end)}</span>
                                <button type="button" className="opacity-0 transition group-hover/page:opacity-100" onClick={() => setEditingFieldId(startFieldId)} aria-label="Edit unit start page">
                                  <Pencil size={14} />
                                </button>
                              </>
                            )}
                          </div>
                          <div className="mt-2 rounded-md border border-border/50 bg-muted/20 p-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">Unit TOC re-extract</p>
                            <div className="mt-1.5 flex flex-wrap items-end gap-1.5">
                              <div className="grid gap-1">
                                <Label className="text-[10px] text-muted-foreground">From (effective)</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  className="h-7 w-[74px] text-xs"
                                  value={unitTocRangeById[draft.id]?.from ?? ''}
                                  onChange={(e) => setUnitTocRangeById((prev) => ({
                                    ...prev,
                                    [draft.id]: {
                                      from: e.target.value,
                                      to: prev[draft.id]?.to ?? '',
                                    },
                                  }))}
                                />
                              </div>
                              <div className="grid gap-1">
                                <Label className="text-[10px] text-muted-foreground">To (effective)</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  className="h-7 w-[74px] text-xs"
                                  value={unitTocRangeById[draft.id]?.to ?? ''}
                                  onChange={(e) => setUnitTocRangeById((prev) => ({
                                    ...prev,
                                    [draft.id]: {
                                      from: prev[draft.id]?.from ?? '',
                                      to: e.target.value,
                                    },
                                  }))}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7"
                                disabled={aiExtracting || !sourceFilePath}
                                onClick={() => void runExtractForUnit(unitIndex)}
                              >
                                Re-extract unit
                              </Button>
                            </div>
                            <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                              {validEffectiveRange
                                ? (
                                    validResolvedRange
                                      ? `Captures effective pages ${fromEffective}-${toEffective} as PDF pages ${resolvedFrom}-${resolvedTo}.`
                                      : 'Selected effective range cannot be mapped to current PDF pages.'
                                  )
                                : 'Enter a valid effective TOC range (from <= to).'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  </div>
                </div>

                <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm">
                  <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/55 bg-muted/35 px-3 py-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[13px] font-semibold text-foreground">
                        Unit {structureUnitIdx + 1}
                        <span className="font-normal text-muted-foreground">
                          {' '}
                          · {formatPageSpan(selectedUnitPageRange.start, selectedUnitPageRange.end)}
                        </span>
                      </p>
                      {selectedUnitCoverRange.start != null && selectedUnitCoverRange.end != null ? (
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          Cover-only pages: {formatPageSpan(selectedUnitCoverRange.start, selectedUnitCoverRange.end)}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 shrink-0 text-xs"
                      onClick={() => addLesson(structureUnitIdx)}
                    >
                      Add lesson
                    </Button>
                  </div>
                  <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
                    {(lessonsByUnitIndex[structureUnitIdx] ?? []).map((lesson, lessonIndex, lessons) => {
                      const lessonRange = pageRangeForIndex(lessons, lessonIndex, selectedUnitPageRange.start, selectedUnitPageRange.end)
                      const isExpanded = openLessonId === lesson.id
                      const lessonTitleFieldId = `lesson-title-${lesson.id}`
                      const lessonStartFieldId = `lesson-start-${lesson.id}`
                      return (
                        <div key={lesson.id} className="py-1">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 text-left"
                            onClick={() => toggleLessonExpanded(lesson.id)}
                          >
                            <span className="flex min-w-0 items-baseline gap-2">
                              <span className="truncate text-sm font-medium">
                                Lesson {lessonIndex + 1}: {lesson.title || 'Untitled lesson'}
                              </span>
                              <span className={BOOK_OUTLINE_PAGE_BADGE_CLASS}>
                                {formatPageSpan(lessonRange.start, lessonRange.end)}
                              </span>
                            </span>
                            <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isExpanded ? (
                            <div className="mt-2 space-y-2 pl-2">
                              <div className="group flex items-center justify-between gap-2 text-sm">
                                  {editingFieldId === lessonTitleFieldId ? (
                                    <Input
                                      autoFocus
                                      value={lesson.title}
                                      onChange={(e) => updateLessonTitle(structureUnitIdx, lessonIndex, e.target.value)}
                                      onBlur={() => setEditingFieldId(null)}
                                    />
                                  ) : (
                                    <>
                                      <span>{lesson.title || 'Untitled lesson'}</span>
                                      <button type="button" className="opacity-0 transition group-hover:opacity-100" onClick={() => setEditingFieldId(lessonTitleFieldId)} aria-label="Edit lesson title">
                                        <Pencil size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                                <div className="group flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                  {editingFieldId === lessonStartFieldId ? (
                                    <Input
                                      autoFocus
                                      type="number"
                                      min={1}
                                      value={pageInputValue(lesson.startPageHint)}
                                      onChange={(e) => updateLessonStartPage(structureUnitIdx, lessonIndex, e.target.value)}
                                      onBlur={() => setEditingFieldId(null)}
                                    />
                                  ) : (
                                    <>
                                      <span>{formatPageSpan(lessonRange.start, lessonRange.end)}</span>
                                      <button type="button" className="opacity-0 transition group-hover:opacity-100" onClick={() => setEditingFieldId(lessonStartFieldId)} aria-label="Edit lesson start page">
                                        <Pencil size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                                {(lesson.parts ?? []).map((part, partIndex, parts) => {
                                  const partRange = pageRangeForIndex(parts, partIndex, lessonRange.start, lessonRange.end)
                                  const partTitleFieldId = `part-title-${part.id}`
                                  const partStartFieldId = `part-start-${part.id}`
                                  const partKind = partVisualKindFromStructureTag(part, part.title, partIndex)
                                  const isStory = partKind === 'longStory' || partKind === 'shortStory'
                                  const activeDraft = drafts?.[structureUnitIdx]
                                  const storyThumbPage = isStory
                                    ? resolveStoryTitleThumbPdfPage({
                                        book: selectedBook ?? { id: bookId, title: '', units: [] },
                                        unit: {
                                          id: activeDraft?.id ?? `unit-${structureUnitIdx}`,
                                          title: activeDraft?.title ?? '',
                                          filePath: activeDraft?.filePath ?? sourceFilePath ?? '',
                                          startPageHint: activeDraft?.startPageHint,
                                        },
                                        lesson,
                                        part,
                                        partRangeStart: partRange.start,
                                        totalPdfPages: previewNumPages,
                                        alignmentRuntime,
                                      })
                                    : null
                                  const PartIcon = (() => {
                                    switch (partKind) {
                                      case 'vocabulary': return Languages
                                      case 'comprehension': return Brain
                                      case 'yourTurn': return Pointer
                                      case 'makingConnections': return Link2
                                      case 'grammarWrite': return PenLine
                                      case 'longStory': return BookMarked
                                      case 'shortStory': return BookOpen
                                      default: return BookOpen
                                    }
                                  })()
                                  return (
                                    <div
                                      key={part.id}
                                      className={cn('ml-3 space-y-1 pl-3', bookOutlinePartStoryShellClass(isStory))}
                                    >
                                      <div className="group flex items-center justify-between gap-2 text-sm">
                                        {editingFieldId === partTitleFieldId ? (
                                          <div className="flex min-w-0 flex-1 items-center gap-2">
                                            <Input
                                              autoFocus
                                              className="min-w-0 flex-1"
                                              value={part.title}
                                              onChange={(e) => updateLessonPartTitle(structureUnitIdx, lessonIndex, partIndex, e.target.value)}
                                              onBlur={() => setEditingFieldId(null)}
                                            />
                                            <span
                                              className={cn(BOOK_OUTLINE_PAGE_BADGE_CLASS, 'pointer-events-none')}
                                              title="Finish editing the title to edit pages"
                                            >
                                              {formatPageSpan(partRange.start, partRange.end)}
                                            </span>
                                          </div>
                                        ) : (
                                          <>
                                            <button
                                              type="button"
                                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                              onClick={() => goToMappedAnchorPage(partRange.start)}
                                              disabled={partRange.start == null}
                                              title={partRange.start != null ? `Open page ${partRange.start}` : 'No start page yet'}
                                            >
                                              {isStory && storyThumbPage != null && previewUrl && pdfReady ? (
                                                <span className="overflow-hidden rounded border border-[var(--border)]/70">
                                                  <PdfDocument
                                                    file={previewUrl}
                                                    options={PDF_DOCUMENT_OPTIONS}
                                                    loading={<span className="block h-[44px] w-[34px] bg-muted/40" />}
                                                  >
                                                    <PdfPage
                                                      pageNumber={storyThumbPage}
                                                      width={34}
                                                      renderTextLayer={false}
                                                      renderAnnotationLayer={false}
                                                    />
                                                  </PdfDocument>
                                                </span>
                                              ) : (
                                                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted/40 text-muted-foreground">
                                                  <PartIcon size={13} />
                                                </span>
                                              )}
                                              <span className="min-w-0">
                                                {isStory ? (
                                                  <span className="flex min-w-0 flex-col">
                                                    <span className="truncate text-[15px] font-semibold leading-tight text-foreground">
                                                      {getPartPrimaryLabel(resolvePartStructureTag(part, partIndex), part.title)}
                                                    </span>
                                                    <span className="text-[11px] italic text-muted-foreground">
                                                      {storySubtitleForVisualKind(partKind)}
                                                    </span>
                                                  </span>
                                                ) : (
                                                  <span className="truncate">
                                                    {getPartPrimaryLabel(resolvePartStructureTag(part, partIndex), part.title)}
                                                  </span>
                                                )}
                                              </span>
                                            </button>
                                            {editingFieldId === partStartFieldId ? (
                                              <Input
                                                autoFocus
                                                className="h-8 w-[5.5rem] shrink-0 font-mono text-xs tabular-nums"
                                                type="number"
                                                min={1}
                                                value={pageInputValue(part.startPageHint)}
                                                onChange={(e) => updateLessonPartStartPage(structureUnitIdx, lessonIndex, partIndex, e.target.value)}
                                                onBlur={() => setEditingFieldId(null)}
                                                aria-label="Part start page"
                                              />
                                            ) : (
                                              <button
                                                type="button"
                                                className={BOOK_OUTLINE_PAGE_BADGE_CLASS}
                                                onClick={() => setEditingFieldId(partStartFieldId)}
                                                aria-label="Edit part start page"
                                              >
                                                {formatPageSpan(partRange.start, partRange.end)}
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              className="shrink-0 opacity-0 transition group-hover:opacity-100"
                                              onClick={() => setEditingFieldId(partTitleFieldId)}
                                              aria-label="Edit part title"
                                            >
                                              <Pencil size={14} />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                                <div className="flex items-center gap-2">
                                  <Button type="button" size="sm" variant="outline" onClick={() => addLessonPart(structureUnitIdx, lessonIndex)}>Add part</Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => goToMappedAnchorPage(lessonRange.start)}
                                    disabled={lessonRange.start == null}
                                  >
                                    View
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
              </div>
            ) : null}

            {wizardStep === 'review' && !drafts.length ? (
              <StructureWizardStepPanel
                stepNumber={4}
                title="No outline yet"
                description="Go back to Extract and run the outline first."
                footer={
                  <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => goToWizardStep('extract')}>
                    Back to extract
                  </Button>
                }
              >
                <p className="text-[12px] text-muted-foreground">Nothing to edit until an outline exists.</p>
              </StructureWizardStepPanel>
            ) : null}
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-muted/15 p-1.5 shadow-inner sm:flex-auto">
            {previewUrl && pdfReady ? (
              <div className="flex min-h-0 flex-1 flex-col gap-1">
                <div className="flex shrink-0 flex-wrap items-center gap-1 rounded-md border border-border/50 bg-background/80 px-1.5 py-0.5">
                  <Button
                    type="button"
                    variant={notCountedPdfPages.includes(previewLeftPage) ? 'secondary' : 'outline'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={toggleCurrentPageIgnored}
                    aria-label={`Toggle not-counted for left page ${previewLeftPage}`}
                    title={`Not counted · left page ${previewLeftPage}`}
                    disabled={!canEditAlignment}
                  >
                    <Ghost size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant={hiddenPdfPages.includes(previewLeftPage) ? 'secondary' : 'outline'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => toggleHiddenPage(previewLeftPage)}
                    aria-label={`Toggle hidden for left page ${previewLeftPage}`}
                    title={`Hidden · left page ${previewLeftPage}`}
                    disabled={!canEditAlignment}
                  >
                    <Trash2 size={14} />
                  </Button>
                  {previewRightPage != null ? (
                    <Button
                      type="button"
                      variant={notCountedPdfPages.includes(previewRightPage) ? 'secondary' : 'outline'}
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => toggleIgnoredPage(previewRightPage)}
                      aria-label={`Toggle not-counted for right page ${previewRightPage}`}
                      title={`Not counted · right page ${previewRightPage}`}
                      disabled={!canEditAlignment}
                    >
                      <Ghost size={14} />
                    </Button>
                  ) : null}
                  {previewRightPage != null ? (
                    <Button
                      type="button"
                      variant={hiddenPdfPages.includes(previewRightPage) ? 'secondary' : 'outline'}
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => toggleHiddenPage(previewRightPage)}
                      aria-label={`Toggle hidden for right page ${previewRightPage}`}
                      title={`Hidden · right page ${previewRightPage}`}
                      disabled={!canEditAlignment}
                    >
                      <Trash2 size={14} />
                    </Button>
                  ) : null}
                  <span className="mx-0.5 hidden h-4 w-px bg-border sm:block" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium tabular-nums text-muted-foreground">
                    {previewRightPage != null
                      ? `${previewLeftEffective ?? '—'}–${previewRightEffective ?? '—'}`
                      : `${previewLeftEffective ?? '—'}`}
                    {previewNumPages != null ? (
                      <span className="text-muted-foreground/70"> · {alignmentRuntime.effectiveTotal} counted</span>
                    ) : null}
                  </span>
                  {drafts.length > 0 ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setUnitCoverFromPreview(structureUnitIdx, previewLeftPage)}
                        title={`Set unit ${structureUnitIdx + 1} thumbnail from left page`}
                        aria-label={`Set unit ${structureUnitIdx + 1} thumbnail from left page`}
                      >
                        <BookMarked size={14} />
                      </Button>
                      {previewRightPage != null ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setUnitCoverFromPreview(structureUnitIdx, previewRightPage)}
                          title={`Set unit ${structureUnitIdx + 1} thumbnail from right page`}
                          aria-label={`Set unit ${structureUnitIdx + 1} thumbnail from right page`}
                        >
                          <BookMarked size={14} />
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-0.5 px-2"
                    onClick={() => goToPreviewSpread(-1)}
                    disabled={visiblePreviewPages.length <= 1 || visiblePreviewPages.indexOf(previewLeftPage) <= 0}
                    aria-label="Previous preview spread"
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </Button>
                  <Input
                    className="h-7 w-12 px-1 text-center text-xs tabular-nums"
                    value={previewPageJumpDraft}
                    onChange={(e) => setPreviewPageJumpDraft(e.target.value)}
                    onBlur={() => commitPreviewPageJump()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        ;(e.target as HTMLInputElement).blur()
                      }
                    }}
                    disabled={!visiblePreviewPages.length}
                    aria-label="Go to counted page"
                    title="Counted page. Enter to go."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-0.5 px-2"
                    onClick={() => goToPreviewSpread(1)}
                    disabled={
                      visiblePreviewPages.length <= 1 ||
                      visiblePreviewPages.indexOf(previewLeftPage) >= visiblePreviewPages.length - 1
                    }
                    aria-label="Next preview spread"
                  >
                    Next
                    <ChevronRight size={14} />
                  </Button>
                </div>
                <PdfDocument
                  file={previewUrl}
                  options={PDF_DOCUMENT_OPTIONS}
                  onLoadSuccess={onPreviewDocumentLoadSuccess}
                  loading={<p className="p-4 text-sm text-muted-foreground">Loading PDF preview...</p>}
                  error={<p className="p-4 text-sm text-[var(--brand-red)]">Could not open this PDF preview.</p>}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div
                    ref={attachPreviewViewport}
                    className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-[var(--surface-2)] p-1.5"
                  >
                    <div
                      className="relative flex w-max max-w-full items-center justify-center leading-none"
                      style={{
                        transform: previewFitScale < 1 ? `scale(${previewFitScale})` : undefined,
                        transformOrigin: 'center center',
                      }}
                    >
                      <SpreadPageCluster
                        spreadOverlayWidthPx={previewCluster.spreadOverlayWidthPx}
                        pageCanvasHeightPx={previewCluster.pageCanvasHeightPx}
                        spreadPageWidthPx={previewSpreadPageWidth}
                        gutterPullPx={previewCluster.gutterPullPx}
                        showBookFrame={false}
                        leftPage={
                          <PdfPage
                            pageNumber={previewLeftPage}
                            width={previewSpreadPageWidth}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            onLoadSuccess={onPreviewPdfPageLoadSuccess}
                          />
                        }
                        rightPage={
                          previewRightPage != null ? (
                            <PdfPage
                              pageNumber={previewRightPage}
                              width={previewSpreadPageWidth}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              onLoadSuccess={onPreviewPdfPageLoadSuccess}
                            />
                          ) : null
                        }
                      />
                    </div>
                  </div>
                </PdfDocument>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-muted-foreground/25 bg-muted/20 px-4 py-6 text-center">
                <p className="text-sm font-medium text-muted-foreground">No PDF preview</p>
                <p className="max-w-xs text-xs leading-snug text-muted-foreground/90">
                  {!sourceFilePath
                    ? 'Add at least one unit with a PDF file to this book so a source path exists.'
                    : !pdfReady
                      ? 'Preparing the PDF viewer…'
                      : 'The preview URL could not be opened for this file.'}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border/50 pt-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {wizardStep !== 'toc' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const order: StructureWizardStep[] = ['toc', 'align', 'extract', 'review']
                  const idx = order.indexOf(wizardStep)
                  if (idx > 0) setWizardStep(order[idx - 1]!)
                }}
              >
                Back
              </Button>
            ) : null}
            {wizardStep === 'review' && selectedBook && bookHasTocMapping(selectedBook) ? (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const nextPayload: BookLibraryPayload = {
                    books: library.books.map((b) =>
                      b.id === selectedBook.id ? stripBookTocMapping(selectedBook) : b,
                    ),
                  }
                  const res = await fetch('/api/books/manifest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(nextPayload),
                  })
                  const body = (await res.json()) as BookLibraryPayload
                  if (res.ok) {
                    onManifestSaved(body, { bookId: selectedBook.id })
                    setDrafts([])
                    setLessonsByUnitIndex([])
                    setWizardStep('toc')
                    setFurthestStep('toc')
                    setTocRangeAtExtract(null)
                  }
                }}
              >
                Clear structure
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {wizardStep === 'toc' ? (
              <Button type="button" onClick={continueFromToc} disabled={!tocRange}>
                Continue to align
              </Button>
            ) : null}
            {wizardStep === 'align' ? (
              <Button type="button" onClick={continueFromAlign}>
                Continue to extract
              </Button>
            ) : null}
            {wizardStep === 'extract' ? (
              <Button type="button" onClick={() => void runExtractWithAi()} disabled={!canRunAi}>
                {aiExtracting ? 'Extracting…' : drafts.length ? 'Re-extract outline' : 'Extract outline'}
              </Button>
            ) : null}
            {wizardStep === 'review' ? (
              <Button type="button" onClick={saveManifest} disabled={saving || !drafts?.length || tocRangeDirtyAfterExtract}>
                {saving ? 'Saving…' : 'Save structure'}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ManualStoryReconcileDialog
      open={reconcileOpen}
      bookTitle={selectedBook?.title ?? 'This book'}
      candidates={reconcileCandidates}
      busy={reconcileBusy}
      onOpenChange={(next) => {
        if (reconcileBusy) return
        setReconcileOpen(next)
      }}
      onSkip={() => {
        setReconcileOpen(false)
        toast.message('You can still merge or delete manuals from Stories later.')
      }}
      onConfirm={(decisions) => {
        void applyManualStoryReconcile(decisions)
      }}
    />
    </>
  )
}
