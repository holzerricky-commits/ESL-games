'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageGridStage } from '@/components/students/fullscreen-book-overlay/sections/PageGridStage'
import { listBookVolumes, unitsForVolume } from '@/lib/books/book-volumes'
import type { PageGridLayoutOptions } from '@/lib/books/page-grid-layout'
import {
  formatEffectivePageSpan,
  mapPdfPageToDisplayLabel,
  resolveMappedPageToPdfPage,
} from '@/lib/books/page-numbering'
import { clampPdfPageToVisible, getUnitReaderBounds, getVisiblePdfPages } from '@/lib/books/page-range'
import type {
  BookLessonRecord,
  BookLibraryPayload,
  BookRecord,
  BookUnitRecord,
  BookVolumeRecord,
} from '@/lib/books/types'
import {
  getStudentSectionOptions,
  getStudentTeachingOpenPdfPageForBookUnit,
  isStudentCurriculumBookStartFresherThanLastStop,
  resolveCurriculumBookStarts,
  resolveStudentSectionAtMappedBookPage,
  updateStudentCurriculumBookStart,
  type StudentCurriculumBookStart,
  type StudentSectionOption,
} from '@/lib/students/selectors'
import type { StudentProfileView } from '@/lib/students/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), { ssr: false })
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const
const DEFAULT_PAGE_ASPECT_RATIO = 1 / 1.414
const LEFT_RAIL_WIDTH_PX = 300

/** Smaller first so teachers can scan for a start page; + zooms tiles up. */
const GRID_ZOOM_STEPS: Array<PageGridLayoutOptions & { thumbRenderWidth: number }> = [
  {
    minCols: 8,
    maxCols: 14,
    targetPageWidthPx: 84,
    gapPx: 6,
    padPx: 10,
    thumbRenderWidth: 120,
  },
  {
    minCols: 6,
    maxCols: 12,
    targetPageWidthPx: 110,
    gapPx: 8,
    padPx: 12,
    thumbRenderWidth: 140,
  },
  {
    minCols: 4,
    maxCols: 8,
    targetPageWidthPx: 160,
    gapPx: 10,
    padPx: 14,
    thumbRenderWidth: 200,
  },
  {
    minCols: 3,
    maxCols: 6,
    targetPageWidthPx: 200,
    gapPx: 12,
    padPx: 16,
    thumbRenderWidth: 240,
  },
]
const DEFAULT_GRID_ZOOM = 0

type PlaceKind = 'start' | 'last' | 'none'

type CurrentPlace = {
  kind: PlaceKind
  label: string
  sectionTitle: string | null
  mappedPage: number | null
  pdfPage: number | null
  unitId: string | null
  sectionId: string | null
  lessonId: string | null
  volumeId: string | null
}

/** After “Set as start”, keep Here in sync before the parent student prop refreshes. */
type LocalHereOverride = {
  mappedPage: number
  pdfPage: number
  unitId: string
  sectionId: string
  lessonId: string | null
  volumeId: string | null
  sectionTitle: string | null
}

type OutlineUnitNode = {
  unit: BookUnitRecord
  lessons: BookLessonRecord[]
}

type OutlineVolumeNode = {
  volume: BookVolumeRecord | null
  volumeKey: string
  units: OutlineUnitNode[]
}

function makeUnitFileUrl(filePath: string): string {
  return `/api/book-file?path=${encodeURIComponent(filePath)}`
}

function parseMappedPage(value: string): number | null {
  const n = Math.floor(Number(value.trim()))
  return Number.isFinite(n) && n >= 1 ? n : null
}

function resolveInitialUnitId(
  book: BookRecord,
  library: BookLibraryPayload,
  studentId: string,
  initialUnitId: string | undefined,
  initialPage: number | undefined,
): string {
  const units = book.units ?? []
  if (initialPage != null) {
    const section = resolveStudentSectionAtMappedBookPage(studentId, library, book.id, initialPage)
    if (section?.unitId) return section.unitId
  }
  if (initialUnitId && units.some((u) => u.id === initialUnitId)) return initialUnitId
  return units[0]?.id ?? ''
}

function shortSectionTitle(option: StudentSectionOption | null | undefined): string | null {
  if (!option) return null
  return (
    option.lessonTitle?.trim() ||
    option.partTitle?.trim() ||
    option.title?.trim() ||
    option.unitTitle?.trim() ||
    null
  )
}

function sectionCoversMappedPage(option: StudentSectionOption, mappedPage: number): boolean {
  const start = option.startPageHint
  if (typeof start !== 'number' || !Number.isFinite(start)) return false
  const end =
    typeof option.endPageHint === 'number' && Number.isFinite(option.endPageHint)
      ? option.endPageHint
      : start
  return mappedPage >= start && mappedPage <= end
}

function lessonKey(unitId: string, lessonId: string): string {
  return `lesson:${unitId}:${lessonId}`
}

function unitLeafKey(unitId: string): string {
  return `unit:${unitId}`
}

function volumeKeyForUnit(book: BookRecord, unit: BookUnitRecord, showVolumes: boolean): string | null {
  if (!showVolumes) return null
  if (unit.volumeId?.trim()) return unit.volumeId.trim()
  const volumes = listBookVolumes(book)
  const path = unit.filePath
  const hit = volumes.find((v) => v.filePath === path)
  return hit?.id ?? null
}

function outlineLessonKeyFromSection(section: StudentSectionOption | null | undefined): string | null {
  if (!section) return null
  if (section.lessonId) return lessonKey(section.unitId, section.lessonId)
  if (section.type === 'unit') return unitLeafKey(section.unitId)
  return unitLeafKey(section.unitId)
}

function lessonCoversMappedPage(lesson: BookLessonRecord, mappedPage: number): boolean {
  const start = lesson.startPageHint
  if (typeof start !== 'number' || !Number.isFinite(start)) return false
  const end =
    typeof lesson.endPageHint === 'number' && Number.isFinite(lesson.endPageHint)
      ? lesson.endPageHint
      : start
  return mappedPage >= start && mappedPage <= end
}

function parseOutlineLessonKey(
  key: string | null | undefined,
): { unitId: string; lessonId: string } | null {
  if (!key?.startsWith('lesson:')) return null
  const rest = key.slice('lesson:'.length)
  const sep = rest.indexOf(':')
  if (sep <= 0) return null
  const unitId = rest.slice(0, sep)
  const lessonId = rest.slice(sep + 1)
  if (!unitId || !lessonId) return null
  return { unitId, lessonId }
}

/** PDF pages in `visiblePages` that fall inside a lesson’s mapped page range. */
function pdfPagesForLesson(
  lesson: BookLessonRecord,
  unit: BookUnitRecord,
  book: BookRecord,
  numPages: number | null,
  visiblePages: number[],
): number[] | null {
  if (typeof lesson.startPageHint !== 'number' || !Number.isFinite(lesson.startPageHint)) return null
  const startPdf = resolveMappedPageToPdfPage(lesson.startPageHint, book, unit, numPages)
  if (startPdf == null) return null

  let endMapped: number | null =
    typeof lesson.endPageHint === 'number' && Number.isFinite(lesson.endPageHint)
      ? lesson.endPageHint
      : null
  if (endMapped == null) {
    const lessons = unit.lessons ?? []
    const idx = lessons.findIndex((l) => l.id === lesson.id)
    const next = idx >= 0 ? lessons[idx + 1] : null
    if (next && typeof next.startPageHint === 'number' && next.startPageHint > lesson.startPageHint) {
      endMapped = next.startPageHint - 1
    } else if (typeof unit.endPageHint === 'number' && Number.isFinite(unit.endPageHint)) {
      endMapped = unit.endPageHint
    }
  }

  const endPdf =
    endMapped != null
      ? (resolveMappedPageToPdfPage(endMapped, book, unit, numPages) ?? startPdf)
      : (visiblePages[visiblePages.length - 1] ?? startPdf)
  const lo = Math.min(startPdf, endPdf)
  const hi = Math.max(startPdf, endPdf)
  const filtered = visiblePages.filter((p) => p >= lo && p <= hi)
  return filtered.length > 0 ? filtered : null
}

type PageGridScope = 'lesson' | 'unit'

function buildOutlineTree(book: BookRecord): OutlineVolumeNode[] {
  const volumes = listBookVolumes(book)
  const showVolumes = volumes.length >= 2
  if (!showVolumes) {
    return [
      {
        volume: null,
        volumeKey: '__all__',
        units: (book.units ?? []).map((unit) => ({
          unit,
          lessons: unit.lessons ?? [],
        })),
      },
    ]
  }
  return volumes.map((volume) => ({
    volume,
    volumeKey: volume.id,
    units: unitsForVolume(book, volume.id).map((unit) => ({
      unit,
      lessons: unit.lessons ?? [],
    })),
  }))
}

function pageSpanLabel(
  book: BookRecord,
  unit: BookUnitRecord,
  startHint: number | undefined,
  endHint: number | undefined,
  numPages: number | null,
): string | null {
  if (typeof startHint !== 'number' || !Number.isFinite(startHint)) return null
  const span = formatEffectivePageSpan(startHint, endHint ?? null, book, unit, numPages, 'mapped')
  if (!span || span === 'pages —' || span.startsWith('pages —')) {
    return String(Math.round(startHint))
  }
  return span.replace(/^p\.?\s*/i, '')
}

export interface StudentCurriculumBookPreviewProps {
  book: BookRecord
  library: BookLibraryPayload
  student: StudentProfileView
  pdfReady: boolean
  /** Book / mapped page (not raw PDF index). */
  initialUnitId?: string
  initialPage?: number
  onClose: () => void
  onStartSaved?: () => void
}

export function StudentCurriculumBookPreview({
  book,
  library,
  student,
  pdfReady,
  initialUnitId,
  initialPage,
  onClose,
  onStartSaved,
}: StudentCurriculumBookPreviewProps) {
  const studentId = student.id
  const units = book.units ?? []
  const [unitId, setUnitId] = useState(() =>
    resolveInitialUnitId(book, library, studentId, initialUnitId, initialPage),
  )
  const [pageNumber, setPageNumber] = useState(1)
  const [numPagesByUnit, setNumPagesByUnit] = useState<Record<string, number>>({})
  const [pageInput, setPageInput] = useState('1')
  const [isSavingStart, setIsSavingStart] = useState(false)
  const [gridZoom, setGridZoom] = useState(DEFAULT_GRID_ZOOM)
  const [pageScopePrefer, setPageScopePrefer] = useState<PageGridScope>('lesson')
  const [mounted, setMounted] = useState(false)
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(() => new Set())
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(() => new Set())
  const [localHere, setLocalHere] = useState<LocalHereOverride | null>(null)
  const [pickedPdfPage, setPickedPdfPage] = useState<number | null>(null)
  const outlineScrollRef = useRef<HTMLDivElement | null>(null)
  const jumpedToPlaceRef = useRef(false)
  const seededExpandRef = useRef(false)

  const gridStep = GRID_ZOOM_STEPS[gridZoom] ?? GRID_ZOOM_STEPS[DEFAULT_GRID_ZOOM]!
  const gridLayoutOptions = useMemo<PageGridLayoutOptions>(
    () => ({
      minCols: gridStep.minCols,
      maxCols: gridStep.maxCols,
      targetPageWidthPx: gridStep.targetPageWidthPx,
      gapPx: gridStep.gapPx,
      padPx: gridStep.padPx,
    }),
    [gridStep],
  )
  const initialMappedPageRef = useRef(initialPage)
  const pendingMappedPageRef = useRef<number | undefined>(initialPage)
  const pendingBoundaryNavRef = useRef<'first' | 'last' | null>(null)
  const pendingHerePdfRef = useRef<number | null>(null)

  const outlineTree = useMemo(() => buildOutlineTree(book), [book])
  const showVolumes = outlineTree.length > 1 || outlineTree[0]?.volume != null

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (event.defaultPrevented) return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    initialMappedPageRef.current = initialPage
    if (initialPage != null) {
      const section = resolveStudentSectionAtMappedBookPage(studentId, library, book.id, initialPage)
      if (section?.unitId) {
        setUnitId(section.unitId)
        pendingMappedPageRef.current = initialPage
      }
    }
  }, [initialPage, studentId, library, book.id])

  const sectionOptions = useMemo(
    () => getStudentSectionOptions(studentId, library).filter((o) => o.bookId === book.id),
    [studentId, library, book.id],
  )

  const bookStart: StudentCurriculumBookStart | null = useMemo(() => {
    const starts = resolveCurriculumBookStarts(
      {
        curriculumBookStarts: student.curriculumBookStarts,
        curriculumAnchorSectionId: student.curriculumAnchorSectionId,
        updatedAt: '',
      },
      library,
      sectionOptions,
    )
    return starts[book.id] ?? null
  }, [
    student.curriculumBookStarts,
    student.curriculumAnchorSectionId,
    library,
    sectionOptions,
    book.id,
  ])

  const latestBookmarkSession = useMemo(() => {
    const withBm = (student.scheduledClasses ?? []).filter(
      (s) => s.status === 'completed' && s.bookmarkAtEnd?.bookId === book.id,
    )
    if (!withBm.length) return null
    return (
      [...withBm].sort((a, b) => {
        const tb = Date.parse(b.classEndedAt ?? b.updatedAt ?? b.scheduledFor)
        const ta = Date.parse(a.classEndedAt ?? a.updatedAt ?? a.scheduledFor)
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
      })[0] ?? null
    )
  }, [student.scheduledClasses, book.id])

  const latestBookmark = latestBookmarkSession?.bookmarkAtEnd ?? null

  const startFresherThanStop = useMemo(
    () => isStudentCurriculumBookStartFresherThanLastStop(studentId, book.id, library),
    [studentId, book.id, library, bookStart, latestBookmarkSession],
  )

  const storedPlace = useMemo((): CurrentPlace => {
    const unitForId = (id: string | null | undefined) =>
      id ? book.units.find((u) => u.id === id) ?? null : null

    if (startFresherThanStop && bookStart) {
      const section = sectionOptions.find((o) => o.id === bookStart.sectionId) ?? null
      const unit = unitForId(bookStart.unitId)
      return {
        kind: 'start',
        label: `Start · p. ${bookStart.mappedPage}`,
        sectionTitle: shortSectionTitle(section),
        mappedPage: bookStart.mappedPage,
        pdfPage: null,
        unitId: bookStart.unitId,
        sectionId: bookStart.sectionId,
        lessonId: section?.lessonId ?? null,
        volumeId: volumeKeyForUnit(book, unit ?? { id: bookStart.unitId, title: '', filePath: '' }, showVolumes),
      }
    }
    if (latestBookmark) {
      const bookmarkUnit = latestBookmark.unitId
        ? book.units.find((u) => u.id === latestBookmark.unitId)
        : book.units[0]
      const pageLabel = bookmarkUnit
        ? mapPdfPageToDisplayLabel(latestBookmark.pdfPage, book, bookmarkUnit, null, 'mapped')
        : String(latestBookmark.pdfPage)
      const mapped = parseMappedPage(pageLabel)
      const section =
        mapped != null
          ? resolveStudentSectionAtMappedBookPage(studentId, library, book.id, mapped)
          : null
      const unitIdResolved = latestBookmark.unitId ?? bookmarkUnit?.id ?? null
      const unit = unitForId(unitIdResolved)
      return {
        kind: 'last',
        label: `Last · p. ${pageLabel}`,
        sectionTitle: shortSectionTitle(section),
        mappedPage: mapped,
        pdfPage: latestBookmark.pdfPage,
        unitId: unitIdResolved,
        sectionId: section?.id ?? null,
        lessonId: section?.lessonId ?? null,
        volumeId: unit ? volumeKeyForUnit(book, unit, showVolumes) : null,
      }
    }
    if (bookStart) {
      const section = sectionOptions.find((o) => o.id === bookStart.sectionId) ?? null
      const unit = unitForId(bookStart.unitId)
      return {
        kind: 'start',
        label: `Start · p. ${bookStart.mappedPage}`,
        sectionTitle: shortSectionTitle(section),
        mappedPage: bookStart.mappedPage,
        pdfPage: null,
        unitId: bookStart.unitId,
        sectionId: bookStart.sectionId,
        lessonId: section?.lessonId ?? null,
        volumeId: volumeKeyForUnit(book, unit ?? { id: bookStart.unitId, title: '', filePath: '' }, showVolumes),
      }
    }
    return {
      kind: 'none',
      label: 'No start set',
      sectionTitle: null,
      mappedPage: null,
      pdfPage: null,
      unitId: null,
      sectionId: null,
      lessonId: null,
      volumeId: null,
    }
  }, [
    startFresherThanStop,
    bookStart,
    latestBookmark,
    sectionOptions,
    book,
    studentId,
    library,
    showVolumes,
  ])

  const currentPlace = useMemo((): CurrentPlace => {
    if (!localHere) return storedPlace
    return {
      kind: 'start',
      label: `Start · p. ${localHere.mappedPage}`,
      sectionTitle: localHere.sectionTitle,
      mappedPage: localHere.mappedPage,
      pdfPage: localHere.pdfPage,
      unitId: localHere.unitId,
      sectionId: localHere.sectionId,
      lessonId: localHere.lessonId,
      volumeId: localHere.volumeId,
    }
  }, [localHere, storedPlace])

  const unit = units.find((u) => u.id === unitId) ?? units[0] ?? null
  const numPages = unit ? (numPagesByUnit[unit.id] ?? null) : null
  const fileUrl = unit ? makeUnitFileUrl(unit.filePath) : null

  const bounds = useMemo(
    () => (unit ? getUnitReaderBounds(unit, numPages, book) : { min: 1, max: 1 }),
    [unit, numPages, book],
  )

  const unitVisiblePages = useMemo(
    () => (unit ? getVisiblePdfPages(unit, numPages, book) : []),
    [unit, numPages, book],
  )

  const bookPageTotal = useMemo(() => {
    let max = 0
    for (const o of sectionOptions) {
      const end = o.endPageHint ?? o.startPageHint
      if (typeof end === 'number' && Number.isFinite(end)) {
        max = Math.max(max, Math.floor(end))
      }
    }
    for (const u of units) {
      const pages = numPagesByUnit[u.id]
      if (pages == null || pages < 1) continue
      const label = mapPdfPageToDisplayLabel(pages, book, u, pages, 'mapped')
      const n = parseMappedPage(label)
      if (n != null) max = Math.max(max, n)
      else max = Math.max(max, pages)
    }
    return Math.max(1, max)
  }, [sectionOptions, units, numPagesByUnit, book])

  const mappedInputForPdf = useCallback(
    (pdfPage: number, forUnit = unit) => {
      if (!forUnit || numPages == null) return String(pdfPage)
      const pages = numPagesByUnit[forUnit.id]
      return mapPdfPageToDisplayLabel(pdfPage, book, forUnit, pages ?? numPages, 'mapped')
    },
    [book, unit, numPages, numPagesByUnit],
  )

  const selectedMappedPage = useMemo(() => {
    const fromLabel = parseMappedPage(mappedInputForPdf(pageNumber))
    if (fromLabel != null) return fromLabel
    return parseMappedPage(pageInput)
  }, [mappedInputForPdf, pageNumber, pageInput])

  const activeSection = useMemo(() => {
    if (selectedMappedPage == null) return null
    const covering = sectionOptions.find((o) => sectionCoversMappedPage(o, selectedMappedPage))
    if (covering) return covering
    return resolveStudentSectionAtMappedBookPage(studentId, library, book.id, selectedMappedPage)
  }, [selectedMappedPage, sectionOptions, studentId, library, book.id])

  const activeLessonKey = useMemo(() => {
    if (activeSection) return outlineLessonKeyFromSection(activeSection)
    if (selectedMappedPage == null || !unit) return null
    const lessons = unit.lessons ?? []
    const hit = lessons.find((l) => lessonCoversMappedPage(l, selectedMappedPage))
    if (hit) return lessonKey(unit.id, hit.id)
    if (!lessons.length) return unitLeafKey(unit.id)
    return null
  }, [activeSection, selectedMappedPage, unit])

  const activeLesson = useMemo((): BookLessonRecord | null => {
    const parsed = parseOutlineLessonKey(activeLessonKey)
    if (!parsed || !unit || parsed.unitId !== unit.id) return null
    return unit.lessons?.find((l) => l.id === parsed.lessonId) ?? null
  }, [activeLessonKey, unit])

  const lessonScopedPages = useMemo(() => {
    if (!activeLesson || !unit) return null
    return pdfPagesForLesson(activeLesson, unit, book, numPages, unitVisiblePages)
  }, [activeLesson, unit, book, numPages, unitVisiblePages])

  const canScopeToLesson = lessonScopedPages != null && lessonScopedPages.length > 0

  const pageScope: PageGridScope =
    pageScopePrefer === 'lesson' && canScopeToLesson ? 'lesson' : 'unit'

  const visiblePages = pageScope === 'lesson' && lessonScopedPages ? lessonScopedPages : unitVisiblePages

  const hereLessonKey = useMemo(() => {
    if (currentPlace.kind === 'none') return null
    if (currentPlace.lessonId && currentPlace.unitId) {
      return lessonKey(currentPlace.unitId, currentPlace.lessonId)
    }
    const section = currentPlace.sectionId
      ? sectionOptions.find((o) => o.id === currentPlace.sectionId) ?? null
      : null
    if (section) return outlineLessonKeyFromSection(section)
    if (currentPlace.unitId) {
      const placeUnit = book.units.find((u) => u.id === currentPlace.unitId)
      if (placeUnit && !(placeUnit.lessons?.length)) return unitLeafKey(placeUnit.id)
      if (currentPlace.mappedPage != null && placeUnit?.lessons?.length) {
        const hit = placeUnit.lessons.find((l) => lessonCoversMappedPage(l, currentPlace.mappedPage!))
        if (hit) return lessonKey(placeUnit.id, hit.id)
      }
    }
    return currentPlace.unitId ? unitLeafKey(currentPlace.unitId) : null
  }, [currentPlace, sectionOptions, book.units])

  const herePdfPageInUnit = useMemo(() => {
    if (!unit || currentPlace.kind === 'none') return null
    if (currentPlace.unitId && currentPlace.unitId !== unit.id) return null
    if (currentPlace.pdfPage != null && (!currentPlace.unitId || currentPlace.unitId === unit.id)) {
      return currentPlace.pdfPage
    }
    if (currentPlace.mappedPage == null || numPages == null) return null
    return (
      resolveMappedPageToPdfPage(currentPlace.mappedPage, book, unit, numPages) ??
      currentPlace.mappedPage
    )
  }, [unit, currentPlace, numPages, book])

  const expandPathFor = useCallback(
    (targetUnitId: string | null, targetVolumeId: string | null) => {
      if (!targetUnitId) return
      setExpandedUnits((prev) => {
        const next = new Set(prev)
        next.add(targetUnitId)
        return next
      })
      if (showVolumes) {
        const unitRec = book.units.find((u) => u.id === targetUnitId)
        const volId = targetVolumeId ?? (unitRec ? volumeKeyForUnit(book, unitRec, true) : null)
        if (volId) {
          setExpandedVolumes((prev) => {
            const next = new Set(prev)
            next.add(volId)
            return next
          })
        }
      }
    },
    [book, showVolumes],
  )

  // Seed expand path once from current place (or first unit).
  useEffect(() => {
    if (seededExpandRef.current) return
    seededExpandRef.current = true
    const targetUnit = currentPlace.unitId ?? unitId ?? units[0]?.id ?? null
    const targetVol = currentPlace.volumeId
    expandPathFor(targetUnit, targetVol)
  }, [currentPlace.unitId, currentPlace.volumeId, unitId, units, expandPathFor])

  // Keep selection path expanded as the teacher browses.
  useEffect(() => {
    if (!unitId) return
    const unitRec = units.find((u) => u.id === unitId)
    if (!unitRec) return
    expandPathFor(unitId, volumeKeyForUnit(book, unitRec, showVolumes))
  }, [unitId, activeLessonKey, book, units, showVolumes, expandPathFor])

  const goToPage = useCallback(
    (targetPdf: number) => {
      // Clamp to the full unit, not the lesson-scoped grid — jumps can cross lessons.
      const next = clampPdfPageToVisible(targetPdf, unitVisiblePages, bounds)
      setPageNumber(next)
      setPageInput(mappedInputForPdf(next))
    },
    [unitVisiblePages, bounds, mappedInputForPdf],
  )

  const selectGridPage = useCallback(
    (targetPdf: number) => {
      const next = clampPdfPageToVisible(targetPdf, unitVisiblePages, bounds)
      setPageNumber(next)
      setPageInput(mappedInputForPdf(next))
      setPickedPdfPage(next)
    },
    [unitVisiblePages, bounds, mappedInputForPdf],
  )

  const switchToUnit = useCallback(
    (nextUnitId: string, opts?: { mappedPage?: number; boundary?: 'first' | 'last' }) => {
      pendingMappedPageRef.current = opts?.mappedPage
      pendingBoundaryNavRef.current = opts?.boundary ?? null
      setUnitId(nextUnitId)
      expandPathFor(nextUnitId, null)
    },
    [expandPathFor],
  )

  const goToMappedBookPage = useCallback(
    (mappedPage: number) => {
      const section = resolveStudentSectionAtMappedBookPage(studentId, library, book.id, mappedPage)
      const targetUnitId = section?.unitId ?? unitId
      const targetUnit = units.find((u) => u.id === targetUnitId) ?? unit
      if (!targetUnit) return

      if (targetUnit.id !== unitId) {
        switchToUnit(targetUnit.id, { mappedPage })
        return
      }

      const pages = numPagesByUnit[targetUnit.id] ?? numPages
      if (pages == null) {
        pendingMappedPageRef.current = mappedPage
        return
      }
      const pdf = resolveMappedPageToPdfPage(mappedPage, book, targetUnit, pages) ?? mappedPage
      goToPage(pdf)
    },
    [studentId, library, book, unitId, unit, units, numPagesByUnit, numPages, switchToUnit, goToPage],
  )

  const jumpToPlace = useCallback(() => {
    if (currentPlace.kind === 'none') return
    if (currentPlace.unitId) expandPathFor(currentPlace.unitId, currentPlace.volumeId)
    if (currentPlace.mappedPage != null) {
      goToMappedBookPage(currentPlace.mappedPage)
      return
    }
    if (currentPlace.pdfPage == null) return
    const targetUnitId = currentPlace.unitId ?? unitId
    if (targetUnitId !== unitId) {
      pendingHerePdfRef.current = currentPlace.pdfPage
      switchToUnit(targetUnitId)
      return
    }
    goToPage(currentPlace.pdfPage)
  }, [currentPlace, goToMappedBookPage, unitId, switchToUnit, goToPage, expandPathFor])

  function onDocumentLoadSuccess(meta: { numPages: number }) {
    if (!unit) return
    setNumPagesByUnit((prev) => ({ ...prev, [unit.id]: meta.numPages }))

    const b = getUnitReaderBounds(unit, meta.numPages, book)
    const vis = getVisiblePdfPages(unit, meta.numPages, book)

    let targetPdf: number

    const pendingHerePdf = pendingHerePdfRef.current
    if (pendingHerePdf != null) {
      pendingHerePdfRef.current = null
      targetPdf = pendingHerePdf
    } else {
      const pendingMapped = pendingMappedPageRef.current
      if (pendingMapped != null) {
        pendingMappedPageRef.current = undefined
        targetPdf = resolveMappedPageToPdfPage(pendingMapped, book, unit, meta.numPages) ?? pendingMapped
      } else if (pendingBoundaryNavRef.current === 'first') {
        pendingBoundaryNavRef.current = null
        targetPdf = vis[0] ?? b.min
      } else if (pendingBoundaryNavRef.current === 'last') {
        pendingBoundaryNavRef.current = null
        targetPdf = vis[vis.length - 1] ?? b.max
      } else {
        const mappedStart = initialMappedPageRef.current
        if (mappedStart != null) {
          targetPdf = resolveMappedPageToPdfPage(mappedStart, book, unit, meta.numPages) ?? mappedStart
          initialMappedPageRef.current = undefined
        } else {
          const resume = getStudentTeachingOpenPdfPageForBookUnit(
            studentId,
            book.id,
            unit.id,
            library,
            meta.numPages,
          )
          targetPdf = resume ?? b.min
        }
      }
    }

    const clamped = clampPdfPageToVisible(targetPdf, vis, b)
    setPageNumber(clamped)
    setPageInput(mapPdfPageToDisplayLabel(clamped, book, unit, meta.numPages, 'mapped'))
  }

  useEffect(() => {
    if (jumpedToPlaceRef.current) return
    if (numPages == null) return
    if (currentPlace.kind === 'none') {
      jumpedToPlaceRef.current = true
      return
    }
    jumpedToPlaceRef.current = true
    jumpToPlace()
  }, [numPages, currentPlace.kind, jumpToPlace])

  useEffect(() => {
    const root = outlineScrollRef.current
    if (!root) return
    const here = root.querySelector<HTMLElement>('[data-outline-here="true"]')
    const active = root.querySelector<HTMLElement>('[data-outline-active="true"]')
    ;(here ?? active)?.scrollIntoView({ block: 'nearest' })
  }, [hereLessonKey, activeLessonKey, expandedUnits, expandedVolumes])

  function commitPageInput() {
    const parsed = parseMappedPage(pageInput)
    if (parsed == null) {
      setPageInput(mappedInputForPdf(pageNumber))
      return
    }
    goToMappedBookPage(parsed)
  }

  function mappedCandidatesForSave(): number[] {
    const out: number[] = []
    const add = (n: number | null) => {
      if (n != null && !out.includes(n)) out.push(n)
    }
    const label = mappedInputForPdf(pageNumber)
    if (label !== '·') add(parseMappedPage(label))
    add(parseMappedPage(pageInput))
    return out
  }

  const pickedIsHere =
    pickedPdfPage != null &&
    herePdfPageInUnit != null &&
    pickedPdfPage === herePdfPageInUnit &&
    (currentPlace.unitId == null || currentPlace.unitId === unitId)

  const pickedMappedLabel =
    pickedPdfPage != null ? mappedInputForPdf(pickedPdfPage) : mappedInputForPdf(pageNumber)

  async function saveAsStart() {
    if (!unit) return
    const candidates = mappedCandidatesForSave()
    if (!candidates.length) {
      toast.error('This page is not in the lesson map. Try another page from the outline.')
      return
    }

    setIsSavingStart(true)
    try {
      let section = null
      let mappedPage: number | null = null
      for (const candidate of candidates) {
        section = resolveStudentSectionAtMappedBookPage(studentId, library, book.id, candidate)
        if (section) {
          mappedPage = candidate
          break
        }
      }
      if (!section || mappedPage == null) {
        toast.error('No lesson matches this page. Try another page from the outline.')
        return
      }
      const pdfForHere = pickedPdfPage ?? pageNumber
      const result = updateStudentCurriculumBookStart(
        studentId,
        { bookId: book.id, sectionId: section.id, mappedPage, pdfPage: pdfForHere },
        library,
      )
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setLocalHere({
        mappedPage,
        pdfPage: pdfForHere,
        unitId: unit.id,
        sectionId: section.id,
        lessonId: section.lessonId ?? null,
        volumeId: volumeKeyForUnit(book, unit, showVolumes),
        sectionTitle: shortSectionTitle(section),
      })
      setPickedPdfPage(null)
      toast.success(`Opens here next time · p. ${mappedPage}`)
      onStartSaved?.()
    } finally {
      setIsSavingStart(false)
    }
  }

  function toggleVolume(volumeKey: string) {
    setExpandedVolumes((prev) => {
      const next = new Set(prev)
      if (next.has(volumeKey)) next.delete(volumeKey)
      else next.add(volumeKey)
      return next
    })
  }

  function toggleUnit(nextUnitId: string) {
    setExpandedUnits((prev) => {
      const next = new Set(prev)
      if (next.has(nextUnitId)) next.delete(nextUnitId)
      else next.add(nextUnitId)
      return next
    })
  }

  function jumpToUnitStart(target: BookUnitRecord) {
    expandPathFor(target.id, volumeKeyForUnit(book, target, showVolumes))
    setPageScopePrefer('unit')
    if (typeof target.startPageHint === 'number' && target.startPageHint >= 1) {
      goToMappedBookPage(target.startPageHint)
      return
    }
    if (target.id !== unitId) {
      switchToUnit(target.id, { boundary: 'first' })
      return
    }
    if (unitVisiblePages.length) goToPage(unitVisiblePages[0]!)
  }

  function jumpToLesson(targetUnit: BookUnitRecord, lesson: BookLessonRecord) {
    expandPathFor(targetUnit.id, volumeKeyForUnit(book, targetUnit, showVolumes))
    setPageScopePrefer('lesson')
    const start =
      typeof lesson.startPageHint === 'number' && lesson.startPageHint >= 1
        ? lesson.startPageHint
        : typeof targetUnit.startPageHint === 'number' && targetUnit.startPageHint >= 1
          ? targetUnit.startPageHint
          : null
    if (start != null) {
      goToMappedBookPage(start)
      return
    }
    jumpToUnitStart(targetUnit)
  }

  function onVolumeRowClick(node: OutlineVolumeNode) {
    const key = node.volumeKey
    const wasOpen = expandedVolumes.has(key)
    toggleVolume(key)
    const firstUnit = node.units[0]?.unit
    if (!wasOpen && firstUnit) jumpToUnitStart(firstUnit)
  }

  function onUnitRowClick(node: OutlineUnitNode) {
    const hasLessons = node.lessons.length > 0
    const wasOpen = expandedUnits.has(node.unit.id)
    if (hasLessons) {
      toggleUnit(node.unit.id)
      if (!wasOpen) jumpToUnitStart(node.unit)
      return
    }
    jumpToUnitStart(node.unit)
  }

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex bg-[#1c1c1f] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Choose start page for ${book.title}`}
    >
      <aside
        className="flex shrink-0 flex-col border-r border-white/10 bg-[#161618]"
        style={{ width: LEFT_RAIL_WIDTH_PX }}
      >
        <div className="flex shrink-0 items-start gap-2 border-b border-white/10 px-3 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 h-8 w-8 shrink-0 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tracking-tight text-white">Set start</p>
            <p className="mt-0.5 truncate text-[12px] text-white/45" title={book.title}>
              {book.title}
            </p>
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-b border-white/10 px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">Where we are</p>
          {currentPlace.kind === 'none' ? (
            <p className="rounded-xl bg-white/5 px-3 py-2.5 text-[13px] text-white/45">No start set</p>
          ) : (
            <button
              type="button"
              onClick={jumpToPlace}
              className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-left transition hover:bg-white/10"
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex h-2 w-2 shrink-0 rounded-full',
                    currentPlace.kind === 'start' ? 'bg-sky-400' : 'bg-emerald-400',
                  )}
                  aria-hidden
                />
                <span className="text-[13px] font-semibold tracking-tight text-white">
                  {currentPlace.label}
                </span>
              </span>
              {currentPlace.sectionTitle ? (
                <span className="mt-1 block truncate pl-4 text-[12px] text-white/45">
                  {currentPlace.sectionTitle}
                </span>
              ) : null}
              <span className="mt-1 block pl-4 text-[11px] text-white/35">Tap to jump</span>
            </button>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Input
              type="number"
              min={1}
              max={bookPageTotal}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitPageInput()
                }
              }}
              onBlur={commitPageInput}
              className="h-9 w-20 border-0 bg-white/10 px-2 text-center text-sm tabular-nums text-white shadow-none"
              aria-label="Book page number"
            />
            <span className="text-[13px] tabular-nums text-white/45">/ {bookPageTotal}</span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
          <p className="mb-2 shrink-0 text-[11px] font-medium uppercase tracking-wide text-white/40">
            Outline
          </p>
          <div
            ref={outlineScrollRef}
            className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5"
          >
            {outlineTree.every((g) => g.units.length === 0) ? (
              <p className="px-1 py-4 text-[12px] text-white/45">No outline for this book yet.</p>
            ) : (
              outlineTree.map((volumeNode) => {
                const volumeOpen = !showVolumes || expandedVolumes.has(volumeNode.volumeKey)
                return (
                  <div key={volumeNode.volumeKey} className="space-y-0.5">
                    {showVolumes && volumeNode.volume ? (
                      <button
                        type="button"
                        onClick={() => onVolumeRowClick(volumeNode)}
                        className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left text-[13px] font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                        aria-expanded={volumeOpen}
                      >
                        <ChevronRight
                          className={cn(
                            'h-3.5 w-3.5 shrink-0 text-white/40 transition-transform',
                            volumeOpen && 'rotate-90',
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">{volumeNode.volume.title}</span>
                      </button>
                    ) : null}

                    {volumeOpen
                      ? volumeNode.units.map((unitNode) => {
                          const hasLessons = unitNode.lessons.length > 0
                          const unitOpen = hasLessons ? expandedUnits.has(unitNode.unit.id) : false
                          const unitLeafId = unitLeafKey(unitNode.unit.id)
                          const unitIsActive = !hasLessons && activeLessonKey === unitLeafId
                          const unitIsHere = !hasLessons && hereLessonKey === unitLeafId
                          const unitBadge = pageSpanLabel(
                            book,
                            unitNode.unit,
                            unitNode.unit.startPageHint,
                            unitNode.unit.endPageHint,
                            numPagesByUnit[unitNode.unit.id] ?? null,
                          )
                          return (
                            <div key={unitNode.unit.id} className={cn(showVolumes && 'ml-2')}>
                              <button
                                type="button"
                                onClick={() => onUnitRowClick(unitNode)}
                                data-outline-active={unitIsActive ? 'true' : undefined}
                                data-outline-here={unitIsHere ? 'true' : undefined}
                                className={cn(
                                  'flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left text-[13px] leading-snug transition-colors',
                                  unitIsActive
                                    ? 'bg-white/15 font-medium text-white'
                                    : 'text-white/65 hover:bg-white/10 hover:text-white',
                                )}
                                aria-expanded={hasLessons ? unitOpen : undefined}
                              >
                                {hasLessons ? (
                                  <ChevronRight
                                    className={cn(
                                      'h-3.5 w-3.5 shrink-0 text-white/40 transition-transform',
                                      unitOpen && 'rotate-90',
                                    )}
                                    aria-hidden
                                  />
                                ) : unitIsHere ? (
                                  <span
                                    className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                                    aria-hidden
                                  />
                                ) : (
                                  <span className="inline-flex h-3.5 w-3.5 shrink-0" aria-hidden />
                                )}
                                <span className="min-w-0 flex-1 break-words whitespace-normal">
                                  {unitNode.unit.title?.trim() || 'Unit'}
                                </span>
                                {unitBadge ? (
                                  <span className="shrink-0 text-[10px] font-medium tabular-nums text-white/45">
                                    {unitBadge}
                                  </span>
                                ) : null}
                              </button>

                              {hasLessons && unitOpen ? (
                                <ul className="ml-4 space-y-0.5 border-l border-white/10 pl-2">
                                  {unitNode.lessons.map((lesson) => {
                                    const key = lessonKey(unitNode.unit.id, lesson.id)
                                    const isActive = activeLessonKey === key
                                    const isHere = hereLessonKey === key
                                    const badge = pageSpanLabel(
                                      book,
                                      unitNode.unit,
                                      lesson.startPageHint,
                                      lesson.endPageHint,
                                      numPagesByUnit[unitNode.unit.id] ?? null,
                                    )
                                    return (
                                      <li key={lesson.id}>
                                        <button
                                          type="button"
                                          data-outline-active={isActive ? 'true' : undefined}
                                          data-outline-here={isHere ? 'true' : undefined}
                                          onClick={() => jumpToLesson(unitNode.unit, lesson)}
                                          className={cn(
                                            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] leading-snug transition-colors',
                                            isActive
                                              ? 'bg-white/15 font-medium text-white'
                                              : 'text-white/55 hover:bg-white/10 hover:text-white',
                                          )}
                                        >
                                          {isHere ? (
                                            <span
                                              className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                                              title="Current place"
                                              aria-hidden
                                            />
                                          ) : (
                                            <span className="inline-flex h-1.5 w-1.5 shrink-0" aria-hidden />
                                          )}
                                          <span className="min-w-0 flex-1 break-words whitespace-normal">
                                            {lesson.title?.trim() || 'Lesson'}
                                          </span>
                                          {badge ? (
                                            <span className="shrink-0 text-[10px] font-medium tabular-nums text-white/40">
                                              {badge}
                                            </span>
                                          ) : null}
                                        </button>
                                      </li>
                                    )
                                  })}
                                </ul>
                              ) : null}
                            </div>
                          )
                        })
                      : null}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-white/10 px-3 py-3">
          <p className="px-0.5 text-[11px] leading-snug text-white/40">
            Tap a page on the right, then set it as the current place.
          </p>
          <Button
            type="button"
            className="h-10 w-full rounded-full"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </aside>

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#1c1c1f] text-white">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white">Pages</p>
            <p className="truncate text-[12px] text-white/45">
              {pageScope === 'lesson' && activeLesson
                ? activeLesson.title?.trim() || 'Lesson'
                : unit?.title?.trim() || 'Unit'}
              {` · ${visiblePages.length} pages`}
              {' · Tap a page to mark the place'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canScopeToLesson ? (
              <div
                className="flex items-center rounded-full bg-white/10 p-0.5"
                role="group"
                aria-label="Page range"
              >
                <button
                  type="button"
                  onClick={() => setPageScopePrefer('lesson')}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-medium transition',
                    pageScope === 'lesson'
                      ? 'bg-white/20 text-white'
                      : 'text-white/50 hover:text-white/80',
                  )}
                  aria-pressed={pageScope === 'lesson'}
                >
                  Lesson
                </button>
                <button
                  type="button"
                  onClick={() => setPageScopePrefer('unit')}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-medium transition',
                    pageScope === 'unit'
                      ? 'bg-white/20 text-white'
                      : 'text-white/50 hover:text-white/80',
                  )}
                  aria-pressed={pageScope === 'unit'}
                >
                  Unit
                </button>
              </div>
            ) : null}
            <div className="flex items-center rounded-full bg-white/10 p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-35"
                disabled={gridZoom <= 0}
                onClick={() => setGridZoom((z) => Math.max(0, z - 1))}
                aria-label="Show more pages"
                title="Smaller pages"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-35"
                disabled={gridZoom >= GRID_ZOOM_STEPS.length - 1}
                onClick={() => setGridZoom((z) => Math.min(GRID_ZOOM_STEPS.length - 1, z + 1))}
                aria-label="Show fewer pages"
                title="Larger pages"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          {!pdfReady ? (
            <p className="px-4 py-16 text-center text-[13px] text-white/55">Loading…</p>
          ) : !unit || !fileUrl ? (
            <p className="px-4 py-16 text-center text-[13px] text-white/55">No pages for this book.</p>
          ) : numPages == null ? (
            <p className="px-4 py-16 text-center text-[13px] text-white/55">Opening…</p>
          ) : (
            <PageGridStage
              pageNumbers={visiblePages}
              activeLeftPage={pickedPdfPage ?? pageNumber}
              activeRightPage={null}
              herePage={herePdfPageInUnit}
              fileUrl={fileUrl}
              unitId={unit.id}
              pdfReady={pdfReady}
              pageAspectRatio={DEFAULT_PAGE_ASPECT_RATIO}
              selectedBook={book}
              selectedUnit={unit}
              numPages={numPages}
              numberingMode="mapped"
              onSelectPage={selectGridPage}
              layoutOptions={gridLayoutOptions}
              thumbRenderWidth={gridStep.thumbRenderWidth}
              compactTiles
              className="absolute inset-0"
            />
          )}

          {fileUrl && unit ? (
            <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
              <PdfDocument
                key={`${book.id}-${unit.id}`}
                file={fileUrl}
                options={PDF_DOCUMENT_OPTIONS}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={null}
                error={null}
              />
            </div>
          ) : null}

          {pickedPdfPage != null ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-4">
              <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl border border-white/15 bg-[#161618]/95 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white">
                    {pickedIsHere ? 'Already the current place' : `Use page ${pickedMappedLabel}?`}
                  </p>
                  <p className="truncate text-[11px] text-white/45">
                    {pickedIsHere
                      ? 'Pick another page to move where the book opens.'
                      : 'Opens here next time in prep or class.'}
                  </p>
                </div>
                {pickedIsHere ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 shrink-0 rounded-full px-3 text-white/70 hover:bg-white/10 hover:text-white"
                    onClick={() => setPickedPdfPage(null)}
                  >
                    Dismiss
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 shrink-0 rounded-full px-3 text-white/70 hover:bg-white/10 hover:text-white"
                      onClick={() => setPickedPdfPage(null)}
                      disabled={isSavingStart}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 shrink-0 rounded-full px-4"
                      disabled={isSavingStart || !unit || numPages == null}
                      onClick={() => void saveAsStart()}
                    >
                      {isSavingStart ? 'Saving…' : 'Set as start'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>,
    document.body,
  )
}
