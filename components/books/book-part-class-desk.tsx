'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, ListChecks, MousePointer2, PanelLeftOpen, ScrollText } from 'lucide-react'
import { BookPartChecksPrep } from '@/components/books/book-part-checks-prep'
import {
  BookPartPagesConfirm,
  type BookPartPagesDisplayRange,
} from '@/components/books/book-part-pages-confirm'
import { BookPartSelectablePrep, selectableStepState } from '@/components/books/book-part-selectable-prep'
import { BookPartStoryTextPrep } from '@/components/books/book-part-story-text-prep'
import { BOOK_WORKBENCH_LEFT_WIDTH_PX } from '@/components/books/book-workbench-shell'
import { FullscreenBookOverlay } from '@/components/students/fullscreen-book-overlay'
import {
  BOOK_CLASS_CHROME_THEME_VARS,
  BOOK_WORKSPACE_LEFT_BAR_WIDTH,
} from '@/components/students/fullscreen-book-overlay/constants'
import { DeskPanelHeader } from '@/components/students/fullscreen-book-overlay/sections/DeskPanelHeader'
import type { DeskStepStatus } from '@/components/students/fullscreen-book-overlay/sections/DeskStatusChip'
import { DeskStepList, DeskStepRow } from '@/components/students/fullscreen-book-overlay/sections/DeskStepList'
import { DeskToolRail } from '@/components/students/fullscreen-book-overlay/sections/DeskToolRail'
import type { BookReaderSpread } from '@/components/students/fullscreen-book-overlay/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BOOKS_WORKSHOP_STUDENT_ID } from '@/lib/books/books-workshop'
import type { ReadingCheckPack, ReadingCheckStop } from '@/lib/books/reading-check-pack'
import { mapPdfPageToDisplayLabel, resolveMappedPageToPdfPage } from '@/lib/books/page-numbering'
import { readingStoryPartKey } from '@/lib/books/reading-story-map'
import { readingStoryTextStatus } from '@/lib/books/reading-story-text'
import type { SearchablePdfRangeStatus } from '@/lib/books/searchable-pdf-client'
import { subscribeStoryTextScan } from '@/lib/books/story-text-scan-manager'
import { resolveOutlinePrintedStartPdfPage } from '@/lib/books/story-thumb-pdf-page'
import { useSearchablePdfJob } from '@/lib/books/use-searchable-pdf-job'
import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'

const CHECKS_RAIL_WIDTH_PX = 420
const NO_STOPS: readonly ReadingCheckStop[] = []

type DeskView = 'overview' | 'pages' | 'selectable' | 'text' | 'checks'

const DETAIL_TITLES: Record<Exclude<DeskView, 'overview'>, string> = {
  pages: 'Pages',
  selectable: 'Selectable pages',
  text: 'Story text',
  checks: 'Reading checks',
}

type StepState = { status: DeskStepStatus; label: string; summary: string; progressPercent?: number | null }

function printedPageNumber(
  pdfPage: number | null,
  book: BookRecord,
  unit: BookUnitRecord,
  totalPdfPages: number | null,
): number | null {
  if (pdfPage == null) return null
  const n = Number(mapPdfPageToDisplayLabel(pdfPage, book, unit, totalPdfPages))
  return Number.isFinite(n) && n >= 1 ? n : null
}

type ChecksSummary = { status: 'none' | 'draft' | 'approved'; count: number; autoApproved?: boolean }

function summarizeChecks(
  pack: { status?: string; stops?: readonly unknown[]; autoApprovedAt?: string | null } | null | undefined,
): ChecksSummary {
  const count = pack?.stops?.length ?? 0
  if (pack?.status === 'approved') return { status: 'approved', count, autoApproved: Boolean(pack.autoApprovedAt) }
  return { status: count > 0 ? 'draft' : 'none', count }
}

function checksLabel(count: number): string {
  return `${count} ${count === 1 ? 'check' : 'checks'}`
}

interface BookPartClassDeskProps {
  book: BookRecord
  unit: BookUnitRecord
  lesson: BookLessonRecord
  /** Part with its resolved structure tag. */
  part: BookLessonPartRecord
  partIndex: number
  partTypeLabel: string | null
  partTitle: string
  /** Outline page range for this part (printed / display pages). */
  rangeStart: number | null
  rangeEnd: number | null
  pdfReady: boolean
  totalPdfPages: number | null
  onPdfNumPages: (numPages: number) => void
  onBack: () => void
}

/**
 * Story part desk: the class reader in prep mode with a Story prep checklist in the left desk rail.
 * See `docs/BOOK_WORKBENCH_SHELL.md`.
 */
export function BookPartClassDesk({
  book,
  unit,
  lesson,
  part,
  partIndex,
  partTypeLabel,
  partTitle,
  rangeStart,
  rangeEnd,
  pdfReady,
  totalPdfPages,
  onPdfNumPages,
  onBack,
}: BookPartClassDeskProps) {
  const [view, setView] = useState<DeskView>('overview')
  const [railOpen, setRailOpen] = useState(true)
  const [textReady, setTextReady] = useState(false)
  const [textPartial, setTextPartial] = useState(false)
  const [textScan, setTextScan] = useState<{ running: boolean; percent: number | null; label: string | null }>({
    running: false,
    percent: null,
    label: null,
  })
  const [selectable, setSelectable] = useState<{ status: SearchablePdfRangeStatus; loading: boolean }>({
    status: 'unknown',
    loading: false,
  })
  const [pagesSavedKey, setPagesSavedKey] = useState(0)
  const [spread, setSpread] = useState<BookReaderSpread | null>(null)
  const [checksSummary, setChecksSummary] = useState<ChecksSummary>({ status: 'none', count: 0 })
  const [storyDisplayRange, setStoryDisplayRange] = useState<BookPartPagesDisplayRange | null>(null)
  const [checksDraft, setChecksDraft] = useState<ReadingCheckPack | null>(null)
  const [checksActiveStop, setChecksActiveStop] = useState<ReadingCheckStop | null>(null)
  const [requestedStopId, setRequestedStopId] = useState<string | null>(null)

  const storyId = useMemo(
    () => readingStoryPartKey(book.id, unit.id, lesson.id, part.id),
    [book.id, unit.id, lesson.id, part.id],
  )
  const assignedBookIds = useMemo(() => [book.id], [book.id])
  const assignedUnitRefs = useMemo(() => [{ bookId: book.id, unitId: unit.id }], [book.id, unit.id])

  const storyStartPrinted = storyDisplayRange?.startDisplay ?? rangeStart
  const storyStartPdfPage =
    resolveOutlinePrintedStartPdfPage(storyStartPrinted, book, unit, totalPdfPages) ??
    (typeof storyStartPrinted === 'number' ? Math.max(1, Math.floor(storyStartPrinted)) : 1)
  const [openPdfPage] = useState(storyStartPdfPage)

  const { selectableRunning, selectableProgress } = useSearchablePdfJob(storyId)

  const handleTextReadyChange = useCallback((ready: boolean) => {
    setTextReady(ready)
  }, [])

  const handleSelectableStatusChange = useCallback((status: SearchablePdfRangeStatus, loading: boolean) => {
    setSelectable((prev) => (prev.status === status && prev.loading === loading ? prev : { status, loading }))
  }, [])

  const handleRangeSaved = useCallback(() => {
    setPagesSavedKey((key) => key + 1)
  }, [])

  const handleSpreadChange = useCallback((next: BookReaderSpread) => {
    setSpread((prev) =>
      prev?.leftPdfPage === next.leftPdfPage && prev?.rightPdfPage === next.rightPdfPage ? prev : next,
    )
  }, [])

  useEffect(() => {
    return subscribeStoryTextScan(storyId, (snap) => {
      setTextScan({
        running: snap.running,
        percent: snap.running && snap.progress ? snap.progress.percent : null,
        label:
          snap.running && snap.progress
            ? `Scanning ${snap.progress.doneCount} of ${snap.progress.totalCount} pages`
            : null,
      })
    })
  }, [storyId])

  const spreadDisplayPages = useMemo(
    () =>
      spread
        ? {
            left: printedPageNumber(spread.leftPdfPage, book, unit, totalPdfPages),
            right: printedPageNumber(spread.rightPdfPage, book, unit, totalPdfPages),
          }
        : null,
    [spread, book, unit, totalPdfPages],
  )

  const handleChecksDraftChange = useCallback((next: ReadingCheckPack | null) => {
    setChecksDraft(next)
    setChecksSummary(summarizeChecks(next))
  }, [])

  const handleChecksActiveStopChange = useCallback((stop: ReadingCheckStop | null) => {
    setChecksActiveStop(stop)
  }, [])

  const handleStoryDisplayRangeChange = useCallback((next: BookPartPagesDisplayRange | null) => {
    setStoryDisplayRange((prev) => {
      if (next == null) return prev == null ? prev : null
      if (prev?.startDisplay === next.startDisplay && prev?.endDisplay === next.endDisplay) {
        return prev
      }
      return next
    })
  }, [])

  const openView = useCallback((next: DeskView) => {
    setView(next)
    setRailOpen(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [textRes, packRes] = await Promise.all([
          fetch(`/api/reading-stories/text?storyId=${encodeURIComponent(storyId)}`),
          fetch(`/api/reading-stories/checks?storyId=${encodeURIComponent(storyId)}`),
        ])
        const textData = (await textRes.json()) as {
          ok?: boolean
          text?: { text?: string } | null
        }
        const packData = (await packRes.json()) as {
          ok?: boolean
          pack?: { status?: string; stops?: unknown[]; autoApprovedAt?: string | null } | null
        }
        if (cancelled) return
        if (textData.ok) {
          setTextReady(readingStoryTextStatus(textData.text?.text) === 'ready')
        }
        if (packData.ok) {
          setChecksSummary(summarizeChecks(packData.pack))
        }
      } catch {
        // Steps stay in default todo state.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [storyId])

  useEffect(() => {
    if (requestedStopId && checksActiveStop?.id === requestedStopId) {
      setRequestedStopId(null)
    }
  }, [requestedStopId, checksActiveStop])

  const checksFocusPdfPage = useMemo(() => {
    if (view !== 'checks' || !checksActiveStop) return null
    if (typeof checksActiveStop.hotspot?.pdfPage === 'number' && checksActiveStop.hotspot.pdfPage >= 1) {
      return checksActiveStop.hotspot.pdfPage
    }
    if (typeof checksActiveStop.displayPage === 'number' && checksActiveStop.displayPage >= 1) {
      return resolveMappedPageToPdfPage(checksActiveStop.displayPage, book, unit, totalPdfPages)
    }
    return null
  }, [view, book, checksActiveStop, totalPdfPages, unit])

  const focusPdfPage = checksFocusPdfPage ?? storyStartPdfPage

  const prepCheckPins = useMemo(
    () =>
      view === 'checks'
        ? {
            storyId,
            stops: checksDraft?.stops ?? NO_STOPS,
            activeStopId: checksActiveStop?.id ?? null,
            onSelectStop: setRequestedStopId,
          }
        : null,
    [view, checksActiveStop?.id, checksDraft?.stops, storyId],
  )

  const pagesReady = storyDisplayRange != null
  const pagesStep: StepState = storyDisplayRange
    ? { status: 'done', label: 'Set', summary: `Pages ${storyDisplayRange.startDisplay}–${storyDisplayRange.endDisplay}` }
    : { status: 'todo', label: 'To do', summary: 'Confirm the story pages' }
  const selectableStep: StepState = {
    ...selectableStepState({
      pagesReady,
      running: selectableRunning,
      status: selectable.status,
      loading: selectable.loading,
    }),
    ...(selectableRunning && selectableProgress
      ? {
          summary: `Page ${selectableProgress.doneCount} of ${selectableProgress.totalCount}`,
          progressPercent: selectableProgress.percent,
        }
      : {}),
  }
  const textStep: StepState = textScan.running
    ? { status: 'running', label: 'Scanning', summary: textScan.label ?? 'Scanning', progressPercent: textScan.percent }
    : textPartial
      ? { status: 'attention', label: 'Partial', summary: 'Scan stopped part way' }
      : textReady
        ? { status: 'done', label: 'Ready', summary: 'Text saved' }
        : pagesReady
          ? { status: 'todo', label: 'To do', summary: 'Scan from the PDF or paste' }
          : { status: 'todo', label: 'Needs pages', summary: 'Set the story pages first' }
  const checksStep: StepState =
    checksSummary.status === 'approved'
      ? checksSummary.autoApproved
        ? {
            status: 'done',
            label: 'Approved (auto)',
            summary: `${checksLabel(checksSummary.count)} \u00b7 not reviewed yet`,
          }
        : { status: 'done', label: 'Approved', summary: checksLabel(checksSummary.count) }
      : checksSummary.status === 'draft'
        ? { status: 'attention', label: 'Draft', summary: `${checksLabel(checksSummary.count)} · not approved` }
        : textReady
          ? { status: 'todo', label: 'To do', summary: 'Generate or write checks' }
          : { status: 'todo', label: 'Needs text', summary: 'Add story text first' }
  const steps = [pagesStep, selectableStep, textStep, checksStep]
  const doneCount = steps.filter((step) => step.status === 'done').length

  const subtitle = [partTypeLabel, book.title].filter(Boolean).join(' · ')
  const railWidthPx = view === 'checks' ? CHECKS_RAIL_WIDTH_PX : BOOK_WORKBENCH_LEFT_WIDTH_PX
  const backToOverview = () => setView('overview')

  const deskRail = (
    <>
      <DeskToolRail
        open={railOpen}
        widthPx={railWidthPx}
        bodyClassName={
          view === 'checks' ? 'flex min-h-0 flex-col overflow-hidden overscroll-contain' : undefined
        }
        header={
          view === 'overview' ? (
            <DeskPanelHeader title={partTitle} subtitle={subtitle} onBack={onBack} backLabel="Back to parts" />
          ) : (
            <DeskPanelHeader
              title={DETAIL_TITLES[view]}
              subtitle={partTitle}
              onBack={backToOverview}
              backLabel="Back to story prep"
            />
          )
        }
      >
        {view === 'overview' ? (
          <DeskStepList label="Story prep" doneCount={doneCount} totalCount={steps.length}>
            <DeskStepRow
              icon={FileText}
              title="Pages"
              summary={pagesStep.summary}
              status={pagesStep.status}
              statusLabel={pagesStep.label}
              onClick={() => openView('pages')}
            />
            <DeskStepRow
              icon={MousePointer2}
              title="Selectable pages"
              summary={selectableStep.summary}
              status={selectableStep.status}
              statusLabel={selectableStep.label}
              progressPercent={selectableStep.progressPercent}
              onClick={() => openView('selectable')}
            />
            <DeskStepRow
              icon={ScrollText}
              title="Story text"
              summary={textStep.summary}
              status={textStep.status}
              statusLabel={textStep.label}
              progressPercent={textStep.progressPercent}
              onClick={() => openView('text')}
            />
            <DeskStepRow
              icon={ListChecks}
              title="Reading checks"
              summary={checksStep.summary}
              status={checksStep.status}
              statusLabel={checksStep.label}
              onClick={() => openView('checks')}
            />
          </DeskStepList>
        ) : null}
        {/* Tools stay mounted so Pages can auto-confirm and scans keep running between screens. */}
        <div className={view === 'pages' ? undefined : 'hidden'}>
          <BookPartPagesConfirm
            book={book}
            unit={unit}
            lesson={lesson}
            part={part}
            partIndex={partIndex}
            partTypeLabel={partTypeLabel}
            partTitle={partTitle}
            pdfReady={pdfReady}
            totalPdfPages={totalPdfPages}
            onPdfNumPages={onPdfNumPages}
            layout="controls"
            rail
            onDisplayRangeChange={handleStoryDisplayRangeChange}
            onRangeSaved={handleRangeSaved}
            spreadDisplayPages={spreadDisplayPages}
          />
        </div>
        <div className={view === 'selectable' ? undefined : 'hidden'}>
          <BookPartSelectablePrep
            book={book}
            unit={unit}
            lesson={lesson}
            part={part}
            totalPdfPages={totalPdfPages}
            pagesReady={pagesReady}
            refreshKey={pagesSavedKey}
            onStatusChange={handleSelectableStatusChange}
          />
        </div>
        <div className={view === 'text' ? undefined : 'hidden'}>
          <BookPartStoryTextPrep
            book={book}
            unit={unit}
            lesson={lesson}
            part={part}
            partIndex={partIndex}
            totalPdfPages={totalPdfPages}
            refreshKey={pagesSavedKey}
            onTextReadyChange={handleTextReadyChange}
            onPartialChange={setTextPartial}
          />
        </div>
        <div className={cn(view === 'checks' ? 'flex min-h-0 flex-1 flex-col' : 'hidden')}>
          <BookPartChecksPrep
            book={book}
            unit={unit}
            lesson={lesson}
            part={part}
            partIndex={partIndex}
            totalPdfPages={totalPdfPages}
            textReady={textReady}
            rail
            onOpenStoryText={() => openView('text')}
            onDraftChange={handleChecksDraftChange}
            onActiveStopChange={handleChecksActiveStopChange}
            requestedStopId={requestedStopId}
            className="h-full"
          />
        </div>
      </DeskToolRail>
      {!railOpen ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="dark absolute top-3 z-50 gap-1.5 rounded-full shadow-md"
          style={{
            ...BOOK_CLASS_CHROME_THEME_VARS,
            left: `calc(${BOOK_WORKSPACE_LEFT_BAR_WIDTH} + 12px)`,
          }}
          onClick={() => setRailOpen(true)}
        >
          <PanelLeftOpen className="h-4 w-4" aria-hidden />
          Story tools
        </Button>
      ) : null}
    </>
  )

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-[var(--book-reading-mat)]">
      <FullscreenBookOverlay
        studentId={BOOKS_WORKSHOP_STUDENT_ID}
        assignedBookIds={assignedBookIds}
        assignedUnitRefs={assignedUnitRefs}
        isPrepMode
        preferBookId={book.id}
        preferUnitId={unit.id}
        preferOpenPdfPage={openPdfPage}
        open
        presented
        onClose={onBack}
        deskRail={deskRail}
        deskRailOpen={railOpen}
        onDeskRailOpenChange={setRailOpen}
        deskRailWidthPx={railWidthPx}
        focusPdfPage={focusPdfPage}
        prepReadingCheckPins={prepCheckPins}
        onSpreadChange={handleSpreadChange}
      />
    </div>
  )
}
