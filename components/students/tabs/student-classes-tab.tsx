'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronDown, ChevronLeft, ChevronRight, Eye, Pencil } from 'lucide-react'
import { ClassPrepExtrasPanel, formatTargetWordsLine } from '@/components/students/class-prep-extras-panel'
import { ClassPrepVocabEditor } from '@/components/students/class-prep-vocab-editor'
import { ReadingCheckPrepareGlanceLink } from '@/components/books/reading-check-prepare-glance-link'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StudentCardLessonPreview } from '@/components/students/student-card-lesson-preview'
import {
  classEntryActionLabel,
  formatClassCountdown,
  resolveClassEntryAction,
} from '@/lib/students/class-schedule-lifecycle'
import {
  formatEffectivePageSpan,
  mapPdfPageToDisplayLabel,
  resolveAlignedAnchorPage,
  type PageNumberingMode,
} from '@/lib/books/page-numbering'
import { getVisiblePdfPages } from '@/lib/books/page-range'
import { getPdfTotalPages } from '@/lib/books/pdf-thumbnail-cache'
import type { BookLibraryPayload } from '@/lib/books/types'
import { fetchBooksLibraryCached } from '@/lib/books/fetch-books-library-cached'
import { ensureStudentRecordsHydrated } from '@/lib/local-data/student-records-client'
import { getSavedWordsForStudent } from '@/lib/local-data/saved-words-disk-client'
import {
  buildStudentMapReaderHref,
  buildPrepareLessonMapHref,
  buildStudentClassPrepContext,
  getStudentSectionOptions,
  getStudentProfileView,
  getStudentTeachingOpenPdfPageForBookUnit,
  recordStudentClassOutcome,
  resolveNextSectionForClass,
  transitionStudentClassStatus,
  updateStudentClassSelectedSection,
  updateStudentClassPrep,
  updateStudentCurriculumBookStart,
  getStudentCurriculumBookStart,
  startStudentClassSession,
  STUDENT_LOCAL_DATA_CHANGED_EVENT,
  getNextClassResumeHeadline,
  getLastStoppedCarryLine,
  dismissPostClassRecapPrompt,
  updateStudentClassEndNote,
  updateStudentClassSessionNote,
  toStudentBookSectionRef,
} from '@/lib/students/selectors'
import type { StudentClassSessionView, StudentProfileView } from '@/lib/students/types'
import type { StudentClassStatus } from '@/lib/types'
import type { BookContextRecord, LessonContextRecord, UnitContextRecord } from '@/lib/context/types'
import {
  prepBlocksFromAiSuggestion,
  type ClassPrepOutlineViewMode,
  type ClassPrepTimeBlock,
} from '@/lib/students/class-prep-outline'
import { hasPrepExtras, prepExtrasFromAiSuggestion } from '@/lib/students/class-prep-extras'
import { formatPrepContextLine } from '@/lib/students/class-prep-signals'

interface StudentClassesTabProps {
  student: StudentProfileView
  onUpdated: () => void
  bookLibrary?: BookLibraryPayload | null
  libraryLoading?: boolean
}

type WordsForm = {
  introducedWords: string
  practicedWords: string
  reviewedWords: string
  learnedWords: string
  teacherNotes: string
}

function formatSectionPageRange(start?: number, end?: number): string {
  if (!start && !end) return 'p —'
  if (start && end && end > start) return `p${start}-${end}`
  return `p${start ?? end}`
}

function splitWords(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function prettyDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type SectionOption = NonNullable<ReturnType<typeof getStudentSectionOptions>[number]>

function isVocabularyPartSection(selected: SectionOption | null | undefined): boolean {
  if (!selected?.partId?.trim()) return false
  const tag = selected.partStructureTag
  return tag === 'vocabulary_in_context' || tag === 'vocabulary_background'
}

function statusPillClass(status: StudentClassSessionView['status']): string {
  if (status === 'completed') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
  if (status === 'prepared') return 'border-blue-500/30 bg-blue-500/10 text-blue-700'
  if (status === 'in_progress') return 'border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-100'
  if (status === 'cancelled') return 'border-red-500/30 bg-red-500/10 text-red-700'
  if (status === 'missed') return 'border-rose-500/35 bg-rose-500/10 text-rose-800'
  return 'border-[var(--border)] bg-[var(--surface-2)] text-muted-foreground'
}

export function StudentClassesTab({
  student,
  onUpdated,
  bookLibrary: bookLibraryFromParent,
  libraryLoading: libraryLoadingFromParent,
}: StudentClassesTabProps) {
  const router = useRouter()
  const numberingMode: PageNumberingMode = 'mapped'
  const liveStudent = useMemo(() => getStudentProfileView(student.id) ?? student, [student])
  const sessions = useMemo(
    () =>
      [...(liveStudent.scheduledClasses ?? [])].sort(
        (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
      ),
    [liveStudent.scheduledClasses],
  )
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null)

  const nextUpcomingClass =
    sessions.find((s) => {
      if (
        s.status === 'completed' ||
        s.status === 'cancelled' ||
        s.status === 'missed' ||
        s.status === 'in_progress'
      ) {
        return false
      }
      const ms = new Date(s.scheduledFor).getTime()
      return Number.isFinite(ms) && ms >= nowMs
    }) ?? null

  /** Live class preferred for default prep/preview focus. */
  const spotlightSession = useMemo(
    () => sessions.find((s) => s.status === 'in_progress') ?? nextUpcomingClass,
    [sessions, nextUpcomingClass],
  )

  const upcomingSessions = useMemo(
    () =>
      sessions.filter(
        (s) => s.status !== 'completed' && s.status !== 'missed',
      ),
    [sessions],
  )

  const pastSessions = useMemo(
    () =>
      [...sessions]
        .filter((s) => s.status === 'completed' || s.status === 'missed')
        .sort((a, b) => {
          const ta = new Date(a.classEndedAt ?? a.updatedAt ?? a.scheduledFor).getTime()
          const tb = new Date(b.classEndedAt ?? b.updatedAt ?? b.scheduledFor).getTime()
          return tb - ta
        }),
    [sessions],
  )

  const previewSession = useMemo(
    () => (previewSessionId ? sessions.find((s) => s.id === previewSessionId) ?? null : null),
    [previewSessionId, sessions],
  )
  const focusSession = previewSession ?? spotlightSession

  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
  const [startBusySessionId, setStartBusySessionId] = useState<string | null>(null)

  const refreshClassData = useCallback(() => {
    onUpdated()
  }, [onUpdated])

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onFocus = () => {
      setNowMs(Date.now())
      refreshClassData()
    }
    const onStudentDataChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ studentId?: string }>).detail
      if (!detail?.studentId || detail.studentId === liveStudent.id) refreshClassData()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, onStudentDataChanged)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus()
    })
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, onStudentDataChanged)
    }
  }, [refreshClassData, liveStudent.id])
  const [aiBusyId, setAiBusyId] = useState<string | null>(null)
  const [openOutcomeFor, setOpenOutcomeFor] = useState<string | null>(null)
  const [outcomes, setOutcomes] = useState<Record<string, WordsForm>>({})
  const [prepNotesBySession, setPrepNotesBySession] = useState<Record<string, string>>({})
  const [prepBlocksBySession, setPrepBlocksBySession] = useState<Record<string, ClassPrepTimeBlock[]>>({})
  const [selectedSectionBySession, setSelectedSectionBySession] = useState<Record<string, string>>({})
  const [editingTeachingSessionId, setEditingTeachingSessionId] = useState<string | null>(null)
  const [teachingEditDraftId, setTeachingEditDraftId] = useState('')
  const [previewStartBySession, setPreviewStartBySession] = useState<Record<string, number>>({})
  const [previewNumPagesBySession, setPreviewNumPagesBySession] = useState<Record<string, number>>({})
  const [outlineViewModeBySession, setOutlineViewModeBySession] = useState<Record<string, ClassPrepOutlineViewMode>>({})
  const usesParentLibrary = bookLibraryFromParent !== undefined
  const [localLibrary, setLocalLibrary] = useState<BookLibraryPayload | null>(bookLibraryFromParent ?? null)
  const library = usesParentLibrary ? (bookLibraryFromParent ?? null) : localLibrary

  const previewSpread = useMemo(() => {
    if (!previewSession) return null
    const options = getStudentSectionOptions(liveStudent.id, library)
    const selectedId = selectedSectionBySession[previewSession.id]
    const selected = options.find((option) => option.id === selectedId)
    const selectedBook = library?.books.find((book) => book.id === selected?.bookId)
    const selectedUnit = selectedBook?.units.find((unit) => unit.id === selected?.unitId)
    const previewFilePath = selectedUnit?.filePath ?? null
    const numPages = previewNumPagesBySession[previewSession.id] ?? null
    const previewPages =
      selectedBook && selectedUnit ? getVisiblePdfPages(selectedUnit, numPages, selectedBook) : []
    const mappedStartHint = resolveAlignedAnchorPage(
      selected?.startPageHint,
      selectedBook,
      selectedUnit,
      numPages,
      numberingMode,
    )
    const anchorBase = Math.max(1, mappedStartHint ?? selected?.startPageHint ?? 1)
    const rawSessionStart = previewStartBySession[previewSession.id]
    const sessionStartInVisible = rawSessionStart != null && previewPages.includes(rawSessionStart)
    const spreadStart = sessionStartInVisible
      ? rawSessionStart
      : previewPages.length > 0
        ? (previewPages.find((p) => p >= anchorBase) ?? previewPages[0] ?? anchorBase)
        : anchorBase
    const leftIndex = previewPages.length ? Math.max(0, previewPages.indexOf(spreadStart)) : 0
    const leftPage = previewPages[leftIndex] ?? spreadStart
    const rightPage = previewPages[leftIndex + 1] ?? leftPage + 1
    const canGoBack = previewPages.length ? leftIndex > 0 : leftPage > 1
    const canGoForward = previewPages.length ? leftIndex + 2 < previewPages.length : true
    const leftLabel = mapPdfPageToDisplayLabel(
      leftPage,
      selectedBook,
      selectedUnit,
      numPages,
      numberingMode,
    )
    const rightLabel = mapPdfPageToDisplayLabel(
      rightPage,
      selectedBook,
      selectedUnit,
      numPages,
      numberingMode,
    )
    return {
      sessionId: previewSession.id,
      selected,
      selectedBook: selectedBook ?? null,
      selectedUnit: selectedUnit ?? null,
      unitId: selected?.unitId ?? null,
      previewFilePath,
      previewPages,
      numPages,
      leftIndex,
      leftPage,
      rightPage,
      spreadStart,
      canGoBack,
      canGoForward,
      leftLabel,
      rightLabel,
    }
  }, [
    previewSession,
    liveStudent.id,
    library,
    selectedSectionBySession,
    previewNumPagesBySession,
    previewStartBySession,
    numberingMode,
  ])

  const turnPreviewSpread = useCallback(
    (direction: -1 | 1) => {
      if (!previewSpread?.selected) return
      const { sessionId, previewPages, leftIndex, leftPage, spreadStart, canGoBack, canGoForward } =
        previewSpread
      if (direction < 0 && !canGoBack) return
      if (direction > 0 && !canGoForward) return
      setPreviewStartBySession((prev) => ({
        ...prev,
        [sessionId]:
          previewPages.length > 0
            ? direction < 0
              ? (previewPages[Math.max(0, leftIndex - 2)] ?? leftPage)
              : (previewPages[Math.min(previewPages.length - 1, leftIndex + 2)] ?? leftPage)
            : direction < 0
              ? Math.max(1, (prev[sessionId] ?? spreadStart) - 2)
              : (prev[sessionId] ?? leftPage) + 2,
      }))
    },
    [previewSpread],
  )

  const jumpPreviewToPage = useCallback(
    (raw: string) => {
      if (!previewSpread?.selected) return
      const match = raw.trim().match(/^(\d+)/)
      if (!match) return
      const typed = parseInt(match[1]!, 10)
      if (!Number.isFinite(typed) || typed < 1) return

      const { sessionId, previewPages, selectedBook, selectedUnit, numPages } = previewSpread
      let targetPdf =
        resolveAlignedAnchorPage(typed, selectedBook, selectedUnit, numPages, numberingMode) ?? typed

      if (previewPages.length > 0) {
        const exact = previewPages.indexOf(targetPdf)
        if (exact >= 0) {
          targetPdf = previewPages[exact - (exact % 2)] ?? targetPdf
        } else {
          const nearest =
            previewPages.find((p) => p >= targetPdf) ?? previewPages[previewPages.length - 1]!
          const idx = previewPages.indexOf(nearest)
          targetPdf = previewPages[Math.max(0, idx - (idx % 2))] ?? nearest
        }
      } else {
        targetPdf = Math.max(1, targetPdf - ((targetPdf - 1) % 2))
      }

      setPreviewStartBySession((prev) =>
        prev[sessionId] === targetPdf ? prev : { ...prev, [sessionId]: targetPdf },
      )
    },
    [previewSpread, numberingMode],
  )

  const [previewJumpDraft, setPreviewJumpDraft] = useState('')
  const [previewJumpFocused, setPreviewJumpFocused] = useState(false)

  useEffect(() => {
    if (!previewSpread || previewJumpFocused) return
    setPreviewJumpDraft(
      previewSpread.leftLabel === '·' ? String(previewSpread.leftPage) : previewSpread.leftLabel,
    )
  }, [previewSpread, previewJumpFocused])

  useEffect(() => {
    if (!previewSession) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        turnPreviewSpread(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        turnPreviewSpread(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewSession, turnPreviewSpread])

  useEffect(() => {
    const nextBlocks: Record<string, ClassPrepTimeBlock[]> = {}
    const nextNotes: Record<string, string> = {}
    for (const session of sessions) {
      nextBlocks[session.id] = session.prepTimeBlocks ?? []
      nextNotes[session.id] = session.prepNotes ?? ''
    }
    setPrepBlocksBySession(nextBlocks)
    setPrepNotesBySession(nextNotes)
  }, [sessions])

  const nextClassResumeHeadline = useMemo(
    () =>
      focusSession
        ? getNextClassResumeHeadline(liveStudent.id, focusSession.id, library)
        : null,
    [liveStudent.id, focusSession, library],
  )

  const spotlightPrepContextLine = useMemo(() => {
    if (!focusSession) return null
    const ctx = buildStudentClassPrepContext(liveStudent.id, focusSession.id, library, null, {
      savedWordEntries: getSavedWordsForStudent(liveStudent.id),
    })
    if ('error' in ctx) return null
    return formatPrepContextLine({
      readingPosition: ctx.readingPosition,
      vocabSignals: ctx.vocabSignals,
      namedRecurringIssues: ctx.namedRecurringIssues,
      prepContextMode: ctx.prepContextMode,
      prepContextFlags: ctx.prepContextFlags,
    })
  }, [liveStudent.id, focusSession, library, sessions, selectedSectionBySession])

  const [error, setError] = useState<string | null>(null)
  const [unitContextBySession, setUnitContextBySession] = useState<Record<string, UnitContextRecord | null>>({})
  const [lessonContextBySession, setLessonContextBySession] = useState<Record<string, LessonContextRecord | null>>({})
  const [bookContextBySession, setBookContextBySession] = useState<Record<string, BookContextRecord | null>>({})
  const [recapOpenFor, setRecapOpenFor] = useState<string | null>(null)
  const [recapDraft, setRecapDraft] = useState('')
  const [sessionNoteOpenFor, setSessionNoteOpenFor] = useState<string | null>(null)
  const [sessionNoteDraft, setSessionNoteDraft] = useState('')

  /** When focused class or its chosen section id changes, re-seed preview start. */
  const previewSyncRef = useRef<{ sessionId: string; sectionId: string } | null>(null)

  useEffect(() => {
    if (usesParentLibrary) return
    let active = true
    async function loadBooks() {
      try {
        const payload = await fetchBooksLibraryCached()
        if (!active) return
        setLocalLibrary(payload)
      } catch {
        // Keep prep usable even when library metadata is unavailable.
      }
    }
    void loadBooks()
    return () => {
      active = false
    }
  }, [usesParentLibrary])

  useEffect(() => {
    if (!focusSession) return
    void loadSavedContext(focusSession)
  }, [focusSession, selectedSectionBySession, sessions])

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const session of sessions) {
      const fallback = resolveNextSectionForClass(liveStudent.id, session.id, library)
      const selected = session.selectedSection?.id ?? fallback?.id
      if (selected) next[session.id] = selected
    }
    setSelectedSectionBySession((prev) => {
      const merged = { ...prev, ...next }
      const prevKeys = Object.keys(prev)
      const mergedKeys = Object.keys(merged)
      if (prevKeys.length === mergedKeys.length && prevKeys.every((key) => prev[key] === merged[key])) {
        return prev
      }
      return merged
    })
  }, [liveStudent.id, sessions, library])

  useEffect(() => {
    if (!focusSession) return
    const options = getStudentSectionOptions(liveStudent.id, library)
    const selectedId = selectedSectionBySession[focusSession.id] ?? ''
    const selected = options.find((option) => option.id === selectedId)
    const selectedBook = library?.books.find((book) => book.id === selected?.bookId)
    const selectedUnit = selectedBook?.units.find((unit) => unit.id === selected?.unitId)
    const rawStart = selected?.startPageHint ?? 1
    let sectionStart = rawStart
    if (selectedBook && selectedUnit) {
      sectionStart =
        resolveAlignedAnchorPage(rawStart, selectedBook, selectedUnit, null, numberingMode) ?? rawStart
    }
    const teachingPage =
      selected != null
        ? getStudentTeachingOpenPdfPageForBookUnit(
            liveStudent.id,
            selected.bookId,
            selected.unitId,
            library,
          )
        : null
    const startPage = teachingPage ?? sectionStart
    const bookStartUpdatedAt =
      selected != null
        ? (liveStudent.curriculumBookStarts?.[selected.bookId]?.updatedAt ?? '')
        : ''
    const syncKey = `${selectedId}::${bookStartUpdatedAt}`
    const prevSync = previewSyncRef.current
    if (
      !prevSync ||
      prevSync.sessionId !== focusSession.id ||
      prevSync.sectionId !== syncKey
    ) {
      previewSyncRef.current = { sessionId: focusSession.id, sectionId: syncKey }
      setPreviewStartBySession((prev) => ({ ...prev, [focusSession.id]: startPage }))
    }
  }, [
    focusSession,
    liveStudent.id,
    liveStudent.curriculumBookStarts,
    library,
    selectedSectionBySession,
  ])

  useEffect(() => {
    if (!focusSession) return
    const options = getStudentSectionOptions(liveStudent.id, library)
    const selectedId = selectedSectionBySession[focusSession.id]
    const selected = options.find((option) => option.id === selectedId)
    const selectedBook = library?.books.find((book) => book.id === selected?.bookId)
    const selectedUnit = selectedBook?.units.find((unit) => unit.id === selected?.unitId)
    if (!selectedUnit || !selected) return
    let cancelled = false
    const fileUrl = `/api/book-file?path=${encodeURIComponent(selectedUnit.filePath)}`
    void getPdfTotalPages(fileUrl)
      .then((numPages) => {
        if (cancelled) return
        setPreviewNumPagesBySession((prev) =>
          prev[focusSession.id] === numPages ? prev : { ...prev, [focusSession.id]: numPages },
        )
        const sessionId = focusSession.id
        const previewPages = selectedBook
          ? getVisiblePdfPages(selectedUnit, numPages, selectedBook)
          : getVisiblePdfPages(selectedUnit, numPages, undefined)
        const teachingPage = getStudentTeachingOpenPdfPageForBookUnit(
          liveStudent.id,
          selected.bookId,
          selected.unitId,
          library,
          numPages,
        )
        const sectionAnchor =
          selectedBook != null
            ? Math.max(
                1,
                resolveAlignedAnchorPage(
                  selected.startPageHint,
                  selectedBook,
                  selectedUnit,
                  numPages,
                  numberingMode,
                ) ?? selected.startPageHint ?? 1,
              )
            : 1
        const anchor = teachingPage ?? sectionAnchor
        const target =
          previewPages.length > 0
            ? (previewPages.find((p) => p >= anchor) ?? previewPages[0] ?? anchor)
            : anchor
        setPreviewStartBySession((prev) =>
          prev[sessionId] === target ? prev : { ...prev, [sessionId]: target },
        )
      })
      .catch(() => {
        // Keep graceful fallback when preview metadata fails.
      })
    return () => {
      cancelled = true
    }
  }, [
    focusSession,
    liveStudent.id,
    liveStudent.curriculumBookStarts,
    library,
    selectedSectionBySession,
  ])

  function setSessionStatus(sessionId: string, status: StudentClassStatus) {
    setStatusBusyId(sessionId)
    const result = transitionStudentClassStatus(liveStudent.id, sessionId, status)
    setStatusBusyId(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onUpdated()
  }

  function savePrepNotes(session: StudentClassSessionView) {
    const sectionOptions = getStudentSectionOptions(liveStudent.id, library)
    const sectionId = selectedSectionBySession[session.id]
    const chosenSection = sectionOptions.find((option) => option.id === sectionId)
    const sectionResult = updateStudentClassSelectedSection(
      liveStudent.id,
      session.id,
      chosenSection ? toStudentBookSectionRef(chosenSection) : null,
    )
    if (!sectionResult.ok) {
      setError(sectionResult.error)
      return
    }
    const result = updateStudentClassPrep(liveStudent.id, session.id, {
      prepNotes: prepNotesBySession[session.id] ?? '',
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    onUpdated()
    toast.success('Notes saved.')
  }

  function savePrepOutline(session: StudentClassSessionView) {
    const sectionOptions = getStudentSectionOptions(liveStudent.id, library)
    const sectionId = selectedSectionBySession[session.id]
    const chosenSection = sectionOptions.find((option) => option.id === sectionId)
    const sectionResult = updateStudentClassSelectedSection(
      liveStudent.id,
      session.id,
      chosenSection ? toStudentBookSectionRef(chosenSection) : null,
    )
    if (!sectionResult.ok) {
      setError(sectionResult.error)
      return
    }
    const result = updateStudentClassPrep(liveStudent.id, session.id, {
      prepTimeBlocks: prepBlocksBySession[session.id] ?? [],
      prepOutlineSummary: session.prepOutlineSummary,
      prepNotes: prepNotesBySession[session.id] ?? session.prepNotes ?? '',
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    onUpdated()
    toast.success('Outline saved.')
  }

  async function askAiForClassPrep(session: StudentClassSessionView) {
    setError(null)
    setAiBusyId(session.id)
    try {
      const sectionOptions = getStudentSectionOptions(liveStudent.id, library)
      const sectionId = selectedSectionBySession[session.id]
      const chosenSection = sectionOptions.find((option) => option.id === sectionId)
      if (chosenSection) {
        const updateSection = updateStudentClassSelectedSection(
          liveStudent.id,
          session.id,
          toStudentBookSectionRef(chosenSection),
        )
        if (!updateSection.ok) {
          setError(updateSection.error)
          return
        }
      }
      let bookContextForPrep = bookContextBySession[session.id] ?? null
      if (!bookContextForPrep && chosenSection?.bookId) {
        try {
          const bookRes = await fetch(`/api/context/get?bookId=${encodeURIComponent(chosenSection.bookId)}`)
          const bookPayload = (await bookRes.json()) as { ok: boolean; bookRecord?: BookContextRecord | null }
          if (bookRes.ok && bookPayload.ok) {
            bookContextForPrep = bookPayload.bookRecord ?? null
            setBookContextBySession((prev) => ({ ...prev, [session.id]: bookContextForPrep }))
          }
        } catch {
          // Keep prep generation resilient even when book-context lookup fails.
        }
      }
      let partSectionVocabulary: string[] | undefined
      if (chosenSection?.partId && chosenSection.lessonId) {
        try {
          const partQuery = new URLSearchParams({
            bookId: chosenSection.bookId,
            unitId: chosenSection.unitId,
            lessonId: chosenSection.lessonId,
            partId: chosenSection.partId,
          })
          const partRes = await fetch(`/api/context/get?${partQuery.toString()}`)
          const partPayload = (await partRes.json()) as {
            ok?: boolean
            context?: { interactiveVocabulary?: Array<{ word?: string }> } | null
          }
          if (partRes.ok && partPayload.ok && partPayload.context?.interactiveVocabulary?.length) {
            partSectionVocabulary = partPayload.context.interactiveVocabulary
              .map((row) => (typeof row.word === 'string' ? row.word.trim() : ''))
              .filter(Boolean)
          }
        } catch {
          // Part vocabulary is optional; keep prep generation resilient.
        }
      }
      const prepContext = buildStudentClassPrepContext(
        liveStudent.id,
        session.id,
        library,
        bookContextForPrep,
        {
          savedWordEntries: getSavedWordsForStudent(liveStudent.id),
          partSectionVocabulary,
        },
      )
      if ('error' in prepContext) {
        setError(prepContext.error)
        return
      }
      const res = await fetch('/api/classes/prep-suggestion', {
        // Build prep context from student class history to keep AI prompts consistent.
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prepContext),
      })
      const payload = (await res.json()) as
        | {
            ok: true
            suggestion: {
              priorities: string[]
              activities: string[]
              timeBlocks: Array<{
                label: string
                minutes: number
                objective: string
                activityType: string
                teacherMoves?: string[]
                studentOutput?: string
                checkForUnderstanding?: string
              }>
              checkpointMoments: string[]
              differentiationTips: string[]
              homeworkOrCarryOver: string[]
              wordsToRevisit: Array<{ word: string; reason: string }>
              summary: string
            }
          }
        | { ok: false; error?: string }
      if (!res.ok || !payload.ok) {
        setError(payload.ok ? 'Failed to generate class prep suggestion.' : (payload.error ?? 'AI request failed.'))
        return
      }
      const blocks = prepBlocksFromAiSuggestion(payload.suggestion.timeBlocks, session.durationMin)
      const extras = prepExtrasFromAiSuggestion(payload.suggestion)
      const revisitWords = extras.prepWordsToRevisit?.map((row) => row.word) ?? []
      setPrepBlocksBySession((prev) => ({ ...prev, [session.id]: blocks }))
      const saveResult = updateStudentClassPrep(liveStudent.id, session.id, {
        prepTimeBlocks: blocks,
        prepOutlineSummary: payload.suggestion.summary.trim() || undefined,
        ...extras,
        plannedVocabulary:
          session.plannedVocabulary.length === 0 && revisitWords.length > 0 ? revisitWords : undefined,
      })
      if (!saveResult.ok) {
        setError(saveResult.error)
        return
      }
      onUpdated()
      toast.success('Outline generated.')
    } catch {
      setError('Failed to generate class prep suggestion.')
    } finally {
      setAiBusyId(null)
    }
  }

  async function loadSavedContext(session: StudentClassSessionView) {
    const options = getStudentSectionOptions(liveStudent.id, library)
    const selectedId = selectedSectionBySession[session.id]
    const selected = options.find((option) => option.id === selectedId) ?? session.selectedSection
    if (!selected) return
    try {
      const res = await fetch(
        `/api/context/get?bookId=${encodeURIComponent(selected.bookId)}&unitId=${encodeURIComponent(selected.unitId)}`,
      )
      const payload = (await res.json()) as {
        ok: boolean
        unit?: UnitContextRecord | null
        lessons?: LessonContextRecord[]
      }
      if (!res.ok || !payload.ok) return
      const lessonId = selected.lessonId ?? selected.id
      const lesson = (payload.lessons ?? []).find((row) => row.lessonId === lessonId) ?? null
      setUnitContextBySession((prev) => ({ ...prev, [session.id]: payload.unit ?? null }))
      setLessonContextBySession((prev) => ({ ...prev, [session.id]: lesson }))
      const bookRes = await fetch(`/api/context/get?bookId=${encodeURIComponent(selected.bookId)}`)
      const bookPayload = (await bookRes.json()) as {
        ok: boolean
        bookRecord?: BookContextRecord | null
      }
      setBookContextBySession((prev) => ({
        ...prev,
        [session.id]: bookRes.ok && bookPayload.ok ? (bookPayload.bookRecord ?? null) : null,
      }))
    } catch {
      // ignore background sync failures
    }
  }

  function saveOutcome(sessionId: string) {
    const form = outcomes[sessionId] ?? {
      introducedWords: '',
      practicedWords: '',
      reviewedWords: '',
      learnedWords: '',
      teacherNotes: '',
    }
    const result = recordStudentClassOutcome(liveStudent.id, sessionId, {
      introducedWords: splitWords(form.introducedWords),
      practicedWords: splitWords(form.practicedWords),
      reviewedWords: splitWords(form.reviewedWords),
      learnedWords: splitWords(form.learnedWords),
      teacherNotes: form.teacherNotes,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setOpenOutcomeFor(null)
    onUpdated()
  }

  function openPrepRoom(sessionId: string) {
    router.push(buildPrepareLessonMapHref(liveStudent.id, sessionId, library))
  }

  async function goToClassMap(sessionId: string) {
    setStartBusySessionId(sessionId)
    try {
      await ensureStudentRecordsHydrated()

      const profile = getStudentProfileView(liveStudent.id)
      const row = profile?.scheduledClasses.find((s) => s.id === sessionId)
      if (!row) {
        const msg = 'Class not found. Refresh the page and try again.'
        setError(msg)
        toast.error(msg)
        return
      }
      if (row.status === 'completed' || row.status === 'cancelled') {
        const msg = 'This class is already finished. Refresh to see your next class.'
        setError(msg)
        toast.error(msg)
        refreshClassData()
        return
      }

      const sectionOptions = getStudentSectionOptions(liveStudent.id, library)
      const sectionId = selectedSectionBySession[sessionId] ?? row.selectedSection?.id ?? ''
      const chosenSection = sectionOptions.find((option) => option.id === sectionId)
      if (chosenSection) {
        const sectionResult = updateStudentClassSelectedSection(
          liveStudent.id,
          sessionId,
          toStudentBookSectionRef(chosenSection),
        )
        if (!sectionResult.ok) {
          setError(sectionResult.error)
          toast.error(sectionResult.error)
          return
        }
      }

      if (row.status !== 'in_progress') {
        const started = startStudentClassSession(liveStudent.id, sessionId)
        if (!started.ok) {
          setError(started.error)
          toast.error(started.error)
          return
        }
        refreshClassData()
      }
      router.push(
        buildStudentMapReaderHref({
          studentId: liveStudent.id,
          classSessionId: sessionId,
          openBook: false,
          bookId: chosenSection?.bookId ?? row.selectedSection?.bookId,
          unitId: chosenSection?.unitId ?? row.selectedSection?.unitId,
        }),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start class.'
      setError(msg)
      toast.error(msg)
    } finally {
      setStartBusySessionId(null)
    }
  }

  function openTeachingEditor(session: StudentClassSessionView) {
    const selectedId = selectedSectionBySession[session.id] ?? session.selectedSection?.id ?? ''
    setTeachingEditDraftId(selectedId)
    setEditingTeachingSessionId(session.id)
  }

  function saveTeachingSelection() {
    const sessionId = editingTeachingSessionId
    if (!sessionId) return
    const options = getStudentSectionOptions(liveStudent.id, library)
    const chosen = teachingEditDraftId
      ? (options.find((option) => option.id === teachingEditDraftId) ?? null)
      : null
    const sectionResult = updateStudentClassSelectedSection(
      liveStudent.id,
      sessionId,
      chosen ? toStudentBookSectionRef(chosen) : null,
    )
    if (!sectionResult.ok) {
      setError(sectionResult.error)
      toast.error(sectionResult.error)
      return
    }
    if (chosen) {
      const existingStart = getStudentCurriculumBookStart(liveStudent.id, chosen.bookId, library)
      let mappedPage: number | null = null
      if (existingStart?.sectionId === chosen.id && existingStart.mappedPage >= 1) {
        mappedPage = existingStart.mappedPage
      } else if (typeof chosen.startPageHint === 'number' && chosen.startPageHint >= 1) {
        mappedPage = Math.floor(chosen.startPageHint)
      } else if (existingStart && existingStart.mappedPage >= 1) {
        mappedPage = existingStart.mappedPage
      }
      const startResult = updateStudentCurriculumBookStart(
        liveStudent.id,
        {
          bookId: chosen.bookId,
          sectionId: chosen.id,
          mappedPage,
          syncSpotlight: false,
        },
        library,
      )
      if (!startResult.ok) {
        setError(startResult.error)
        toast.error(startResult.error)
        return
      }
    }
    setSelectedSectionBySession((prev) => ({
      ...prev,
      [sessionId]: chosen?.id ?? '',
    }))
    setEditingTeachingSessionId(null)
    onUpdated()
    toast.success(chosen ? 'Today’s lesson updated.' : 'Cleared today’s lesson.')
  }

  function renderSectionPicker(session: StudentClassSessionView) {
    const options = getStudentSectionOptions(liveStudent.id, library)
    const selectedId = selectedSectionBySession[session.id] ?? session.selectedSection?.id ?? ''
    const selected = options.find((option) => option.id === selectedId)
    const selectedBook = library?.books.find((book) => book.id === selected?.bookId)
    const selectedUnit = selectedBook?.units.find((unit) => unit.id === selected?.unitId)
    const teachingPdf =
      selected != null
        ? getStudentTeachingOpenPdfPageForBookUnit(
            liveStudent.id,
            selected.bookId,
            selected.unitId,
            library,
          )
        : null
    const pageSource =
      teachingPdf ??
      (selectedBook && selectedUnit
        ? resolveAlignedAnchorPage(
            selected?.startPageHint,
            selectedBook,
            selectedUnit,
            null,
            numberingMode,
          )
        : null) ??
      selected?.startPageHint ??
      null
    const pageLabel =
      pageSource != null && selectedBook && selectedUnit
        ? mapPdfPageToDisplayLabel(pageSource, selectedBook, selectedUnit, null, numberingMode)
        : pageSource != null
          ? String(pageSource)
          : null
    const pieceTitle = selected
      ? (selected.partTitle ?? selected.lessonTitle ?? selected.title).trim()
      : ''
    const primaryLine = selected
      ? [selected.bookTitle, selected.unitTitle, pieceTitle].filter(Boolean).join(' · ')
      : 'Not set yet'
    const lastLine =
      selected && library
        ? getLastStoppedCarryLine(
            liveStudent.id,
            session.id,
            library,
            selected.bookId,
            selected.unitId,
          )
        : null

    return (
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            What we’re teaching
          </label>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground"
            onClick={() => openTeachingEditor(session)}
            aria-label="Edit what we’re teaching"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-background px-3 py-2.5">
          <p className="text-sm font-medium leading-snug text-foreground">{primaryLine}</p>
          {pageLabel ? (
            <p className="mt-0.5 text-xs text-muted-foreground">Open at p. {pageLabel}</p>
          ) : null}
          {lastLine ? <p className="mt-1 text-xs text-muted-foreground">{lastLine}</p> : null}
          {!selected ? (
            <p className="mt-1 text-xs text-muted-foreground">Tap edit to pick today’s book section.</p>
          ) : null}
        </div>
      </div>
    )
  }

  function renderPrepNotes(session: StudentClassSessionView) {
    return (
      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Note to self</label>
        <textarea
          className="min-h-[56px] w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
          value={prepNotesBySession[session.id] ?? session.prepNotes ?? ''}
          onChange={(e) =>
            setPrepNotesBySession((prev) => ({
              ...prev,
              [session.id]: e.target.value,
            }))
          }
          placeholder="Quick reminder for this class…"
        />
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => savePrepNotes(session)}>
          Save note
        </Button>
      </div>
    )
  }

  function renderMorePrepDetails(session: StudentClassSessionView) {
    const options = getStudentSectionOptions(liveStudent.id, library)
    const selectedId = selectedSectionBySession[session.id] ?? session.selectedSection?.id ?? ''
    const selected = options.find((option) => option.id === selectedId)
    const unitContext = unitContextBySession[session.id]
    const lessonContext = lessonContextBySession[session.id]
    return (
      <div className="space-y-3">
        {isVocabularyPartSection(selected) &&
        selected?.bookId &&
        selected?.unitId &&
        selected?.lessonId &&
        selected?.partId ? (
          <div className="rounded-lg border border-[var(--border)] bg-background p-3">
            <p className="text-xs font-semibold text-foreground">Interactive vocabulary</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Words saved here load in the book reader for this part.
            </p>
            <div className="mt-3">
              <ClassPrepVocabEditor
                bookId={selected.bookId}
                unitId={selected.unitId}
                lessonId={selected.lessonId}
                partId={selected.partId}
                partTitle={selected.partTitle}
                sectionPath={selected.pathLabel}
                startPageHint={selected.startPageHint}
                endPageHint={selected.endPageHint}
              />
            </div>
          </div>
        ) : null}
        {unitContext || lessonContext ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-[var(--border)] bg-background p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Unit context</p>
              <p className="mt-1 text-xs text-foreground">{unitContext?.theme ?? 'Not scanned yet.'}</p>
              {unitContext?.bigIdeas?.length ? (
                <p className="mt-1 text-xs text-muted-foreground">{unitContext.bigIdeas.slice(0, 2).join(' | ')}</p>
              ) : null}
            </div>
            <div className="rounded border border-[var(--border)] bg-background p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lesson context</p>
              <p className="mt-1 text-xs text-foreground">
                {lessonContext
                  ? lessonContext.comprehensionSkill + ' · ' + lessonContext.strategy
                  : 'Not scanned yet.'}
              </p>
              {lessonContext?.essentialQuestions?.length ? (
                <p className="mt-1 text-xs text-muted-foreground">{lessonContext.essentialQuestions[0]}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Curriculum context loads from the book when a section is selected.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="ui-section space-y-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Upcoming lessons
            {upcomingSessions.length > 0 ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({upcomingSessions.length})
              </span>
            ) : null}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Prepare ahead · Enter in the last 20 minutes · Preview glances at pages
          </p>
        </div>
        {error ? <p className="text-sm text-[var(--brand-red)]">{error}</p> : null}
        {upcomingSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming class yet — book one on the calendar.</p>
        ) : (
          <ul className="divide-y divide-border/80 rounded-xl border border-border/80 bg-background">
            {upcomingSessions.map((session, index) => {
              const entry = resolveClassEntryAction(session, nowMs)
              const countdown = formatClassCountdown(session.scheduledFor, nowMs)
              const entryLabel = classEntryActionLabel(entry)
              const statusLabel =
                session.status === 'in_progress'
                  ? 'Live'
                  : session.status === 'prepared'
                    ? 'Prepared'
                    : session.status === 'cancelled'
                      ? 'Cancelled'
                      : 'Not started'
              const sectionTitle = session.selectedSection?.title?.trim() || session.title
              const glanceSectionId =
                selectedSectionBySession[session.id] ?? session.selectedSection?.id ?? ''
              const glanceSection =
                (library
                  ? getStudentSectionOptions(liveStudent.id, library).find((o) => o.id === glanceSectionId)
                  : null) ?? session.selectedSection
              return (
                <li
                  key={session.id}
                  className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-0.5 w-7 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                        {sectionTitle}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Lesson · {statusLabel} · {prettyDateTime(session.scheduledFor)} ·{' '}
                        {session.durationMin}min
                      </p>
                      {glanceSection?.bookId && glanceSection?.unitId ? (
                        <ReadingCheckPrepareGlanceLink
                          bookId={glanceSection.bookId}
                          unitId={glanceSection.unitId}
                          lessonId={glanceSection.lessonId}
                          partId={glanceSection.partId}
                          studentId={liveStudent.id}
                          classSessionId={session.id}
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => setPreviewSessionId(session.id)}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      Preview
                    </Button>
                    {(session.status === 'planned' || session.status === 'prepared') &&
                    entry !== 'prepare' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openPrepRoom(session.id)}
                      >
                        Prepare
                      </Button>
                    ) : null}
                    {entry === 'prepare' ? (
                      <div className="flex min-w-[5.5rem] flex-col items-center gap-0.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="w-full min-w-[5.5rem] bg-emerald-500/15 text-emerald-900 hover:bg-emerald-500/25"
                          onClick={() => openPrepRoom(session.id)}
                        >
                          Prepare
                        </Button>
                        {countdown ? (
                          <span className="text-[11px] tabular-nums text-muted-foreground">{countdown}</span>
                        ) : null}
                      </div>
                    ) : null}
                    {entry === 'enter' || entry === 'continue' ? (
                      <div className="flex min-w-[5.5rem] flex-col items-center gap-0.5">
                        <Button
                          type="button"
                          size="sm"
                          className="w-full min-w-[5.5rem] bg-emerald-600 text-white hover:bg-emerald-700"
                          disabled={startBusySessionId === session.id}
                          onClick={() => void goToClassMap(session.id)}
                        >
                          {startBusySessionId === session.id ? '…' : entryLabel}
                        </Button>
                        {countdown ? (
                          <span className="text-[11px] tabular-nums text-muted-foreground">{countdown}</span>
                        ) : entry === 'continue' ? (
                          <span className="text-[11px] text-muted-foreground">Live</span>
                        ) : null}
                      </div>
                    ) : null}
                    {session.status === 'cancelled' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={statusBusyId === session.id}
                        onClick={() => setSessionStatus(session.id, 'planned')}
                      >
                        Reopen
                      </Button>
                    ) : session.status !== 'in_progress' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={statusBusyId === session.id || session.status === 'completed'}
                        onClick={() => setSessionStatus(session.id, 'cancelled')}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <Collapsible className="ui-section group">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Ended lessons
              {pastSessions.length > 0 ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">({pastSessions.length})</span>
              ) : null}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Newest first — notes, bookmark, word lists</p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
        {pastSessions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No completed classes yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pastSessions.map((session) => (
              <Collapsible key={session.id} className="group/past rounded-lg">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/past:rotate-180" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{session.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {session.classEndedAt
                          ? `Ended ${prettyDateTime(session.classEndedAt)}`
                          : `Scheduled ${prettyDateTime(session.scheduledFor)}`}{' '}
                        · {session.durationMin} min
                      </p>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 border-t border-[var(--border)] px-3 py-3 text-xs md:text-sm">
                    {!session.classEndNote?.trim() && session.postClassRecapPromptDismissed !== true ? (
                      <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-950">
                        <p className="font-medium text-foreground">Optional: add a one-line recap for next time</p>
                        {recapOpenFor === session.id ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              className="min-h-[70px] w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm text-foreground"
                              placeholder="What helped, what to repeat next class…"
                              value={recapDraft}
                              onChange={(e) => setRecapDraft(e.target.value)}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  const r = updateStudentClassEndNote(liveStudent.id, session.id, recapDraft)
                                  if (!r.ok) {
                                    setError(r.error)
                                    return
                                  }
                                  setRecapOpenFor(null)
                                  setRecapDraft('')
                                  onUpdated()
                                }}
                              >
                                Save recap
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setRecapOpenFor(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="secondary" onClick={() => setRecapOpenFor(session.id)}>
                              Add note
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const r = dismissPostClassRecapPrompt(liveStudent.id, session.id)
                                if (!r.ok) setError(r.error)
                                else onUpdated()
                              }}
                            >
                              Not now
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : null}
                    {session.classStartedAt ? (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Started:</span> {prettyDateTime(session.classStartedAt)}
                      </p>
                    ) : null}
                    {session.classEndNote ? (
                      <p>
                        <span className="font-medium text-foreground">Recap:</span> {session.classEndNote}
                      </p>
                    ) : null}
                    {session.readingCheckWrapLine ? (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Reading checks:</span>{' '}
                        {session.readingCheckWrapLine.replace(/^Checks:\s*/i, '')}
                      </p>
                    ) : null}
                    {session.sessionNote && sessionNoteOpenFor !== session.id ? (
                      <div className="rounded-md border border-[var(--border)]/80 bg-background/50 p-2">
                        <p className="font-medium text-foreground">Session log</p>
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{session.sessionNote}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="mt-2 h-7 px-2 text-xs"
                          onClick={() => {
                            setSessionNoteOpenFor(session.id)
                            setSessionNoteDraft(session.sessionNote ?? '')
                          }}
                        >
                          Edit session log
                        </Button>
                      </div>
                    ) : null}
                    {sessionNoteOpenFor === session.id ? (
                      <div className="space-y-2 rounded-md border border-[var(--border)] bg-background/50 p-2">
                        <p className="font-medium text-foreground">
                          {session.sessionNote ? 'Edit session log' : 'Session log'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          What you did this call (pages, activities), carry-over, plan for next time.
                        </p>
                        <textarea
                          className="min-h-[120px] w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm text-foreground"
                          placeholder="e.g. Read pp. 12–18; student struggled with past tense — drill next time."
                          value={sessionNoteDraft}
                          onChange={(e) => setSessionNoteDraft(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const r = updateStudentClassSessionNote(liveStudent.id, session.id, sessionNoteDraft)
                              if (!r.ok) {
                                setError(r.error)
                                return
                              }
                              setSessionNoteOpenFor(null)
                              setSessionNoteDraft('')
                              onUpdated()
                            }}
                          >
                            Save session log
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSessionNoteOpenFor(null)
                              setSessionNoteDraft('')
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : !session.sessionNote && sessionNoteOpenFor !== session.id ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setSessionNoteOpenFor(session.id)
                          setSessionNoteDraft('')
                        }}
                      >
                        Add session log
                      </Button>
                    ) : null}
                    {session.bookmarkAtEnd ? (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Bookmark:</span> book {session.bookmarkAtEnd.bookId}
                        {session.bookmarkAtEnd.unitId ? ` · unit ${session.bookmarkAtEnd.unitId}` : ''}
                        {(() => {
                          const bm = session.bookmarkAtEnd
                          const b = library?.books.find((bk) => bk.id === bm.bookId)
                          const u =
                            bm.unitId?.trim() && b
                              ? b.units.find((un) => un.id === bm.unitId)
                              : b?.units[0]
                          if (!b || !u || !Number.isFinite(bm.pdfPage)) {
                            return <> · PDF p{bm.pdfPage}</>
                          }
                          const label = mapPdfPageToDisplayLabel(Math.floor(bm.pdfPage), b, u, null, numberingMode)
                          return <> · pp. {label}</>
                        })()}
                      </p>
                    ) : null}
                    {session.selectedSection?.title ? (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Section:</span> {session.selectedSection.title}
                        {(() => {
                          const opt =
                            library && session.selectedSection?.id
                              ? getStudentSectionOptions(liveStudent.id, library).find((o) => o.id === session.selectedSection?.id)
                              : undefined
                          const book = opt ? library?.books.find((b) => b.id === opt.bookId) : undefined
                          const unit = book && opt ? book.units.find((u) => u.id === opt.unitId) : undefined
                          const pages =
                            opt && book && unit && typeof opt.startPageHint === 'number'
                              ? formatEffectivePageSpan(
                                  opt.startPageHint,
                                  opt.endPageHint ?? null,
                                  book,
                                  unit,
                                  null,
                                  numberingMode,
                                )
                              : null
                          if (!pages || pages === 'pages —' || pages.startsWith('pages —')) return null
                          return <> · {pages}</>
                        })()}
                      </p>
                    ) : null}
                    {session.teacherNotes ? (
                      <p>
                        <span className="font-medium text-foreground">Teacher notes:</span> {session.teacherNotes}
                      </p>
                    ) : null}
                    <div className="grid gap-1 sm:grid-cols-2">
                      {session.introducedWords?.length ? (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Introduced:</span>{' '}
                          {session.introducedWords.join(', ')}
                        </p>
                      ) : null}
                      {session.practicedWords?.length ? (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Practiced:</span> {session.practicedWords.join(', ')}
                        </p>
                      ) : null}
                      {session.reviewedWords?.length ? (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Reviewed:</span> {session.reviewedWords.join(', ')}
                        </p>
                      ) : null}
                      {session.learnedWords?.length ? (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Learned:</span> {session.learnedWords.join(', ')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
        </CollapsibleContent>
      </Collapsible>

      <Dialog
        open={previewSession != null}
        onOpenChange={(open) => {
          if (!open) setPreviewSessionId(null)
        }}
      >
        <DialogContent
          className={
            'gap-0 overflow-hidden border-0 bg-[#1a1714] p-0 text-white ' +
            'sm:max-w-4xl ' +
            '[&_[data-slot=dialog-close]]:right-3 [&_[data-slot=dialog-close]]:top-3 ' +
            '[&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:bg-black/40 ' +
            '[&_[data-slot=dialog-close]]:p-1.5 [&_[data-slot=dialog-close]]:text-white ' +
            '[&_[data-slot=dialog-close]]:opacity-90 [&_[data-slot=dialog-close]]:hover:bg-black/55 ' +
            '[&_[data-slot=dialog-close]]:hover:opacity-100 [&_[data-slot=dialog-close]]:focus:ring-white/40'
          }
        >
          <DialogTitle className="sr-only">Page preview</DialogTitle>
          <DialogDescription className="sr-only">Lesson page preview</DialogDescription>
          <div className="relative h-[min(70vh,560px)] w-full">
            {previewSpread?.previewFilePath && previewSpread.selected && previewSpread.unitId ? (
              <>
                <div className="grid h-full grid-cols-2">
                  <button
                    type="button"
                    className="relative h-full min-w-0 border-0 bg-transparent p-0 text-left"
                    aria-label="Previous pages"
                    disabled={!previewSpread.canGoBack}
                    onClick={() => turnPreviewSpread(-1)}
                  >
                    <StudentCardLessonPreview
                      filePath={previewSpread.previewFilePath}
                      unitId={previewSpread.unitId}
                      page={previewSpread.leftPage}
                      label={`Page ${previewSpread.leftLabel}`}
                      fitHeight
                      objectFit="contain"
                      className="pointer-events-none absolute inset-0 h-full w-full rounded-none border-0 bg-[#2a241c] shadow-none"
                    />
                  </button>
                  <button
                    type="button"
                    className="relative h-full min-w-0 border-0 bg-transparent p-0 text-left"
                    aria-label="Next pages"
                    disabled={!previewSpread.canGoForward}
                    onClick={() => turnPreviewSpread(1)}
                  >
                    <StudentCardLessonPreview
                      filePath={previewSpread.previewFilePath}
                      unitId={previewSpread.unitId}
                      page={previewSpread.rightPage}
                      label={`Page ${previewSpread.rightLabel}`}
                      fitHeight
                      objectFit="contain"
                      className="pointer-events-none absolute inset-0 h-full w-full rounded-none border-0 bg-[#2a241c] shadow-none"
                    />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Previous pages"
                  disabled={!previewSpread.canGoBack}
                  onClick={() => turnPreviewSpread(-1)}
                  className="absolute top-1/2 left-2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md transition enabled:hover:bg-black/60 disabled:pointer-events-none disabled:opacity-25"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Next pages"
                  disabled={!previewSpread.canGoForward}
                  onClick={() => turnPreviewSpread(1)}
                  className="absolute top-1/2 right-2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md transition enabled:hover:bg-black/60 disabled:pointer-events-none disabled:opacity-25"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
                <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium tabular-nums text-white/95 shadow-md">
                  <span className="pl-1 text-white/70">p</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Go to page"
                    value={previewJumpDraft}
                    onFocus={() => setPreviewJumpFocused(true)}
                    onChange={(e) => setPreviewJumpDraft(e.target.value)}
                    onBlur={() => {
                      setPreviewJumpFocused(false)
                      jumpPreviewToPage(previewJumpDraft)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        jumpPreviewToPage(previewJumpDraft)
                        ;(e.target as HTMLInputElement).blur()
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        setPreviewJumpDraft(
                          previewSpread.leftLabel === '·'
                            ? String(previewSpread.leftPage)
                            : previewSpread.leftLabel,
                        )
                        ;(e.target as HTMLInputElement).blur()
                      }
                    }}
                    className="h-6 w-12 rounded-md border-0 bg-white/15 px-1.5 text-center text-xs font-medium tabular-nums text-white outline-none ring-0 placeholder:text-white/40 focus:bg-white/25"
                  />
                  <span className="pr-1 text-white/70">–{previewSpread.rightLabel}</span>
                </div>
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center px-6 text-center">
                <p className="text-sm text-white/70">Set a teaching section first</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingTeachingSessionId != null}
        onOpenChange={(open) => {
          if (!open) setEditingTeachingSessionId(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>What we’re teaching</DialogTitle>
            <DialogDescription>
              Pick the book section for this class. Prepare and Enter will use this.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="teaching-section-pick">
              Lesson piece
            </label>
            <select
              id="teaching-section-pick"
              className="w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
              value={teachingEditDraftId}
              onChange={(e) => setTeachingEditDraftId(e.target.value)}
            >
              <option value="">Not set</option>
              {(() => {
                const options = getStudentSectionOptions(liveStudent.id, library)
                const groups: Array<{ bookId: string; bookTitle: string; options: typeof options }> = []
                for (const option of options) {
                  const last = groups[groups.length - 1]
                  if (last && last.bookId === option.bookId) {
                    last.options.push(option)
                  } else {
                    groups.push({
                      bookId: option.bookId,
                      bookTitle: option.bookTitle || 'Book',
                      options: [option],
                    })
                  }
                }
                return groups.map((group) => (
                  <optgroup key={group.bookId} label={group.bookTitle}>
                    {group.options.map((option) => {
                      const b = library?.books.find((bk) => bk.id === option.bookId)
                      const u = b?.units.find((un) => un.id === option.unitId)
                      const span =
                        b && u && typeof option.startPageHint === 'number'
                          ? formatEffectivePageSpan(
                              option.startPageHint,
                              option.endPageHint ?? null,
                              b,
                              u,
                              null,
                              numberingMode,
                            )
                          : ''
                      const pageSuffix =
                        span && span !== 'pages —' && !span.startsWith('pages —') ? ` · ${span}` : ''
                      const withinBookLabel =
                        option.type === 'unit'
                          ? option.unitTitle || option.title
                          : option.type === 'lesson'
                            ? [option.unitTitle, option.lessonTitle || option.title].filter(Boolean).join(' / ')
                            : [option.unitTitle, option.lessonTitle, option.partTitle || option.title]
                                .filter(Boolean)
                                .join(' / ')
                      const noMapSuffix =
                        option.type === 'unit' && typeof option.startPageHint !== 'number'
                          ? ' · pages not mapped'
                          : ''
                      return (
                        <option key={option.id} value={option.id}>
                          {withinBookLabel}
                          {pageSuffix}
                          {noMapSuffix}
                        </option>
                      )
                    })}
                  </optgroup>
                ))
              })()}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingTeachingSessionId(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveTeachingSelection}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
