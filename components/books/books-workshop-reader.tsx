'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BooksWorkshopPlaceBar } from '@/components/books/books-workshop-place-bar'
import {
  BooksWorkshopStoryTools,
  type BooksWorkshopStoryToolsStatus,
} from '@/components/books/books-workshop-story-tools'
import {
  BooksWorkshopVocabTools,
  type BooksWorkshopVocabToolsStatus,
} from '@/components/books/books-workshop-vocab-tools'
import { FullscreenBookOverlay } from '@/components/students/fullscreen-book-overlay'
import { formatPartPageRangeLabel } from '@/lib/books/book-part-shelf'
import {
  BOOKS_WORKSHOP_STUDENT_ID,
  WORKSHOP_MANUAL_VOCAB_LESSON_ID,
  workshopManualVocabPartId,
  type BooksWorkshopMarkPhase,
  type BooksWorkshopOpenRequest,
} from '@/lib/books/books-workshop'
import { readingStoryManualKey } from '@/lib/books/reading-story-map'

interface BooksWorkshopReaderProps {
  request: BooksWorkshopOpenRequest
  onClose: () => void
}

function parsePageInput(raw: string): number | null {
  const n = Math.floor(Number(String(raw).trim()))
  if (!Number.isFinite(n) || n < 1) return null
  return n
}

/**
 * Books workshop: same teaching reader as class Continue, clock off, no student.
 * Story / vocab tools on the place bar; unmarked → Mark this section → type tools.
 */
export function BooksWorkshopReader({ request, onClose }: BooksWorkshopReaderProps) {
  const [liveRequest, setLiveRequest] = useState(request)
  const [markPhase, setMarkPhase] = useState<BooksWorkshopMarkPhase>('idle')
  const [markStart, setMarkStart] = useState(String(Math.max(1, request.pdfPage || 1)))
  const [markEnd, setMarkEnd] = useState(String(Math.max(1, request.pdfPage || 1)))
  const [spanStart, setSpanStart] = useState<number | null>(null)
  const [spanEnd, setSpanEnd] = useState<number | null>(null)
  const [markBusy, setMarkBusy] = useState(false)
  const [preferOpenExercises, setPreferOpenExercises] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [checksOpen, setChecksOpen] = useState(false)
  const [wordsOpen, setWordsOpen] = useState(false)
  const [storyStatus, setStoryStatus] = useState<BooksWorkshopStoryToolsStatus>({
    textReady: false,
    checksApproved: false,
    hasUsableChecks: false,
    loading: true,
  })
  const [vocabStatus, setVocabStatus] = useState<BooksWorkshopVocabToolsStatus>({
    wordsReady: false,
    loading: true,
  })

  useEffect(() => {
    setLiveRequest(request)
    setMarkPhase('idle')
    setMarkStart(String(Math.max(1, request.pdfPage || 1)))
    setMarkEnd(String(Math.max(1, request.pdfPage || 1)))
    setSpanStart(null)
    setSpanEnd(null)
    setMarkBusy(false)
    setPreferOpenExercises(request.kind === 'exercise')
    setTextOpen(false)
    setChecksOpen(false)
    setWordsOpen(false)
  }, [request])

  const storyToolsAvailable =
    liveRequest.kind === 'story' && Boolean(liveRequest.storyId?.trim())
  const vocabToolsAvailable =
    liveRequest.kind === 'vocab' &&
    Boolean(liveRequest.lessonId?.trim()) &&
    Boolean(liveRequest.partId?.trim())
  const showMarkAction = liveRequest.kind === 'unmarked'
  const assignedBookIds = useMemo(() => [liveRequest.bookId], [liveRequest.bookId])
  const assignedUnitRefs = useMemo(
    () => [{ bookId: liveRequest.bookId, unitId: liveRequest.unitId }],
    [liveRequest.bookId, liveRequest.unitId],
  )

  const onStoryStatusChange = useCallback((status: BooksWorkshopStoryToolsStatus) => {
    setStoryStatus(status)
  }, [])

  const onVocabStatusChange = useCallback((status: BooksWorkshopVocabToolsStatus) => {
    setVocabStatus(status)
  }, [])

  const onStartMark = useCallback(() => {
    const page = Math.max(1, liveRequest.pdfPage || 1)
    setMarkStart(String(page))
    setMarkEnd(String(page))
    setMarkPhase('span')
  }, [liveRequest.pdfPage])

  const onCancelMark = useCallback(() => {
    setMarkPhase('idle')
    setSpanStart(null)
    setSpanEnd(null)
    setMarkBusy(false)
  }, [])

  const onConfirmSpan = useCallback(() => {
    const start = parsePageInput(markStart)
    const end = parsePageInput(markEnd)
    if (start == null || end == null) {
      toast.error('Enter valid start and end pages.')
      return
    }
    if (end < start) {
      toast.error('End page must be at or after the start page.')
      return
    }
    setSpanStart(start)
    setSpanEnd(end)
    setMarkPhase('pickType')
  }, [markStart, markEnd])

  const onPickMarkType = useCallback(
    async (type: 'story' | 'vocab' | 'exercise') => {
      if (spanStart == null || spanEnd == null) {
        toast.error('Set the page span first.')
        setMarkPhase('span')
        return
      }

      if (type === 'vocab') {
        const pageRangeLabel = formatPartPageRangeLabel(spanStart, spanEnd)
        const localId = Date.now().toString(36)
        const partId = workshopManualVocabPartId(localId)
        const title = `Vocab ${pageRangeLabel}`
        setLiveRequest((prev) => ({
          ...prev,
          kind: 'vocab',
          pdfPage: spanStart,
          pageRangeLabel,
          partTitle: title,
          typeLabel: 'Vocab',
          storyId: null,
          lessonId: WORKSHOP_MANUAL_VOCAB_LESSON_ID,
          partId,
          startPageHint: spanStart,
          endPageHint: spanEnd,
        }))
        setMarkPhase('idle')
        setSpanStart(null)
        setSpanEnd(null)
        setWordsOpen(true)
        toast.success('Section marked as vocab — scan or edit words.')
        return
      }

      if (type === 'exercise') {
        const pageRangeLabel = formatPartPageRangeLabel(spanStart, spanEnd)
        setLiveRequest((prev) => ({
          ...prev,
          kind: 'exercise',
          pdfPage: spanStart,
          pageRangeLabel,
          partTitle: pageRangeLabel,
          typeLabel: 'Exercise',
          storyId: null,
          lessonId: null,
          partId: null,
        }))
        setPreferOpenExercises(true)
        setMarkPhase('idle')
        setSpanStart(null)
        setSpanEnd(null)
        toast.success('Section marked as exercise — box a task on the page.')
        return
      }

      setMarkBusy(true)
      const localId = `s${Date.now().toString(36)}`
      const storyId = readingStoryManualKey(liveRequest.bookId, liveRequest.unitId, localId)
      const pageRangeLabel = formatPartPageRangeLabel(spanStart, spanEnd)
      const title = `Story ${pageRangeLabel}`
      try {
        const res = await fetch('/api/reading-stories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storyId,
            bookId: liveRequest.bookId,
            unitId: liveRequest.unitId,
            lessonId: null,
            partId: null,
            title,
            startPage: spanStart,
            endPage: spanEnd,
            rangeConfirmed: true,
          }),
        })
        const data = (await res.json()) as { ok?: boolean; error?: string }
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Could not save this story section.')
        }
        setLiveRequest((prev) => ({
          ...prev,
          kind: 'story',
          storyId,
          pdfPage: spanStart,
          pageRangeLabel,
          partTitle: title,
          typeLabel: 'Story',
          lessonId: null,
          partId: null,
        }))
        setMarkPhase('idle')
        setSpanStart(null)
        setSpanEnd(null)
        toast.success('Section marked as story — use Text and Checks.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save this story section.')
      } finally {
        setMarkBusy(false)
      }
    },
    [spanStart, spanEnd, liveRequest.bookId, liveRequest.unitId],
  )

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-[var(--book-reading-mat)]">
      <FullscreenBookOverlay
        studentId={BOOKS_WORKSHOP_STUDENT_ID}
        assignedBookIds={assignedBookIds}
        assignedUnitRefs={assignedUnitRefs}
        isPrepMode
        preferBookId={liveRequest.bookId}
        preferUnitId={liveRequest.unitId}
        preferOpenPdfPage={liveRequest.pdfPage}
        preferOpenExercises={preferOpenExercises}
        open
        presented
        onClose={onClose}
        topChrome={
          <BooksWorkshopPlaceBar
            place={liveRequest}
            kind={liveRequest.kind}
            showStoryActions={storyToolsAvailable}
            onOpenText={() => setTextOpen(true)}
            onOpenChecks={() => setChecksOpen(true)}
            textReady={storyStatus.textReady}
            checksApproved={storyStatus.checksApproved}
            hasUsableChecks={storyStatus.hasUsableChecks}
            textOpen={textOpen}
            checksOpen={checksOpen}
            showVocabActions={vocabToolsAvailable}
            onOpenWords={() => setWordsOpen(true)}
            wordsReady={vocabStatus.wordsReady}
            wordsOpen={wordsOpen}
            showMarkAction={showMarkAction}
            markPhase={markPhase}
            markStart={markStart}
            markEnd={markEnd}
            onMarkStartChange={setMarkStart}
            onMarkEndChange={setMarkEnd}
            onStartMark={onStartMark}
            onCancelMark={onCancelMark}
            onConfirmSpan={onConfirmSpan}
            onPickMarkType={(type) => void onPickMarkType(type)}
            markBusy={markBusy}
          />
        }
      />
      {storyToolsAvailable ? (
        <BooksWorkshopStoryTools
          request={liveRequest}
          textOpen={textOpen}
          onTextOpenChange={setTextOpen}
          checksOpen={checksOpen}
          onChecksOpenChange={setChecksOpen}
          onStatusChange={onStoryStatusChange}
        />
      ) : null}
      {vocabToolsAvailable ? (
        <BooksWorkshopVocabTools
          request={liveRequest}
          wordsOpen={wordsOpen}
          onWordsOpenChange={setWordsOpen}
          onStatusChange={onVocabStatusChange}
        />
      ) : null}
    </div>
  )
}
