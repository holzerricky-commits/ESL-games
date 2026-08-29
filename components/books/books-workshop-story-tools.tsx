'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { StoryCheckPackPanel } from '@/components/books/story-check-pack-panel'
import {
  StoryTextFuelPanel,
  type StoryTextFuelBusy,
} from '@/components/books/story-text-fuel-panel'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import type { BooksWorkshopOpenRequest } from '@/lib/books/books-workshop'
import { fetchBooksLibraryCached } from '@/lib/books/fetch-books-library-cached'
import { getPdfTotalPages } from '@/lib/books/pdf-thumbnail-cache'
import {
  countUsableReadingCheckStops,
  type ReadingCheckPack,
} from '@/lib/books/reading-check-pack'
import { READING_CHECK_HOTSPOT_PLACE_UI_DISMISS_EVENT } from '@/lib/books/reading-check-hotspot-placement-events'
import {
  isManualReadingStoryId,
  parseManualReadingStoryId,
  parseOutlineReadingStoryId,
  resolveReadingStoryRange,
  type ReadingStoryMap,
  type ReadingStoryRangeOverride,
} from '@/lib/books/reading-story-map'
import { storyTextScanCanContinue } from '@/lib/books/reading-story-page-markers'
import {
  readingStoryTextStatus,
  type ReadingStoryTextRecord,
} from '@/lib/books/reading-story-text'
import type { StoryScanProgress, StoryTextScanMode } from '@/lib/books/story-text-scan-client'
import {
  startStoryTextScan,
  stopStoryTextScan,
  subscribeStoryTextScan,
} from '@/lib/books/story-text-scan-manager'
import { useSearchablePdfJob } from '@/lib/books/use-searchable-pdf-job'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'

const WORKSHOP_DIALOG_Z = 'z-[90]'

export type BooksWorkshopStoryToolsStatus = {
  textReady: boolean
  checksApproved: boolean
  hasUsableChecks: boolean
  loading: boolean
}

interface BooksWorkshopStoryToolsProps {
  request: BooksWorkshopOpenRequest
  textOpen: boolean
  onTextOpenChange: (open: boolean) => void
  checksOpen: boolean
  onChecksOpenChange: (open: boolean) => void
  onStatusChange?: (status: BooksWorkshopStoryToolsStatus) => void
}

/**
 * Workshop story modules host — no rail. Loads story data and opens Text / Checks dialogs
 * above the workshop shell (z-90).
 */
export function BooksWorkshopStoryTools({
  request,
  textOpen,
  onTextOpenChange,
  checksOpen,
  onChecksOpenChange,
  onStatusChange,
}: BooksWorkshopStoryToolsProps) {
  const storyId = request.storyId?.trim() ?? ''
  const { selectableRunning, selectableProgress, startSelectable, stopSelectable } =
    useSearchablePdfJob(storyId)
  const outlineParsed = useMemo(() => parseOutlineReadingStoryId(storyId), [storyId])
  const manualParsed = useMemo(() => parseManualReadingStoryId(storyId), [storyId])
  const isManual = Boolean(manualParsed) || isManualReadingStoryId(storyId)

  const story = useMemo<ReadingStoryMap | null>(() => {
    if (!storyId) return null
    if (outlineParsed) {
      return {
        id: storyId,
        bookId: outlineParsed.bookId,
        unitId: outlineParsed.unitId,
        lessonId: outlineParsed.lessonId,
        partId: outlineParsed.partId,
        title: request.partTitle?.trim() || request.typeLabel?.trim() || 'Story',
        lessonTitle: request.lessonTitle ?? undefined,
      }
    }
    if (manualParsed) {
      return {
        id: storyId,
        bookId: manualParsed.bookId,
        unitId: manualParsed.unitId,
        lessonId: null,
        partId: null,
        title: request.partTitle?.trim() || request.typeLabel?.trim() || 'Story',
        kind: 'manual',
      }
    }
    // Fallback when ids are already on the request
    if (request.bookId && request.unitId && isManualReadingStoryId(storyId)) {
      return {
        id: storyId,
        bookId: request.bookId,
        unitId: request.unitId,
        lessonId: null,
        partId: null,
        title: request.partTitle?.trim() || request.typeLabel?.trim() || 'Story',
        kind: 'manual',
      }
    }
    return null
  }, [
    storyId,
    outlineParsed,
    manualParsed,
    request.bookId,
    request.unitId,
    request.partTitle,
    request.typeLabel,
    request.lessonTitle,
  ])

  const loadBookId = story?.bookId ?? request.bookId
  const loadUnitId = story?.unitId ?? request.unitId

  const [book, setBook] = useState<BookRecord | null>(null)
  const [unit, setUnit] = useState<BookUnitRecord | null>(null)
  const [totalPdfPages, setTotalPdfPages] = useState<number | null>(null)
  const [override, setOverride] = useState<ReadingStoryRangeOverride | null>(null)
  const [textRecord, setTextRecord] = useState<ReadingStoryTextRecord | null>(null)
  const [textDraft, setTextDraft] = useState('')
  const [pack, setPack] = useState<ReadingCheckPack | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Exclude<StoryTextFuelBusy, 'scan'> | null>(null)
  const [scanProgress, setScanProgress] = useState<StoryScanProgress | null>(null)
  const [scanRunning, setScanRunning] = useState(false)

  const resolved = useMemo(() => {
    if (!story || !book || !unit) return null
    return resolveReadingStoryRange(story, book, unit, totalPdfPages, override)
  }, [story, book, unit, totalPdfPages, override])

  const pagesReady = Boolean(resolved && resolved.source !== 'none')
  const pageRangeLabel = pagesReady
    ? `p${resolved!.startDisplayPage}–${resolved!.endDisplayPage}`
    : request.pageRangeLabel?.trim() || null
  const hasStoryText = readingStoryTextStatus(textRecord?.text ?? textDraft) === 'ready'
  const canContinueScan = storyTextScanCanContinue({
    text: textDraft,
    startPdfPage: textRecord?.startPdfPage,
    endPdfPage: textRecord?.endPdfPage,
  })
  const defaultDisplayPage = pagesReady
    ? resolved!.startDisplayPage
    : Number.isFinite(request.pdfPage) && request.pdfPage >= 1
      ? Math.floor(request.pdfPage)
      : null
  const usableChecks = pack ? countUsableReadingCheckStops(pack) : 0
  const checksApproved = pack?.status === 'approved'

  useEffect(() => {
    onStatusChange?.({
      textReady: hasStoryText,
      checksApproved,
      hasUsableChecks: usableChecks > 0,
      loading,
    })
  }, [hasStoryText, checksApproved, usableChecks, loading, onStatusChange])

  useEffect(() => {
    function onDismissUi() {
      onChecksOpenChange(false)
    }
    window.addEventListener(READING_CHECK_HOTSPOT_PLACE_UI_DISMISS_EVENT, onDismissUi)
    return () => {
      window.removeEventListener(READING_CHECK_HOTSPOT_PLACE_UI_DISMISS_EVENT, onDismissUi)
    }
  }, [onChecksOpenChange])

  useEffect(() => {
    if (!story) return
    return subscribeStoryTextScan(story.id, (snap) => {
      setScanRunning(snap.running)
      setScanProgress(snap.progress)
      if (snap.lastText) {
        setTextRecord(snap.lastText)
        setTextDraft(snap.lastText.text)
      }
    })
  }, [story])

  useEffect(() => {
    if (!story || !loadBookId || !loadUnitId) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const lib = await fetchBooksLibraryCached()
        const nextBook = lib.books.find((b) => b.id === loadBookId) ?? null
        const nextUnit = nextBook?.units.find((u) => u.id === loadUnitId) ?? null
        if (!nextBook || !nextUnit) {
          throw new Error('Could not find this book in the library.')
        }
        if (cancelled) return
        setBook(nextBook)
        setUnit(nextUnit)

        const unitFileUrl = nextUnit.filePath ? makeUnitFileUrl(nextUnit.filePath) : null
        if (unitFileUrl) {
          try {
            const pages = await getPdfTotalPages(unitFileUrl)
            if (!cancelled) setTotalPdfPages(pages)
          } catch {
            if (!cancelled) setTotalPdfPages(null)
          }
        }

        const [storiesRes, textRes, packRes] = await Promise.all([
          fetch(
            `/api/reading-stories?bookId=${encodeURIComponent(loadBookId)}&unitId=${encodeURIComponent(loadUnitId)}`,
          ),
          fetch(`/api/reading-stories/text?storyId=${encodeURIComponent(story.id)}`),
          fetch(`/api/reading-stories/checks?storyId=${encodeURIComponent(story.id)}`),
        ])
        const storiesData = (await storiesRes.json()) as {
          ok?: boolean
          error?: string
          overrides?: ReadingStoryRangeOverride[]
        }
        const textData = (await textRes.json()) as {
          ok?: boolean
          error?: string
          text?: ReadingStoryTextRecord | null
        }
        const packData = (await packRes.json()) as {
          ok?: boolean
          error?: string
          pack?: ReadingCheckPack | null
        }
        if (!storiesRes.ok || !storiesData.ok) {
          throw new Error(storiesData.error || 'Could not load page range')
        }
        if (!textRes.ok || !textData.ok) {
          throw new Error(textData.error || 'Could not load story text')
        }
        if (!packRes.ok || !packData.ok) {
          throw new Error(packData.error || 'Could not load reading checks')
        }
        if (cancelled) return
        const match =
          storiesData.overrides?.find((row) => row.storyId === story.id) ??
          (outlineParsed
            ? storiesData.overrides?.find(
                (row) =>
                  row.partId != null &&
                  row.partId === outlineParsed.partId &&
                  row.lessonId === outlineParsed.lessonId,
              )
            : null) ??
          null
        setOverride(match)
        const record = textData.text ?? null
        setTextRecord(record)
        setTextDraft(record?.text ?? '')
        setPack(packData.pack ?? null)
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Could not load story tools')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [story, loadBookId, loadUnitId, outlineParsed])

  const scanText = useCallback(
    (opts?: { mode?: StoryTextScanMode }) => {
      if (!story) return
      if (!pagesReady) {
        toast.error('Set pages for this story first.')
        return
      }
      const mode = opts?.mode ?? 'full'
      const existing =
        mode === 'continue' && textRecord
          ? { ...textRecord, text: textDraft || textRecord.text }
          : null
      startStoryTextScan({
        storyId: story.id,
        bookId: story.bookId,
        unitId: story.unitId,
        lessonId: story.lessonId,
        partId: story.partId,
        title: story.title,
        totalPdfPages,
        mode,
        existingText: existing,
      })
    },
    [story, pagesReady, textRecord, textDraft, totalPdfPages],
  )

  function stopScan() {
    if (!story) return
    stopStoryTextScan(story.id)
  }

  async function saveTextPaste(): Promise<boolean> {
    if (!story) return false
    setBusy('saveText')
    try {
      const res = await fetch('/api/reading-stories/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          storyId: story.id,
          bookId: story.bookId,
          unitId: story.unitId,
          text: textDraft,
          startDisplayPage: pagesReady ? resolved!.startDisplayPage : undefined,
          endDisplayPage: pagesReady ? resolved!.endDisplayPage : undefined,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        text?: ReadingStoryTextRecord
        error?: string
      }
      if (!data.ok || !data.text) {
        toast.error(data.error ?? 'Could not save text.')
        return false
      }
      setTextRecord(data.text)
      setTextDraft(data.text.text)
      toast.success('Story text saved.')
      return true
    } catch {
      toast.error('Could not save text.')
      return false
    } finally {
      setBusy(null)
    }
  }

  const fuelBusy: StoryTextFuelBusy =
    busy === 'saveText' ? 'saveText' : scanRunning ? 'scan' : null

  if (!storyId || !story) return null

  return (
    <>
      <StoryTextFuelPanel
        storyTitle={story.title}
        pageRangeLabel={pageRangeLabel}
        textDraft={textDraft}
        onTextDraftChange={setTextDraft}
        hasStoryText={hasStoryText}
        busy={fuelBusy}
        scanProgress={scanProgress}
        onScan={(opts) => scanText(opts)}
        onStopScan={stopScan}
        onSave={() => saveTextPaste()}
        scanDisabled={!pagesReady}
        canContinueScan={canContinueScan}
        onMakeSelectable={() => {
          if (!story) return
          if (!pagesReady) {
            toast.error('Set pages for this story first.')
            return
          }
          startSelectable({
            bookId: story.bookId,
            unitId: story.unitId,
            lessonId: story.lessonId,
            partId: story.partId,
            title: story.title,
            totalPdfPages,
          })
        }}
        onStopMakeSelectable={stopSelectable}
        selectableProgress={selectableProgress}
        selectableRunning={selectableRunning}
        dialogOpen={textOpen}
        onDialogOpenChange={onTextOpenChange}
        hideCollapsedRow
        dialogClassName={WORKSHOP_DIALOG_Z}
        dialogOverlayClassName={WORKSHOP_DIALOG_Z}
      />
      <StoryCheckPackPanel
        storyId={story.id}
        bookId={story.bookId}
        unitId={story.unitId}
        storyTitle={story.title}
        hasStoryText={hasStoryText}
        lessonLinked={!isManual}
        lessonId={story.lessonId}
        pack={pack}
        defaultDisplayPage={defaultDisplayPage}
        onPackChange={setPack}
        onOpenStoryText={() => onTextOpenChange(true)}
        dialogOpen={checksOpen}
        onDialogOpenChange={onChecksOpenChange}
        hideCollapsedRow
        dialogClassName={WORKSHOP_DIALOG_Z}
        dialogOverlayClassName={WORKSHOP_DIALOG_Z}
      />
    </>
  )
}
