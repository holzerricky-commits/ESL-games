'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, Clock3, Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StudentCardLessonPreview } from '@/components/students/student-card-lesson-preview'
import {
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
  updateStudentClassPublishedVocabulary,
} from '@/lib/students/selectors'
import type { StudentClassSessionView, StudentProfileView } from '@/lib/students/types'
import type { VocabularySet } from '@/lib/vocabulary/types'

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

function statusPillClass(status: StudentClassSessionView['status']): string {
  if (status === 'completed') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
  if (status === 'prepared') return 'border-blue-500/30 bg-blue-500/10 text-blue-700'
  if (status === 'cancelled') return 'border-red-500/30 bg-red-500/10 text-red-700'
  return 'border-[var(--border)] bg-[var(--surface-2)] text-muted-foreground'
}

export function StudentClassesTab({ student, onUpdated }: StudentClassesTabProps) {
  const numberingMode: PageNumberingMode = 'mapped'
  const liveStudent = useMemo(() => getStudentProfileView(student.id) ?? student, [student])
  const sessions = useMemo(
    () =>
      [...(liveStudent.scheduledClasses ?? [])].sort(
        (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
      ),
    [liveStudent.scheduledClasses],
  )
  const nextClass = sessions.find((s) => s.status !== 'completed' && s.status !== 'cancelled') ?? null

  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
  const [aiBusyId, setAiBusyId] = useState<string | null>(null)
  const [openOutcomeFor, setOpenOutcomeFor] = useState<string | null>(null)
  const [openPrepFor, setOpenPrepFor] = useState<string | null>(null)
  const [outcomes, setOutcomes] = useState<Record<string, WordsForm>>({})
  const [prepSummary, setPrepSummary] = useState<Record<string, string>>({})
  const [selectedSectionBySession, setSelectedSectionBySession] = useState<Record<string, string>>({})
  const [previewStartBySession, setPreviewStartBySession] = useState<Record<string, number>>({})
  const [previewNumPagesBySession, setPreviewNumPagesBySession] = useState<Record<string, number>>({})
  const [lessonPlanViewModeBySession, setLessonPlanViewModeBySession] = useState<Record<string, LessonPlanViewMode>>({})
  const [library, setLibrary] = useState<BookLibraryPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vocabBusyId, setVocabBusyId] = useState<string | null>(null)
  const [vocabSetBySession, setVocabSetBySession] = useState<Record<string, VocabularySet | null>>({})

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
    if (!nextClass) return
    const options = getStudentSectionOptions(liveStudent.id, library)
    const selectedId = selectedSectionBySession[nextClass.id]
    const selected = options.find((option) => option.id === selectedId)
    const selectedBook = library?.books.find((book) => book.id === selected?.bookId)
    const selectedUnit = selectedBook?.units.find((unit) => unit.id === selected?.unitId)
    const rawStart = selected?.startPageHint ?? 1
    let startPage = rawStart
    if (selectedBook && selectedUnit) {
      const approxTotalPages = selectedUnit.pdfPageRange?.end ?? null
      startPage =
        resolveAlignedAnchorPage(rawStart, selectedBook, selectedUnit, approxTotalPages, numberingMode) ?? rawStart
    }
    setPreviewStartBySession((prev) => (prev[nextClass.id] ? prev : { ...prev, [nextClass.id]: startPage }))
  }, [nextClass, liveStudent.id, library, selectedSectionBySession])

  useEffect(() => {
    if (!nextClass) return
    const options = getStudentSectionOptions(liveStudent.id, library)
    const selectedId = selectedSectionBySession[nextClass.id]
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
          prev[nextClass.id] === numPages ? prev : { ...prev, [nextClass.id]: numPages },
        )
      })
      .catch(() => {
        // Keep graceful fallback when preview metadata fails.
      })
    return () => {
      cancelled = true
    }
  }, [nextClass, liveStudent.id, library, selectedSectionBySession])

  function setSessionStatus(sessionId: string, status: 'planned' | 'prepared' | 'completed' | 'cancelled') {
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
      const prepContext = buildStudentClassPrepContext(liveStudent.id, session.id, library)
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

  async function generateVocabularyDraft(session: StudentClassSessionView) {
    setError(null)
    setVocabBusyId(session.id)
    try {
      const options = getStudentSectionOptions(liveStudent.id, library)
      const selectedId = selectedSectionBySession[session.id]
      const selected = options.find((option) => option.id === selectedId)
      if (!selected) {
        setError('Select a section before generating vocabulary.')
        return
      }
      const startPage = Math.max(1, selected.startPageHint ?? 1)
      const endPage = Math.max(startPage, selected.endPageHint ?? startPage)
      const res = await fetch('/api/vocabulary/generate-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            studentId: liveStudent.id,
            classId: session.id,
            classTitle: session.title,
            bookId: selected.bookId,
            unitId: selected.unitId,
            sectionId: selected.id,
            sectionTitle: selected.title,
            pageRange: { startPage, endPage },
          },
          requestedCount: 12,
          seedWords: session.plannedVocabulary,
        }),
      })
      const payload = (await res.json()) as { ok: boolean; error?: string; set?: VocabularySet }
      if (!res.ok || !payload.ok || !payload.set) {
        setError(payload.error ?? 'Failed to generate vocabulary set.')
        return
      }
      setVocabSetBySession((prev) => ({ ...prev, [session.id]: payload.set! }))
    } catch {
      setError('Failed to generate vocabulary set.')
    } finally {
      setVocabBusyId(null)
    }
  }

  async function updateVocabularyEntry(
    sessionId: string,
    setId: string,
    entryId: string,
    patch: Record<string, unknown>,
  ) {
    setVocabBusyId(sessionId)
    try {
      const res = await fetch('/api/vocabulary/review-set', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId,
          entryId,
          action: 'update',
          ...patch,
        }),
      })
      const payload = (await res.json()) as { ok: boolean; error?: string; set?: VocabularySet }
      if (!res.ok || !payload.ok || !payload.set) {
        setError(payload.error ?? 'Failed to update entry.')
        return
      }
      setVocabSetBySession((prev) => ({ ...prev, [sessionId]: payload.set! }))
    } catch {
      setError('Failed to update entry.')
    } finally {
      setVocabBusyId(null)
    }
  }

  async function removeVocabularyEntry(sessionId: string, setId: string, entryId: string) {
    setVocabBusyId(sessionId)
    try {
      const res = await fetch('/api/vocabulary/review-set', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId,
          entryId,
          action: 'remove',
        }),
      })
      const payload = (await res.json()) as { ok: boolean; error?: string; set?: VocabularySet }
      if (!res.ok || !payload.ok || !payload.set) {
        setError(payload.error ?? 'Failed to remove entry.')
        return
      }
      setVocabSetBySession((prev) => ({ ...prev, [sessionId]: payload.set! }))
    } catch {
      setError('Failed to remove entry.')
    } finally {
      setVocabBusyId(null)
    }
  }

  async function publishVocabularySet(session: StudentClassSessionView, set: VocabularySet) {
    setError(null)
    setVocabBusyId(session.id)
    try {
      const res = await fetch('/api/vocabulary/publish-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setId: set.id }),
      })
      const payload = (await res.json()) as { ok: boolean; error?: string; set?: VocabularySet; publishedWords?: string[] }
      if (!res.ok || !payload.ok || !payload.set || !payload.publishedWords) {
        setError(payload.error ?? 'Failed to publish set.')
        return
      }
      const linkResult = updateStudentClassPublishedVocabulary(liveStudent.id, session.id, {
        setId: payload.set.id,
        status: payload.set.status,
        words: payload.publishedWords,
      })
      if (!linkResult.ok) {
        setError(linkResult.error)
        return
      }
      setVocabSetBySession((prev) => ({ ...prev, [session.id]: payload.set! }))
      onUpdated()
    } catch {
      setError('Failed to publish set.')
    } finally {
      setVocabBusyId(null)
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
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-[var(--card)] p-4">
        {nextClass ? (
          (() => {
            const options = getStudentSectionOptions(liveStudent.id, library)
            const selectedId = selectedSectionBySession[nextClass.id]
            const selected = options.find((option) => option.id === selectedId)
            const selectedBook = library?.books.find((book) => book.id === selected?.bookId)
            const selectedUnit = selectedBook?.units.find((unit) => unit.id === selected?.unitId)
            const previewFilePath = selectedUnit?.filePath ?? null
            const numPages = previewNumPagesBySession[nextClass.id] ?? null
            const previewPages = selectedBook && selectedUnit ? getVisiblePdfPages(selectedUnit, numPages, selectedBook) : []
            const mappedStartHint = resolveAlignedAnchorPage(
              selected?.startPageHint,
              selectedBook,
              selectedUnit,
              numPages,
              numberingMode,
            )
            const fallbackStart = Math.max(1, previewStartBySession[nextClass.id] ?? mappedStartHint ?? selected?.startPageHint ?? 1)
            const leftIndex = previewPages.length
              ? Math.max(0, previewPages.indexOf(fallbackStart))
              : 0
            const leftPage = previewPages[leftIndex] ?? fallbackStart
            const rightPage = previewPages[leftIndex + 1] ?? leftPage + 1
            const canGoBack = previewPages.length ? leftIndex > 0 : leftPage > 1
            const sectionRangeLabel = formatSectionPageRange(selected?.startPageHint, selected?.endPageHint)
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
                [nextClass.id]: targetPage,
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
                            label={`Page ${leftPage}`}
                            fitHeight
                            className="h-full w-full rounded-r-none border-0 border-r-0 object-cover"
                          />
                          <StudentCardLessonPreview
                            filePath={previewFilePath}
                            unitId={selected.unitId}
                            page={rightPage}
                            label={`Page ${rightPage}`}
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
                          [nextClass.id]:
                            previewPages.length > 0
                              ? (previewPages[Math.max(0, leftIndex - 2)] ?? leftPage)
                              : Math.max(1, (prev[nextClass.id] ?? leftPage) - 2),
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
                          [nextClass.id]:
                            previewPages.length > 0
                              ? (previewPages[Math.min(previewPages.length - 1, leftIndex + 2)] ?? leftPage)
                              : (prev[nextClass.id] ?? leftPage) + 2,
                        }))
                      }
                    >
                      →
                    </Button>
                  </div>
                </div>
                <div className="flex h-full min-h-0 flex-col rounded-xl bg-[var(--surface-2)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground md:text-base">Next class</h3>
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusPillClass(nextClass.status)}`}
                    >
                      {nextClass.status}
                    </span>
                  </div>

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
                        {new Date(nextClass.scheduledFor).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Time</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-foreground">
                        <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                        {new Date(nextClass.scheduledFor).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        <span className="text-muted-foreground">
                          ({nextClass.durationMin} min · {formatClassKind(nextClass.durationMin)})
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 min-w-0 text-xs md:text-sm">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Target words</p>
                    <p className="mt-0.5 truncate text-foreground">
                      {nextClass.plannedVocabulary.length
                        ? `${nextClass.plannedVocabulary.length} total · ${nextClass.plannedVocabulary.slice(0, 2).join(', ')}`
                        : 'None yet'}
                    </p>
                  </div>

                  <div className="mt-6 min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lesson plan</p>
                    {nextClass.aiPrepSummary ? (
                      (() => {
                        const raw = nextClass.aiPrepSummary
                        const quickStart = raw.indexOf('Quick view:\n')
                        const detailedStart = raw.indexOf('Detailed view:\n')
                        const hasStructured = quickStart >= 0 && detailedStart > quickStart
                        const mode = lessonPlanViewModeBySession[nextClass.id] ?? 'quick'
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
                                  setLessonPlanViewModeBySession((prev) => ({ ...prev, [nextClass.id]: 'quick' }))
                                }
                              >
                                Quick
                              </button>
                              <button
                                type="button"
                                className={`rounded px-2 py-1 text-xs ${mode === 'detailed' ? 'bg-[var(--surface-2)] font-semibold text-foreground' : 'text-muted-foreground'}`}
                                onClick={() =>
                                  setLessonPlanViewModeBySession((prev) => ({ ...prev, [nextClass.id]: 'detailed' }))
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

                  <div className="mt-auto grid w-full grid-cols-[1fr_auto] gap-2">
                    <Button
                      type="button"
                      className="min-h-[50px] bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => openPrepare(nextClass.id)}
                    >
                      Prepare
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="min-h-[50px] min-w-[50px]"
                      onClick={() => void askAiForClassPrep(nextClass)}
                      disabled={aiBusyId === nextClass.id}
                      aria-label="Analyze selected part"
                      title="Analyze selected part"
                    >
                      {aiBusyId === nextClass.id ? (
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
        ) : (
          <div className="mt-3 space-y-3">
            {sessions
              .filter((session) => session.id === nextClass?.id)
              .map((session) => {
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
                        {session.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex md:flex-wrap md:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full md:w-auto"
                        onClick={() => setSessionStatus(session.id, 'prepared')}
                        disabled={statusBusyId === session.id || session.status === 'completed' || session.status === 'cancelled'}
                      >
                        Mark prepared
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full md:w-auto"
                        onClick={() => setOpenPrepFor(openPrepFor === session.id ? null : session.id)}
                      >
                        {openPrepFor === session.id ? 'Hide prep' : 'Open prep'}
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
                    Section: {session.selectedSection?.title ?? 'Auto-select next section in prep'}
                  </p>
                  {session.sourceSlotId ? (
                    <p className="mt-1 text-xs text-muted-foreground">Scheduled from weekly calendar.</p>
                  ) : null}
                  {session.aiPrepSummary ? (
                    <p className="mt-1 text-xs text-muted-foreground">AI prep note: {session.aiPrepSummary}</p>
                  ) : null}

                  {openPrepFor === session.id ? (
                    <div className="mt-3 space-y-2 rounded-lg bg-[var(--card)] p-3 md:p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preparation notes</p>
                      {(() => {
                        const options = getStudentSectionOptions(liveStudent.id, library)
                        const selectedId = selectedSectionBySession[session.id] ?? ''
                        const vocabSet = vocabSetBySession[session.id]
                        const allApproved = vocabSet ? vocabSet.entries.length > 0 && vocabSet.entries.every((entry) => entry.approved) : false
                        return (
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Book section
                            </label>
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
                              {options.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.pathLabel}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-muted-foreground">
                              Next section is preselected automatically from the last completed class.
                            </p>
                            <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-foreground">Pre-class vocabulary workflow</p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={vocabBusyId === session.id}
                                  onClick={() => void generateVocabularyDraft(session)}
                                  className="h-7 text-xs"
                                >
                                  {vocabBusyId === session.id ? 'Generating...' : 'Generate from selected pages'}
                                </Button>
                              </div>
                              {vocabSet ? (
                                <div className="mt-2 space-y-2">
                                  <p className="text-xs text-muted-foreground">
                                    Status: <span className="font-semibold text-foreground">{vocabSet.status}</span> · Words: {vocabSet.entries.length}
                                  </p>
                                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                                    {vocabSet.entries.map((entry) => (
                                      <div key={entry.id} className="rounded border border-[var(--border)] bg-background p-2">
                                        <div className="flex items-center justify-between gap-2">
                                          <input
                                            value={entry.word}
                                            onChange={(e) =>
                                              void updateVocabularyEntry(session.id, vocabSet.id, entry.id, {
                                                word: e.target.value,
                                                lemma: e.target.value,
                                              })
                                            }
                                            className="h-7 w-32 rounded border border-[var(--border)] bg-background px-2 text-xs"
                                          />
                                          <div className="flex items-center gap-1">
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant={entry.approved ? 'default' : 'outline'}
                                              className="h-7 px-2 text-xs"
                                              onClick={() =>
                                                void updateVocabularyEntry(session.id, vocabSet.id, entry.id, {
                                                  approved: !entry.approved,
                                                })
                                              }
                                            >
                                              <Check className="mr-1 h-3 w-3" />
                                              {entry.approved ? 'Approved' : 'Approve'}
                                            </Button>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              className="h-7 px-2 text-xs"
                                              onClick={() => void removeVocabularyEntry(session.id, vocabSet.id, entry.id)}
                                            >
                                              Remove
                                            </Button>
                                          </div>
                                        </div>
                                        <textarea
                                          value={entry.definition}
                                          onChange={(e) =>
                                            void updateVocabularyEntry(session.id, vocabSet.id, entry.id, {
                                              definition: e.target.value,
                                            })
                                          }
                                          className="mt-2 min-h-[56px] w-full rounded border border-[var(--border)] bg-background px-2 py-1 text-xs"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                                    disabled={!allApproved || vocabBusyId === session.id}
                                    onClick={() => void publishVocabularySet(session, vocabSet)}
                                  >
                                    Publish approved set to class vocabulary
                                  </Button>
                                </div>
                              ) : (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Generate a draft set, approve entries, then publish for game/practice use.
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })()}
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
    </div>
  )
}
