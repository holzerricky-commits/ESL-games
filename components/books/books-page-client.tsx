'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { Camera, ChevronDown, ChevronLeft, ChevronRight, FileText, FileType2, Pencil, Settings2, Upload, Wand2, X } from 'lucide-react'
import type {
  BookLessonPartRecord,
  BookLessonRecord,
  BookLibraryPayload,
  BookRecord,
  BookUnitRecord,
} from '@/lib/books/types'
import { DEFAULT_BOOK_FOCUS_AREAS } from '@/lib/context/types'
import type { BookContextDraftRecord, BookContextMaterialRecord, BookContextSummaryRecord } from '@/lib/context/types'
import { mapPdfPageToDisplayLabel, type PageNumberingMode } from '@/lib/books/page-numbering'
import { clampPdfPage, clampPdfPageToVisible, getFileAlignment, getUnitReaderBounds, getVisiblePdfPages } from '@/lib/books/page-range'
import { buildPageAlignmentRuntime, resolveEffectiveAnchorToPdfPage } from '@/lib/books/page-alignment-runtime'
import { getSavedUnitPage, saveUnitPage } from '@/lib/books/progress'
import {
  appendStudentCurriculumSession,
  getStudentDefaultBookUnitForReader,
  getStudentResumePdfPageForBookUnit,
} from '@/lib/students/selectors'
import {
  clearLessonRangeOverride,
  getLessonRangeOverride,
  upsertLessonRangeOverride,
} from '@/lib/students/selectors'
import type { LessonContextRecord, UnitContextRecord } from '@/lib/context/types'
import {
  deriveAutoLessonRange,
  resolveCanonicalLessonRange,
  type ContextRangeOption,
  type LessonRangeSource,
} from '@/lib/context/resolver'
import { BookStructureWizard } from '@/components/books/book-structure-wizard'
import { BookDropUpload } from '@/components/books/book-drop-upload'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { bookHasTocMapping } from '@/lib/books/strip-book-toc-mapping'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), {
  ssr: false,
})
const PdfPage = dynamic(() => import('react-pdf').then((mod) => mod.Page), {
  ssr: false,
})
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const
const BOOK_MATERIAL_TYPE_OPTIONS: Array<{ value: BookContextMaterialRecord['type']; label: string }> = [
  { value: 'pacing-guide', label: 'Pacing guide' },
  { value: 'scope-sequence', label: 'Scope & sequence' },
  { value: 'teacher-edition', label: 'Teacher edition' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'intervention', label: 'Intervention' },
  { value: 'grammar-writing', label: 'Grammar / writing' },
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'digital-resource', label: 'Digital resource' },
]

interface SelectedBookState {
  bookId: string
  unitId: string | null
}

interface DownloadedBookMaterial {
  id: string
  url: string
  title: string
  materialType: string
  fileName: string
  filePath: string
  sizeBytes: number
  contentType: string
  savedAt: string
}

interface SourceDownloadProgress {
  taskId: string
  status: 'queued' | 'downloading' | 'completed' | 'failed'
  downloadedBytes: number
  totalBytes: number | null
  speedBytesPerSec: number
  error?: string
  filePath?: string
}

interface MaterialMappingSuggestion {
  materialId: string
  materialTitle: string
  materialFilePath: string
  bookId: string
  unitId?: string
  lessonId?: string
  partId?: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
  pathLabel: string
  sourceFilePath?: string
  evidenceSnippet?: string
  evidencePage?: number | null
  score?: number
  detectedSignals?: string[]
  extractedLessonTitle?: string
  lessonProfileSnapshot?: MaterialLessonProfile
  mappedAt: string
}

interface MappingScanSkipRecord {
  materialId: string
  materialTitle: string
  reason: string
}

interface MaterialEvidence {
  field: string
  snippet: string
  page: number | null
  confidence: 'high' | 'medium' | 'low'
}

interface MaterialLessonSignals {
  phonics: string[]
  fluency: string[]
  comprehension: string[]
  listening: string[]
  vocabulary: string[]
  grammar: string[]
  writing: string[]
  speaking: string[]
  assessment: string[]
  extensions: string[]
}

interface MaterialLessonSections {
  readAloud: string[]
  anchorText: string[]
  pairedSelection: string[]
  selection: string[]
  targetVocabulary: string[]
  spelling: string[]
  grammar: string[]
  writing: string[]
  essentialQuestion: string[]
  comprehensionTargets: string[]
  grammarVocabTargets: string[]
  weeklyAssessments: string[]
}

interface MaterialLessonProfile {
  lessonTitle: string
  lessonNumber: number | null
  inferredUnitId?: string
  inferredLessonId?: string
  inferredPathLabel?: string
  confidence: 'high' | 'medium' | 'low'
  sectionFields?: MaterialLessonSections
  signals: MaterialLessonSignals
  evidence: MaterialEvidence[]
}

interface MaterialAnalysisResult {
  materialId: string
  materialTitle: string
  materialFilePath: string
  parseStatus: 'ok' | 'partial' | 'failed'
  extractionMode: 'pdf' | 'text' | 'metadata'
  detectedUnits?: string[]
  lessonProfiles: MaterialLessonProfile[]
  errors: string[]
  parsedAt: string
}


function makeUnitFileUrl(filePath: string): string {
  return `/api/book-file?path=${encodeURIComponent(filePath)}`
}

function estimatePageByIndex(min: number, max: number, idx: number, total: number): number {
  if (max <= min) return min
  if (total <= 1) return min
  const clampedIdx = Math.max(0, Math.min(idx, total - 1))
  const span = max - min
  const ratio = clampedIdx / (total - 1)
  return min + Math.round(span * ratio)
}

function formatPageSpan(
  start: number | null,
  end: number | null,
  book?: BookRecord | null,
  unit?: BookUnitRecord | null,
  totalPdfPages?: number | null,
  mode: PageNumberingMode = 'mapped',
): string {
  if (start == null) return 'pages —'
  const left = mapPdfPageToDisplayLabel(start, book, unit, totalPdfPages ?? null, mode)
  if (end == null || end <= start) return `p${left}`
  const right = mapPdfPageToDisplayLabel(end, book, unit, totalPdfPages ?? null, mode)
  return `p${left}-${right}`
}

function pageRangeForIndex<T extends { startPageHint?: number; endPageHint?: number }>(
  items: T[],
  index: number,
  fallbackStart?: number | null,
  fallbackEnd?: number | null,
): { start: number | null; end: number | null } {
  const current = items[index]
  const start = typeof current?.startPageHint === 'number'
    ? Math.round(current.startPageHint)
    : (fallbackStart ?? null)
  const explicitEnd = typeof current?.endPageHint === 'number'
    ? Math.round(current.endPageHint)
    : null
  if (explicitEnd != null) return { start, end: explicitEnd }
  const next = items
    .slice(index + 1)
    .find((item) => typeof item.startPageHint === 'number' && Number.isFinite(item.startPageHint))
  const nextStart = typeof next?.startPageHint === 'number' ? Math.round(next.startPageHint) : null
  return {
    start,
    end: nextStart != null ? Math.max(start ?? 1, nextStart - 1) : (fallbackEnd ?? null),
  }
}

function resolveStartHintWithAlignment(
  min: number,
  max: number,
  hint: number | null | undefined,
  book: BookRecord | null | undefined,
  unit: BookUnitRecord,
  totalPdfPages: number | null,
): number | null {
  if (typeof hint !== 'number' || !Number.isFinite(hint)) return null
  const rounded = Math.round(hint)
  const raw = clampPdfPage(rounded, { min, max })
  const { notCountedPdfPages, hiddenPdfPages } = getFileAlignment(book, unit.filePath)
  if (!notCountedPdfPages.length && !hiddenPdfPages.length) return raw
  const runtime = buildPageAlignmentRuntime(totalPdfPages, hiddenPdfPages, notCountedPdfPages)
  const mapped = resolveEffectiveAnchorToPdfPage(rounded, runtime)
  if (mapped == null) return raw
  return clampPdfPage(mapped, { min, max })
}

function inferGradeHintFromBook(book: BookRecord | null): string | null {
  if (!book) return null
  const text = `${book.title} ${book.description ?? ''}`
  const gMatch = text.match(/\bG(?:rade)?\s*([1-9]|1[0-2])\b/i)
  if (gMatch?.[1]) return `Grade ${gMatch[1]}`
  const gradeMatch = text.match(/\bGrade\s*([1-9]|1[0-2])\b/i)
  if (gradeMatch?.[1]) return `Grade ${gradeMatch[1]}`
  return null
}

function toggleMaterialType(
  current: BookContextMaterialRecord['type'][],
  type: BookContextMaterialRecord['type'],
): BookContextMaterialRecord['type'][] {
  if (current.includes(type)) return current.filter((item) => item !== type)
  return [...current, type]
}

function normalizeFocusArea(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function lessonNumberFromTitle(title: string): number | null {
  const match = title.match(/\blesson\s+([0-9]{1,2})\b/i)
  if (!match?.[1]) return null
  const num = Number(match[1])
  return Number.isFinite(num) && num > 0 ? num : null
}

function isFrameworkEligibleLessonTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase()
  if (!normalized) return false
  if (normalized.includes('reading power')) return false
  if (normalized.includes('unit wrap up') || normalized.includes('unit wrap-up')) return false
  if (normalized.includes('glossary')) return false
  return true
}

function withSelectionFocusArea(values: string[]): string[] {
  const cleaned = values.map((item) => normalizeFocusArea(String(item ?? ''))).filter(Boolean)
  const hasSelection = cleaned.some((item) => item.toLowerCase() === 'selection')
  return hasSelection ? cleaned : ['Selection', ...cleaned]
}

function formatByteCount(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '0 B/s'
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`
}

function isPdfMaterial(material: DownloadedBookMaterial): boolean {
  const contentType = material.contentType?.toLowerCase() ?? ''
  const fileName = material.fileName?.toLowerCase() ?? ''
  const filePath = material.filePath?.toLowerCase() ?? ''
  return contentType.includes('pdf') || fileName.endsWith('.pdf') || filePath.endsWith('.pdf')
}

const FRAMEWORK_SUBSECTION_LABEL_RE = /^(\s*)([A-Za-z][^:\n]{0,80}:)(.*)$/

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeFrameworkCellText(value: string): string {
  const lines = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const output: string[] = []
  let seenLabel = false

  for (const line of lines) {
    const match = line.match(FRAMEWORK_SUBSECTION_LABEL_RE)
    if (match) {
      if (seenLabel && output[output.length - 1] !== '') {
        output.push('')
      }
      seenLabel = true
      output.push(line)
      continue
    }
    output.push(line)
  }

  return output.join('\n')
}

function frameworkCellTextToHtml(value: string): string {
  try {
    const normalized = normalizeFrameworkCellText(value)
    if (!normalized.trim()) return ''
    return normalized
      .split('\n')
      .map((line) => {
        const match = line.match(FRAMEWORK_SUBSECTION_LABEL_RE)
        if (!match) return escapeHtml(line)
        const [, leading, label, tail] = match
        return `${escapeHtml(leading)}<strong class="text-sm font-semibold">${escapeHtml(label)}</strong>${escapeHtml(tail)}`
      })
      .join('<br />')
  } catch {
    return escapeHtml(value.replace(/\r\n?/g, '\n')).replace(/\n/g, '<br />')
  }
}

function normalizeEditableText(rawValue: string): string {
  const normalizedLineEndings = rawValue.replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ')
  return normalizeFrameworkCellText(normalizedLineEndings.replace(/\n+$/g, ''))
}

interface FrameworkRichCellEditorProps {
  value: string
  placeholder: string
  className?: string
  onChange: (nextValue: string) => void
}

function FrameworkRichCellEditor({ value, placeholder, className, onChange }: FrameworkRichCellEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [localText, setLocalText] = useState(() => normalizeFrameworkCellText(value))
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    const normalizedIncoming = normalizeFrameworkCellText(value)
    setLocalText(normalizedIncoming)
    if (!isFocused && editorRef.current) {
      editorRef.current.innerHTML = frameworkCellTextToHtml(normalizedIncoming)
    }
  }, [isFocused, value])

  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.innerHTML = frameworkCellTextToHtml(localText)
  }, [])

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder={placeholder}
      className={cn(
        'whitespace-pre-wrap break-words [overflow-wrap:anywhere] px-0.5 py-0.5 text-xs leading-5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'empty:before:pointer-events-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground',
        className,
      )}
      onFocus={() => setIsFocused(true)}
      onInput={(event) => {
        const nextRaw = event.currentTarget.innerText ?? ''
        const nextText = normalizeEditableText(nextRaw)
        setLocalText(nextText)
        onChange(nextText)
      }}
      onBlur={(event) => {
        const nextText = normalizeEditableText(event.currentTarget.innerText ?? '')
        setIsFocused(false)
        setLocalText(nextText)
        onChange(nextText)
        event.currentTarget.innerHTML = frameworkCellTextToHtml(nextText)
      }}
    />
  )
}

interface FrameworkApplyPreview {
  units: Array<{
    unitId: string
    unitTitle?: string
    theme: string
    bigIdeas: string[]
    crossCurricularLinks: string[]
    targetLanguageDomains: string[]
    sourcePageRange: { startPage: number; endPage: number }
  }>
  lessons: Array<{
    lessonId: string
    lessonTitle?: string
    unitId: string
    textType: string
    comprehensionSkill: string
    strategy: string
    essentialQuestions: string[]
    lessonGoals: string[]
    grammarNotes: string[]
    writingNotes: string[]
    sourcePageRange: { startPage: number; endPage: number }
  }>
  parts: Array<{
    lessonId: string
    partId: string
    partTitle?: string
    partGoals: string[]
    activityNotes: string[]
    grammarNotes: string[]
    writingNotes: string[]
    sourcePageRange: { startPage: number; endPage: number }
  }>
  book: {
    focusAreas: string[]
    instructionalPriorities: string[]
    summaryNote: string
  }
}

export function BooksPageClient() {
  const numberingMode: PageNumberingMode = 'mapped'
  const searchParams = useSearchParams()
  const selectedStudentId = searchParams.get('student')
  const requestedBookId = searchParams.get('book')
  const requestedUnitId = searchParams.get('unit')
  const [library, setLibrary] = useState<BookLibraryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedBookState | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [viewerWidth, setViewerWidth] = useState(900)
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null)
  const [pdfReady, setPdfReady] = useState(false)
  /** Single expanded book in the left sidebar; collapsed by default. */
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null)
  /** One expanded unit per book (`bookId -> unitId`). */
  const [expandedUnitByBook, setExpandedUnitByBook] = useState<Record<string, string | null>>({})
  /** One expanded lesson parts group per unit (`unitId -> lessonId`). */
  const [expandedLessonByUnit, setExpandedLessonByUnit] = useState<Record<string, string | null>>({})
  const [structureWizardOpen, setStructureWizardOpen] = useState(false)
  const [structureWizardTarget, setStructureWizardTarget] = useState<{ bookId: string; filePath: string | null } | null>(null)
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false)
  const [readerLessonId, setReaderLessonId] = useState<string | null>(null)
  const [readerPartId, setReaderPartId] = useState<string | null>(null)
  const [unitContext, setUnitContext] = useState<UnitContextRecord | null>(null)
  const [lessonContext, setLessonContext] = useState<LessonContextRecord | null>(null)
  const [bookContext, setBookContext] = useState<BookContextSummaryRecord | null>(null)
  const [contextBusy, setContextBusy] = useState<'unit' | 'lesson' | null>(null)
  const [unitContextLoading, setUnitContextLoading] = useState(false)
  const [lessonContextLoading, setLessonContextLoading] = useState(false)
  const [bookContextLoading, setBookContextLoading] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)
  const [lessonRangeDraft, setLessonRangeDraft] = useState<{
    key: string
    startPage: number
    endPage: number
    source: LessonRangeSource
  } | null>(null)
  const [bookText, setBookText] = useState('')
  const [unitText, setUnitText] = useState('')
  const [lessonText, setLessonText] = useState('')
  const [partText, setPartText] = useState('')
  const [editingLevel, setEditingLevel] = useState<Record<'book' | 'unit' | 'lesson' | 'part', boolean>>({
    book: false,
    unit: false,
    lesson: false,
    part: false,
  })
  const [aiPanelOpen, setAiPanelOpen] = useState<Record<'book' | 'unit' | 'lesson' | 'part', boolean>>({
    book: false,
    unit: false,
    lesson: false,
    part: false,
  })
  const [aiRange, setAiRange] = useState<Record<'book' | 'unit' | 'lesson' | 'part', { startPage: number; endPage: number }>>({
    book: { startPage: 1, endPage: 1 },
    unit: { startPage: 1, endPage: 1 },
    lesson: { startPage: 1, endPage: 1 },
    part: { startPage: 1, endPage: 1 },
  })
  const [aiBusyLevel, setAiBusyLevel] = useState<'unit' | 'lesson' | null>(null)
  const [bookQueryOverride, setBookQueryOverride] = useState('')
  const [bookAdvancedSearchOpen, setBookAdvancedSearchOpen] = useState(false)
  const [bookMaterialTypes, setBookMaterialTypes] = useState<BookContextMaterialRecord['type'][]>([
    'pacing-guide',
    'scope-sequence',
    'teacher-edition',
  ])
  const [bookSearchMode, setBookSearchMode] = useState<'official-first' | 'broad'>('official-first')
  const [bookDownloadableOnly, setBookDownloadableOnly] = useState(true)
  const [bookResultLimit, setBookResultLimit] = useState(8)
  const [bookDraft, setBookDraft] = useState<BookContextDraftRecord | null>(null)
  const [bookFocusAreas, setBookFocusAreas] = useState<string[]>([...DEFAULT_BOOK_FOCUS_AREAS])
  const [bookFocusAreaInput, setBookFocusAreaInput] = useState('')
  const [downloadedMaterials, setDownloadedMaterials] = useState<DownloadedBookMaterial[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [sourceDownloadProgress, setSourceDownloadProgress] = useState<Record<string, SourceDownloadProgress>>({})
  const [mappingSuggestions, setMappingSuggestions] = useState<MaterialMappingSuggestion[]>([])
  const [mappingSkipped, setMappingSkipped] = useState<MappingScanSkipRecord[]>([])
  const [mappingProcessedCount, setMappingProcessedCount] = useState(0)
  const [mappingScannedCount, setMappingScannedCount] = useState(0)
  const [mappingErrors, setMappingErrors] = useState<string[]>([])
  const [materialAnalyses, setMaterialAnalyses] = useState<MaterialAnalysisResult[]>([])
  const [mappingScanBusy, setMappingScanBusy] = useState(false)
  const [mappingApplyBusy, setMappingApplyBusy] = useState(false)
  const [mappingWorkspaceOpen, setMappingWorkspaceOpen] = useState(false)
  const [frameworkWorkspaceOpen, setFrameworkWorkspaceOpen] = useState(false)
  const [selectedMaterialIdsForMapping, setSelectedMaterialIdsForMapping] = useState<string[]>([])
  const [bookAiBusy, setBookAiBusy] = useState(false)
  const [bookSaveBusy, setBookSaveBusy] = useState(false)
  const [frameworkApplyBusy, setFrameworkApplyBusy] = useState(false)
  const [frameworkPreviewOpen, setFrameworkPreviewOpen] = useState(false)
  const [frameworkPreviewBusy, setFrameworkPreviewBusy] = useState(false)
  const [frameworkPreview, setFrameworkPreview] = useState<FrameworkApplyPreview | null>(null)
  const [frameworkPreviewSummary, setFrameworkPreviewSummary] = useState<{
    unitsUpdated: number
    lessonsUpdated: number
    partsUpdated: number
    deprecatedLabelsSkipped: number
  } | null>(null)
  const [focusNotesByLesson, setFocusNotesByLesson] = useState<Record<string, Record<string, string>>>({})
  const [lessonCaptureRow, setLessonCaptureRow] = useState<{
    lessonId: string
    lessonTitle: string
    unitTitle: string
  } | null>(null)
  const [lessonCaptureImage, setLessonCaptureImage] = useState<string>('')
  const [lessonCaptureBusy, setLessonCaptureBusy] = useState(false)
  const [tableCaptureOpen, setTableCaptureOpen] = useState(false)
  const [tableCaptureImage, setTableCaptureImage] = useState('')
  const [tableCaptureBusy, setTableCaptureBusy] = useState(false)
  const [unitCaptureOpen, setUnitCaptureOpen] = useState(false)
  const [unitCaptureImage, setUnitCaptureImage] = useState('')
  const [unitCaptureBusy, setUnitCaptureBusy] = useState(false)
  const [unitCaptureUnitId, setUnitCaptureUnitId] = useState('')
  const [selectedFrameworkLessonIds, setSelectedFrameworkLessonIds] = useState<string[]>([])
  const [selectedRowsCaptureOpen, setSelectedRowsCaptureOpen] = useState(false)
  const [selectedRowsCaptureImage, setSelectedRowsCaptureImage] = useState('')
  const [selectedRowsCaptureBusy, setSelectedRowsCaptureBusy] = useState(false)
  const selectedRef = useRef<SelectedBookState | null>(null)
  const pageNumberRef = useRef(1)
  const sessionStartedAtRef = useRef<string | null>(null)
  const unitContextLoadRevRef = useRef(0)
  const lessonContextLoadRevRef = useRef(0)
  const bookContextLoadRevRef = useRef(0)
  const lessonCaptureFileInputRef = useRef<HTMLInputElement | null>(null)
  const tableCaptureFileInputRef = useRef<HTMLInputElement | null>(null)
  const unitCaptureFileInputRef = useRef<HTMLInputElement | null>(null)
  const selectedRowsCaptureFileInputRef = useRef<HTMLInputElement | null>(null)

  const loadLibrary = useCallback(async (options?: { preserveSelection?: boolean }) => {
    setLoading(true)
    setLoadError(null)
    const preserveSelection = options?.preserveSelection ?? false
    try {
      const response = await fetch('/api/books')
      const payload = (await response.json()) as BookLibraryPayload | { error: string }
      if (!response.ok) {
        const errorMessage = 'error' in payload ? payload.error : 'Failed to load books.'
        throw new Error(errorMessage)
      }
      const resolved = payload as BookLibraryPayload
      setLibrary(resolved)
      const books = resolved.books
      if (preserveSelection) {
        const current = selectedRef.current
        if (!current) return
        const book = books.find((b) => b.id === current.bookId)
        if (!book) return
        const sameUnit = current.unitId ? book.units.find((u) => u.id === current.unitId) : null
        if (sameUnit) {
          const saved = getSavedUnitPage(book.id, sameUnit.id)
          const bounds = getUnitReaderBounds(sameUnit, null, book)
          setSelected({ bookId: book.id, unitId: sameUnit.id })
          setPageNumber(clampPdfPage(saved, bounds))
          return
        }
        setSelected({ bookId: book.id, unitId: null })
        return
      }
      const studentId = selectedStudentId?.trim() ?? ''
      let effectiveBookId = requestedBookId?.trim() ?? ''
      let effectiveUnitId = requestedUnitId?.trim() ?? ''

      if (!effectiveBookId && !effectiveUnitId) {
        if (!studentId) {
          setSelected(null)
          setSessionStartedAt(null)
          return
        }
        const pick = getStudentDefaultBookUnitForReader(studentId, resolved)
        if (!pick) {
          setSelected(null)
          setSessionStartedAt(null)
          return
        }
        effectiveBookId = pick.bookId
        effectiveUnitId = pick.unitId
      } else {
        if (!effectiveBookId && effectiveUnitId) {
          const fallbackBook = books[0] ?? null
          if (!fallbackBook) {
            setSelected(null)
            return
          }
          effectiveBookId = fallbackBook.id
        }
        if (effectiveBookId && !effectiveUnitId) {
          const b = books.find((book) => book.id === effectiveBookId)
          const first = b?.units?.[0]
          if (first) effectiveUnitId = first.id
        }
      }

      const targetBook = books.find((book) => book.id === effectiveBookId) ?? null
      if (!targetBook) {
        setSelected(null)
        return
      }
      const targetUnit = effectiveUnitId ? targetBook.units.find((unit) => unit.id === effectiveUnitId) ?? null : null
      if (targetUnit) {
        const genericSaved = getSavedUnitPage(targetBook.id, targetUnit.id)
        const studentResume =
          studentId.length > 0
            ? getStudentResumePdfPageForBookUnit(studentId, targetBook.id, targetUnit.id)
            : null
        const startPage = studentResume ?? genericSaved
        const bounds = getUnitReaderBounds(targetUnit, null, targetBook)
        setSelected({ bookId: targetBook.id, unitId: targetUnit.id })
        setPageNumber(clampPdfPage(startPage, bounds))
        setSessionStartedAt(new Date().toISOString())
        setExpandedBookId(targetBook.id)
        setExpandedUnitByBook({ [targetBook.id]: targetUnit.id })
      } else {
        setSelected({ bookId: targetBook.id, unitId: null })
        setSessionStartedAt(null)
        setExpandedBookId(targetBook.id)
      }
      setExpandedLessonByUnit({})
      setReaderLessonId(null)
      setReaderPartId(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load books.'
      setLoadError(message)
    } finally {
      setLoading(false)
    }
  }, [requestedBookId, requestedUnitId, selectedStudentId])

  useEffect(() => {
    let active = true
    async function setupPdfWorker() {
      const { pdfjs } = await import('react-pdf')
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      if (active) setPdfReady(true)
    }
    void setupPdfWorker()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])

  useEffect(() => {
    function syncWidth() {
      const target = Math.min(window.innerWidth - 420, 980)
      setViewerWidth(Math.max(320, target))
    }
    syncWidth()
    window.addEventListener('resize', syncWidth)
    return () => window.removeEventListener('resize', syncWidth)
  }, [])

  const selectedBook: BookRecord | null = useMemo(() => {
    if (!library || !selected) return null
    return library.books.find((book) => book.id === selected.bookId) ?? null
  }, [library, selected])

  const selectedUnit: BookUnitRecord | null = useMemo(() => {
    if (!selectedBook || !selected) return null
    return selectedBook.units.find((unit) => unit.id === selected.unitId) ?? null
  }, [selectedBook, selected])

  const readerBreadcrumb = useMemo(() => {
    if (!selectedUnit) return { lesson: null as BookLessonRecord | null, part: null as BookLessonPartRecord | null }
    const lessons = selectedUnit.lessons ?? []
    const lesson = readerLessonId ? (lessons.find((l) => l.id === readerLessonId) ?? null) : null
    const part =
      lesson && readerPartId ? (lesson.parts?.find((p) => p.id === readerPartId) ?? null) : null
    return { lesson, part }
  }, [selectedUnit, readerLessonId, readerPartId])

  const contextRangeOptions = useMemo<ContextRangeOption[]>(() => {
    if (!selectedBook || !selectedUnit) return []
    const out: ContextRangeOption[] = []
    for (const lesson of selectedUnit.lessons ?? []) {
      if (lesson.parts?.length) {
        for (const part of lesson.parts) {
          out.push({
            bookId: selectedBook.id,
            unitId: selectedUnit.id,
            lessonId: lesson.id,
            id: part.id,
            startPageHint: part.startPageHint ?? lesson.startPageHint ?? selectedUnit.startPageHint,
            endPageHint: part.endPageHint ?? lesson.endPageHint ?? selectedUnit.endPageHint,
          })
        }
      } else {
        out.push({
          bookId: selectedBook.id,
          unitId: selectedUnit.id,
          lessonId: lesson.id,
          id: lesson.id,
          startPageHint: lesson.startPageHint ?? selectedUnit.startPageHint,
          endPageHint: lesson.endPageHint ?? selectedUnit.endPageHint,
        })
      }
    }
    return out
  }, [selectedBook, selectedUnit])

  const contextTarget = useMemo<ContextRangeOption | null>(() => {
    if (!selectedBook || !selectedUnit || !readerBreadcrumb.lesson) return null
    return {
      bookId: selectedBook.id,
      unitId: selectedUnit.id,
      lessonId: readerBreadcrumb.lesson.id,
      id: readerBreadcrumb.part?.id ?? readerBreadcrumb.lesson.id,
      startPageHint:
        readerBreadcrumb.part?.startPageHint ?? readerBreadcrumb.lesson.startPageHint ?? selectedUnit.startPageHint,
      endPageHint:
        readerBreadcrumb.part?.endPageHint ?? readerBreadcrumb.lesson.endPageHint ?? selectedUnit.endPageHint,
    }
  }, [selectedBook, selectedUnit, readerBreadcrumb.lesson, readerBreadcrumb.part])

  const resolvedLessonRange = useMemo(() => {
    if (!contextTarget) return null
    const auto = deriveAutoLessonRange(contextRangeOptions, contextTarget)
    if (lessonRangeDraft && lessonRangeDraft.key === auto.key) {
      return {
        key: lessonRangeDraft.key,
        startPage: Math.max(1, Math.floor(lessonRangeDraft.startPage)),
        endPage: Math.max(Math.max(1, Math.floor(lessonRangeDraft.startPage)), Math.floor(lessonRangeDraft.endPage)),
        source: lessonRangeDraft.source,
      }
    }
    const saved = selectedStudentId ? getLessonRangeOverride(selectedStudentId, auto.key) : null
    return resolveCanonicalLessonRange(contextRangeOptions, contextTarget, saved)
  }, [contextTarget, contextRangeOptions, lessonRangeDraft, selectedStudentId])

  const activeUnitKey = selectedBook && selectedUnit ? `${selectedBook.id}::${selectedUnit.id}` : null
  const activeBookKey = selectedBook ? selectedBook.id : null
  const activeLessonKey =
    selectedBook && selectedUnit && readerBreadcrumb.lesson
      ? `${selectedBook.id}::${selectedUnit.id}::${readerBreadcrumb.lesson.id}`
      : null
  const activePartKey =
    selectedBook && selectedUnit && readerBreadcrumb.lesson && readerBreadcrumb.part
      ? `${selectedBook.id}::${selectedUnit.id}::${readerBreadcrumb.lesson.id}::${readerBreadcrumb.part.id}`
      : null

  const readerBounds = useMemo(
    () =>
      selectedUnit ? getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined) : { min: 1, max: 1 },
    [selectedUnit, numPages, selectedBook],
  )
  const visiblePages = useMemo(
    () => (selectedUnit ? getVisiblePdfPages(selectedUnit, numPages, selectedBook ?? undefined) : []),
    [selectedUnit, numPages, selectedBook],
  )
  const currentSpreadLeftPage = useMemo(() => {
    if (!visiblePages.length) return pageNumber
    const idx = Math.max(0, visiblePages.indexOf(pageNumber))
    return visiblePages[idx] ?? pageNumber
  }, [pageNumber, visiblePages])
  const currentSpreadRightPage = useMemo(() => {
    if (!visiblePages.length) return null
    const idx = Math.max(0, visiblePages.indexOf(currentSpreadLeftPage))
    return visiblePages[idx + 1] ?? null
  }, [currentSpreadLeftPage, visiblePages])
  const selectedLesson = readerBreadcrumb.lesson
  const selectedPart = readerBreadcrumb.part
  const selectedPartRange = useMemo(() => {
    if (!selectedUnit || !selectedLesson || !selectedPart) return null
    const lessons = selectedUnit.lessons ?? []
    const lessonIndex = Math.max(0, lessons.findIndex((lesson) => lesson.id === selectedLesson.id))
    const lessonRange = pageRangeForIndex(lessons, lessonIndex)
    const parts = selectedLesson.parts ?? []
    const partIndex = Math.max(0, parts.findIndex((part) => part.id === selectedPart.id))
    return pageRangeForIndex(parts, partIndex, lessonRange.start, lessonRange.end)
  }, [selectedLesson, selectedPart, selectedUnit])

  const frameworkLessonRows = useMemo(() => {
    if (!selectedBook) return []
    return selectedBook.units.flatMap((unit) => {
      const eligibleLessons = (unit.lessons ?? []).filter((lesson) =>
        isFrameworkEligibleLessonTitle(lesson.title || 'Lesson'),
      )
      return eligibleLessons.map((lesson, eligibleIdx) => ({
        unitId: unit.id,
        lessonId: lesson.id,
        lessonTitle: lesson.title || 'Lesson',
        unitTitle: unit.title,
        // Important: this is ordinal index among visible/eligible lessons only.
        unitLessonIndex: eligibleIdx,
      }))
    })
  }, [selectedBook])

  const frameworkUnits = useMemo(() => {
    const seen = new Map<string, string>()
    for (const row of frameworkLessonRows) {
      if (!seen.has(row.unitId)) seen.set(row.unitId, row.unitTitle)
    }
    return [...seen.entries()].map(([unitId, unitTitle]) => ({ unitId, unitTitle }))
  }, [frameworkLessonRows])

  useEffect(() => {
    if (!frameworkUnits.length) {
      setUnitCaptureUnitId('')
      return
    }
    setUnitCaptureUnitId((prev) => (prev && frameworkUnits.some((unit) => unit.unitId === prev) ? prev : frameworkUnits[0]!.unitId))
  }, [frameworkUnits])

  useEffect(() => {
    setSelectedFrameworkLessonIds((prev) => {
      if (!frameworkLessonRows.length) return []
      const allowed = new Set(frameworkLessonRows.map((row) => row.lessonId))
      return prev.filter((id) => allowed.has(id))
    })
  }, [frameworkLessonRows])

  useEffect(() => {
    if (!frameworkWorkspaceOpen) {
      setFrameworkPreviewOpen(false)
      setFrameworkPreview(null)
      setFrameworkPreviewSummary(null)
    }
  }, [frameworkWorkspaceOpen])

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    pageNumberRef.current = pageNumber
  }, [pageNumber])

  useEffect(() => {
    sessionStartedAtRef.current = sessionStartedAt
  }, [sessionStartedAt])

  function pushSessionHistory(entry: {
    bookId: string
    unitId: string
    page: number
    openedAt: string
    closedAt?: string
  }) {
    if (!selectedStudentId) return
    appendStudentCurriculumSession(selectedStudentId, entry)
  }

  function closeCurrentSession(currentPage: number, options?: { resetState?: boolean }) {
    const currentSelected = selectedRef.current
    const startedAt = sessionStartedAtRef.current
    if (!currentSelected || !currentSelected.unitId || !startedAt) return
    pushSessionHistory({
      bookId: currentSelected.bookId,
      unitId: currentSelected.unitId,
      page: currentPage,
      openedAt: startedAt,
      closedAt: new Date().toISOString(),
    })
    if (options?.resetState !== false) {
      setSessionStartedAt(null)
    }
  }

  function openUnit(bookId: string, unitId: string, initialPdfPage?: number) {
    closeCurrentSession(pageNumber)
    setReaderLessonId(null)
    setReaderPartId(null)
    const currentSelected = selectedRef.current
    const currentBook = currentSelected ? library?.books.find((b) => b.id === currentSelected.bookId) : null
    const currentUnit = currentSelected ? currentBook?.units.find((u) => u.id === currentSelected.unitId) : null
    const book = library?.books.find((b) => b.id === bookId)
    const unit = book?.units.find((u) => u.id === unitId)
    const saved = getSavedUnitPage(bookId, unitId)
    const studentId = selectedStudentId?.trim() ?? ''
    const studentResume =
      studentId.length > 0 && initialPdfPage == null
        ? getStudentResumePdfPageForBookUnit(studentId, bookId, unitId)
        : null
    const bounds = unit ? getUnitReaderBounds(unit, null, book ?? undefined) : { min: 1, max: Number.MAX_SAFE_INTEGER }
    const target = initialPdfPage != null ? initialPdfPage : studentResume ?? saved
    const bounded = clampPdfPageToVisible(target, unit ? getVisiblePdfPages(unit, null, book ?? undefined) : [], bounds)
    const fileChanged =
      currentUnit?.filePath != null && unit?.filePath != null
        ? currentUnit.filePath !== unit.filePath
        : true
    setSelected({ bookId, unitId })
    setPageNumber(bounded)
    saveUnitPage(bookId, unitId, bounded)
    if (fileChanged) setNumPages(null)
    setSessionStartedAt(new Date().toISOString())
  }

  function selectBook(bookId: string) {
    closeCurrentSession(pageNumber)
    setSelected({ bookId, unitId: null })
    setReaderLessonId(null)
    setReaderPartId(null)
    setNumPages(null)
    setSessionStartedAt(null)
  }

  function toggleUnitExpanded(bookId: string, unitId: string) {
    setExpandedUnitByBook((prev) => ({
      ...prev,
      [bookId]: prev[bookId] === unitId ? null : unitId,
    }))
  }

  function toggleBookExpanded(bookId: string) {
    setExpandedBookId((prev) => (prev === bookId ? null : bookId))
  }

  function toggleLessonPartsExpanded(unitId: string, lessonId: string) {
    setExpandedLessonByUnit((prev) => ({
      ...prev,
      [unitId]: prev[unitId] === lessonId ? null : lessonId,
    }))
  }

  function selectLessonForReading(bookId: string, unit: BookUnitRecord, lesson: BookLessonRecord) {
    const book = library?.books.find((b) => b.id === bookId)
    const bounds = getUnitReaderBounds(unit, numPages, book ?? undefined)
    const lessons = unit.lessons ?? []
    const lessonIdx = Math.max(0, lessons.findIndex((l) => l.id === lesson.id))
    const page =
      resolveStartHintWithAlignment(bounds.min, bounds.max, lesson.startPageHint, book, unit, numPages) ??
      lesson.pdfPageRange?.start ??
      estimatePageByIndex(bounds.min, bounds.max, lessonIdx, lessons.length || 1)
    openUnit(bookId, unit.id, page)
    setExpandedBookId(bookId)
    setExpandedUnitByBook((prev) => ({ ...prev, [bookId]: unit.id }))
    setExpandedLessonByUnit((prev) => ({ ...prev, [unit.id]: lesson.id }))
    setReaderLessonId(lesson.id)
    setReaderPartId(null)
  }

  function selectPartForReading(
    bookId: string,
    unit: BookUnitRecord,
    lesson: BookLessonRecord,
    part: BookLessonPartRecord,
  ) {
    const book = library?.books.find((b) => b.id === bookId)
    const bounds = getUnitReaderBounds(unit, numPages, book ?? undefined)
    const parts = lesson.parts ?? []
    const partIdx = Math.max(0, parts.findIndex((p) => p.id === part.id))
    const lessonPage =
      resolveStartHintWithAlignment(bounds.min, bounds.max, lesson.startPageHint, book, unit, numPages) ??
      lesson.pdfPageRange?.start ??
      estimatePageByIndex(bounds.min, bounds.max, Math.max(0, (unit.lessons ?? []).findIndex((l) => l.id === lesson.id)), (unit.lessons ?? []).length || 1)
    const page =
      resolveStartHintWithAlignment(lessonPage, bounds.max, part.startPageHint, book, unit, numPages) ??
      part.pdfPageRange?.start ??
      (parts.length > 0 ? estimatePageByIndex(lessonPage, bounds.max, partIdx, parts.length) : lessonPage)
    openUnit(bookId, unit.id, page)
    setExpandedBookId(bookId)
    setExpandedUnitByBook((prev) => ({ ...prev, [bookId]: unit.id }))
    setExpandedLessonByUnit((prev) => ({ ...prev, [unit.id]: lesson.id }))
    setReaderLessonId(lesson.id)
    setReaderPartId(part.id)
  }

  function goToPage(nextPage: number) {
    if (!selected || !selectedUnit) return
    const bounds = getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
    const bounded = clampPdfPageToVisible(nextPage, visiblePages, bounds)
    setPageNumber(bounded)
    saveUnitPage(selected.bookId, selectedUnit.id, bounded)
  }

  function goToNeighborPage(direction: -1 | 1, step = 1) {
    if (!selected || !selectedUnit) return
    if (!visiblePages.length) {
      goToPage(pageNumber + direction * step)
      return
    }
    const currentIndex = Math.max(0, visiblePages.indexOf(pageNumber))
    const nextIndex = Math.max(0, Math.min(currentIndex + direction * step, visiblePages.length - 1))
    const nextPage = visiblePages[nextIndex] ?? pageNumber
    goToPage(nextPage)
  }

  function onDocumentLoadSuccess(meta: { numPages: number }) {
    setNumPages(meta.numPages)
    if (!selected || !selectedUnit) return
    const bounds = getUnitReaderBounds(selectedUnit, meta.numPages, selectedBook ?? undefined)
    const nextVisiblePages = getVisiblePdfPages(selectedUnit, meta.numPages, selectedBook ?? undefined)
    const bounded = clampPdfPageToVisible(pageNumber, nextVisiblePages, bounds)
    if (bounded !== pageNumber) {
      setPageNumber(bounded)
    }
    saveUnitPage(selected.bookId, selectedUnit.id, bounded)
  }

  function handleManifestSaved(payload: BookLibraryPayload) {
    setLibrary(payload)
    const cur = selectedRef.current
    if (!cur) return
    const book = payload.books.find((b) => b.id === cur.bookId)
    if (!book) return
    if (cur.unitId) {
      const sameUnit = book.units.find((u) => u.id === cur.unitId)
      const nextUnit = sameUnit ?? book.units[0]
      if (!nextUnit) return
      const bounds = getUnitReaderBounds(nextUnit, null, book ?? undefined)
      const saved = getSavedUnitPage(book.id, nextUnit.id)
      setSelected({ bookId: book.id, unitId: nextUnit.id })
      setPageNumber(clampPdfPage(saved, bounds))
      setNumPages(null)
      return
    }
    setSelected({ bookId: book.id, unitId: null })
  }

  function openStructureWizardForBook(book: BookRecord) {
    setStructureWizardTarget({ bookId: book.id, filePath: book.units[0]?.filePath ?? null })
    setStructureWizardOpen(true)
  }

  async function loadUnitContextForSelection(bookId: string, unitId: string, rev: number) {
    try {
      const res = await fetch(
        `/api/context/get?bookId=${encodeURIComponent(bookId)}&unitId=${encodeURIComponent(unitId)}`,
      )
      const payload = (await res.json()) as {
        ok: boolean
        unit?: UnitContextRecord | null
      }
      if (rev !== unitContextLoadRevRef.current) return
      if (!res.ok || !payload.ok) {
        setUnitContext(null)
        return
      }
      setUnitContext(payload.unit ?? null)
    } catch {
      if (rev !== unitContextLoadRevRef.current) return
      setUnitContext(null)
    } finally {
      if (rev === unitContextLoadRevRef.current) {
        setUnitContextLoading(false)
      }
    }
  }

  async function loadBookContextForSelection(bookId: string, rev: number) {
    try {
      const res = await fetch(`/api/context/get?bookId=${encodeURIComponent(bookId)}`)
      const payload = (await res.json()) as {
        ok: boolean
        book?: BookContextSummaryRecord | null
        bookRecord?: {
          summary?: string | null
          focusAreas?: string[] | null
          focusNotesByLesson?: Record<string, Record<string, string>> | null
        } | null
      }
      if (rev !== bookContextLoadRevRef.current) return
      if (!res.ok || !payload.ok) {
        setBookContext(null)
        return
      }
      setBookContext(payload.book ?? null)
      if (typeof payload.bookRecord?.summary === 'string') {
        setBookText(payload.bookRecord.summary)
      }
      if (Array.isArray(payload.bookRecord?.focusAreas) && payload.bookRecord.focusAreas.length > 0) {
        setBookFocusAreas(withSelectionFocusArea(payload.bookRecord.focusAreas))
      } else {
        setBookFocusAreas([...DEFAULT_BOOK_FOCUS_AREAS])
      }
      setFocusNotesByLesson(
        payload.bookRecord?.focusNotesByLesson && typeof payload.bookRecord.focusNotesByLesson === 'object'
          ? payload.bookRecord.focusNotesByLesson
          : {},
      )
    } catch {
      if (rev !== bookContextLoadRevRef.current) return
      setBookContext(null)
      setBookFocusAreas([...DEFAULT_BOOK_FOCUS_AREAS])
      setFocusNotesByLesson({})
    } finally {
      if (rev === bookContextLoadRevRef.current) {
        setBookContextLoading(false)
      }
    }
  }

  async function loadDownloadedMaterialsForBook(bookId: string) {
    setMaterialsLoading(true)
    try {
      const res = await fetch(`/api/context/materials?bookId=${encodeURIComponent(bookId)}`)
      const payload = (await res.json()) as { ok: boolean; items?: DownloadedBookMaterial[] }
      if (!res.ok || !payload.ok) {
        setDownloadedMaterials([])
        return
      }
      setDownloadedMaterials(Array.isArray(payload.items) ? payload.items : [])
    } catch {
      setDownloadedMaterials([])
    } finally {
      setMaterialsLoading(false)
    }
  }

  async function downloadSourceForBook(source: { url: string; title: string }, materialType?: BookContextMaterialRecord['type']) {
    if (!selectedBook || !source.url) return
    const existingProgress = sourceDownloadProgress[source.url]
    if (existingProgress && (existingProgress.status === 'queued' || existingProgress.status === 'downloading')) return
    setSourceDownloadProgress((prev) => ({
      ...prev,
      [source.url]: {
        taskId: '',
        status: 'queued',
        downloadedBytes: 0,
        totalBytes: null,
        speedBytesPerSec: 0,
      },
    }))
    try {
      const res = await fetch('/api/context/materials/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: selectedBook.id,
          url: source.url,
          title: source.title,
          materialType: materialType ?? 'other',
        }),
      })
      const payload = (await res.json()) as { ok: boolean; error?: string; taskId?: string }
      if (!res.ok || !payload.ok || !payload.taskId) {
        setContextError(payload.error ?? 'Failed to download material.')
        return
      }
      const taskId = payload.taskId
      setSourceDownloadProgress((prev) => ({
        ...prev,
        [source.url]: {
          taskId,
          status: 'queued',
          downloadedBytes: 0,
          totalBytes: null,
          speedBytesPerSec: 0,
        },
      }))
      let done = false
      while (!done) {
        const statusRes = await fetch(`/api/context/materials/download?taskId=${encodeURIComponent(taskId)}`)
        const statusPayload = (await statusRes.json()) as {
          ok: boolean
          task?: {
            status: 'queued' | 'downloading' | 'completed' | 'failed'
            downloadedBytes: number
            totalBytes: number | null
            speedBytesPerSec: number
            error?: string
            item?: DownloadedBookMaterial
          }
          error?: string
        }
        if (!statusRes.ok || !statusPayload.ok || !statusPayload.task) {
          setSourceDownloadProgress((prev) => ({
            ...prev,
            [source.url]: {
              taskId,
              status: 'failed',
              downloadedBytes: 0,
              totalBytes: null,
              speedBytesPerSec: 0,
              error: statusPayload.error ?? 'Download status unavailable.',
            },
          }))
          break
        }
        const task = statusPayload.task
        setSourceDownloadProgress((prev) => ({
          ...prev,
          [source.url]: {
            taskId,
            status: task.status,
            downloadedBytes: Number(task.downloadedBytes ?? 0),
            totalBytes: Number.isFinite(Number(task.totalBytes)) ? Number(task.totalBytes) : null,
            speedBytesPerSec: Number(task.speedBytesPerSec ?? 0),
            error: task.error,
            filePath: task.item?.filePath,
          },
        }))
        if (task.status === 'completed') {
          if (task.item) {
            setDownloadedMaterials((prev) => [task.item as DownloadedBookMaterial, ...prev.filter((item) => item.url !== task.item?.url)])
          }
          toast.success('Material downloaded to local book folder.')
          done = true
          break
        }
        if (task.status === 'failed') {
          setContextError(task.error ?? 'Failed to download material.')
          done = true
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 700))
      }
    } catch {
      setContextError('Failed to download material.')
    }
  }

  async function scanMaterialMappingsForBook(materialIds?: string[]) {
    if (!selectedBook) return
    setMappingScanBusy(true)
    setContextError(null)
    try {
      const res = await fetch('/api/context/materials/map-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: selectedBook.id,
          materialIds: materialIds && materialIds.length ? materialIds : undefined,
        }),
      })
      const payload = (await res.json()) as {
        ok: boolean
        error?: string
        suggestions?: MaterialMappingSuggestion[]
        materialsCount?: number
        processedCount?: number
        skipped?: MappingScanSkipRecord[]
        errors?: string[]
        analysisByMaterial?: MaterialAnalysisResult[]
      }
      if (!res.ok || !payload.ok) {
        setContextError(payload.error ?? 'Failed to scan material mappings.')
        return
      }
      const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : []
      const skipped = Array.isArray(payload.skipped) ? payload.skipped : []
      const scannedCount = Number.isFinite(Number(payload.materialsCount)) ? Number(payload.materialsCount) : 0
      const processedCount = Number.isFinite(Number(payload.processedCount)) ? Number(payload.processedCount) : 0
      const errors = Array.isArray(payload.errors) ? payload.errors.filter((row): row is string => typeof row === 'string') : []
      const analysisByMaterial = Array.isArray(payload.analysisByMaterial) ? payload.analysisByMaterial : []
      setMappingSuggestions(suggestions)
      setMappingSkipped(skipped)
      setMappingScannedCount(scannedCount)
      setMappingProcessedCount(processedCount)
      setMappingErrors(errors)
      setMaterialAnalyses(analysisByMaterial)
      if (suggestions.length > 0) {
        toast.success(`Found ${suggestions.length} mapping suggestion${suggestions.length === 1 ? '' : 's'}.`)
      } else {
        toast(
          scannedCount > 0
            ? `No mapping suggestions found yet. Processed ${processedCount}/${scannedCount} file${scannedCount === 1 ? '' : 's'}.`
            : 'No mapping suggestions found yet.',
        )
      }
    } catch {
      setContextError('Failed to scan material mappings.')
    } finally {
      setMappingScanBusy(false)
    }
  }

  async function applyMaterialMappings(items: MaterialMappingSuggestion[]) {
    if (!selectedBook || !items.length) return
    setMappingApplyBusy(true)
    setContextError(null)
    try {
      const res = await fetch('/api/context/materials/map-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: selectedBook.id,
          mappings: items.map((item) => ({
            materialId: item.materialId,
            unitId: item.unitId,
            lessonId: item.lessonId,
            partId: item.partId,
            confidence: item.confidence,
            reason: item.reason,
            sourceFilePath: item.sourceFilePath,
            evidenceSnippet: item.evidenceSnippet,
            evidencePage: item.evidencePage,
            lessonProfileSnapshot: item.lessonProfileSnapshot,
          })),
        }),
      })
      const payload = (await res.json()) as { ok: boolean; error?: string; savedCount?: number }
      if (!res.ok || !payload.ok) {
        setContextError(payload.error ?? 'Failed to apply mappings.')
        return
      }
      toast.success(`Saved ${payload.savedCount ?? items.length} mapping${(payload.savedCount ?? items.length) === 1 ? '' : 's'}.`)
    } catch {
      setContextError('Failed to apply mappings.')
    } finally {
      setMappingApplyBusy(false)
    }
  }

  async function loadLessonContextForSelection(bookId: string, unitId: string, lessonId: string, rev: number) {
    try {
      const res = await fetch(
        `/api/context/get?bookId=${encodeURIComponent(bookId)}&unitId=${encodeURIComponent(unitId)}&lessonId=${encodeURIComponent(lessonId)}`,
      )
      const payload = (await res.json()) as {
        ok: boolean
        context?: LessonContextRecord | null
      }
      if (rev !== lessonContextLoadRevRef.current) return
      if (!res.ok || !payload.ok) {
        setLessonContext(null)
        return
      }
      setLessonContext(payload.context ?? null)
    } catch {
      if (rev !== lessonContextLoadRevRef.current) return
      setLessonContext(null)
    } finally {
      if (rev === lessonContextLoadRevRef.current) {
        setLessonContextLoading(false)
      }
    }
  }

  async function scanUnitContextFromBook() {
    if (!selectedBook || !selectedUnit || !resolvedLessonRange) return
    setContextError(null)
    setContextBusy('unit')
    try {
      const res = await fetch('/api/context/scan-unit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: selectedBook.id,
          unitId: selectedUnit.id,
          unitTitle: selectedUnit.title,
          sourcePageRange: {
            startPage: resolvedLessonRange.startPage,
            endPage: resolvedLessonRange.endPage,
          },
          scanProfile: 'balanced',
        }),
      })
      const payload = (await res.json()) as { ok: boolean; error?: string; context?: UnitContextRecord }
      if (!res.ok || !payload.ok || !payload.context) {
        setContextError(payload.error ?? 'Failed to scan unit context.')
        return
      }
      setUnitContext(payload.context)
    } catch {
      setContextError('Failed to scan unit context.')
    } finally {
      setContextBusy(null)
    }
  }

  async function scanLessonContextFromBook() {
    if (!selectedBook || !selectedUnit || !readerBreadcrumb.lesson || !resolvedLessonRange) return
    setContextError(null)
    setContextBusy('lesson')
    try {
      const res = await fetch('/api/context/scan-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: selectedBook.id,
          unitId: selectedUnit.id,
          lessonId: readerBreadcrumb.lesson.id,
          lessonTitle: readerBreadcrumb.lesson.title,
          sourcePageRange: {
            startPage: resolvedLessonRange.startPage,
            endPage: resolvedLessonRange.endPage,
          },
          scanProfile: 'balanced',
        }),
      })
      const payload = (await res.json()) as { ok: boolean; error?: string; context?: LessonContextRecord }
      if (!res.ok || !payload.ok || !payload.context) {
        setContextError(payload.error ?? 'Failed to scan lesson context.')
        return
      }
      setLessonContext(payload.context)
    } catch {
      setContextError('Failed to scan lesson context.')
    } finally {
      setContextBusy(null)
    }
  }

  function saveRangeOverrideFromBook() {
    if (!selectedStudentId || !resolvedLessonRange) return
    const result = upsertLessonRangeOverride(selectedStudentId, resolvedLessonRange.key, {
      startPage: resolvedLessonRange.startPage,
      endPage: resolvedLessonRange.endPage,
    })
    if (!result.ok) {
      setContextError(result.error)
      return
    }
    setLessonRangeDraft({ ...resolvedLessonRange, source: 'saved' })
    toast.success('Lesson range saved.')
  }

  function resetRangeOverrideFromBook() {
    if (!contextTarget || !selectedStudentId) return
    const auto = deriveAutoLessonRange(contextRangeOptions, contextTarget)
    const result = clearLessonRangeOverride(selectedStudentId, auto.key)
    if (!result.ok) {
      setContextError(result.error)
      return
    }
    setLessonRangeDraft(auto)
    toast.success('Using auto lesson range.')
  }

  useEffect(() => {
    if (!activeBookKey || !selectedBook) {
      bookContextLoadRevRef.current += 1
      setBookContext(null)
      setBookContextLoading(false)
      setDownloadedMaterials([])
      setMaterialsLoading(false)
      setSourceDownloadProgress({})
      setMappingSuggestions([])
      setMappingSkipped([])
      setMappingProcessedCount(0)
      setMappingScannedCount(0)
      setMappingErrors([])
      setMaterialAnalyses([])
      setSelectedMaterialIdsForMapping([])
      setBookFocusAreas([...DEFAULT_BOOK_FOCUS_AREAS])
      setBookFocusAreaInput('')
      return
    }
    const rev = bookContextLoadRevRef.current + 1
    bookContextLoadRevRef.current = rev
    setBookContextLoading(true)
    void loadBookContextForSelection(selectedBook.id, rev)
    void loadDownloadedMaterialsForBook(selectedBook.id)
  }, [activeBookKey, selectedBook])

  useEffect(() => {
    setSelectedMaterialIdsForMapping((prev) => {
      if (!downloadedMaterials.length) return []
      if (!prev.length) return downloadedMaterials.map((item) => item.id)
      const allowed = new Set(downloadedMaterials.map((item) => item.id))
      const next = prev.filter((id) => allowed.has(id))
      return next.length ? next : downloadedMaterials.map((item) => item.id)
    })
  }, [downloadedMaterials])

  useEffect(() => {
    if (!frameworkLessonRows.length || !bookFocusAreas.length) {
      setFocusNotesByLesson({})
      return
    }
    setFocusNotesByLesson((prev) => {
      const next: Record<string, Record<string, string>> = {}
      for (const row of frameworkLessonRows) {
        const existingByArea = prev[row.lessonId] ?? {}
        const areaMap: Record<string, string> = {}
        for (const area of bookFocusAreas) {
          areaMap[area] = existingByArea[area] ?? ''
        }
        next[row.lessonId] = areaMap
      }
      return next
    })
  }, [frameworkLessonRows, bookFocusAreas])

  useEffect(() => {
    setContextError(null)
    if (!activeUnitKey || !selectedBook || !selectedUnit) {
      setUnitContext(null)
      setUnitContextLoading(false)
      setLessonContext(null)
      setLessonContextLoading(false)
      return
    }
    setLessonContext(null)
    lessonContextLoadRevRef.current += 1
    const rev = unitContextLoadRevRef.current + 1
    unitContextLoadRevRef.current = rev
    setUnitContextLoading(true)
    void loadUnitContextForSelection(selectedBook.id, selectedUnit.id, rev)
  }, [activeUnitKey])

  useEffect(() => {
    if (!activeLessonKey || !selectedBook || !selectedUnit || !readerBreadcrumb.lesson) {
      lessonContextLoadRevRef.current += 1
      setLessonContext(null)
      setLessonContextLoading(false)
      return
    }
    const rev = lessonContextLoadRevRef.current + 1
    lessonContextLoadRevRef.current = rev
    setLessonContextLoading(true)
    void loadLessonContextForSelection(selectedBook.id, selectedUnit.id, readerBreadcrumb.lesson.id, rev)
  }, [activeLessonKey, activePartKey])

  useEffect(() => {
    setBookText(bookContext?.summary ?? '')
  }, [bookContext?.summary, selectedBook?.id])

  useEffect(() => {
    setUnitText(unitContext?.theme ?? '')
  }, [unitContext?.theme, selectedUnit?.id])

  useEffect(() => {
    setLessonText(
      lessonContext ? `${lessonContext.comprehensionSkill} · ${lessonContext.strategy}` : '',
    )
  }, [lessonContext?.comprehensionSkill, lessonContext?.strategy, selectedLesson?.id])

  useEffect(() => {
    setPartText('')
  }, [selectedPart?.id])

  useEffect(() => {
    const unitStart = selectedUnit?.startPageHint ?? selectedUnit?.pdfPageRange?.start ?? 1
    const unitEnd = selectedUnit?.endPageHint ?? selectedUnit?.pdfPageRange?.end ?? Math.max(unitStart, numPages ?? unitStart)
    const lessonStart = resolvedLessonRange?.startPage ?? unitStart
    const lessonEnd = resolvedLessonRange?.endPage ?? unitEnd
    const partStart = selectedPartRange?.start ?? lessonStart
    const partEnd = selectedPartRange?.end ?? lessonEnd
    setAiRange({
      book: { startPage: unitStart, endPage: unitEnd },
      unit: { startPage: unitStart, endPage: unitEnd },
      lesson: { startPage: lessonStart, endPage: lessonEnd },
      part: { startPage: partStart, endPage: partEnd },
    })
  }, [numPages, resolvedLessonRange?.endPage, resolvedLessonRange?.startPage, selectedPartRange?.end, selectedPartRange?.start, selectedUnit?.endPageHint, selectedUnit?.pdfPageRange?.end, selectedUnit?.pdfPageRange?.start, selectedUnit?.startPageHint])

  async function runUnitAiFromPanel() {
    if (!selectedBook || !selectedUnit) return
    setContextError(null)
    setAiBusyLevel('unit')
    try {
      const range = aiRange.unit
      const res = await fetch('/api/context/scan-unit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: selectedBook.id,
          unitId: selectedUnit.id,
          unitTitle: selectedUnit.title,
          sourcePageRange: { startPage: range.startPage, endPage: range.endPage },
          scanProfile: 'balanced',
        }),
      })
      const payload = (await res.json()) as { ok: boolean; error?: string; context?: UnitContextRecord }
      if (!res.ok || !payload.ok || !payload.context) {
        setContextError(payload.error ?? 'Failed to generate unit context.')
        return
      }
      setUnitContext(payload.context)
      setUnitText(payload.context.theme)
      toast.success('Unit context generated.')
    } catch {
      setContextError('Failed to generate unit context.')
    } finally {
      setAiBusyLevel(null)
    }
  }

  async function runLessonAiFromPanel() {
    if (!selectedBook || !selectedUnit || !selectedLesson) return
    setContextError(null)
    setAiBusyLevel('lesson')
    try {
      const range = aiRange.lesson
      const res = await fetch('/api/context/scan-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: selectedBook.id,
          unitId: selectedUnit.id,
          lessonId: selectedLesson.id,
          lessonTitle: selectedLesson.title,
          sourcePageRange: { startPage: range.startPage, endPage: range.endPage },
          scanProfile: 'balanced',
        }),
      })
      const payload = (await res.json()) as { ok: boolean; error?: string; context?: LessonContextRecord }
      if (!res.ok || !payload.ok || !payload.context) {
        setContextError(payload.error ?? 'Failed to generate lesson context.')
        return
      }
      setLessonContext(payload.context)
      setLessonText(`${payload.context.comprehensionSkill} · ${payload.context.strategy}`)
      toast.success('Lesson context generated.')
    } catch {
      setContextError('Failed to generate lesson context.')
    } finally {
      setAiBusyLevel(null)
    }
  }

  async function runBookAiFromPanel() {
    if (!selectedBook) return
    setContextError(null)
    setBookAiBusy(true)
    try {
      const range = aiRange.book
      const derivedGradeHint = inferGradeHintFromBook(selectedBook)
      const versionHints = selectedBook.units
        .slice(0, 3)
        .flatMap((unit) => {
          const fromPath = unit.filePath.split(/[\\/]/).pop() ?? unit.filePath
          return [unit.title, fromPath]
        })
        .filter(Boolean)
      const res = await fetch('/api/context/scan-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: selectedBook.id,
          bookTitle: selectedBook.title,
          bookDescription: selectedBook.description ?? undefined,
          gradeHint: derivedGradeHint ?? undefined,
          versionHints,
          materialTypes: bookMaterialTypes,
          searchMode: bookSearchMode,
          downloadableOnly: bookDownloadableOnly,
          maxResults: bookResultLimit,
          queryOverride: bookQueryOverride.trim() || undefined,
          sourcePageRange: { startPage: range.startPage, endPage: range.endPage },
          scanProfile: 'balanced',
        }),
      })
      const payload = (await res.json()) as { ok: boolean; error?: string; draft?: BookContextDraftRecord }
      if (!res.ok || !payload.ok || !payload.draft) {
        setContextError(payload.error ?? 'Failed to generate book context draft.')
        return
      }
      setBookDraft(payload.draft)
      setBookText(payload.draft.summary)
      if (Array.isArray(payload.draft.focusAreas) && payload.draft.focusAreas.length > 0) {
        setBookFocusAreas(withSelectionFocusArea(payload.draft.focusAreas))
      }
      toast.success('Book context draft generated.')
    } catch {
      setContextError('Failed to generate book context draft.')
    } finally {
      setBookAiBusy(false)
    }
  }

  async function saveBookDraft() {
    if (!selectedBook) return
    setContextError(null)
    setBookSaveBusy(true)
    try {
      const baseDraft: BookContextDraftRecord = bookDraft ?? {
        kind: 'book-draft',
        bookId: selectedBook.id,
        summary: bookText.trim(),
        goals: [],
        pacing: [],
        instructionalPriorities: [],
        focusAreas: [...bookFocusAreas],
        focusNotesByLesson: {},
        sourcePageRange: null,
        materials: [],
        sources: [],
        evidence: [],
        generatedAt: new Date().toISOString(),
      }
      const res = await fetch('/api/context/save-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: {
            ...baseDraft,
            summary: bookText.trim(),
            focusAreas: bookFocusAreas.map((item) => normalizeFocusArea(item)).filter(Boolean),
            focusNotesByLesson,
          },
        }),
      })
      const payload = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !payload.ok) {
        setContextError(payload.error ?? 'Failed to save book context.')
        return
      }
      toast.success('Book context saved.')
      setBookDraft(null)
      const rev = bookContextLoadRevRef.current + 1
      bookContextLoadRevRef.current = rev
      setBookContextLoading(true)
      void loadBookContextForSelection(selectedBook.id, rev)
    } catch {
      setContextError('Failed to save book context.')
    } finally {
      setBookSaveBusy(false)
    }
  }

  function buildFrameworkApplyBody(): Record<string, unknown> | null {
    if (!selectedBook || !frameworkLessonRows.length) return null
    const unitById = new Map(selectedBook.units.map((unit) => [unit.id, unit] as const))
    const rows = frameworkLessonRows.map((row) => {
      const unit = unitById.get(row.unitId)
      const lesson = unit?.lessons?.find((item) => item.id === row.lessonId)
      return {
        unitId: row.unitId,
        unitTitle: row.unitTitle,
        lessonId: row.lessonId,
        lessonTitle: row.lessonTitle,
        sourcePageRange: {
          startPage: lesson?.startPageHint ?? unit?.startPageHint ?? 1,
          endPage: lesson?.endPageHint ?? unit?.endPageHint ?? lesson?.startPageHint ?? unit?.startPageHint ?? 1,
        },
      }
    })
    const lessonParts = selectedBook.units.flatMap((unit) =>
      (unit.lessons ?? []).map((lesson) => ({
        lessonId: lesson.id,
        parts: (lesson.parts ?? []).map((part) => ({
          partId: part.id,
          partTitle: part.title,
          sourcePageRange: {
            startPage: part.startPageHint ?? lesson.startPageHint ?? unit.startPageHint ?? 1,
            endPage: part.endPageHint ?? lesson.endPageHint ?? unit.endPageHint ?? part.startPageHint ?? 1,
          },
        })),
      })),
    )
    return {
      bookId: selectedBook.id,
      focusAreas: bookFocusAreas.map((item) => normalizeFocusArea(item)).filter(Boolean),
      focusNotesByLesson,
      rows,
      lessonParts,
    }
  }

  async function loadFrameworkMappingPreview() {
    const body = buildFrameworkApplyBody()
    if (!body) {
      toast.error('No lessons in the framework table to map.')
      return
    }
    setContextError(null)
    setFrameworkPreviewBusy(true)
    try {
      const res = await fetch('/api/context/framework/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, dryRun: true }),
      })
      const payload = (await res.json()) as {
        ok: boolean
        error?: string
        dryRun?: boolean
        preview?: FrameworkApplyPreview
        summary?: {
          unitsUpdated: number
          lessonsUpdated: number
          partsUpdated: number
          deprecatedLabelsSkipped: number
        }
      }
      if (!res.ok || !payload.ok || !payload.preview || !payload.summary) {
        setContextError(payload.error ?? 'Failed to build mapping preview.')
        return
      }
      setFrameworkPreview(payload.preview)
      setFrameworkPreviewSummary(payload.summary)
      setFrameworkPreviewOpen(true)
      toast.info('Review the mapping below, then confirm to write context files.')
    } catch {
      setContextError('Failed to build mapping preview.')
    } finally {
      setFrameworkPreviewBusy(false)
    }
  }

  async function applyFrameworkToContextLayers() {
    const body = buildFrameworkApplyBody()
    if (!body) return
    setContextError(null)
    setFrameworkApplyBusy(true)
    try {
      const res = await fetch('/api/context/framework/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, dryRun: false }),
      })
      const payload = (await res.json()) as {
        ok: boolean
        error?: string
        summary?: {
          bookUpdated: number
          unitsUpdated: number
          lessonsUpdated: number
          partsUpdated: number
          deprecatedLabelsSkipped: number
        }
      }
      if (!res.ok || !payload.ok || !payload.summary) {
        setContextError(payload.error ?? 'Failed to apply framework context layers.')
        return
      }
      const summary = payload.summary
      toast.success(
        `Applied to context layers: ${summary.unitsUpdated} units, ${summary.lessonsUpdated} lessons, ${summary.partsUpdated} parts.`,
      )
      if (summary.deprecatedLabelsSkipped > 0) {
        toast.info(`Ignored ${summary.deprecatedLabelsSkipped} deprecated label block${summary.deprecatedLabelsSkipped === 1 ? '' : 's'}.`)
      }
      setFrameworkPreviewOpen(false)
      setFrameworkPreview(null)
      setFrameworkPreviewSummary(null)
      const rev = bookContextLoadRevRef.current + 1
      bookContextLoadRevRef.current = rev
      setBookContextLoading(true)
      void loadBookContextForSelection(String(body.bookId), rev)
    } catch {
      setContextError('Failed to apply framework context layers.')
    } finally {
      setFrameworkApplyBusy(false)
    }
  }

  async function confirmFrameworkApplyFromPreview() {
    await applyFrameworkToContextLayers()
  }

  async function extractSingleLessonRowFromScreenshot() {
    if (!lessonCaptureRow || !lessonCaptureImage || !bookFocusAreas.length) return
    setLessonCaptureBusy(true)
    setContextError(null)
    try {
      const res = await fetch('/api/context/framework/extract-row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonTitle: lessonCaptureRow.lessonTitle,
          unitTitle: lessonCaptureRow.unitTitle,
          focusAreas: bookFocusAreas,
          imageDataUrl: lessonCaptureImage,
        }),
      })
      const payload = (await res.json()) as {
        ok: boolean
        error?: string
        values?: Record<string, string>
      }
      if (!res.ok || !payload.ok || !payload.values) {
        setContextError(payload.error ?? 'Failed to extract lesson row.')
        return
      }
      setFocusNotesByLesson((prev) => ({
        ...prev,
        [lessonCaptureRow.lessonId]: {
          ...(prev[lessonCaptureRow.lessonId] ?? {}),
          ...Object.fromEntries(
            bookFocusAreas.map((area) => [area, String(payload.values?.[area] ?? '').trim()]),
          ),
        },
      }))
      toast.success('Lesson row extracted and populated.')
      setLessonCaptureRow(null)
      setLessonCaptureImage('')
    } catch {
      setContextError('Failed to extract lesson row.')
    } finally {
      setLessonCaptureBusy(false)
    }
  }

  async function extractFullTableFromScreenshot() {
    if (!tableCaptureImage || !bookFocusAreas.length || !frameworkLessonRows.length) return
    setTableCaptureBusy(true)
    setContextError(null)
    try {
      const res = await fetch('/api/context/framework/extract-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focusAreas: bookFocusAreas,
          imageDataUrl: tableCaptureImage,
          rows: frameworkLessonRows.map((row) => ({
            lessonId: row.lessonId,
            lessonTitle: row.lessonTitle,
            unitTitle: row.unitTitle,
            unitLessonIndex: row.unitLessonIndex,
          })),
        }),
      })
      const payload = (await res.json()) as {
        ok: boolean
        error?: string
        rows?: Array<{
          lessonId?: string
          lessonTitle?: string
          lessonNumber?: number
          values: Record<string, string>
        }>
      }
      if (!res.ok || !payload.ok || !Array.isArray(payload.rows)) {
        setContextError(payload.error ?? 'Failed to extract full table.')
        return
      }
      const byId = new Map(frameworkLessonRows.map((row) => [row.lessonId, row]))
      const byLessonNum = new Map<number, typeof frameworkLessonRows[number]>()
      for (const row of frameworkLessonRows) {
        const num = lessonNumberFromTitle(row.lessonTitle) ?? row.unitLessonIndex + 1
        if (!byLessonNum.has(num)) byLessonNum.set(num, row)
      }
      let applied = 0
      setFocusNotesByLesson((prev) => {
        const next = { ...prev }
        for (const extracted of payload.rows ?? []) {
          let target = extracted.lessonId ? byId.get(extracted.lessonId) : undefined
          if (!target && typeof extracted.lessonNumber === 'number') {
            target = byLessonNum.get(extracted.lessonNumber)
          }
          if (!target) continue
          const rowMap: Record<string, string> = { ...(next[target.lessonId] ?? {}) }
          for (const area of bookFocusAreas) {
            const value = String(extracted.values?.[area] ?? '').trim()
            if (!value) continue
            rowMap[area] = value
          }
          next[target.lessonId] = rowMap
          applied += 1
        }
        return next
      })
      toast.success(`Table extraction complete. Updated ${applied} lesson row${applied === 1 ? '' : 's'}.`)
      setTableCaptureOpen(false)
      setTableCaptureImage('')
    } catch {
      setContextError('Failed to extract full table.')
    } finally {
      setTableCaptureBusy(false)
    }
  }

  async function extractUnitFromScreenshot() {
    if (!unitCaptureImage || !bookFocusAreas.length || !frameworkLessonRows.length || !unitCaptureUnitId) return
    const unitRows = frameworkLessonRows.filter((row) => row.unitId === unitCaptureUnitId)
    if (!unitRows.length) return
    setUnitCaptureBusy(true)
    setContextError(null)
    try {
      const res = await fetch('/api/context/framework/extract-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focusAreas: bookFocusAreas,
          imageDataUrl: unitCaptureImage,
          rows: unitRows.map((row) => ({
            lessonId: row.lessonId,
            lessonTitle: row.lessonTitle,
            unitTitle: row.unitTitle,
            unitLessonIndex: row.unitLessonIndex,
          })),
        }),
      })
      const payload = (await res.json()) as {
        ok: boolean
        error?: string
        rows?: Array<{
          lessonId?: string
          lessonTitle?: string
          lessonNumber?: number
          values: Record<string, string>
        }>
      }
      if (!res.ok || !payload.ok || !Array.isArray(payload.rows)) {
        setContextError(payload.error ?? 'Failed to extract selected unit.')
        return
      }
      const byId = new Map(unitRows.map((row) => [row.lessonId, row]))
      const byLessonNum = new Map<number, typeof unitRows[number]>()
      for (const row of unitRows) {
        const num = lessonNumberFromTitle(row.lessonTitle) ?? row.unitLessonIndex + 1
        if (!byLessonNum.has(num)) byLessonNum.set(num, row)
      }
      let applied = 0
      setFocusNotesByLesson((prev) => {
        const next = { ...prev }
        for (const extracted of payload.rows ?? []) {
          let target = extracted.lessonId ? byId.get(extracted.lessonId) : undefined
          if (!target && typeof extracted.lessonNumber === 'number') {
            target = byLessonNum.get(extracted.lessonNumber)
          }
          if (!target) continue
          const rowMap: Record<string, string> = { ...(next[target.lessonId] ?? {}) }
          for (const area of bookFocusAreas) {
            const value = String(extracted.values?.[area] ?? '').trim()
            if (!value) continue
            rowMap[area] = value
          }
          next[target.lessonId] = rowMap
          applied += 1
        }
        return next
      })
      const unitLabel = frameworkUnits.find((unit) => unit.unitId === unitCaptureUnitId)?.unitTitle ?? 'Selected unit'
      toast.success(`${unitLabel}: updated ${applied} lesson row${applied === 1 ? '' : 's'}.`)
      setUnitCaptureOpen(false)
      setUnitCaptureImage('')
    } catch {
      setContextError('Failed to extract selected unit.')
    } finally {
      setUnitCaptureBusy(false)
    }
  }

  async function extractSelectedRowsFromScreenshot() {
    if (!selectedRowsCaptureImage || !bookFocusAreas.length || !frameworkLessonRows.length || !selectedFrameworkLessonIds.length) return
    const selectedRows = frameworkLessonRows.filter((row) => selectedFrameworkLessonIds.includes(row.lessonId))
    if (!selectedRows.length) return
    setSelectedRowsCaptureBusy(true)
    setContextError(null)
    try {
      const res = await fetch('/api/context/framework/extract-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focusAreas: bookFocusAreas,
          imageDataUrl: selectedRowsCaptureImage,
          rows: selectedRows.map((row) => ({
            lessonId: row.lessonId,
            lessonTitle: row.lessonTitle,
            unitTitle: row.unitTitle,
            unitLessonIndex: row.unitLessonIndex,
          })),
        }),
      })
      const payload = (await res.json()) as {
        ok: boolean
        error?: string
        rows?: Array<{
          lessonId?: string
          lessonTitle?: string
          lessonNumber?: number
          values: Record<string, string>
        }>
      }
      if (!res.ok || !payload.ok || !Array.isArray(payload.rows)) {
        setContextError(payload.error ?? 'Failed to extract selected rows.')
        return
      }
      const byId = new Map(selectedRows.map((row) => [row.lessonId, row]))
      const byLessonNum = new Map<number, typeof selectedRows[number]>()
      for (const row of selectedRows) {
        const num = lessonNumberFromTitle(row.lessonTitle) ?? row.unitLessonIndex + 1
        if (!byLessonNum.has(num)) byLessonNum.set(num, row)
      }
      let applied = 0
      setFocusNotesByLesson((prev) => {
        const next = { ...prev }
        for (const extracted of payload.rows ?? []) {
          let target = extracted.lessonId ? byId.get(extracted.lessonId) : undefined
          if (!target && typeof extracted.lessonNumber === 'number') {
            target = byLessonNum.get(extracted.lessonNumber)
          }
          if (!target) continue
          const rowMap: Record<string, string> = { ...(next[target.lessonId] ?? {}) }
          // overwrite mode for selected rows: replace existing values
          for (const area of bookFocusAreas) {
            rowMap[area] = String(extracted.values?.[area] ?? '').trim()
          }
          next[target.lessonId] = rowMap
          applied += 1
        }
        return next
      })
      if (applied > 0) {
        toast.success(`Selected rows extraction complete. Updated ${applied} row${applied === 1 ? '' : 's'}. Paste next screenshot to continue.`)
      } else {
        toast('No selected rows were matched from this screenshot. Adjust selection/screenshot and try again.')
      }
      // Keep dialog open and keep selection so user can process the next batch quickly.
      setSelectedRowsCaptureImage('')
    } catch {
      setContextError('Failed to extract selected rows.')
    } finally {
      setSelectedRowsCaptureBusy(false)
    }
  }

  useEffect(() => {
    return () => {
      closeCurrentSession(pageNumberRef.current, { resetState: false })
    }
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-sm text-muted-foreground">Loading local books...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-base font-semibold text-foreground">Could not load books</p>
        <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
      </div>
    )
  }

  const books = library?.books ?? []

  if (books.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-base font-semibold text-foreground">No units found yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Add PDFs under `book-library/BookName/Unit-01.pdf`, or create `book-library/books.json`.
          The template file `books.example.json` is ignored by the app.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Books and units</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setUploadPanelOpen((prev) => !prev)}
            >
              {uploadPanelOpen ? <X className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              {uploadPanelOpen ? 'Hide upload' : 'Add PDF'}
            </Button>
          </div>
          {selectedStudentId ? (
            <p className="text-xs text-muted-foreground">
              Student context active. Session history will be tracked for this student.
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {uploadPanelOpen ? (
            <BookDropUpload
              onUploadComplete={async () => {
                await loadLibrary({ preserveSelection: true })
                setUploadPanelOpen(false)
              }}
            />
          ) : null}
          {library ? (
            <BookStructureWizard
              library={library}
              preferredBookId={structureWizardTarget?.bookId ?? selected?.bookId ?? null}
              preferredFilePath={structureWizardTarget?.filePath ?? selectedUnit?.filePath ?? null}
              onManifestSaved={handleManifestSaved}
              open={structureWizardOpen}
              onOpenChange={(nextOpen) => {
                setStructureWizardOpen(nextOpen)
                if (!nextOpen) setStructureWizardTarget(null)
              }}
            />
          ) : null}
          {books.map((book) => {
            const coverPath = book.units[0]?.filePath
            const coverUrl = coverPath ? makeUnitFileUrl(coverPath) : null
            const mapped = bookHasTocMapping(book)
            const bookOpen = expandedBookId === book.id
            return (
            <section key={book.id} className="space-y-2">
              <div
                className="flex gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-background/30"
                role="button"
                tabIndex={0}
                aria-expanded={bookOpen}
                aria-label={bookOpen ? `Collapse ${book.title}` : `Expand ${book.title}`}
                onClick={() => {
                  selectBook(book.id)
                  toggleBookExpanded(book.id)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    selectBook(book.id)
                    toggleBookExpanded(book.id)
                  }
                }}
              >
                {coverUrl && pdfReady ? (
                  <div className="flex shrink-0 flex-col items-center gap-0.5">
                    <PdfPageThumbnail
                      fileUrl={coverUrl}
                      unitId={`${book.id}-cover`}
                      pageNumber={1}
                      width={56}
                      pdfReady={pdfReady}
                      label="Cover"
                      className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] shadow-sm"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-sm p-0.5 text-muted-foreground transition">
                      <ChevronDown className={cn('h-4 w-4 transition-transform', !bookOpen && '-rotate-90')} />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="text-sm font-semibold leading-tight text-foreground">{book.title}</h3>
                      {book.description ? (
                        <p className="text-xs text-muted-foreground">{book.description}</p>
                      ) : null}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant={mapped ? 'outline' : 'secondary'}
                          size="icon-sm"
                          className={cn(
                            'h-7 w-7 shrink-0 rounded-full',
                            mapped &&
                              'border-[var(--brand-green)]/40 text-[var(--brand-green)] hover:bg-[var(--brand-green)]/10 hover:text-[var(--brand-green)]',
                          )}
                          aria-label={mapped ? `View or edit ${book.title} mapping` : `Map ${book.title} structure`}
                          onClick={(event) => {
                            event.stopPropagation()
                            openStructureWizardForBook(book)
                          }}
                        >
                          {mapped ? <Pencil className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>{mapped ? 'View/Edit mapping' : 'Map structure'}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
              {bookOpen ? (
              <div className="space-y-1">
                {book.units.map((unit) => {
                  const active = selected?.bookId === book.id && selected?.unitId === unit.id
                  const resumePage = getSavedUnitPage(book.id, unit.id)
                  const unitOpen = expandedUnitByBook[book.id] === unit.id
                  const lessons = unit.lessons ?? []
                  const unitStart = unit.startPageHint ?? unit.pdfPageRange?.start ?? 1
                  const contentStart = unit.pdfContentStart ?? unitStart
                  const coverPages = Math.max(0, contentStart - unitStart)
                  const unitCoverUrl = makeUnitFileUrl(unit.filePath)
                  return (
                    <div
                      key={unit.id}
                      className={cn(
                        'overflow-hidden rounded-lg border text-left transition-colors',
                        active
                          ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10'
                          : 'border-[var(--border)] bg-[var(--surface-2)] hover:bg-background/30',
                      )}
                    >
                      <div className="flex items-stretch gap-0">
                        {pdfReady ? (
                          <div className="flex w-12 shrink-0 flex-col items-center justify-center border-r border-[var(--border)]/70 bg-background/40 px-1 py-1">
                            <PdfPageThumbnail
                              fileUrl={unitCoverUrl}
                              unitId={`${unit.id}-cover`}
                              pageNumber={unitStart}
                              width={36}
                              pdfReady={pdfReady}
                              label="Unit cover"
                              className="rounded-sm border border-[var(--border)]/70"
                            />
                            <span className="mt-0.5 text-[9px] text-muted-foreground">Cover</span>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="flex shrink-0 items-center justify-center px-1.5 text-muted-foreground hover:text-foreground"
                          aria-expanded={unitOpen}
                          aria-label={unitOpen ? 'Hide lessons' : 'Show lessons'}
                          onClick={() => toggleUnitExpanded(book.id, unit.id)}
                        >
                          <ChevronDown
                            className={cn('h-4 w-4 transition-transform', unitOpen && 'rotate-180')}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openUnit(book.id, unit.id)
                            setExpandedBookId(book.id)
                            toggleUnitExpanded(book.id, unit.id)
                          }}
                          className={cn(
                            'min-w-0 flex-1 px-2 py-2 text-left text-sm transition-colors',
                            active
                              ? 'text-foreground'
                              : 'text-muted-foreground hover:bg-background/40 hover:text-foreground',
                          )}
                        >
                          <span className="block font-medium">{unit.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Open · saved page {resumePage}
                          </span>
                          {coverPages > 0 ? (
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {coverPages} cover page{coverPages === 1 ? '' : 's'} before Lesson 1
                            </span>
                          ) : null}
                        </button>
                      </div>
                      {unitOpen ? (
                        <div className="border-t border-[var(--border)] bg-background/30 px-1 py-1">
                          {lessons.length === 0 ? (
                            <p className="px-2 py-1.5 text-xs text-muted-foreground">
                              No lessons mapped for this unit yet.
                            </p>
                          ) : (
                            <ul className="space-y-0.5">
                              {lessons.map((lesson, lessonIndex) => {
                                const partsOpen = expandedLessonByUnit[unit.id] === lesson.id
                                const parts = lesson.parts ?? []
                                const lessonRange = pageRangeForIndex(lessons, lessonIndex)
                                return (
                                  <li key={lesson.id} className="rounded-md">
                                    <div className="flex items-start gap-0">
                                      <button
                                        type="button"
                                        className={cn(
                                          'mt-0.5 flex shrink-0 items-center justify-center p-1 text-muted-foreground hover:text-foreground',
                                          parts.length === 0 && 'pointer-events-none opacity-25',
                                        )}
                                        aria-expanded={partsOpen}
                                        aria-label={partsOpen ? 'Hide parts' : 'Show parts'}
                                        disabled={parts.length === 0}
                                        onClick={() => toggleLessonPartsExpanded(unit.id, lesson.id)}
                                      >
                                        <ChevronDown
                                          className={cn(
                                            'h-3.5 w-3.5 transition-transform',
                                            partsOpen && 'rotate-180',
                                          )}
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => selectLessonForReading(book.id, unit, lesson)}
                                        className={cn(
                                          'min-w-0 flex-1 rounded px-1.5 py-1 text-left text-xs leading-snug transition-colors',
                                          active &&
                                            readerLessonId === lesson.id &&
                                            readerPartId == null
                                            ? 'bg-[var(--brand-blue)]/20 font-medium text-foreground'
                                            : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                                        )}
                                      >
                                        <span className="inline-flex min-w-0 items-center gap-1.5">
                                          <span className="truncate">{lesson.title || 'Lesson'}</span>
                                          <span className="shrink-0 rounded bg-background/70 px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                                            {formatPageSpan(lessonRange.start, lessonRange.end, book, unit, numPages, numberingMode)}
                                          </span>
                                        </span>
                                      </button>
                                    </div>
                                    {partsOpen && parts.length > 0 ? (
                                      <ul className="ml-5 border-l border-[var(--border)]/80 py-0.5 pl-2">
                                        {parts.map((part, partIndex) => {
                                          const partRange = pageRangeForIndex(parts, partIndex, lessonRange.start, lessonRange.end)
                                          return (
                                          <li key={part.id}>
                                            <button
                                              type="button"
                                              onClick={() => selectPartForReading(book.id, unit, lesson, part)}
                                              className={cn(
                                                'w-full rounded px-1.5 py-1 text-left text-[11px] leading-snug transition-colors',
                                                active && readerPartId === part.id
                                                  ? 'bg-[var(--brand-blue)]/20 font-medium text-foreground'
                                                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                                              )}
                                            >
                                              <span className="inline-flex min-w-0 items-center gap-1.5">
                                                <span className="truncate">{part.title || 'Part'}</span>
                                                <span className="shrink-0 rounded bg-background/70 px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                  {formatPageSpan(partRange.start, partRange.end, book, unit, numPages, numberingMode)}
                                                </span>
                                              </span>
                                            </button>
                                          </li>
                                          )
                                        })}
                                      </ul>
                                    ) : null}
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              ) : null}
            </section>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-3xl leading-tight md:text-4xl">
            {selectedBook?.title ?? 'Choose a Book'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedBook ? (
            <section className="ui-simple-surface space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-[130px_minmax(0,1fr)]">
                <div className="ui-simple-block flex h-[180px] w-[130px] items-center justify-center text-center">
                  <span className="px-2 text-xs text-muted-foreground">Book cover preview</span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workspace ready</p>
                  <h3 className="text-xl font-semibold leading-tight text-foreground md:text-2xl">
                    Select a book to start
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Choose from the left list to load the cover, title, and supporting files in this panel.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => setUploadPanelOpen(true)}>
                      Import PDF
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Quick pick</p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {books.slice(0, 6).map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => {
                        selectBook(book.id)
                        setExpandedBookId(book.id)
                      }}
                      className="ui-simple-block p-3 text-left transition hover:bg-background"
                    >
                      <p className="truncate text-sm font-semibold text-foreground">{book.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {book.units.length} unit{book.units.length === 1 ? '' : 's'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-4">
                    {selectedBook.units[0]?.filePath && pdfReady ? (
                      <PdfPageThumbnail
                        fileUrl={makeUnitFileUrl(selectedBook.units[0].filePath)}
                        unitId={`${selectedBook.id}-right-panel-cover`}
                        pageNumber={1}
                        width={120}
                        pdfReady={pdfReady}
                        label="Book cover"
                        className="rounded-md border border-[var(--border)] bg-background shadow-sm"
                      />
                    ) : (
                      <div className="flex h-[166px] w-[120px] shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-background text-xs text-muted-foreground">
                        No cover
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected book</p>
                      <h3 className="text-2xl font-semibold leading-tight text-foreground md:text-3xl">
                        {selectedBook.title}
                      </h3>
                      {selectedBook.description ? (
                        <p className="max-w-2xl text-sm text-muted-foreground">{selectedBook.description}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setFrameworkWorkspaceOpen(true)}
                    >
                      <Settings2 className="mr-1 h-3.5 w-3.5" />
                      Framework
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setMappingWorkspaceOpen(true)}
                    >
                      Mapping workspace
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setAiPanelOpen((prev) => ({ ...prev, book: true }))}
                    >
                      <Wand2 className="mr-1 h-3.5 w-3.5" />
                      Book Ops
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Supporting files</p>
                  {materialsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading downloaded files...</p>
                  ) : downloadedMaterials.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No files found in this book&apos;s `supporting` folder yet.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {downloadedMaterials.map((material) => {
                        const fileUrl = makeUnitFileUrl(material.filePath)
                        const PdfIcon = isPdfMaterial(material) ? FileType2 : FileText
                        return (
                          <a
                            key={material.id}
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="group rounded-md border border-[var(--border)] bg-background p-3 transition hover:border-[var(--brand-blue)]/50 hover:bg-[var(--surface-2)]"
                            title={material.fileName}
                          >
                            <div className="flex items-start gap-3">
                              <PdfIcon className="mt-0.5 h-10 w-10 shrink-0 text-[var(--brand-blue)]" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground group-hover:underline">
                                  {material.title || material.fileName}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{material.fileName}</p>
                              </div>
                            </div>
                          </a>
                        )
                      })}
                    </div>
                  )}
                </div>
                <Dialog
                  open={aiPanelOpen.book}
                  onOpenChange={(open) => setAiPanelOpen((prev) => ({ ...prev, book: open }))}
                >
                  <DialogContent className="h-[90vh] w-[98vw] max-w-[98vw] sm:max-w-[98vw] overflow-hidden p-0">
                    <div className="flex h-full flex-col">
                      <DialogHeader className="border-b border-[var(--border)] px-5 py-4">
                        <DialogTitle>Book operations</DialogTitle>
                        <DialogDescription>
                          Search, review, download supporting materials, then approve and save the book context.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-5 py-4 lg:grid-cols-[400px_minmax(0,1fr)]">
                        <div className="space-y-3 overflow-y-auto pr-1">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Material types</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {BOOK_MATERIAL_TYPE_OPTIONS.map((option) => {
                                const selectedType = bookMaterialTypes.includes(option.value)
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setBookMaterialTypes((prev) => toggleMaterialType(prev, option.value))}
                                    className={cn(
                                      'rounded border px-2 py-1 text-[11px] transition',
                                      selectedType
                                        ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 text-foreground'
                                        : 'border-[var(--border)] bg-background text-muted-foreground hover:bg-[var(--surface-2)]',
                                    )}
                                  >
                                    {option.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Label className="text-xs text-muted-foreground">
                              Search mode
                              <select
                                className="mt-1 h-8 w-full rounded border border-[var(--border)] bg-background px-2 text-xs text-foreground"
                                value={bookSearchMode}
                                onChange={(event) =>
                                  setBookSearchMode(event.target.value === 'broad' ? 'broad' : 'official-first')
                                }
                              >
                                <option value="official-first">Official docs first</option>
                                <option value="broad">Broad web search</option>
                              </select>
                            </Label>
                            <Label className="text-xs text-muted-foreground">
                              Result limit
                              <select
                                className="mt-1 h-8 w-full rounded border border-[var(--border)] bg-background px-2 text-xs text-foreground"
                                value={bookResultLimit}
                                onChange={(event) =>
                                  setBookResultLimit(Math.max(4, Math.min(20, Number(event.target.value) || 8)))
                                }
                              >
                                <option value={5}>5</option>
                                <option value={8}>8</option>
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                                <option value={20}>20</option>
                              </select>
                            </Label>
                          </div>
                          <label className="flex items-center gap-2 rounded border border-[var(--border)] bg-background px-2 py-1.5 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={bookDownloadableOnly}
                              onChange={(event) => setBookDownloadableOnly(event.target.checked)}
                            />
                            Downloadable files only
                          </label>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setBookAdvancedSearchOpen((prev) => !prev)}
                          >
                            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', bookAdvancedSearchOpen && 'rotate-180')} />
                            Advanced
                          </button>
                          {bookAdvancedSearchOpen ? (
                            <Label className="block text-xs text-muted-foreground">
                              Custom query override
                              <Input
                                type="text"
                                value={bookQueryOverride}
                                onChange={(event) => setBookQueryOverride(event.target.value)}
                                className="mt-1 h-8 text-xs"
                                placeholder="Optional: exact query to run"
                              />
                            </Label>
                          ) : null}
                          <div className="space-y-2 rounded border border-[var(--border)] bg-background p-2">
                            <p className="text-xs font-semibold text-foreground">Instructional framework</p>
                            <p className="text-[11px] text-muted-foreground">
                              Manage focus areas and lesson-by-focus planning in the Framework workspace.
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setAiPanelOpen((prev) => ({ ...prev, book: false }))
                                setFrameworkWorkspaceOpen(true)
                              }}
                            >
                              Open framework workspace
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={bookAiBusy}
                              onClick={() => void runBookAiFromPanel()}
                            >
                              {bookAiBusy ? 'Generating...' : 'Find docs & draft context'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              disabled={bookSaveBusy}
                              onClick={() => void saveBookDraft()}
                            >
                              {bookSaveBusy ? 'Saving...' : 'Approve & save'}
                            </Button>
                          </div>
                          <div className="space-y-2 rounded border border-[var(--border)] bg-background p-2">
                            <p className="text-xs font-semibold text-foreground">Mapping workspace</p>
                            <p className="text-[11px] text-muted-foreground">
                              Do scanning and Unit/Lesson/Part linking in a dedicated workspace.
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => setMappingWorkspaceOpen(true)}
                            >
                              Open mapping workspace
                            </Button>
                          </div>
                        </div>
                        <div className="min-h-0 overflow-y-auto rounded border border-[var(--border)] bg-background p-3">
                          {!bookDraft ? (
                            <p className="text-sm text-muted-foreground">
                              Run search to generate draft evidence and downloadable sources.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-xs font-semibold text-foreground">Draft evidence review</p>
                              <p className="text-[11px] text-muted-foreground">
                                {bookDraft.sources.length} source{bookDraft.sources.length === 1 ? '' : 's'} discovered.
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {materialsLoading
                                  ? 'Checking downloaded materials...'
                                  : `${downloadedMaterials.length} material${downloadedMaterials.length === 1 ? '' : 's'} saved locally.`}
                              </p>
                              <div className="space-y-2">
                                {bookDraft.sources.length > 0 ? (
                                  bookDraft.sources.map((source, index) => (
                                    <article key={`${source.url}-${index}`} className="space-y-1 rounded border border-[var(--border)]/70 bg-[var(--surface-2)] p-2">
                                      {(() => {
                                        const progress = sourceDownloadProgress[source.url]
                                        const isDownloaded = downloadedMaterials.some((item) => item.url === source.url)
                                        const isBusy = progress?.status === 'queued' || progress?.status === 'downloading'
                                        const pct =
                                          progress?.totalBytes && progress.totalBytes > 0
                                            ? Math.max(0, Math.min(100, Math.round((progress.downloadedBytes / progress.totalBytes) * 100)))
                                            : null
                                        return (
                                          <>
                                            <div className="flex items-start justify-between gap-2">
                                              <p className="text-xs text-foreground">
                                                <span className="font-semibold">{source.title || 'Untitled source'}</span>
                                              </p>
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="h-6 px-2 text-[11px]"
                                                disabled={isBusy || isDownloaded}
                                                onClick={() =>
                                                  void downloadSourceForBook(
                                                    { url: source.url, title: source.title || 'Untitled source' },
                                                    (bookDraft.materials.find((item) => item.url === source.url)?.type ??
                                                      'other') as BookContextMaterialRecord['type'],
                                                  )
                                                }
                                              >
                                                {isDownloaded ? 'Downloaded' : isBusy ? 'Downloading...' : 'Download'}
                                              </Button>
                                            </div>
                                            {isBusy ? (
                                              <div className="space-y-1">
                                                <div className="h-1.5 w-full overflow-hidden rounded bg-background">
                                                  <div
                                                    className="h-full bg-[var(--brand-blue)] transition-all"
                                                    style={{ width: `${pct ?? 15}%` }}
                                                  />
                                                </div>
                                                <p className="text-[11px] text-muted-foreground">
                                                  {pct != null ? `${pct}%` : 'downloading...'} • {formatByteCount(progress?.downloadedBytes ?? 0)}
                                                  {progress?.totalBytes ? ` / ${formatByteCount(progress.totalBytes)}` : ''} •{' '}
                                                  {formatSpeed(progress?.speedBytesPerSec ?? 0)}
                                                </p>
                                              </div>
                                            ) : null}
                                            {progress?.status === 'failed' ? (
                                              <p className="text-[11px] text-[var(--brand-red)]">{progress.error ?? 'Download failed.'}</p>
                                            ) : null}
                                            <p className="text-[11px] text-muted-foreground">{source.snippet}</p>
                                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                              <span className="rounded bg-background px-1.5 py-0.5 text-muted-foreground">
                                                confidence: {source.confidence}
                                              </span>
                                              <span className="rounded bg-background px-1.5 py-0.5 text-muted-foreground">
                                                score: {source.trustScore}
                                              </span>
                                            </div>
                                            <a
                                              href={source.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="block truncate text-[11px] text-[var(--brand-blue)] underline-offset-2 hover:underline"
                                              title={source.url}
                                            >
                                              {source.url}
                                            </a>
                                            {isDownloaded ? (
                                              <p className="text-[11px] text-emerald-700">
                                                saved: {downloadedMaterials.find((item) => item.url === source.url)?.filePath}
                                              </p>
                                            ) : null}
                                          </>
                                        )
                                      })()}
                                    </article>
                                  ))
                                ) : (
                                  <p className="text-[11px] text-muted-foreground">No sources discovered yet.</p>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">Field evidence</p>
                                {bookDraft.evidence.length > 0 ? (
                                  bookDraft.evidence.map((item, index) => (
                                    <article key={`${item.sourceUrl}-${index}`} className="space-y-1 rounded border border-[var(--border)]/70 bg-[var(--surface-2)] p-2">
                                      <p className="text-[11px] text-foreground">
                                        <span className="font-semibold">{item.field}</span>
                                      </p>
                                      <span className="inline-flex rounded bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                        confidence: {item.confidence}
                                      </span>
                                      <p className="text-[11px] text-muted-foreground">{item.snippet}</p>
                                      <a
                                        href={item.sourceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block truncate text-[11px] text-[var(--brand-blue)] underline-offset-2 hover:underline"
                                        title={item.sourceUrl}
                                      >
                                        {item.sourceUrl}
                                      </a>
                                    </article>
                                  ))
                                ) : (
                                  <p className="text-[11px] text-muted-foreground">No field-level evidence extracted yet.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={frameworkWorkspaceOpen} onOpenChange={setFrameworkWorkspaceOpen}>
                  <DialogContent className="h-[90vh] min-h-0 w-[98vw] max-w-[98vw] sm:max-w-[98vw] p-0">
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                      <DialogHeader className="border-b border-[var(--border)] px-5 py-4">
                        <DialogTitle>Instructional framework</DialogTitle>
                        <DialogDescription>
                          Define focus areas at book level, then plan lesson-specific notes in a lesson-by-focus table.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 px-5 py-4">
                        <div className="w-full shrink-0 space-y-2 rounded border border-[var(--border)] bg-background p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-foreground">Focus areas</p>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => setSelectedRowsCaptureOpen(true)}
                                  title="Extract selected rows from one screenshot"
                                  disabled={selectedFrameworkLessonIds.length === 0}
                                >
                                  <Camera className="mr-1 h-3.5 w-3.5" />
                                  Extract selected rows
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => setUnitCaptureOpen(true)}
                                  title="Extract one unit from screenshot"
                                >
                                  <Camera className="mr-1 h-3.5 w-3.5" />
                                  Extract unit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => setTableCaptureOpen(true)}
                                  title="Extract full table from screenshot"
                                >
                                  <Camera className="mr-1 h-3.5 w-3.5" />
                                  Extract full table
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => setBookFocusAreas([...DEFAULT_BOOK_FOCUS_AREAS])}
                                >
                                  Reset defaults
                                </Button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {bookFocusAreas.map((item) => (
                                <button
                                  key={item}
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] text-foreground"
                                  onClick={() =>
                                    setBookFocusAreas((prev) => prev.filter((row) => row.toLowerCase() !== item.toLowerCase()))
                                  }
                                  title="Remove focus area"
                                >
                                  {item}
                                  <X className="h-3 w-3" />
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => setSelectedFrameworkLessonIds(frameworkLessonRows.map((row) => row.lessonId))}
                                disabled={frameworkLessonRows.length === 0}
                              >
                                Select all rows
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => setSelectedFrameworkLessonIds([])}
                                disabled={selectedFrameworkLessonIds.length === 0}
                              >
                                Clear selection
                              </Button>
                              <span className="text-muted-foreground">
                                {selectedFrameworkLessonIds.length} selected
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                value={bookFocusAreaInput}
                                onChange={(event) => setBookFocusAreaInput(event.target.value)}
                                className="h-8 text-xs"
                                placeholder="Add custom focus area"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => {
                                  const value = normalizeFocusArea(bookFocusAreaInput)
                                  if (!value) return
                                  setBookFocusAreas((prev) =>
                                    prev.some((row) => row.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value],
                                  )
                                  setBookFocusAreaInput('')
                                }}
                              >
                                Add
                              </Button>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              disabled={bookSaveBusy}
                              onClick={() => void saveBookDraft()}
                            >
                              {bookSaveBusy ? 'Saving...' : 'Save focus areas'}
                            </Button>
                        </div>
                        {frameworkLessonRows.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No lessons found in this book yet.</p>
                        ) : bookFocusAreas.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Add at least one focus area to generate the table.</p>
                        ) : (
                          <div tabIndex={0} className="min-h-0 min-w-0 flex-1 overflow-auto">
                            <table className="w-max table-fixed border-collapse text-xs">
                                <thead>
                                  <tr>
                                    <th className="sticky left-0 top-0 z-10 min-w-[156px] border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-1 text-left font-semibold text-foreground">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={frameworkLessonRows.length > 0 && selectedFrameworkLessonIds.length === frameworkLessonRows.length}
                                          onChange={(event) =>
                                            setSelectedFrameworkLessonIds(
                                              event.target.checked ? frameworkLessonRows.map((row) => row.lessonId) : [],
                                            )
                                          }
                                          title="Select all visible rows"
                                        />
                                        <span>Lesson</span>
                                      </div>
                                    </th>
                                    {bookFocusAreas.map((area) => (
                                      <th key={area} className="w-[220px] min-w-[220px] max-w-[220px] border border-[var(--border)] bg-[var(--surface-2)] px-1 py-1 text-left font-semibold text-foreground">
                                        {area}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {frameworkLessonRows.map((row) => (
                                    <tr key={row.lessonId}>
                                      <td className="sticky left-0 z-10 border border-[var(--border)] bg-background px-1.5 py-1 align-top">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex min-w-0 items-start gap-2">
                                            <input
                                              type="checkbox"
                                              className="mt-1"
                                              checked={selectedFrameworkLessonIds.includes(row.lessonId)}
                                              onChange={(event) => {
                                                setSelectedFrameworkLessonIds((prev) =>
                                                  event.target.checked
                                                    ? [...new Set([...prev, row.lessonId])]
                                                    : prev.filter((id) => id !== row.lessonId),
                                                )
                                              }}
                                              title="Select row"
                                            />
                                            <p className="font-medium text-foreground">{row.lessonTitle}</p>
                                          </div>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 px-1.5 text-[11px]"
                                            title="Paste lesson-row screenshot"
                                            onClick={() => {
                                              setLessonCaptureRow({
                                                lessonId: row.lessonId,
                                                lessonTitle: row.lessonTitle,
                                                unitTitle: row.unitTitle,
                                              })
                                              setLessonCaptureImage('')
                                            }}
                                          >
                                            <Camera className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">{row.unitTitle}</p>
                                      </td>
                                      {bookFocusAreas.map((area) => (
                                        <td key={`${row.lessonId}-${area}`} className="w-[220px] min-w-[220px] max-w-[220px] border border-[var(--border)] px-0.5 py-0.5 align-top">
                                          <FrameworkRichCellEditor
                                            value={focusNotesByLesson[row.lessonId]?.[area] ?? ''}
                                            onChange={(event) =>
                                              setFocusNotesByLesson((prev) => ({
                                                ...prev,
                                                [row.lessonId]: {
                                                  ...(prev[row.lessonId] ?? {}),
                                                  [area]: event,
                                                },
                                              }))
                                            }
                                            placeholder={`Add ${area.toLowerCase()} notes`}
                                          />
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                            </table>
                          </div>
                        )}
                        <div className="shrink-0 rounded border border-[var(--border)] bg-background p-2">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={bookSaveBusy || frameworkApplyBusy}
                              onClick={() => void saveBookDraft()}
                            >
                              {bookSaveBusy ? 'Saving progress...' : 'Save table progress'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              disabled={frameworkPreviewBusy || frameworkApplyBusy || bookSaveBusy}
                              onClick={() => void loadFrameworkMappingPreview()}
                            >
                              {frameworkPreviewBusy ? 'Loading preview...' : 'Review before apply'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog
                  open={frameworkPreviewOpen}
                  onOpenChange={(open) => {
                    if (!open) {
                      setFrameworkPreviewOpen(false)
                      setFrameworkPreview(null)
                      setFrameworkPreviewSummary(null)
                    }
                  }}
                >
                  <DialogContent className="flex max-h-[90vh] max-w-[calc(100%-2rem)] flex-col gap-3 overflow-hidden sm:max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Framework mapping preview</DialogTitle>
                      <DialogDescription>
                        {frameworkPreviewSummary
                          ? `Planned writes: ${frameworkPreviewSummary.unitsUpdated} unit(s), ${frameworkPreviewSummary.lessonsUpdated} lesson(s), ${frameworkPreviewSummary.partsUpdated} part(s). Deprecated label blocks skipped: ${frameworkPreviewSummary.deprecatedLabelsSkipped}.`
                          : 'Review how table notes map into stored context before writing files.'}
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[min(55vh,480px)] pr-3">
                      {frameworkPreview ? (
                        <div className="space-y-6 text-sm">
                          <section className="space-y-2">
                            <h3 className="font-semibold text-foreground">Book</h3>
                            <p className="text-muted-foreground">{frameworkPreview.book.summaryNote}</p>
                            <p>
                              <span className="font-medium">Focus areas: </span>
                              {frameworkPreview.book.focusAreas.join(', ') || '—'}
                            </p>
                            <div>
                              <p className="font-medium">Instructional priorities</p>
                              {frameworkPreview.book.instructionalPriorities.length ? (
                                <ul className="mt-1 list-disc space-y-1 pl-4">
                                  {frameworkPreview.book.instructionalPriorities.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-muted-foreground">—</p>
                              )}
                            </div>
                          </section>
                          <section className="space-y-2">
                            <h3 className="font-semibold text-foreground">Units</h3>
                            {frameworkPreview.units.length ? (
                              <ul className="space-y-3">
                                {frameworkPreview.units.map((unit) => (
                                  <li key={unit.unitId} className="rounded border border-[var(--border)] p-2">
                                    <p className="font-medium">{unit.unitTitle ?? unit.unitId}</p>
                                    <p className="text-muted-foreground text-xs">Theme: {unit.theme}</p>
                                    <p className="mt-1 text-xs">Pages p{unit.sourcePageRange.startPage}–{unit.sourcePageRange.endPage}</p>
                                    {unit.bigIdeas.length ? (
                                      <p className="mt-1 text-xs">
                                        <span className="font-medium">Big ideas: </span>
                                        {unit.bigIdeas.join('; ')}
                                      </p>
                                    ) : null}
                                    {unit.targetLanguageDomains.length ? (
                                      <p className="mt-1 text-xs">
                                        <span className="font-medium">Domains: </span>
                                        {unit.targetLanguageDomains.join(', ')}
                                      </p>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-muted-foreground">No unit aggregates.</p>
                            )}
                          </section>
                          <section className="space-y-2">
                            <h3 className="font-semibold text-foreground">Lessons</h3>
                            {frameworkPreview.lessons.length ? (
                              <ul className="space-y-3">
                                {frameworkPreview.lessons.map((lesson) => (
                                  <li key={lesson.lessonId} className="rounded border border-[var(--border)] p-2">
                                    <p className="font-medium">{lesson.lessonTitle ?? lesson.lessonId}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {lesson.textType} · {lesson.comprehensionSkill} · {lesson.strategy}
                                    </p>
                                    {lesson.lessonGoals.slice(0, 5).map((goal, idx) => (
                                      <p key={`${lesson.lessonId}-goal-${idx}`} className="mt-1 text-xs">
                                        {goal}
                                      </p>
                                    ))}
                                    {lesson.lessonGoals.length > 5 ? (
                                      <p className="text-xs text-muted-foreground">
                                        +{lesson.lessonGoals.length - 5} more goal line(s)
                                      </p>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-muted-foreground">No lesson rows.</p>
                            )}
                          </section>
                          <section className="space-y-2">
                            <h3 className="font-semibold text-foreground">Lesson parts</h3>
                            {frameworkPreview.parts.length ? (
                              <ul className="space-y-3">
                                {frameworkPreview.parts.map((part) => (
                                  <li key={`${part.lessonId}-${part.partId}`} className="rounded border border-[var(--border)] p-2">
                                    <p className="font-medium">{part.partTitle ?? part.partId}</p>
                                    <p className="text-xs text-muted-foreground">Lesson {part.lessonId}</p>
                                    {part.activityNotes.slice(0, 4).map((note, idx) => (
                                      <p key={`${part.lessonId}-${part.partId}-note-${idx}`} className="mt-1 text-xs">
                                        {note}
                                      </p>
                                    ))}
                                    {part.activityNotes.length > 4 ? (
                                      <p className="text-xs text-muted-foreground">
                                        +{part.activityNotes.length - 4} more note(s)
                                      </p>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-muted-foreground">No part-level matches (keyword overlap).</p>
                            )}
                          </section>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No preview loaded.</p>
                      )}
                    </ScrollArea>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={frameworkApplyBusy}
                        onClick={() => {
                          setFrameworkPreviewOpen(false)
                          setFrameworkPreview(null)
                          setFrameworkPreviewSummary(null)
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="button" disabled={frameworkApplyBusy} onClick={() => void confirmFrameworkApplyFromPreview()}>
                        {frameworkApplyBusy ? 'Applying...' : 'Apply to context layers'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog
                  open={!!lessonCaptureRow}
                  onOpenChange={(open) => {
                    if (!open) {
                      setLessonCaptureRow(null)
                      setLessonCaptureImage('')
                    }
                  }}
                >
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Extract single lesson row</DialogTitle>
                      <DialogDescription>
                        Paste or upload a screenshot for {lessonCaptureRow?.lessonTitle ?? 'this lesson'} and Gemini will fill only this row.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <input
                        ref={lessonCaptureFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            const result = typeof reader.result === 'string' ? reader.result : ''
                            if (result.startsWith('data:image/')) {
                              setLessonCaptureImage(result)
                            } else {
                              toast('Please select an image file.')
                            }
                          }
                          reader.readAsDataURL(file)
                          event.currentTarget.value = ''
                        }}
                      />
                      <div
                        className="rounded border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-muted-foreground"
                        onPaste={(event) => {
                          const items = event.clipboardData?.items ?? []
                          const imageItem = [...items].find((item) => item.type.startsWith('image/'))
                          if (!imageItem) return
                          const file = imageItem.getAsFile()
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            const result = typeof reader.result === 'string' ? reader.result : ''
                            if (result.startsWith('data:image/')) {
                              setLessonCaptureImage(result)
                              toast.success('Screenshot pasted.')
                            }
                          }
                          reader.readAsDataURL(file)
                        }}
                      >
                        Paste screenshot with Ctrl+V here, or use upload.
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => lessonCaptureFileInputRef.current?.click()}
                        >
                          Upload screenshot
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={!lessonCaptureImage || lessonCaptureBusy}
                          onClick={() => void extractSingleLessonRowFromScreenshot()}
                        >
                          {lessonCaptureBusy ? 'Extracting...' : 'Extract and populate row'}
                        </Button>
                      </div>
                      {lessonCaptureImage ? (
                        <div className="max-h-80 overflow-auto rounded border border-[var(--border)] bg-background p-2">
                          <img src={lessonCaptureImage} alt="Lesson row screenshot preview" className="max-w-full rounded" />
                        </div>
                      ) : null}
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog
                  open={tableCaptureOpen}
                  onOpenChange={(open) => {
                    setTableCaptureOpen(open)
                    if (!open) setTableCaptureImage('')
                  }}
                >
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Extract full table from screenshot</DialogTitle>
                      <DialogDescription>
                        Paste or upload one screenshot containing multiple lesson rows. Gemini will try to fill all matching lessons.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <input
                        ref={tableCaptureFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            const result = typeof reader.result === 'string' ? reader.result : ''
                            if (result.startsWith('data:image/')) {
                              setTableCaptureImage(result)
                            } else {
                              toast('Please select an image file.')
                            }
                          }
                          reader.readAsDataURL(file)
                          event.currentTarget.value = ''
                        }}
                      />
                      <div
                        className="rounded border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-muted-foreground"
                        onPaste={(event) => {
                          const items = event.clipboardData?.items ?? []
                          const imageItem = [...items].find((item) => item.type.startsWith('image/'))
                          if (!imageItem) return
                          const file = imageItem.getAsFile()
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            const result = typeof reader.result === 'string' ? reader.result : ''
                            if (result.startsWith('data:image/')) {
                              setTableCaptureImage(result)
                              toast.success('Screenshot pasted.')
                            }
                          }
                          reader.readAsDataURL(file)
                        }}
                      >
                        Paste full-table screenshot with Ctrl+V here, or use upload.
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => tableCaptureFileInputRef.current?.click()}
                        >
                          Upload screenshot
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={!tableCaptureImage || tableCaptureBusy}
                          onClick={() => void extractFullTableFromScreenshot()}
                        >
                          {tableCaptureBusy ? 'Extracting...' : 'Extract full table'}
                        </Button>
                      </div>
                      {tableCaptureImage ? (
                        <div className="max-h-96 overflow-auto rounded border border-[var(--border)] bg-background p-2">
                          <img src={tableCaptureImage} alt="Full table screenshot preview" className="max-w-full rounded" />
                        </div>
                      ) : null}
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog
                  open={selectedRowsCaptureOpen}
                  onOpenChange={(open) => {
                    setSelectedRowsCaptureOpen(open)
                    if (!open) setSelectedRowsCaptureImage('')
                  }}
                >
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Extract selected rows from screenshot</DialogTitle>
                      <DialogDescription>
                        Paste or upload one screenshot containing the selected rows. Gemini will populate only selected rows and overwrite their values.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <input
                        ref={selectedRowsCaptureFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            const result = typeof reader.result === 'string' ? reader.result : ''
                            if (result.startsWith('data:image/')) {
                              setSelectedRowsCaptureImage(result)
                            } else {
                              toast('Please select an image file.')
                            }
                          }
                          reader.readAsDataURL(file)
                          event.currentTarget.value = ''
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        {selectedFrameworkLessonIds.length} row{selectedFrameworkLessonIds.length === 1 ? '' : 's'} selected
                      </p>
                      <div
                        className="rounded border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-muted-foreground"
                        onPaste={(event) => {
                          const items = event.clipboardData?.items ?? []
                          const imageItem = [...items].find((item) => item.type.startsWith('image/'))
                          if (!imageItem) return
                          const file = imageItem.getAsFile()
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            const result = typeof reader.result === 'string' ? reader.result : ''
                            if (result.startsWith('data:image/')) {
                              setSelectedRowsCaptureImage(result)
                              toast.success('Screenshot pasted.')
                            }
                          }
                          reader.readAsDataURL(file)
                        }}
                      >
                        Paste selected-rows screenshot with Ctrl+V here, or use upload.
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => selectedRowsCaptureFileInputRef.current?.click()}
                        >
                          Upload screenshot
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={!selectedRowsCaptureImage || selectedRowsCaptureBusy || selectedFrameworkLessonIds.length === 0}
                          onClick={() => void extractSelectedRowsFromScreenshot()}
                        >
                          {selectedRowsCaptureBusy ? 'Extracting...' : 'Extract selected rows'}
                        </Button>
                      </div>
                      {selectedRowsCaptureImage ? (
                        <div className="max-h-96 overflow-auto rounded border border-[var(--border)] bg-background p-2">
                          <img src={selectedRowsCaptureImage} alt="Selected rows screenshot preview" className="max-w-full rounded" />
                        </div>
                      ) : null}
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog
                  open={unitCaptureOpen}
                  onOpenChange={(open) => {
                    setUnitCaptureOpen(open)
                    if (!open) setUnitCaptureImage('')
                  }}
                >
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Extract one unit from screenshot</DialogTitle>
                      <DialogDescription>
                        Pick a unit, then paste or upload a screenshot for that unit table. Gemini will fill only that unit&apos;s lessons.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <input
                        ref={unitCaptureFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            const result = typeof reader.result === 'string' ? reader.result : ''
                            if (result.startsWith('data:image/')) {
                              setUnitCaptureImage(result)
                            } else {
                              toast('Please select an image file.')
                            }
                          }
                          reader.readAsDataURL(file)
                          event.currentTarget.value = ''
                        }}
                      />
                      <Label className="text-xs text-muted-foreground">
                        Unit
                        <select
                          className="mt-1 h-8 w-full rounded border border-[var(--border)] bg-background px-2 text-xs text-foreground"
                          value={unitCaptureUnitId}
                          onChange={(event) => setUnitCaptureUnitId(event.target.value)}
                        >
                          {frameworkUnits.map((unit) => (
                            <option key={unit.unitId} value={unit.unitId}>
                              {unit.unitTitle}
                            </option>
                          ))}
                        </select>
                      </Label>
                      <div
                        className="rounded border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-muted-foreground"
                        onPaste={(event) => {
                          const items = event.clipboardData?.items ?? []
                          const imageItem = [...items].find((item) => item.type.startsWith('image/'))
                          if (!imageItem) return
                          const file = imageItem.getAsFile()
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            const result = typeof reader.result === 'string' ? reader.result : ''
                            if (result.startsWith('data:image/')) {
                              setUnitCaptureImage(result)
                              toast.success('Screenshot pasted.')
                            }
                          }
                          reader.readAsDataURL(file)
                        }}
                      >
                        Paste unit screenshot with Ctrl+V here, or use upload.
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => unitCaptureFileInputRef.current?.click()}
                        >
                          Upload screenshot
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={!unitCaptureImage || unitCaptureBusy || !unitCaptureUnitId}
                          onClick={() => void extractUnitFromScreenshot()}
                        >
                          {unitCaptureBusy ? 'Extracting...' : 'Extract unit'}
                        </Button>
                      </div>
                      {unitCaptureImage ? (
                        <div className="max-h-96 overflow-auto rounded border border-[var(--border)] bg-background p-2">
                          <img src={unitCaptureImage} alt="Unit screenshot preview" className="max-w-full rounded" />
                        </div>
                      ) : null}
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={mappingWorkspaceOpen} onOpenChange={setMappingWorkspaceOpen}>
                  <DialogContent className="h-[90vh] w-[98vw] max-w-[98vw] sm:max-w-[98vw] overflow-hidden p-0">
                    <div className="flex h-full flex-col">
                      <DialogHeader className="border-b border-[var(--border)] px-5 py-4">
                        <DialogTitle>Mapping workspace</DialogTitle>
                        <DialogDescription>
                          Select downloaded files, scan for Unit/Lesson/Part mapping suggestions, then apply.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-5 py-4 lg:grid-cols-[380px_minmax(0,1fr)]">
                        <div className="space-y-3 overflow-y-auto pr-1">
                          <div className="space-y-2 rounded border border-[var(--border)] bg-background p-2">
                            <p className="text-xs font-semibold text-foreground">Downloaded files</p>
                            {materialsLoading ? (
                              <p className="text-xs text-muted-foreground">Loading files...</p>
                            ) : downloadedMaterials.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No downloaded files for this book yet.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {downloadedMaterials.map((material) => {
                                  const checked = selectedMaterialIdsForMapping.includes(material.id)
                                  return (
                                    <label key={material.id} className="flex items-start gap-2 rounded border border-[var(--border)]/70 bg-[var(--surface-2)] p-2 text-xs">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) =>
                                          setSelectedMaterialIdsForMapping((prev) =>
                                            event.target.checked
                                              ? prev.includes(material.id)
                                                ? prev
                                                : [...prev, material.id]
                                              : prev.filter((id) => id !== material.id),
                                          )
                                        }
                                      />
                                      <span className="min-w-0">
                                        <span className="block truncate font-medium text-foreground">
                                          {material.title || material.fileName}
                                        </span>
                                        <span className="block truncate text-muted-foreground">{material.fileName}</span>
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={mappingScanBusy || selectedMaterialIdsForMapping.length === 0}
                                onClick={() => void scanMaterialMappingsForBook(selectedMaterialIdsForMapping)}
                              >
                                {mappingScanBusy ? 'Scanning...' : 'Scan selected'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={mappingScanBusy || downloadedMaterials.length === 0}
                                onClick={() => void scanMaterialMappingsForBook()}
                              >
                                {mappingScanBusy ? 'Scanning...' : 'Scan all'}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="min-h-0 overflow-y-auto rounded border border-[var(--border)] bg-background p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-foreground">Suggestions</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={mappingApplyBusy || mappingSuggestions.length === 0}
                              onClick={() => void applyMaterialMappings(mappingSuggestions)}
                            >
                              {mappingApplyBusy ? 'Applying...' : 'Apply all suggestions'}
                            </Button>
                          </div>
                          <div className="mb-2 rounded border border-[var(--border)] bg-[var(--surface-2)] p-2 text-[11px] text-muted-foreground">
                            <p>
                              Scanned: {mappingScannedCount} file{mappingScannedCount === 1 ? '' : 's'} · Processed:{' '}
                              {mappingProcessedCount} · Skipped: {mappingSkipped.length}
                            </p>
                            {mappingErrors.length > 0 ? (
                              <div className="mt-1 space-y-0.5">
                                {mappingErrors.slice(0, 4).map((row, idx) => (
                                  <p key={`${row}-${idx}`} className="truncate text-[var(--brand-red)]">
                                    {row}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                            {mappingSkipped.length > 0 ? (
                              <div className="mt-1 space-y-0.5">
                                {mappingSkipped.slice(0, 6).map((item) => (
                                  <p key={`${item.materialId}-${item.reason}`} className="truncate">
                                    {item.materialTitle}: {item.reason}
                                  </p>
                                ))}
                                {mappingSkipped.length > 6 ? <p>+{mappingSkipped.length - 6} more skipped files</p> : null}
                              </div>
                            ) : null}
                          </div>
                          {materialAnalyses.length > 0 ? (
                            <div className="mb-3 space-y-2 rounded border border-[var(--border)] bg-[var(--surface-2)] p-2">
                              <p className="text-xs font-semibold text-foreground">Extracted lesson analysis</p>
                              <div className="space-y-2">
                                {materialAnalyses.map((analysis) => (
                                  <article key={`${analysis.materialId}-${analysis.parsedAt}`} className="rounded border border-[var(--border)] bg-background p-2">
                                    <p className="truncate text-xs font-medium text-foreground">{analysis.materialTitle}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      status: {analysis.parseStatus} · mode: {analysis.extractionMode} · lessons: {analysis.lessonProfiles.length}
                                    </p>
                                    {analysis.detectedUnits && analysis.detectedUnits.length > 0 ? (
                                      <p className="text-[11px] text-muted-foreground">detected units: {analysis.detectedUnits.join(', ')}</p>
                                    ) : null}
                                    {analysis.lessonProfiles.slice(0, 3).map((lesson) => {
                                      const signalPairs = Object.entries(lesson.signals).filter(([, values]) => Array.isArray(values) && values.length > 0)
                                      return (
                                        <div key={`${analysis.materialId}-${lesson.lessonTitle}`} className="mt-1 rounded border border-[var(--border)]/70 bg-[var(--surface-2)] p-1.5">
                                          <p className="truncate text-[11px] font-medium text-foreground">{lesson.lessonTitle}</p>
                                          {lesson.inferredPathLabel ? (
                                            <p className="text-[10px] text-muted-foreground">mapped: {lesson.inferredPathLabel}</p>
                                          ) : null}
                                          {lesson.sectionFields ? (
                                            <div className="mt-1 grid gap-1 text-[10px] text-muted-foreground">
                                              {lesson.sectionFields.readAloud.length > 0 ? (
                                                <p><span className="font-semibold text-foreground">Read Aloud:</span> {lesson.sectionFields.readAloud.join('; ')}</p>
                                              ) : null}
                                              {lesson.sectionFields.anchorText.length > 0 ? (
                                                <p><span className="font-semibold text-foreground">Anchor Text:</span> {lesson.sectionFields.anchorText.join('; ')}</p>
                                              ) : null}
                                              {lesson.sectionFields.pairedSelection.length > 0 ? (
                                                <p><span className="font-semibold text-foreground">Paired Selection:</span> {lesson.sectionFields.pairedSelection.join('; ')}</p>
                                              ) : null}
                                              {lesson.sectionFields.selection.length > 0 ? (
                                                <p><span className="font-semibold text-foreground">Selection:</span> {lesson.sectionFields.selection.join('; ')}</p>
                                              ) : null}
                                              {lesson.sectionFields.targetVocabulary.length > 0 ? (
                                                <p><span className="font-semibold text-foreground">Target Vocabulary:</span> {lesson.sectionFields.targetVocabulary.join('; ')}</p>
                                              ) : null}
                                              {lesson.sectionFields.spelling.length > 0 ? (
                                                <p><span className="font-semibold text-foreground">Spelling:</span> {lesson.sectionFields.spelling.join('; ')}</p>
                                              ) : null}
                                              {lesson.sectionFields.grammar.length > 0 ? (
                                                <p><span className="font-semibold text-foreground">Grammar:</span> {lesson.sectionFields.grammar.join('; ')}</p>
                                              ) : null}
                                              {lesson.sectionFields.writing.length > 0 ? (
                                                <p><span className="font-semibold text-foreground">Writing:</span> {lesson.sectionFields.writing.join('; ')}</p>
                                              ) : null}
                                              {lesson.sectionFields.essentialQuestion.length > 0 ? (
                                                <p><span className="font-semibold text-foreground">Essential Question:</span> {lesson.sectionFields.essentialQuestion.join('; ')}</p>
                                              ) : null}
                                              {lesson.sectionFields.comprehensionTargets.length > 0 ? (
                                                <p><span className="font-semibold text-foreground">Comprehension Targets:</span> {lesson.sectionFields.comprehensionTargets.join('; ')}</p>
                                              ) : null}
                                              {lesson.sectionFields.grammarVocabTargets.length > 0 ? (
                                                <p><span className="font-semibold text-foreground">Grammar/Vocab Targets:</span> {lesson.sectionFields.grammarVocabTargets.join('; ')}</p>
                                              ) : null}
                                              {lesson.sectionFields.weeklyAssessments.length > 0 ? (
                                                <p><span className="font-semibold text-foreground">Weekly Assessments:</span> {lesson.sectionFields.weeklyAssessments.join('; ')}</p>
                                              ) : null}
                                            </div>
                                          ) : null}
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {signalPairs.length > 0 ? (
                                              signalPairs.map(([key, values]) => (
                                                <span key={`${lesson.lessonTitle}-${key}`} className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                                  {key} ({values.length})
                                                </span>
                                              ))
                                            ) : (
                                              <span className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">no parameter signals</span>
                                            )}
                                          </div>
                                          {lesson.evidence[0]?.snippet ? (
                                            <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                                              Evidence{typeof lesson.evidence[0].page === 'number' ? ` (p${lesson.evidence[0].page})` : ''}: {lesson.evidence[0].snippet}
                                            </p>
                                          ) : null}
                                        </div>
                                      )
                                    })}
                                  </article>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {mappingSuggestions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No suggestions yet. Scan selected files to generate mappings.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {mappingSuggestions.map((item) => (
                                <article key={`${item.materialId}-${item.pathLabel}`} className="rounded border border-[var(--border)]/70 bg-[var(--surface-2)] p-2">
                                  <p className="truncate text-xs font-medium text-foreground">{item.materialTitle}</p>
                                  <p className="mt-0.5 text-[11px] text-muted-foreground">{item.pathLabel}</p>
                                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    {item.confidence} confidence · {item.reason}
                                  </p>
                                  {item.extractedLessonTitle ? (
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">Extracted lesson: {item.extractedLessonTitle}</p>
                                  ) : null}
                                  {item.detectedSignals && item.detectedSignals.length > 0 ? (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {item.detectedSignals.map((signal) => (
                                        <span key={`${item.materialId}-${signal}`} className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                          {signal}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                  {typeof item.score === 'number' ? (
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">Score: {item.score.toFixed(2)}</p>
                                  ) : null}
                                  {item.evidenceSnippet ? (
                                    <p className="mt-0.5 line-clamp-3 text-[11px] text-muted-foreground">
                                      Evidence{typeof item.evidencePage === 'number' ? ` (p${item.evidencePage})` : ''}: {item.evidenceSnippet}
                                    </p>
                                  ) : null}
                                  <div className="mt-1">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-[11px]"
                                      disabled={mappingApplyBusy}
                                      onClick={() => void applyMaterialMappings([item])}
                                    >
                                      Link this material
                                    </Button>
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </section>

              <section className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Unit {selectedUnit ? `— ${selectedUnit.title}` : ''}</p>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={!selectedUnit} onClick={() => setEditingLevel((prev) => ({ ...prev, unit: !prev.unit }))}>
                      {editingLevel.unit ? 'Done' : 'Edit'}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={!selectedUnit} onClick={() => setAiPanelOpen((prev) => ({ ...prev, unit: !prev.unit }))}>
                      AI
                    </Button>
                  </div>
                </div>
                {!selectedUnit ? (
                  <p className="text-sm text-muted-foreground">Select a unit from the left panel.</p>
                ) : editingLevel.unit ? (
                  <Textarea value={unitText} onChange={(event) => setUnitText(event.target.value)} className="min-h-24 bg-background" placeholder="Write unit context, goals, and focus." />
                ) : (
                  <p className="text-sm text-foreground">{unitContextLoading ? 'Loading context...' : (unitText || `Not extracted for this unit (${selectedUnit.title}).`)}</p>
                )}
                {aiPanelOpen.unit && selectedUnit ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap items-end gap-2">
                      <Label className="text-xs text-muted-foreground">Start
                        <Input type="number" min={1} value={aiRange.unit.startPage} onChange={(e) => {
                          const startPage = Math.max(1, Number(e.target.value || 1))
                          setAiRange((prev) => ({ ...prev, unit: { startPage, endPage: Math.max(startPage, prev.unit.endPage) } }))
                        }} className="mt-1 h-8 w-24 text-xs" />
                      </Label>
                      <Label className="text-xs text-muted-foreground">End
                        <Input type="number" min={1} value={aiRange.unit.endPage} onChange={(e) => {
                          const endPage = Math.max(1, Number(e.target.value || aiRange.unit.startPage))
                          setAiRange((prev) => ({ ...prev, unit: { ...prev.unit, endPage: Math.max(prev.unit.startPage, endPage) } }))
                        }} className="mt-1 h-8 w-24 text-xs" />
                      </Label>
                      <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={aiBusyLevel === 'unit'} onClick={() => void runUnitAiFromPanel()}>
                        {aiBusyLevel === 'unit' ? 'Generating...' : 'Run AI'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Lesson {selectedLesson ? `— ${selectedLesson.title}` : ''}</p>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={!selectedLesson} onClick={() => setEditingLevel((prev) => ({ ...prev, lesson: !prev.lesson }))}>
                      {editingLevel.lesson ? 'Done' : 'Edit'}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={!selectedLesson} onClick={() => setAiPanelOpen((prev) => ({ ...prev, lesson: !prev.lesson }))}>
                      AI
                    </Button>
                  </div>
                </div>
                {!selectedLesson ? (
                  <p className="text-sm text-muted-foreground">Select a lesson from the left panel.</p>
                ) : editingLevel.lesson ? (
                  <Textarea value={lessonText} onChange={(event) => setLessonText(event.target.value)} className="min-h-24 bg-background" placeholder="Write lesson context, goals, and strategy." />
                ) : (
                  <p className="text-sm text-foreground">{lessonContextLoading ? 'Loading context...' : (lessonText || `Not extracted for this lesson (${selectedLesson.title}).`)}</p>
                )}
                {aiPanelOpen.lesson && selectedLesson ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap items-end gap-2">
                      <Label className="text-xs text-muted-foreground">Start
                        <Input type="number" min={1} value={aiRange.lesson.startPage} onChange={(e) => {
                          const startPage = Math.max(1, Number(e.target.value || 1))
                          setAiRange((prev) => ({ ...prev, lesson: { startPage, endPage: Math.max(startPage, prev.lesson.endPage) } }))
                        }} className="mt-1 h-8 w-24 text-xs" />
                      </Label>
                      <Label className="text-xs text-muted-foreground">End
                        <Input type="number" min={1} value={aiRange.lesson.endPage} onChange={(e) => {
                          const endPage = Math.max(1, Number(e.target.value || aiRange.lesson.startPage))
                          setAiRange((prev) => ({ ...prev, lesson: { ...prev.lesson, endPage: Math.max(prev.lesson.startPage, endPage) } }))
                        }} className="mt-1 h-8 w-24 text-xs" />
                      </Label>
                      <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={aiBusyLevel === 'lesson'} onClick={() => void runLessonAiFromPanel()}>
                        {aiBusyLevel === 'lesson' ? 'Generating...' : 'Run AI'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Lesson Part {selectedPart ? `— ${selectedPart.title}` : ''}</p>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={!selectedPart} onClick={() => setEditingLevel((prev) => ({ ...prev, part: !prev.part }))}>
                      {editingLevel.part ? 'Done' : 'Edit'}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={!selectedPart} onClick={() => setAiPanelOpen((prev) => ({ ...prev, part: !prev.part }))}>
                      AI
                    </Button>
                  </div>
                </div>
                {!selectedPart ? (
                  <p className="text-sm text-muted-foreground">Select a lesson part from the left panel.</p>
                ) : editingLevel.part ? (
                  <Textarea value={partText} onChange={(event) => setPartText(event.target.value)} className="min-h-24 bg-background" placeholder="Write part-level context and activity goals." />
                ) : (
                  <p className="text-sm text-foreground">{partText || `No generated context yet for ${selectedPart.title}.`}</p>
                )}
                {aiPanelOpen.part && selectedPart ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap items-end gap-2">
                      <Label className="text-xs text-muted-foreground">Start
                        <Input type="number" min={1} value={aiRange.part.startPage} onChange={(e) => {
                          const startPage = Math.max(1, Number(e.target.value || 1))
                          setAiRange((prev) => ({ ...prev, part: { startPage, endPage: Math.max(startPage, prev.part.endPage) } }))
                        }} className="mt-1 h-8 w-24 text-xs" />
                      </Label>
                      <Label className="text-xs text-muted-foreground">End
                        <Input type="number" min={1} value={aiRange.part.endPage} onChange={(e) => {
                          const endPage = Math.max(1, Number(e.target.value || aiRange.part.startPage))
                          setAiRange((prev) => ({ ...prev, part: { ...prev.part, endPage: Math.max(prev.part.startPage, endPage) } }))
                        }} className="mt-1 h-8 w-24 text-xs" />
                      </Label>
                      <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => toast.info('Part-level AI generation endpoint will be added next.')}>
                        Run AI
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>

              {contextError ? <p className="text-xs text-[var(--brand-red)]">{contextError}</p> : null}

              {selectedUnit ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => goToNeighborPage(-1, 2)}
                      disabled={!visiblePages.length || currentSpreadLeftPage === (visiblePages[0] ?? currentSpreadLeftPage)}
                    >
                      <ChevronLeft size={16} />
                      Prev
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => goToNeighborPage(1, 2)}
                      disabled={!visiblePages.length || currentSpreadRightPage == null}
                    >
                      Next
                      <ChevronRight size={16} />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      PDF page {currentSpreadRightPage != null ? `${currentSpreadLeftPage}-${currentSpreadRightPage}` : `${currentSpreadLeftPage}`}
                      {numPages != null ? ` / ${numPages}` : ''}
                    </span>
                  </div>
                  <div className="overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2">
                    {pdfReady ? (
                      <PdfDocument
                        file={makeUnitFileUrl(selectedUnit.filePath)}
                        options={PDF_DOCUMENT_OPTIONS}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<p className="p-6 text-sm text-muted-foreground">Loading PDF...</p>}
                        error={<p className="p-6 text-sm text-[var(--brand-red)]">Could not open this PDF unit.</p>}
                      >
                        <div className="grid gap-2 xl:grid-cols-2">
                          <PdfPage
                            pageNumber={currentSpreadLeftPage}
                            width={Math.max(320, Math.floor(viewerWidth / 2) - 8)}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                          />
                          {currentSpreadRightPage != null ? (
                            <PdfPage
                              pageNumber={currentSpreadRightPage}
                              width={Math.max(320, Math.floor(viewerWidth / 2) - 8)}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                            />
                          ) : null}
                        </div>
                      </PdfDocument>
                    ) : (
                      <p className="p-6 text-sm text-muted-foreground">Preparing PDF viewer...</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm text-muted-foreground">
                  Select a unit to open the book preview and verify lesson page ranges.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
