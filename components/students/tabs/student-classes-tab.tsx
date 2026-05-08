'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronDown, Clock3, Play, Sparkles, Zap } from 'lucide-react'
import { ClassPrepVocabEditor } from '@/components/students/class-prep-vocab-editor'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { StudentCardLessonPreview } from '@/components/students/student-card-lesson-preview'
import {
  formatEffectivePageSpan,
  mapPdfPageToDisplayLabel,
  resolveAlignedAnchorPage,
  type PageNumberingMode,
} from '@/lib/books/page-numbering'
import { getVisiblePdfPages } from '@/lib/books/page-range'
import { getPdfTotalPages } from '@/lib/books/pdf-thumbnail-cache'
import type { BookLibraryPayload } from '@/lib/books/types'
import {
  buildStudentClassPrepContext,
  getStudentSectionOptions,
  getStudentProfileView,
  recordStudentClassOutcome,
  resolveNextSectionForClass,
  transitionStudentClassStatus,
  updateStudentClassSelectedSection,
  updateStudentClassPrepSummary,
  startStudentClassSession,
  getNextClassResumeHeadline,
  getLastStoppedCarryLine,
  dismissPostClassRecapPrompt,
  updateStudentClassEndNote,
  updateStudentClassSessionNote,
} from '@/lib/students/selectors'
import type { StudentClassSessionView, StudentProfileView } from '@/lib/students/types'
import type { StudentClassStatus } from '@/lib/types'
import type { BookContextRecord, LessonContextRecord, UnitContextRecord } from '@/lib/context/types'

interface StudentClassesTabProps {
  student: StudentProfileView
  onUpdated: () => void
}

type WordsForm = {
  introducedWords: string
  practicedWords: string
  reviewedWords: string
  learnedWords: string
  teacherNotes: string
}

type LessonPlanViewMode = 'quick' | 'detailed'

function formatMinuteRange(startMin: number, endMin: number): string {
  return `${startMin}-${endMin} min`
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

function formatClassKind(durationMin: number): string {
  if (durationMin <= 30) return 'Short class'
  if (durationMin >= 50) return 'Long class'
  return 'Standard class'
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
  return 'border-[var(--border)] bg-[var(--surface-2)] text-muted-foreground'
}

export function StudentClassesTab({ student, onUpdated }: StudentClassesTabProps) {
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
  const nowMs = Date.now()
  const nextUpcomingClass =
    sessions.find((s) => {
      if (s.status === 'completed' || s.status === 'cancelled' || s.status === 'in_progress') return false
      const ms = new Date(s.scheduledFor).getTime()
      return Number.isFinite(ms) && ms >= nowMs
    }) ?? null

  /** Live class takes over the big card so you can still hit “Continue to map”. */
  const spotlightSession = useMemo(
    () => sessions.find((s) => s.status === 'in_progress') ?? nextUpcomingClass,
    [sessions, nextUpcomingClass],
  )

  const pastSessions = useMemo(
    () =>
      [...sessions]
        .filter((s) => s.status === 'completed')
        .sort((a, b) => {
          const ta = new Date(a.classEndedAt ?? a.updatedAt ?? a.scheduledFor).getTime()
          const tb = new Date(b.classEndedAt ?? b.updatedAt ?? b.scheduledFor).getTime()
          return tb - ta
        }),
    [sessions],
  )

  const activeSessions = useMemo(() => sessions.filter((s) => s.status !== 'completed'), [sessions])

  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
  const [startBusySessionId, setStartBusySessionId] = useState<string | null>(null)
  const [aiBusyId, setAiBusyId] = useState<string | null>(null)
  const [openOutcomeFor, setOpenOutcomeFor] = useState<string | null>(null)
  const [openPrepFor, setOpenPrepFor] = useState<string | null>(null)
  const prepSession = useMemo(
    () => (openPrepFor ? sessions.find((s) => s.id === openPrepFor) ?? null : null),
    [openPrepFor, sessions],
  )
  const [outcomes, setOutcomes] = useState<Record<string, WordsForm>>({})
  const [prepSummary, setPrepSummary] = useState<Record<string, string>>({})
  const [selectedSectionBySession, setSelectedSectionBySession] = useState<Record<string, string>>({})
  const [previewStartBySession, setPreviewStartBySession] = useState<Record<string, number>>({})
  const [previewNumPagesBySession, setPreviewNumPagesBySession] = useState<Record<string, number>>({})
  const [lessonPlanViewModeBySession, setLessonPlanViewModeBySession] = useState<Record<string, LessonPlanViewMode>>({})
  const [library, setLibrary] = useState<BookLibraryPayload | null>(null)

  const nextClassResumeHeadline = useMemo(
    () =>
      spotlightSession
        ? getNextClassResumeHeadline(liveStudent.id, spotlightSession.id, library)
        : null,
    [liveStudent.id, spotlightSession, library],
  )

  const [error, setError] = useState<string | null>(null)
  const [unitContextBySession, setUnitContextBySession] = useState<Record<string, UnitContextRecord | null>>({})
  const [lessonContextBySession, setLessonContextBySession] = useState<Record<string, LessonContextRecord | null>>({})
  const [bookContextBySession, setBookContextBySession] = useState<Record<string, BookContextRecord | null>>({})
  const [recapOpenFor, setRecapOpenFor] = useState<string | null>(null)
  const [recapDraft, setRecapDraft] = useState('')
  const [sessionNoteOpenFor, setSessionNoteOpenFor] = useState<string | null>(null)
  const [sessionNoteDraft, setSessionNoteDraft] = useState('')

  /** When spotlight class or its chosen section id changes, re-seed preview start (avoid sticky pages from a prior section). */
  const spotlightPreviewSyncRef = useRef<{ sessionId: string; sectionId: string } | null>(null)

  useEffect(() => {
    let active = true
    async function loadBooks() {
      try {
        const res = await fetch('/api/books')
        if (!res.ok) return
        const payload = (await res.json()) as BookLibraryPayload
        if (!active) return
        setLibrary(payload)
      } catch {
        // Keep prep usable even when library metadata is unavailable.
      }
    }
    void loadBooks()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!openPrepFor) return
    const session = sessions.find((row) => row.id === openPrepFor)
    if (!session) return
    void loadSavedContext(session)
    // include selected-section map so context refreshes after section switches
  }, [openPrepFor, selectedSectionBySession, sessions])

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const session of sessions) {
      const fallback = resolveNextSectionForClass(liveStudent.id, session.id, library)
      const selected = session.selectedSection?.id ?? fallback?.id
      if (selected) next[session.id] = selected
    }
    setSelectedSectionBySession((prev) => {
      const merged = { ...next, ...prev }
      const prevKeys = Object.keys(prev)
      const mergedKeys = Object.keys(merged)
      if (prevKeys.length === mergedKeys.length && prevKeys.every((key) => prev[key] === merged[key])) {
        return prev
      }
      return merged
    })
  }, [liveStudent.id, sessions, library])

  useEffect(() => {
    if (!spotlightSession) return
    const options = getStudentSectionOptions(liveStudent.id, library)
    const selectedId = selectedSectionBySession[spotlightSession.id] ?? ''
    const selected = options.find((option) => option.id === selectedId)
    const selectedBook = library?.books.find((book) => book.id === selected?.bookId)
    const selectedUnit = selectedBook?.units.find((unit) => unit.id === selected?.unitId)
    const rawStart = selected?.startPageHint ?? 1
    let startPage = rawStart
    if (selectedBook && selectedUnit) {
      startPage =
        resolveAlignedAnchorPage(rawStart, selectedBook, selectedUnit, null, numberingMode) ?? rawStart
    }
    const prevSync = spotlightPreviewSyncRef.current
    if (
      !prevSync ||
      prevSync.sessionId !== spotlightSession.id ||
      prevSync.sectionId !== selectedId
    ) {
      spotlightPreviewSyncRef.current = { sessionId: spotlightSession.id, sectionId: selectedId }
      setPreviewStartBySession((prev) => ({ ...prev, [spotlightSession.id]: startPage }))
    }
  }, [spotlightSession, liveStudent.id, library, selectedSectionBySession])

  useEffect(() => {
    if (!spotlightSession) return
    const options = getStudentSectionOptions(liveStudent.id, library)
    const selectedId = selectedSectionBySession[spotlightSession.id]
    const selected = options.find((option) => option.id === selectedId)
    const selectedBook = library?.books.find((book) => book.id === selected?.bookId)
    const selectedUnit = selectedBook?.units.find((unit) => unit.id === selected?.unitId)
    if (!selectedUnit) return
    let cancelled = false
    const fileUrl = `/api/book-file?path=${encodeURIComponent(selectedUnit.filePath)}`
    void getPdfTotalPages(fileUrl)
      .then((numPages) => {
        if (cancelled) return
        setPreviewNumPagesBySession((prev) =>
          prev[spotlightSession.id] === numPages ? prev : { ...prev, [spotlightSession.id]: numPages },
        )
        const sessionId = spotlightSession.id
        const previewPages = selectedBook
          ? getVisiblePdfPages(selectedUnit, numPages, selectedBook)
          : getVisiblePdfPages(selectedUnit, numPages, undefined)
        const anchor =
          selected && selectedBook
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
  }, [spotlightSession, liveStudent.id, library, selectedSectionBySession])

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

  function savePrepSummary(session: StudentClassSessionView) {
    const sectionOptions = getStudentSectionOptions(liveStudent.id, library)
    const sectionId = selectedSectionBySession[session.id]
    const chosenSection = sectionOptions.find((option) => option.id === sectionId)
    const sectionResult = updateStudentClassSelectedSection(liveStudent.id, session.id, chosenSection ?? null)
    if (!sectionResult.ok) {
      setError(sectionResult.error)
      return
    }
    const text = prepSummary[session.id] ?? ''
    const result = updateStudentClassPrepSummary(liveStudent.id, session.id, text)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onUpdated()
  }

  async function askAiForClassPrep(session: StudentClassSessionView) {
    setError(null)
    setAiBusyId(session.id)
    try {
      const sectionOptions = getStudentSectionOptions(liveStudent.id, library)
      const sectionId = selectedSectionBySession[session.id]
      const chosenSection = sectionOptions.find((option) => option.id === sectionId)
      if (chosenSection) {
        const updateSection = updateStudentClassSelectedSection(liveStudent.id, session.id, chosenSection)
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
      const prepContext = buildStudentClassPrepContext(
        liveStudent.id,
        session.id,
        library,
        bookContextForPrep,
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
      let currentMin = 0
      const rangedBlocks = payload.suggestion.timeBlocks.map((block) => {
        const startMin = currentMin
        const endMin = currentMin + Math.max(1, block.minutes)
        currentMin = endMin
        return { ...block, startMin, endMin }
      })
      const quickViewLines = rangedBlocks.map(
        (block) =>
          `${formatMinuteRange(block.startMin, block.endMin)} - ${block.label}: ${block.activityType.replace(/-/g, ' ')}`,
      )
      const detailedViewLines = rangedBlocks.flatMap((block) => {
        const lines = [
          `${formatMinuteRange(block.startMin, block.endMin)} - ${block.label}`,
          `Objective: ${block.objective}`,
          `Activity: ${block.activityType.replace(/-/g, ' ')}`,
        ]
        if (block.teacherMoves?.length) lines.push(`Teacher moves: ${block.teacherMoves.join('; ')}`)
        if (block.studentOutput) lines.push(`Student output: ${block.studentOutput}`)
        if (block.checkForUnderstanding) lines.push(`Check: ${block.checkForUnderstanding}`)
        return lines.concat('')
      })
      const summary = [
        payload.suggestion.summary,
        '',
        'Quick view:',
        ...quickViewLines,
        '',
        'Detailed view:',
        ...detailedViewLines,
        payload.suggestion.priorities.length ? `Priorities: ${payload.suggestion.priorities.join('; ')}` : '',
        payload.suggestion.activities.length ? `Activities: ${payload.suggestion.activities.join('; ')}` : '',
        payload.suggestion.checkpointMoments.length ? `Checkpoints: ${payload.suggestion.checkpointMoments.join('; ')}` : '',
        payload.suggestion.differentiationTips.length
          ? `Differentiation: ${payload.suggestion.differentiationTips.join('; ')}`
          : '',
        payload.suggestion.homeworkOrCarryOver.length ? `Carry-over: ${payload.suggestion.homeworkOrCarryOver.join('; ')}` : '',
        payload.suggestion.wordsToRevisit.length
          ? `Words to revisit: ${payload.suggestion.wordsToRevisit.map((item) => `${item.word} (${item.reason})`).join('; ')}`
          : '',
      ]
        .filter((line, index, arr) => !(line === '' && arr[index - 1] === ''))
        .join('\n')
      setPrepSummary((prev) => ({
        ...prev,
        [session.id]: summary,
      }))
      const saveResult = updateStudentClassPrepSummary(liveStudent.id, session.id, summary)
      if (!saveResult.ok) {
        setError(saveResult.error)
        return
      }
      setOpenPrepFor(session.id)
      onUpdated()
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

  function openPrepare(sessionId: string) {
    setOpenPrepFor(sessionId)
    setOpenOutcomeFor(null)
    const session = sessions.find((row) => row.id === sessionId)
    if (session) {
      void loadSavedContext(session)
    }
  }

  function goToClassMap(sessionId: string) {
    const row = sessions.find((s) => s.id === sessionId)
    if (!row) return
    if (row.status === 'completed' || row.status === 'cancelled') return
    if (row.status !== 'in_progress') {
      setStartBusySessionId(sessionId)
      const started = startStudentClassSession(liveStudent.id, sessionId)
      setStartBusySessionId(null)
      if (!started.ok) {
        setError(started.error)
        return
      }
      onUpdated()
    }
    router.push(`/students/${liveStudent.id}/map?classSession=${encodeURIComponent(sessionId)}`)
  }

  function renderClassPrepDialogBody(session: StudentClassSessionView) {
    const options = getStudentSectionOptions(liveStudent.id, library)
    const selectedId = selectedSectionBySession[session.id] ?? session.selectedSection?.id ?? ''
    const selected = options.find((option) => option.id === selectedId)
    const unitContext = unitContextBySession[session.id]
    const lessonContext = lessonContextBySession[session.id]
    return (
      <div className="space-y-4 pr-1">
        {isVocabularyPartSection(selected) &&
        selected?.bookId &&
        selected?.unitId &&
        selected?.lessonId &&
        selected?.partId ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <p className="text-xs font-semibold text-foreground">Interactive vocabulary (saved to book)</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              These words load in the Books reader for this part for all students.
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
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preparation notes</p>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Book section</label>
          <select
            className="w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
            value={selectedId}
            onChange={(e) =>
              setSelectedSectionBySession((prev) => ({
                ...prev,
                [session.id]: e.target.value,
              }))
            }
          >
            <option value="">No section selected</option>
            {options.map((option) => {
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
              const suffix = span && span !== 'pages —' && !span.startsWith('pages —') ? ' · ' + span : ''
              return (
                <option key={option.id} value={option.id}>
                  {option.pathLabel}
                  {suffix}
                </option>
              )
            })}
          </select>
          <p className="text-xs text-muted-foreground">
            Next section is preselected automatically from the last completed class.
          </p>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">Auto-loaded curriculum context</p>
          </div>
          {unitContext || lessonContext ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
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
            <p className="mt-2 text-xs text-muted-foreground">
              Context is managed from the Book page. Open this class prep after selecting a section to auto-load context.
            </p>
          )}
        </div>
        <textarea
          className="min-h-[90px] w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
          value={prepSummary[session.id] ?? session.aiPrepSummary ?? ''}
          onChange={(e) =>
            setPrepSummary((prev) => ({
              ...prev,
              [session.id]: e.target.value,
            }))
          }
          placeholder="Paste AI suggestions or add your own prep summary."
        />
        <Button type="button" size="sm" onClick={() => savePrepSummary(session)}>
          Save prep summary
        </Button>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-[var(--card)] p-4">
        {spotlightSession ? (
          (() => {
            const options = getStudentSectionOptions(liveStudent.id, library)
            const selectedId = selectedSectionBySession[spotlightSession.id]
            const selected = options.find((option) => option.id === selectedId)
            const selectedBook = library?.books.find((book) => book.id === selected?.bookId)
            const selectedUnit = selectedBook?.units.find((unit) => unit.id === selected?.unitId)
            const previewFilePath = selectedUnit?.filePath ?? null
            const numPages = previewNumPagesBySession[spotlightSession.id] ?? null
            const previewPages = selectedBook && selectedUnit ? getVisiblePdfPages(selectedUnit, numPages, selectedBook) : []
            const mappedStartHint = resolveAlignedAnchorPage(
              selected?.startPageHint,
              selectedBook,
              selectedUnit,
              numPages,
              numberingMode,
            )
            const anchorBase = Math.max(
              1,
              mappedStartHint ?? selected?.startPageHint ?? 1,
            )
            const rawSessionStart = previewStartBySession[spotlightSession.id]
            const sessionStartInVisible =
              rawSessionStart != null && previewPages.includes(rawSessionStart)
            const spreadStart = sessionStartInVisible
              ? rawSessionStart
              : previewPages.length > 0
                ? (previewPages.find((p) => p >= anchorBase) ?? previewPages[0] ?? anchorBase)
                : anchorBase
            const leftIndex = previewPages.length
              ? Math.max(0, previewPages.indexOf(spreadStart))
              : 0
            const leftPage = previewPages[leftIndex] ?? spreadStart
            const rightPage = previewPages[leftIndex + 1] ?? leftPage + 1
            const canGoBack = previewPages.length ? leftIndex > 0 : leftPage > 1
            const sectionRangeLabel =
              selectedBook && selectedUnit
                ? formatEffectivePageSpan(
                    selected?.startPageHint ?? null,
                    selected?.endPageHint ?? null,
                    selectedBook,
                    selectedUnit,
                    numPages,
                    numberingMode,
                  )
                : formatSectionPageRange(selected?.startPageHint, selected?.endPageHint)
            const leftLabel = mapPdfPageToDisplayLabel(leftPage, selectedBook, selectedUnit, numPages, numberingMode)
            const rightLabel = mapPdfPageToDisplayLabel(rightPage, selectedBook, selectedUnit, numPages, numberingMode)
            const previewRangeLabel = `p${leftLabel}-${rightLabel}`
            const jumpToSectionStart = () => {
              if (!selected) return
              const anchor = Math.max(
                1,
                resolveAlignedAnchorPage(selected.startPageHint, selectedBook, selectedUnit, numPages, numberingMode) ??
                  selected.startPageHint ??
                  1,
              )
              const targetPage = previewPages.find((page) => page >= anchor) ?? previewPages[0] ?? anchor
              setPreviewStartBySession((prev) => ({
                ...prev,
                [spotlightSession.id]: targetPage,
              }))
            }
            return (
              <div className="mt-3 grid min-h-[380px] gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex min-h-0 flex-1 items-stretch">
                      {previewFilePath && selected ? (
                        <>
                          <StudentCardLessonPreview
                            filePath={previewFilePath}
                            unitId={selected.unitId}
                            page={leftPage}
                            label={`Page ${leftLabel}`}
                            fitHeight
                            className="h-full w-full rounded-r-none border-0 border-r-0 object-cover"
                          />
                          <StudentCardLessonPreview
                            filePath={previewFilePath}
                            unitId={selected.unitId}
                            page={rightPage}
                            label={`Page ${rightLabel}`}
                            fitHeight
                            className="h-full w-full rounded-l-none border-0 object-cover"
                          />
                        </>
                      ) : (
                        <>
                          <div className="flex h-full w-full flex-col items-center justify-center rounded-r-none bg-gradient-to-b from-white to-slate-50 p-3 text-center shadow-sm dark:from-slate-900 dark:from-0% dark:to-slate-800 dark:to-100%">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Left page</p>
                            <p className="text-lg font-semibold text-foreground">{leftPage}</p>
                          </div>
                          <div className="flex h-full w-full flex-col items-center justify-center rounded-l-none bg-gradient-to-b from-white to-slate-50 p-3 text-center shadow-sm dark:from-slate-900 dark:from-0% dark:to-slate-800 dark:to-100%">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Right page</p>
                            <p className="text-lg font-semibold text-foreground">{rightPage}</p>
                          </div>
                        </>
                      )}
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPreviewStartBySession((prev) => ({
                          ...prev,
                          [spotlightSession.id]:
                            previewPages.length > 0
                              ? (previewPages[Math.max(0, leftIndex - 2)] ?? leftPage)
                              : Math.max(1, (prev[spotlightSession.id] ?? spreadStart) - 2),
                        }))
                      }
                      disabled={!canGoBack}
                    >
                      ←
                    </Button>
                    <button
                      type="button"
                      className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-foreground hover:bg-[var(--surface-2)]"
                      onClick={jumpToSectionStart}
                      title="Current preview page range"
                    >
                      {previewRangeLabel}
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPreviewStartBySession((prev) => ({
                          ...prev,
                          [spotlightSession.id]:
                            previewPages.length > 0
                              ? (previewPages[Math.min(previewPages.length - 1, leftIndex + 2)] ?? leftPage)
                              : (prev[spotlightSession.id] ?? leftPage) + 2,
                        }))
                      }
                    >
                      →
                    </Button>
                  </div>
                </div>
                <div className="flex h-full min-h-0 flex-col rounded-xl bg-[var(--surface-2)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground md:text-base">
                      {spotlightSession.status === 'in_progress' ? 'Live class' : 'Next class'}
                    </h3>
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusPillClass(spotlightSession.status)}`}
                    >
                      {spotlightSession.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {nextClassResumeHeadline ? (
                    <p className="mt-1.5 text-xs font-medium leading-snug text-[var(--brand-blue)] md:text-sm">
                      {nextClassResumeHeadline.headline}
                    </p>
                  ) : null}
                  {selected && library ? (
                    <div className="mt-2 space-y-1 text-xs leading-snug text-muted-foreground md:text-sm">
                      {(() => {
                        const lastLine = getLastStoppedCarryLine(
                          liveStudent.id,
                          spotlightSession.id,
                          library,
                          selected.bookId,
                          selected.unitId,
                        )
                        const todayLabel = (selected.partTitle ?? selected.title).trim()
                        return (
                          <>
                            {lastLine ? <p>{lastLine}</p> : null}
                            {todayLabel ? (
                              <p>
                                <span className="font-medium text-foreground">Today: </span>
                                {todayLabel}
                              </p>
                            ) : null}
                          </>
                        )
                      })()}
                    </div>
                  ) : null}
                  {selected ? (
                    <div className="mt-2">
                      <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                        <Link
                          href={`/books?student=${encodeURIComponent(liveStudent.id)}&book=${encodeURIComponent(selected.bookId)}&unit=${encodeURIComponent(selected.unitId)}`}
                        >
                          Open book at last stop
                        </Link>
                      </Button>
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-1">
                    {selected ? (
                      <>
                        <p className="text-xs font-normal text-muted-foreground/80">
                          {[selected.bookTitle, selected.unitTitle, selected.lessonTitle].filter(Boolean).join(' / ')}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-left text-base font-semibold text-[var(--brand-blue)] underline-offset-2 transition hover:underline md:text-lg"
                            onClick={jumpToSectionStart}
                            title="Jump preview to this part"
                          >
                            {selected.partTitle ?? selected.title}
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs text-muted-foreground hover:bg-[var(--surface-2)]"
                            onClick={jumpToSectionStart}
                            title="Jump to selected part range"
                          >
                            {sectionRangeLabel}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm font-medium text-muted-foreground">No section selected yet</p>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs md:text-sm">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Date</p>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-foreground">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        {new Date(spotlightSession.scheduledFor).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Time</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-foreground">
                        <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                        {new Date(spotlightSession.scheduledFor).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        <span className="text-muted-foreground">
                          ({spotlightSession.durationMin} min · {formatClassKind(spotlightSession.durationMin)})
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 min-w-0 text-xs md:text-sm">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Target words</p>
                    <p className="mt-0.5 truncate text-foreground">
                      {spotlightSession.plannedVocabulary.length
                        ? `${spotlightSession.plannedVocabulary.length} total · ${spotlightSession.plannedVocabulary.slice(0, 2).join(', ')}`
                        : 'None yet'}
                    </p>
                  </div>

                  <div className="mt-6 min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lesson plan</p>
                    {spotlightSession.aiPrepSummary ? (
                      (() => {
                        const raw = spotlightSession.aiPrepSummary
                        const quickStart = raw.indexOf('Quick view:\n')
                        const detailedStart = raw.indexOf('Detailed view:\n')
                        const hasStructured = quickStart >= 0 && detailedStart > quickStart
                        const mode = lessonPlanViewModeBySession[spotlightSession.id] ?? 'quick'
                        const quickText = hasStructured
                          ? raw.slice(quickStart + 'Quick view:\n'.length, detailedStart).trim()
                          : raw
                        const detailedText = hasStructured
                          ? raw.slice(detailedStart + 'Detailed view:\n'.length).trim()
                          : raw
                        return (
                          <div className="mt-2 space-y-2">
                            <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--card)] p-0.5">
                              <button
                                type="button"
                                className={`rounded px-2 py-1 text-xs ${mode === 'quick' ? 'bg-[var(--surface-2)] font-semibold text-foreground' : 'text-muted-foreground'}`}
                                onClick={() =>
                                  setLessonPlanViewModeBySession((prev) => ({ ...prev, [spotlightSession.id]: 'quick' }))
                                }
                              >
                                Quick
                              </button>
                              <button
                                type="button"
                                className={`rounded px-2 py-1 text-xs ${mode === 'detailed' ? 'bg-[var(--surface-2)] font-semibold text-foreground' : 'text-muted-foreground'}`}
                                onClick={() =>
                                  setLessonPlanViewModeBySession((prev) => ({ ...prev, [spotlightSession.id]: 'detailed' }))
                                }
                              >
                                Detailed
                              </button>
                            </div>
                            <p
                              className={`whitespace-pre-line text-xs text-foreground md:text-sm ${
                                mode === 'quick' ? 'line-clamp-6' : 'line-clamp-10'
                              }`}
                            >
                              {mode === 'quick' ? quickText : detailedText}
                            </p>
                          </div>
                        )
                      })()
                    ) : (
                      <div className="mt-2 rounded-lg border border-[var(--border)] px-3 py-2">
                        <p className="text-xs text-muted-foreground md:text-sm">
                          No lesson plan yet. Run analysis to generate one.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto flex w-full flex-wrap gap-2">
                    <Button
                      type="button"
                      className="min-h-[50px] min-w-[120px] flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => openPrepare(spotlightSession.id)}
                    >
                      Prepare
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-[50px] min-w-[120px] flex-1 gap-1.5"
                      onClick={() => goToClassMap(spotlightSession.id)}
                      disabled={
                        startBusySessionId === spotlightSession.id ||
                        spotlightSession.status === 'completed' ||
                        spotlightSession.status === 'cancelled'
                      }
                    >
                      {startBusySessionId === spotlightSession.id ? (
                        <span className="text-xs font-semibold">…</span>
                      ) : (
                        <>
                          <Play className="h-4 w-4 shrink-0" />
                          {spotlightSession.status === 'in_progress' ? 'Continue to map' : 'Start class'}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="min-h-[50px] min-w-[50px] shrink-0"
                      onClick={() => void askAiForClassPrep(spotlightSession)}
                      disabled={aiBusyId === spotlightSession.id}
                      aria-label="Analyze selected part"
                      title="Analyze selected part"
                    >
                      {aiBusyId === spotlightSession.id ? (
                        <span className="text-xs font-semibold">...</span>
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })()
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No upcoming class yet.</p>
        )}
      </section>

      <section className="rounded-2xl bg-[var(--card)] p-4">
        <h3 className="text-base font-semibold text-foreground">Classes</h3>
        {error ? <p className="mt-2 text-sm text-[var(--brand-red)]">{error}</p> : null}
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No classes yet.</p>
        ) : activeSessions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing active here — completed classes are listed under Past classes.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {activeSessions.map((session) => {
              const currentOutcome = outcomes[session.id] ?? {
                introducedWords: '',
                practicedWords: '',
                reviewedWords: '',
                learnedWords: '',
                teacherNotes: '',
              }
              return (
                <article key={session.id} className="rounded-xl bg-[var(--surface-2)] p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{session.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {prettyDateTime(session.scheduledFor)} · {session.durationMin} min
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusPillClass(session.status)}`}
                      >
                        {session.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex md:flex-wrap md:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full md:w-auto"
                        onClick={() => setSessionStatus(session.id, 'prepared')}
                        disabled={
                          statusBusyId === session.id ||
                          session.status === 'completed' ||
                          session.status === 'cancelled' ||
                          session.status === 'in_progress'
                        }
                      >
                        Mark prepared
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full md:w-auto"
                        onClick={() => setOpenPrepFor(session.id)}
                      >
                        Open prep
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full md:w-auto"
                        onClick={() => void askAiForClassPrep(session)}
                        disabled={aiBusyId === session.id}
                      >
                        {aiBusyId === session.id ? 'Thinking...' : 'Ask AI'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full md:w-auto"
                        onClick={() => setOpenOutcomeFor(openOutcomeFor === session.id ? null : session.id)}
                        disabled={session.status === 'cancelled'}
                      >
                        {openOutcomeFor === session.id ? 'Hide outcome' : 'Log outcome'}
                      </Button>
                      {session.status !== 'cancelled' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full md:w-auto"
                          onClick={() => setSessionStatus(session.id, 'cancelled')}
                          disabled={statusBusyId === session.id || session.status === 'completed'}
                        >
                          Cancel
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full md:w-auto"
                          onClick={() => setSessionStatus(session.id, 'planned')}
                          disabled={statusBusyId === session.id}
                        >
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Planned words: {session.plannedVocabulary.length ? session.plannedVocabulary.join(', ') : 'None'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(() => {
                      const title = session.selectedSection?.title ?? 'Auto-select next section in prep'
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
                      const pagesBit =
                        pages && pages !== 'pages —' && !pages.startsWith('pages —') ? ` · ${pages}` : ''
                      return (
                        <>
                          Section: {title}
                          {pagesBit}
                        </>
                      )
                    })()}
                  </p>
                  {session.sourceSlotId ? (
                    <p className="mt-1 text-xs text-muted-foreground">Scheduled from weekly calendar.</p>
                  ) : null}
                  {session.aiPrepSummary ? (
                    <p className="mt-1 text-xs text-muted-foreground">AI prep note: {session.aiPrepSummary}</p>
                  ) : null}


                  {openOutcomeFor === session.id ? (
                    <div className="mt-3 space-y-2 rounded-lg bg-[var(--card)] p-3 md:p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Class outcomes</p>
                      <textarea
                        className="min-h-[58px] w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
                        placeholder="Introduced words (comma separated)"
                        value={currentOutcome.introducedWords}
                        onChange={(e) =>
                          setOutcomes((prev) => ({
                            ...prev,
                            [session.id]: { ...currentOutcome, introducedWords: e.target.value },
                          }))
                        }
                      />
                      <textarea
                        className="min-h-[58px] w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
                        placeholder="Practiced words (comma separated)"
                        value={currentOutcome.practicedWords}
                        onChange={(e) =>
                          setOutcomes((prev) => ({
                            ...prev,
                            [session.id]: { ...currentOutcome, practicedWords: e.target.value },
                          }))
                        }
                      />
                      <textarea
                        className="min-h-[58px] w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
                        placeholder="Reviewed words (comma separated)"
                        value={currentOutcome.reviewedWords}
                        onChange={(e) =>
                          setOutcomes((prev) => ({
                            ...prev,
                            [session.id]: { ...currentOutcome, reviewedWords: e.target.value },
                          }))
                        }
                      />
                      <textarea
                        className="min-h-[58px] w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
                        placeholder="Learned words (comma separated)"
                        value={currentOutcome.learnedWords}
                        onChange={(e) =>
                          setOutcomes((prev) => ({
                            ...prev,
                            [session.id]: { ...currentOutcome, learnedWords: e.target.value },
                          }))
                        }
                      />
                      <textarea
                        className="min-h-[70px] w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
                        placeholder="Teacher notes"
                        value={currentOutcome.teacherNotes}
                        onChange={(e) =>
                          setOutcomes((prev) => ({
                            ...prev,
                            [session.id]: { ...currentOutcome, teacherNotes: e.target.value },
                          }))
                        }
                      />
                      <div className="grid grid-cols-2 gap-2 md:flex">
                        <Button type="button" size="sm" onClick={() => saveOutcome(session.id)}>
                          Save outcomes
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setOpenOutcomeFor(null)}>
                          Close
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-[var(--card)] p-4">
        <h3 className="text-base font-semibold text-foreground">Past classes</h3>
        <p className="mt-1 text-xs text-muted-foreground">Newest first. Open a row for notes, bookmark, and word lists.</p>
        {pastSessions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No completed classes yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pastSessions.map((session) => (
              <Collapsible key={session.id} className="group rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--card)]/60"
                  >
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
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
                      <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-50">
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
      </section>
      <Dialog open={Boolean(openPrepFor)} onOpenChange={(open) => { if (!open) setOpenPrepFor(null) }}>
        <DialogContent className="flex max-h-[min(92vh,900px)] w-[min(96vw,1180px)] max-w-[min(96vw,1180px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1180px)]">
          <DialogHeader className="shrink-0 border-b border-[var(--border)] px-6 py-4 pr-14 text-left">
            <DialogTitle>{prepSession ? `Class prep · ${prepSession.title}` : 'Class prep'}</DialogTitle>
            <DialogDescription className="text-left text-xs text-muted-foreground">
              Notes, book section, and vocabulary for the next class. Vocabulary sections include a PDF preview of the
              exact pages sent to the assistant.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {prepSession ? renderClassPrepDialogBody(prepSession) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
