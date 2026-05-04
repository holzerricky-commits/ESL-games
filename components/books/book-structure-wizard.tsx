'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { toast } from 'sonner'
import type { BookLessonPartRecord, BookLessonRecord, BookLibraryPayload, BookRecord } from '@/lib/books/types'
import { captureTocRangeAsJpegs } from '@/lib/books/capture-toc-images-client'
import { BOOK_OUTLINE_PAGE_BADGE_CLASS, bookOutlinePartStoryShellClass } from '@/components/books/book-outline-part-row'
import { getPartPrimaryLabel } from '@/lib/books/part-section-display'
import {
  partVisualKindFromStructureTag,
  storySubtitleForVisualKind,
} from '@/lib/books/book-part-visual-kind'
import { normalizeLessonsStructureTags, resolvePartStructureTag } from '@/lib/books/part-structure-tag'
import { draftsToUnits, type TocUnitDraft } from '@/lib/books/toc-import'
import { formatLessonTitleWithNumber } from '@/lib/books/lesson-title'
import { bookHasTocMapping, stripBookTocMapping } from '@/lib/books/strip-book-toc-mapping'
import {
  buildPageAlignmentRuntime,
  mergeCoverIntoHiddenPages,
  resolveEffectiveAnchorToPdfPage,
} from '@/lib/books/page-alignment-runtime'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), { ssr: false })
const PdfPage = dynamic(() => import('react-pdf').then((mod) => mod.Page), { ssr: false })
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const

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

function pageRangeForIndex<T extends { startPageHint?: number }>(
  items: T[],
  index: number,
  fallbackStart: number | null,
  fallbackEnd: number | null,
): { start: number | null; end: number | null } {
  const current = items[index]
  const start =
    typeof current?.startPageHint === 'number' && Number.isFinite(current.startPageHint)
      ? Math.round(current.startPageHint)
      : fallbackStart
  const next = items
    .slice(index + 1)
    .find((item) => typeof item.startPageHint === 'number' && Number.isFinite(item.startPageHint))
  const nextStart = typeof next?.startPageHint === 'number' ? Math.round(next.startPageHint) : null
  return {
    start,
    end: nextStart != null ? Math.max(start ?? 1, nextStart - 1) : fallbackEnd,
  }
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

export interface BookStructureWizardProps {
  library: BookLibraryPayload
  preferredBookId: string | null
  preferredFilePath: string | null
  onManifestSaved: (payload: BookLibraryPayload) => void
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
  const [previewNumPages, setPreviewNumPages] = useState<number | null>(null)
  const [pdfReady, setPdfReady] = useState(false)
  const [drafts, setDrafts] = useState<TocUnitDraft[]>([])
  const [lessonsByUnitIndex, setLessonsByUnitIndex] = useState<BookLessonRecord[][]>([])
  const [aiExtracting, setAiExtracting] = useState(false)
  const [aiExtractionCompleted, setAiExtractionCompleted] = useState(false)
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [stagedExtractionEnabled, setStagedExtractionEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastNumPages, setLastNumPages] = useState<number | null>(null)
  const [structureUnitIdx, setStructureUnitIdx] = useState(0)
  const [selectedUnitIndicesForMerge, setSelectedUnitIndicesForMerge] = useState<Set<number>>(() => new Set())
  const [openLessonId, setOpenLessonId] = useState<string | null>(null)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [unitTocRangeById, setUnitTocRangeById] = useState<Record<string, { from: string; to: string }>>({})
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const selectedBook = useMemo(() => library.books.find((b) => b.id === bookId) ?? null, [library.books, bookId])
  const sourcePathsForBook = useMemo(
    () => (selectedBook ? uniqueSortedFilePaths(selectedBook) : []),
    [selectedBook],
  )
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
    const first = library.books[0]
    const initialBook = (preferredBookId && library.books.find((b) => b.id === preferredBookId)) ?? first
    if (!initialBook) return
    const hasExistingMapping = bookHasTocMapping(initialBook)
    setBookId(initialBook.id)
    const paths = uniqueSortedFilePaths(initialBook)
    setSourceFilePath((preferredFilePath && paths.includes(preferredFilePath) ? preferredFilePath : null) ?? paths[0] ?? '')
    if (hasExistingMapping) {
      const restoredDrafts: TocUnitDraft[] = initialBook.units.map((unit) => ({
        id: unit.id,
        title: unit.title,
        needsReview: false,
        ...(typeof unit.startPageHint === 'number' ? { startPageHint: unit.startPageHint } : {}),
        ...(unit.anchorConfidence ? { anchorConfidence: unit.anchorConfidence } : {}),
        ...(unit.anchorSource ? { anchorSource: unit.anchorSource } : {}),
      }))
      const restoredLessons = initialBook.units.map((unit) => normalizeLessonsStructureTags(structuredClone(unit.lessons ?? [])))
      setDrafts(restoredDrafts)
      setLessonsByUnitIndex(restoredLessons)
    } else {
      setDrafts([])
      setLessonsByUnitIndex([])
    }
    setStructureUnitIdx(0)
    setSelectedUnitIndicesForMerge(new Set())
    setOpenLessonId(null)
    setEditingFieldId(null)
    setUnitTocRangeById({})
    setTocFrom('1')
    setTocTo('3')
    setAiMessage(null)
    setStagedExtractionEnabled(false)
    setAiExtractionCompleted(hasExistingMapping)
  }, [open, library.books, preferredBookId, preferredFilePath])

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

  function goToPreviewPage(nextPage: number) {
    setPreviewPage(clampPreviewPage(nearestVisiblePage(nextPage, visiblePreviewPages)))
  }

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
  }, [notCountedPdfPages, stagedExtractionEnabled])

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
      setDrafts(merged.drafts)
      setLessonsByUnitIndex(merged.lessonsByUnit.map((lessons) => normalizeLessonsStructureTags(lessons)))
      setStructureUnitIdx(0)
      setSelectedUnitIndicesForMerge(new Set())
      setOpenLessonId(null)
      setEditingFieldId(null)
      setAiMessage(`Extracted ${merged.drafts.length} units.`)
      setAiExtractionCompleted(true)
      toast.success(`Extracted ${merged.drafts.length} units.`)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'AI extraction failed.'
      setAiMessage(message)
      toast.error(message)
    } finally {
      setAiExtracting(false)
    }
  }, [extractBatchesWithAi, sourceFilePath, tocRange])

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
      setDrafts((prev) => prev.map((draft, i) => (i === unitIndex ? { ...draft, ...replacementDraft, id: draft.id } : draft)))
      setLessonsByUnitIndex((prev) =>
        prev.map((lessons, i) => (i === unitIndex ? normalizeLessonsStructureTags(replacementLessons) : lessons)),
      )
      setStructureUnitIdx(unitIndex)
      setOpenLessonId(null)
      setEditingFieldId(null)
      setAiExtractionCompleted(true)
      setAiMessage(`Re-extracted Unit ${unitIndex + 1}.`)
      toast.success(`Re-extracted Unit ${unitIndex + 1}.`)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unit extraction failed.'
      setAiMessage(message)
      toast.error(message)
    } finally {
      setAiExtracting(false)
    }
  }, [drafts, extractBatchesWithAi, resolveAnchorToPdfPage, sourceFilePath, unitTocRangeById])

  function addUnit() {
    const unitIndex = drafts.length
    const nextDraft: TocUnitDraft = {
      id: newBookChildId('unit'),
      title: `Unit ${unitIndex + 1}`,
      needsReview: false,
      startPageHint: effectiveHintForNewAnchors,
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
        nextLessonsByUnit[writeIndex] = normalizeLessonsStructureTags(mergedLessons)
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

  function toggleCurrentPageIgnored() {
    if (!aiExtractionCompleted) return
    const current = new Set(notCountedPdfPages)
    if (current.has(previewLeftPage)) current.delete(previewLeftPage)
    else current.add(previewLeftPage)
    setNotCountedPdfPagesInput(stringifyPageListInput([...current]))
  }

  function toggleIgnoredPage(page: number) {
    if (!aiExtractionCompleted) return
    const current = new Set(notCountedPdfPages)
    if (current.has(page)) current.delete(page)
    else current.add(page)
    setNotCountedPdfPagesInput(stringifyPageListInput([...current]))
  }

  function toggleHiddenPage(page: number) {
    if (!aiExtractionCompleted) return
    if (page === 1) return
    const current = new Set(hiddenPdfPages)
    if (current.has(page)) current.delete(page)
    else current.add(page)
    setHiddenPdfPagesInput(stringifyPageListInput(mergeCoverIntoHiddenPages([...current])))
  }

  function addLesson(unitIndex: number) {
    setLessonsByUnitIndex((prev) => {
      const next = [...prev]
      while (next.length <= unitIndex) next.push([])
      const n = (next[unitIndex] ?? []).length + 1
      next[unitIndex] = [
        ...(next[unitIndex] ?? []),
        { id: newBookChildId('lesson'), title: formatLessonTitleWithNumber(n, ''), startPageHint: effectiveHintForNewAnchors, parts: [] },
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
      setSaving(true)
      try {
        const units = draftsToUnits(sourceFilePath, drafts, lessonsByUnitIndex)
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
        onManifestSaved(body as BookLibraryPayload)
        setOpen(false)
        toast.success('Saved structure.')
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[94vh] w-[98vw] max-h-[94vh] flex-col gap-4 overflow-hidden p-5 sm:max-w-[min(1800px,98vw)] sm:p-6">
        <DialogTitle className="sr-only">Structure-first book mapping</DialogTitle>
        <DialogDescription className="sr-only">
          Review extracted units, lessons, parts, and editable PDF page anchors before saving.
        </DialogDescription>

        <div className="flex min-h-0 min-w-0 shrink-0 gap-4 border-b border-border/50 pb-4 sm:gap-5">
          <div className="flex shrink-0 flex-col justify-center">
            {previewUrl && pdfReady ? (
              <PdfPageThumbnail
                fileUrl={previewUrl}
                unitId={`${bookId}-structure-map-cover`}
                pageNumber={1}
                width={100}
                pdfReady={pdfReady}
                label="Cover"
                className="shadow-md ring-1 ring-border/50"
              />
            ) : (
              <div
                className="flex w-[100px] shrink-0 flex-col items-center justify-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/25 px-2 text-center text-[10px] font-medium text-muted-foreground"
                style={{ aspectRatio: '1 / 1.414' }}
              >
                PDF preview
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">Structure-first mapping</p>
            <h2 className="text-balance text-3xl font-semibold leading-[1.06] tracking-tight sm:text-4xl lg:text-5xl">
              {selectedBook?.title ?? 'Book'}
            </h2>
            <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[12px] text-muted-foreground">
              <span className="whitespace-nowrap">Books</span>
              <ChevronRight className="size-3.5 shrink-0 opacity-40" aria-hidden />
              <span className="min-w-0 max-w-[min(100%,28rem)] truncate font-medium text-foreground/80">{selectedBook?.title ?? '—'}</span>
              <ChevronRight className="size-3.5 shrink-0 opacity-40" aria-hidden />
              <span className="min-w-0 max-w-[min(100%,36rem)] truncate font-mono text-[11px] text-muted-foreground/95" title={sourceFilePath || undefined}>
                {sourceFilePath ? fileBasename(sourceFilePath) : 'No source file'}
              </span>
            </p>
            {(library.books.length > 1 || sourcePathsForBook.length > 1) ? (
              <div className="mt-2 flex flex-col gap-2.5 pt-0.5">
                {library.books.length > 1 ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/75">Switch book</span>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {library.books.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setBookId(b.id)
                            const paths = uniqueSortedFilePaths(b)
                            setSourceFilePath(paths[0] ?? '')
                          }}
                          className={cn(
                            'max-w-full truncate rounded-full border px-2.5 py-0.5 text-left text-xs font-medium transition-colors',
                            b.id === bookId
                              ? 'border-primary/35 bg-primary/12 text-foreground'
                              : 'border-border/60 bg-background/80 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                          )}
                        >
                          {b.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {sourcePathsForBook.length > 1 ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/75">Source PDF</span>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {sourcePathsForBook.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setSourceFilePath(p)}
                          className={cn(
                            'max-w-full truncate rounded-full border px-2.5 py-0.5 text-left font-mono text-[11px] font-medium transition-colors',
                            p === sourceFilePath
                              ? 'border-primary/35 bg-primary/12 text-foreground'
                              : 'border-border/60 bg-background/80 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                          )}
                          title={p}
                        >
                          {fileBasename(p)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid min-h-0 min-w-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(520px,44vw)]">
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 shadow-sm">
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid flex-1 gap-1.5 sm:min-w-[7rem] sm:max-w-[10rem]">
                  <Label className="text-xs font-medium text-muted-foreground">TOC from</Label>
                  <Input type="number" min={1} className="h-9" value={tocFrom} onChange={(e) => setTocFrom(e.target.value)} />
                </div>
                <div className="grid flex-1 gap-1.5 sm:min-w-[7rem] sm:max-w-[10rem]">
                  <Label className="text-xs font-medium text-muted-foreground">TOC to</Label>
                  <Input type="number" min={1} className="h-9" value={tocTo} onChange={(e) => setTocTo(e.target.value)} />
                </div>
                <Button type="button" className="h-9 shrink-0" onClick={() => void runExtractWithAi()} disabled={!canRunAi}>
                  {aiExtracting ? 'Extracting…' : 'Extract with AI'}
                </Button>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border"
                  checked={stagedExtractionEnabled}
                  onChange={(e) => setStagedExtractionEnabled(e.target.checked)}
                />
                Use staged extraction for long TOCs (safer, slower)
                {recommendStagedExtraction ? <span className="rounded bg-amber-100/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">recommended</span> : null}
              </label>
              <div className="grid gap-3 border-t border-border/40 pt-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Not counted PDF pages</Label>
                  <Input
                    className="h-9 font-mono text-xs"
                    placeholder="e.g. 8,9, 120-122"
                    value={notCountedPdfPagesInput}
                    onChange={(e) => setNotCountedPdfPagesInput(e.target.value)}
                    disabled={!aiExtractionCompleted}
                  />
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Visible in preview but skipped for printed-page numbering.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Hidden PDF pages</Label>
                  <Input
                    className="h-9 font-mono text-xs"
                    placeholder="e.g. 12,13 or 120-121"
                    value={hiddenPdfPagesInput}
                    onChange={(e) => setHiddenPdfPagesInput(e.target.value)}
                    disabled={!aiExtractionCompleted}
                  />
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Removed from spread navigation in the reader. Page 1 (cover) is always omitted from previews but still counts as page 1 so the first shown spread can start at 2 (left).
                  </p>
                </div>
              </div>
              {!aiExtractionCompleted ? (
                <p className="text-[11px] text-muted-foreground">Run AI extraction once to unlock page alignment fields.</p>
              ) : null}
              {aiMessage ? <p className="rounded-md bg-background/60 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">{aiMessage}</p> : null}
            </div>

            {lastNumPages != null ? (
              <p className="text-[11px] font-medium tabular-nums text-muted-foreground">PDF page count: {lastNumPages}</p>
            ) : null}

            {drafts?.length ? (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="space-y-2 rounded-xl border border-border/50 bg-background/40 p-3">
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Units</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={mergeSelectedUnits}
                        disabled={selectedUnitIndicesForMerge.size < 2}
                      >
                        Merge selected
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={addUnit}>Add unit</Button>
                    </div>
                  </div>
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

                <div className="space-y-2 rounded-xl border border-border/50 bg-background/40 p-3">
                  <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-medium text-foreground">
                        Unit {structureUnitIdx + 1}
                        <span className="font-normal text-muted-foreground"> · {formatPageSpan(selectedUnitPageRange.start, selectedUnitPageRange.end)}</span>
                      </p>
                      {selectedUnitCoverRange.start != null && selectedUnitCoverRange.end != null ? (
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          Cover-only pages: {formatPageSpan(selectedUnitCoverRange.start, selectedUnitCoverRange.end)}
                        </p>
                      ) : null}
                    </div>
                    <Button type="button" size="sm" variant="secondary" className="h-8 shrink-0" onClick={() => addLesson(structureUnitIdx)}>Add lesson</Button>
                  </div>
                  <div className="space-y-2">
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
                                  const tocAnchored =
                                    typeof part.startPageHint === 'number' || typeof lesson.startPageHint === 'number'
                                  const partStartPdf =
                                    partRange.start != null
                                      ? tocAnchored
                                        ? resolveEffectiveAnchorToPdfPage(partRange.start, alignmentRuntime) ??
                                          partRange.start
                                        : partRange.start
                                      : null
                                  const storyThumbPage =
                                    isStory && partStartPdf != null ? clampPreviewPage(Math.floor(partStartPdf) + 1) : null
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
          </div>

          <div className="flex min-h-0 flex-col overflow-y-auto rounded-xl border border-border/60 bg-muted/10 p-3 shadow-inner">
            {previewUrl && pdfReady ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/70 px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={notCountedPdfPages.includes(previewLeftPage) ? 'secondary' : 'outline'}
                      size="icon"
                      onClick={toggleCurrentPageIgnored}
                      aria-label={`Toggle not-counted for left page ${previewLeftPage}`}
                      title={`Toggle not-counted for left page ${previewLeftPage}`}
                      disabled={!aiExtractionCompleted}
                    >
                      <Ghost size={16} />
                    </Button>
                    <Button
                      type="button"
                      variant={hiddenPdfPages.includes(previewLeftPage) ? 'secondary' : 'outline'}
                      size="icon"
                      onClick={() => toggleHiddenPage(previewLeftPage)}
                      aria-label={`Toggle hidden for left page ${previewLeftPage}`}
                      title={`Toggle hidden for left page ${previewLeftPage}`}
                      disabled={!aiExtractionCompleted}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    {previewRightPage != null ? (
                      <Button
                        type="button"
                        variant={notCountedPdfPages.includes(previewRightPage) ? 'secondary' : 'outline'}
                        size="icon"
                        onClick={() => toggleIgnoredPage(previewRightPage)}
                        aria-label={`Toggle not-counted for right page ${previewRightPage}`}
                        title={`Toggle not-counted for right page ${previewRightPage}`}
                        disabled={!aiExtractionCompleted}
                      >
                        <Ghost size={16} />
                      </Button>
                    ) : null}
                    {previewRightPage != null ? (
                      <Button
                        type="button"
                        variant={hiddenPdfPages.includes(previewRightPage) ? 'secondary' : 'outline'}
                        size="icon"
                        onClick={() => toggleHiddenPage(previewRightPage)}
                        aria-label={`Toggle hidden for right page ${previewRightPage}`}
                        title={`Toggle hidden for right page ${previewRightPage}`}
                        disabled={!aiExtractionCompleted}
                      >
                        <Trash2 size={16} />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    Preview {previewRightPage != null
                      ? `${previewLeftEffective ?? '—'}–${previewRightEffective ?? '—'}`
                      : `${previewLeftEffective ?? '—'}`}
                    {previewNumPages != null ? (
                      <span className="text-muted-foreground/70"> · {alignmentRuntime.effectiveTotal} counted</span>
                    ) : null}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => goToPreviewSpread(-1)}
                      disabled={visiblePreviewPages.indexOf(previewLeftPage) <= 0}
                      aria-label="Previous preview spread"
                    >
                      <ChevronLeft size={16} />
                      Prev
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => goToPreviewSpread(1)}
                      disabled={
                        visiblePreviewPages.length <= 1 ||
                        visiblePreviewPages.indexOf(previewLeftPage) >= visiblePreviewPages.length - 1
                      }
                      aria-label="Next preview spread"
                    >
                      Next
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
                <PdfDocument
                  file={previewUrl}
                  options={PDF_DOCUMENT_OPTIONS}
                  onLoadSuccess={onPreviewDocumentLoadSuccess}
                  loading={<p className="p-6 text-sm text-muted-foreground">Loading PDF preview...</p>}
                  error={<p className="p-6 text-sm text-[var(--brand-red)]">Could not open this PDF preview.</p>}
                >
                  <div className="grid min-h-0 flex-1 gap-2 2xl:grid-cols-2">
                    <div className="min-h-0 overflow-auto rounded-lg border border-border/60 bg-background p-1 shadow-sm">
                      <div className="mb-1 flex items-center justify-between gap-2 px-1 text-[11px] font-medium text-muted-foreground">
                        <span className="min-w-0 flex-1 text-center">
                        {previewLeftEffective != null ? (
                          `Page ${previewLeftEffective}`
                        ) : (
                          <span title="Ghosted page" aria-label="Ghosted page">
                            <Ghost size={12} />
                          </span>
                        )}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => setUnitCoverFromPreview(structureUnitIdx, previewLeftPage)}
                          title={`Set unit ${structureUnitIdx + 1} cover to this page`}
                          aria-label={`Set unit ${structureUnitIdx + 1} cover to this left page`}
                          disabled={!drafts.length}
                        >
                          <BookMarked size={12} />
                        </Button>
                      </div>
                      <PdfPage pageNumber={previewLeftPage} height={620} renderTextLayer={false} renderAnnotationLayer={false} />
                    </div>
                    {previewRightPage != null ? (
                      <div className="min-h-0 overflow-auto rounded-lg border border-border/60 bg-background p-1 shadow-sm">
                        <div className="mb-1 flex items-center justify-between gap-2 px-1 text-[11px] font-medium text-muted-foreground">
                          <span className="min-w-0 flex-1 text-center">
                          {previewRightEffective != null ? (
                            `Page ${previewRightEffective}`
                          ) : (
                            <span title="Ghosted page" aria-label="Ghosted page">
                              <Ghost size={12} />
                            </span>
                          )}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => setUnitCoverFromPreview(structureUnitIdx, previewRightPage)}
                            title={`Set unit ${structureUnitIdx + 1} cover to this page`}
                            aria-label={`Set unit ${structureUnitIdx + 1} cover to this right page`}
                            disabled={!drafts.length}
                          >
                            <BookMarked size={12} />
                          </Button>
                        </div>
                        <PdfPage pageNumber={previewRightPage} height={620} renderTextLayer={false} renderAnnotationLayer={false} />
                      </div>
                    ) : null}
                  </div>
                </PdfDocument>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/15 p-8 text-center">
                <p className="text-sm font-medium text-muted-foreground">No PDF preview</p>
                <p className="max-w-sm text-xs leading-relaxed text-muted-foreground/90">
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

        <DialogFooter className="gap-2 border-t border-border/50 pt-2 sm:justify-end">
          {selectedBook && bookHasTocMapping(selectedBook) && (
            <Button type="button" variant="outline" onClick={async () => {
              const nextPayload: BookLibraryPayload = { books: library.books.map((b) => (b.id === selectedBook.id ? stripBookTocMapping(selectedBook) : b)) }
              const res = await fetch('/api/books/manifest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nextPayload) })
              const body = (await res.json()) as BookLibraryPayload
              if (res.ok) onManifestSaved(body)
            }}>Clear structure</Button>
          )}
          <Button type="button" onClick={saveManifest} disabled={saving || !drafts?.length}>Save structure</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
