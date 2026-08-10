'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, ListChecks, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CHECKS_DIALOG_STYLE } from '@/components/books/checks-editor-theme'
import { StoryCheckPackPanel } from '@/components/books/story-check-pack-panel'
import { StoryTextFuelPanel } from '@/components/books/story-text-fuel-panel'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import { fetchBooksLibraryCached } from '@/lib/books/fetch-books-library-cached'
import { getPdfTotalPages } from '@/lib/books/pdf-thumbnail-cache'
import {
  countUsableReadingCheckStops,
  createReadingCheckHotspotPlacement,
  type ReadingCheckPack,
} from '@/lib/books/reading-check-pack'
import {
  mergeStoriesForBook,
  readingStoryManualKey,
  resolveReadingStoryRange,
  type ReadingStoryMap,
  type ReadingStoryRangeOverride,
} from '@/lib/books/reading-story-map'
import {
  readingStoryTextStatus,
  type ReadingStoryTextRecord,
} from '@/lib/books/reading-story-text'
import { storyTextScanCanContinue } from '@/lib/books/reading-story-page-markers'
import type { StoryScanProgress, StoryTextScanMode } from '@/lib/books/story-text-scan-client'
import {
  startStoryTextScan,
  stopStoryTextScan,
  subscribeStoryTextScan,
} from '@/lib/books/story-text-scan-manager'
import {
  READING_CHECK_HOTSPOT_PLACE_RESULT_EVENT,
  READING_CHECK_HOTSPOT_PLACE_UI_DISMISS_EVENT,
  type ReadingCheckHotspotPlaceResultDetail,
} from '@/lib/books/reading-check-hotspot-placement-events'
import type { BookLibraryPayload, BookRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

const PREP_STORY_THUMB_WIDTH = 52

function PrepStepHeader({
  step,
  label,
  done,
  active,
  trailing,
}: {
  step: number | null
  label: string
  done?: boolean
  active?: boolean
  trailing?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
            done
              ? 'bg-[var(--checks-ok-soft)] text-[var(--checks-ok)]'
              : active
                ? 'bg-[var(--checks-accent-soft)] text-[var(--checks-accent)]'
                : 'bg-[var(--checks-bg)] text-[var(--checks-muted)]',
          )}
        >
          {done ? (
            <Check className="size-3.5" aria-hidden />
          ) : step == null ? (
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          ) : (
            step
          )}
        </span>
        <p
          className={cn(
            'text-xs font-semibold tracking-wide',
            active || done ? 'text-[var(--checks-ink)]' : 'text-[var(--checks-muted)]',
          )}
        >
          {label}
        </p>
      </div>
      {trailing}
    </div>
  )
}

export interface ReadingCheckPrepPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
  /** Locked to the book already open in Prep — no picker. */
  bookId?: string | null
  /** Locked to the unit already open in Prep — no picker. */
  unitId?: string | null
}

/**
 * Prep-room shortcut: create/pick a story (manual pages OK) → scan → draft/approve checks.
 * Saves through the same Stories APIs as Books → Stories.
 * Uses the book/unit currently open in Prep (not a separate book picker).
 */
export function ReadingCheckPrepPanel({
  open,
  onOpenChange,
  studentId: _studentId,
  bookId: lockedBookId = null,
  unitId: lockedUnitId = null,
}: ReadingCheckPrepPanelProps) {
  const [library, setLibrary] = useState<BookLibraryPayload | null>(null)
  const [stories, setStories] = useState<ReadingStoryMap[]>([])
  const [overridesById, setOverridesById] = useState<Record<string, ReadingStoryRangeOverride>>({})
  const [textById, setTextById] = useState<Record<string, ReadingStoryTextRecord>>({})
  const [packById, setPackById] = useState<Record<string, ReadingCheckPack>>({})
  const [storyId, setStoryId] = useState<string>('')
  const [pack, setPack] = useState<ReadingCheckPack | null>(null)
  const [textRecord, setTextRecord] = useState<ReadingStoryTextRecord | null>(null)
  const [textDraft, setTextDraft] = useState('')
  const [loadingStories, setLoadingStories] = useState(false)
  const [busy, setBusy] = useState<'create' | 'scan' | 'saveText' | 'savePages' | 'delete' | null>(null)
  const [unitPdfPages, setUnitPdfPages] = useState<number | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [scanProgress, setScanProgress] = useState<StoryScanProgress | null>(null)
  const [scanRunning, setScanRunning] = useState(false)
  const [textDialogOpen, setTextDialogOpen] = useState(false)

  const bookId = (lockedBookId ?? '').trim()
  const lockedUnit = (lockedUnitId ?? '').trim()

  const selectedBook = useMemo((): BookRecord | null => {
    if (!bookId || !library) return null
    return library.books.find((b) => b.id === bookId) ?? null
  }, [library, bookId])

  const unitId = useMemo(() => {
    if (lockedUnit) return lockedUnit
    if (!selectedBook) return ''
    // Single-unit books: no need for a separate pick
    if (selectedBook.units.length === 1) return selectedBook.units[0]?.id ?? ''
    return ''
  }, [lockedUnit, selectedBook])

  const selectedUnit = useMemo(() => {
    if (!selectedBook || !unitId) return null
    return selectedBook.units.find((u) => u.id === unitId) ?? null
  }, [selectedBook, unitId])

  const unitStories = useMemo(
    () => stories.filter((s) => s.unitId === unitId),
    [stories, unitId],
  )
  const activeStory = stories.find((s) => s.id === storyId) ?? null
  const hasStoryText = readingStoryTextStatus(textRecord?.text) === 'ready'
  const bookReady = Boolean(bookId && unitId && selectedBook && selectedUnit)
  const needsUnitFromMap =
    Boolean(bookId && selectedBook && selectedBook.units.length > 1 && !lockedUnit)
  const unitFileUrl = selectedUnit?.filePath ? makeUnitFileUrl(selectedUnit.filePath) : null
  const unitPdfReady = Boolean(unitFileUrl)

  useEffect(() => {
    if (open) return
    // Keep background scans running — only clear local non-scan busy chrome.
    setBusy((prev) => (prev === 'scan' ? null : prev))
  }, [open])

  useEffect(() => {
    if (!storyId) {
      setScanProgress(null)
      setScanRunning(false)
      return
    }
    return subscribeStoryTextScan(storyId, (snap) => {
      setScanRunning(snap.running)
      setScanProgress(snap.progress)
      if (snap.lastText) {
        setTextRecord(snap.lastText)
        setTextDraft(snap.lastText.text)
        setTextById((prev) => ({ ...prev, [storyId]: snap.lastText! }))
      }
    })
  }, [storyId])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void fetchBooksLibraryCached()
      .then((lib) => {
        if (cancelled) return
        setLibrary(lib)
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load books.')
      })
    return () => {
      cancelled = true
    }
  }, [open])

  // Reset story selection when the open book/unit changes
  useEffect(() => {
    setStoryId('')
    setPack(null)
    setTextRecord(null)
    setTextDraft('')
    setAddingNew(false)
    setUnitPdfPages(null)
    setTextDialogOpen(false)
  }, [bookId, unitId])

  useEffect(() => {
    if (!open || !unitFileUrl) {
      setUnitPdfPages(null)
      return
    }
    let cancelled = false
    void getPdfTotalPages(unitFileUrl)
      .then((n) => {
        if (!cancelled) setUnitPdfPages(n)
      })
      .catch(() => {
        if (!cancelled) setUnitPdfPages(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, unitFileUrl])

  useEffect(() => {
    function onDismissUi() {
      onOpenChange(false)
    }
    function onPlaceResult(event: Event) {
      const detail = (event as CustomEvent<ReadingCheckHotspotPlaceResultDetail>).detail
      if (!detail) return
      setPack((prev) => {
        if (!prev) return prev
        if (
          detail.storyId !== prev.storyId ||
          detail.bookId !== prev.bookId ||
          detail.unitId !== prev.unitId
        ) {
          return prev
        }
        return {
          ...prev,
          status: 'draft',
          approvedAt: null,
          stops: prev.stops.map((s) => {
            if (s.id !== detail.stopId) return s
            return {
              ...s,
              displayPage: detail.displayPage ?? s.displayPage,
              hotspot: createReadingCheckHotspotPlacement({
                pdfPage: detail.pdfPage,
                pageSide: detail.pageSide,
                x: detail.x,
                y: detail.y,
              }),
            }
          }),
        }
      })
    }
    window.addEventListener(READING_CHECK_HOTSPOT_PLACE_UI_DISMISS_EVENT, onDismissUi)
    window.addEventListener(READING_CHECK_HOTSPOT_PLACE_RESULT_EVENT, onPlaceResult)
    return () => {
      window.removeEventListener(READING_CHECK_HOTSPOT_PLACE_UI_DISMISS_EVENT, onDismissUi)
      window.removeEventListener(READING_CHECK_HOTSPOT_PLACE_RESULT_EVENT, onPlaceResult)
    }
  }, [onOpenChange])

  const loadStoriesForBook = useCallback(async (bid: string, book: BookRecord | null) => {
    if (!bid) {
      setStories([])
      setOverridesById({})
      setTextById({})
      setPackById({})
      return null
    }
    setLoadingStories(true)
    try {
      const [storiesRes, textRes, packsRes] = await Promise.all([
        fetch(`/api/reading-stories?bookId=${encodeURIComponent(bid)}`),
        fetch(`/api/reading-stories/text?bookId=${encodeURIComponent(bid)}`),
        fetch(`/api/reading-stories/checks?bookId=${encodeURIComponent(bid)}`),
      ])
      const storiesData = (await storiesRes.json()) as {
        ok?: boolean
        overrides?: ReadingStoryRangeOverride[]
        error?: string
      }
      const textData = (await textRes.json()) as { ok?: boolean; texts?: ReadingStoryTextRecord[] }
      const packsData = (await packsRes.json()) as { ok?: boolean; packs?: ReadingCheckPack[] }
      if (!storiesData.ok) {
        toast.error(storiesData.error ?? 'Could not load stories.')
        setStories([])
        setOverridesById({})
        setTextById({})
        setPackById({})
        return null
      }
      const overrides = storiesData.overrides ?? []
      const byId: Record<string, ReadingStoryRangeOverride> = {}
      for (const o of overrides) byId[o.storyId] = o
      setOverridesById(byId)
      const merged = mergeStoriesForBook(bid, overrides, book)
      setStories(merged)
      const nextText: Record<string, ReadingStoryTextRecord> = {}
      for (const record of textData.texts ?? []) nextText[record.storyId] = record
      setTextById(nextText)
      const nextPacks: Record<string, ReadingCheckPack> = {}
      for (const p of packsData.packs ?? []) nextPacks[p.storyId] = p
      setPackById(nextPacks)
      return { texts: textData.texts ?? [], packs: packsData.packs ?? [] }
    } catch {
      toast.error('Could not load stories.')
      setStories([])
      setOverridesById({})
      setTextById({})
      setPackById({})
      return null
    } finally {
      setLoadingStories(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !bookId || !selectedBook) return
    let cancelled = false
    void loadStoriesForBook(bookId, selectedBook).then((extra) => {
      if (cancelled || !extra) return
      // Keep selection if still valid after reload
      setStoryId((prev) => (prev && extra ? prev : ''))
    })
    return () => {
      cancelled = true
    }
  }, [open, bookId, selectedBook, loadStoriesForBook])

  useEffect(() => {
    if (!activeStory || !selectedBook || !selectedUnit) {
      setEditTitle('')
      setEditStart('')
      setEditEnd('')
      return
    }
    const override = overridesById[activeStory.id]
    setEditTitle(override?.title?.trim() || activeStory.title)
    const range = resolveReadingStoryRange(
      activeStory,
      selectedBook,
      selectedUnit,
      unitPdfPages,
      override,
    )
    if (range.source !== 'none') {
      setEditStart(String(range.startDisplayPage))
      setEditEnd(String(range.endDisplayPage))
    } else if (override) {
      setEditStart(String(override.startPage))
      setEditEnd(String(override.endPage))
    } else {
      setEditStart('')
      setEditEnd('')
    }
  }, [activeStory, overridesById, selectedBook, selectedUnit, unitPdfPages])

  useEffect(() => {
    if (!storyId || !bookId) {
      setPack(null)
      setTextRecord(null)
      setTextDraft('')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [textRes, packRes] = await Promise.all([
          fetch(`/api/reading-stories/text?storyId=${encodeURIComponent(storyId)}`),
          fetch(`/api/reading-stories/checks?storyId=${encodeURIComponent(storyId)}`),
        ])
        const textData = (await textRes.json()) as {
          ok?: boolean
          text?: ReadingStoryTextRecord | null
        }
        const packData = (await packRes.json()) as {
          ok?: boolean
          pack?: ReadingCheckPack | null
        }
        if (cancelled) return
        const record = textData.ok ? textData.text ?? null : null
        setTextRecord(record)
        setTextDraft(record?.text ?? '')
        const nextPack = packData.ok ? packData.pack ?? null : null
        setPack(nextPack)
        if (record) {
          setTextById((prev) => ({ ...prev, [storyId]: record }))
        }
        if (nextPack) {
          setPackById((prev) => ({ ...prev, [storyId]: nextPack }))
        }
      } catch {
        if (!cancelled) {
          setTextRecord(null)
          setTextDraft('')
          setPack(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [storyId, bookId])

  async function createManualStory() {
    if (!selectedBook || !selectedUnit) {
      toast.error('Pick a book and unit.')
      return
    }
    const title = newTitle.trim()
    const startPage = Math.max(1, Math.floor(Number(newStart)))
    const endPage = Math.max(1, Math.floor(Number(newEnd)))
    if (!title) {
      toast.error('Give the story a title.')
      return
    }
    if (!Number.isFinite(startPage) || !Number.isFinite(endPage)) {
      toast.error('Enter valid start and end pages.')
      return
    }
    setBusy('create')
    const localId = `s${Date.now().toString(36)}`
    const nextStoryId = readingStoryManualKey(selectedBook.id, selectedUnit.id, localId)
    try {
      const res = await fetch('/api/reading-stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: nextStoryId,
          bookId: selectedBook.id,
          unitId: selectedUnit.id,
          lessonId: null,
          partId: null,
          title,
          startPage: Math.min(startPage, endPage),
          endPage: Math.max(startPage, endPage),
          rangeConfirmed: true,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!data.ok) {
        toast.error(data.error ?? 'Could not add story.')
        return
      }
      toast.success('Story saved — same place as Books → Stories.')
      setAddingNew(false)
      setNewTitle('')
      setNewStart('')
      setNewEnd('')
      await loadStoriesForBook(selectedBook.id, selectedBook)
      setStoryId(nextStoryId)
    } catch {
      toast.error('Could not add story.')
    } finally {
      setBusy(null)
    }
  }

  async function saveStoryPages() {
    if (!activeStory || !selectedBook) return
    const title = editTitle.trim()
    const startPage = Math.max(1, Math.floor(Number(editStart)))
    const endPage = Math.max(1, Math.floor(Number(editEnd)))
    if (!title) {
      toast.error('Give the story a title.')
      return
    }
    if (!Number.isFinite(startPage) || !Number.isFinite(endPage)) {
      toast.error('Enter valid start and end pages.')
      return
    }
    setBusy('savePages')
    try {
      const res = await fetch('/api/reading-stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: activeStory.id,
          bookId: activeStory.bookId,
          unitId: activeStory.unitId,
          lessonId: activeStory.lessonId,
          partId: activeStory.partId,
          title,
          startPage: Math.min(startPage, endPage),
          endPage: Math.max(startPage, endPage),
          rangeConfirmed: true,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        override?: ReadingStoryRangeOverride
        error?: string
      }
      if (!data.ok || !data.override) {
        toast.error(data.error ?? 'Could not save pages.')
        return
      }
      setOverridesById((prev) => ({ ...prev, [data.override!.storyId]: data.override! }))
      await loadStoriesForBook(selectedBook.id, selectedBook)
      toast.success('Story pages updated.')
    } catch {
      toast.error('Could not save pages.')
    } finally {
      setBusy(null)
    }
  }

  async function deleteActiveStory() {
    if (!activeStory || !selectedBook) return
    const isManual = activeStory.id.startsWith('manual::')
    const ok = window.confirm(
      isManual
        ? `Delete “${activeStory.title}”? This removes pages, text, and checks.`
        : `Clear saved pages for “${activeStory.title}”? Story text and checks for this id are removed too.`,
    )
    if (!ok) return
    setBusy('delete')
    try {
      const res = await fetch('/api/reading-stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', storyId: activeStory.id }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!data.ok) {
        toast.error(data.error ?? 'Could not delete story.')
        return
      }
      setStoryId('')
      setPack(null)
      setTextRecord(null)
      setTextDraft('')
      await loadStoriesForBook(selectedBook.id, selectedBook)
      toast.success(isManual ? 'Story deleted.' : 'Saved story data cleared.')
    } catch {
      toast.error('Could not delete story.')
    } finally {
      setBusy(null)
    }
  }

  function stopScan() {
    if (!storyId) return
    stopStoryTextScan(storyId)
  }

  function scanText(opts?: { mode?: StoryTextScanMode }) {
    if (!activeStory || !selectedUnit) return
    const mode = opts?.mode ?? 'full'
    const existing =
      mode === 'continue' && textRecord
        ? { ...textRecord, text: textDraft || textRecord.text }
        : null
    startStoryTextScan({
      storyId: activeStory.id,
      bookId: activeStory.bookId,
      unitId: activeStory.unitId,
      lessonId: activeStory.lessonId,
      partId: activeStory.partId,
      title: editTitle.trim() || activeStory.title,
      mode,
      existingText: existing,
    })
  }

  async function saveTextPaste(): Promise<boolean> {
    if (!activeStory) return false
    setBusy('saveText')
    try {
      const res = await fetch('/api/reading-stories/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          storyId: activeStory.id,
          bookId: activeStory.bookId,
          unitId: activeStory.unitId,
          text: textDraft,
          startDisplayPage: Math.floor(Number(editStart)) || undefined,
          endDisplayPage: Math.floor(Number(editEnd)) || undefined,
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
      setTextById((prev) => ({ ...prev, [activeStory.id]: data.text! }))
      toast.success('Story text saved.')
      return true
    } catch {
      toast.error('Could not save text.')
      return false
    } finally {
      setBusy(null)
    }
  }

  const pageRangeLabel =
    editStart && editEnd ? `p${editStart}–${editEnd}` : null
  const pagesReady = Boolean(
    editStart &&
      editEnd &&
      Number.isFinite(Number(editStart)) &&
      Number.isFinite(Number(editEnd)),
  )
  const storyPicked = Boolean(activeStory) && !addingNew
  const textStepDone = hasStoryText
  const checksStepFocus = storyPicked && pagesReady && textStepDone
  const canContinueScan = storyTextScanCanContinue({
    text: textDraft,
    startPdfPage: textRecord?.startPdfPage,
    endPdfPage: textRecord?.endPdfPage,
  })

  function storyListMeta(story: ReadingStoryMap) {
    if (!selectedBook || !selectedUnit) {
      return {
        rangeLabel: null as string | null,
        thumbPdfPage: null as number | null,
        pagesLabel: 'Pages?',
        textLabel: 'Text?',
        checksLabel: 'Checks?',
      }
    }
    const range = resolveReadingStoryRange(
      story,
      selectedBook,
      selectedUnit,
      unitPdfPages,
      overridesById[story.id],
    )
    const rangeLabel =
      range.source === 'none'
        ? null
        : `p${range.startDisplayPage}–${range.endDisplayPage}`
    const pagesLabel =
      range.source === 'none'
        ? 'Pages?'
        : range.rangeConfirmed
          ? 'Pages ✓'
          : 'Pages ~'
    const textReady = readingStoryTextStatus(textById[story.id]?.text) === 'ready'
    const storyPack = packById[story.id]
    const checksLabel =
      storyPack?.status === 'approved' && countUsableReadingCheckStops(storyPack) > 0
        ? 'Checks ✓'
        : storyPack && countUsableReadingCheckStops(storyPack) > 0
          ? 'Draft'
          : 'Checks?'
    return {
      rangeLabel,
      thumbPdfPage: range.source === 'none' ? null : range.startPdfPage,
      pagesLabel,
      textLabel: textReady ? 'Text ✓' : 'Text?',
      checksLabel,
    }
  }

  function selectStory(id: string) {
    setAddingNew(false)
    setStoryId(id)
  }

  function clearStorySelection() {
    setStoryId('')
    setPack(null)
    setTextRecord(null)
    setTextDraft('')
    setTextDialogOpen(false)
  }

  function startAddStory() {
    clearStorySelection()
    setAddingNew(true)
  }

  function cancelAddStory() {
    setAddingNew(false)
    setNewTitle('')
    setNewStart('')
    setNewEnd('')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        style={CHECKS_DIALOG_STYLE}
      >
        <SheetHeader className="shrink-0 border-b border-[var(--checks-border)] bg-white px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold text-[var(--checks-ink)]">
            <ListChecks className="h-4 w-4 text-[var(--checks-accent)]" aria-hidden />
            Reading checks prep
          </SheetTitle>
          <p className="text-xs font-normal text-[var(--checks-muted)]">
            Pages → text → questions. Saves into Books → Stories for this title.
          </p>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[var(--checks-bg)]">
          <div className="space-y-3 px-4 py-4">
            <section className="rounded-xl border border-[var(--checks-border)] bg-white px-3 py-3">
              <PrepStepHeader step={null} label="Preparing" done={bookReady} active={!bookReady} />
              <div className="mt-2 pl-8">
                {bookReady && selectedBook && selectedUnit ? (
                  <p className="text-sm font-medium text-[var(--checks-ink)]">
                    {selectedBook.title}
                    {selectedUnit.title && selectedUnit.title !== selectedBook.title ? (
                      <span className="font-normal text-[var(--checks-muted)]">
                        {' '}
                        · {selectedUnit.title}
                      </span>
                    ) : null}
                  </p>
                ) : needsUnitFromMap ? (
                  <p className="text-sm text-[var(--checks-muted)]">
                    This title has more than one part. Open the part you’re prep-ing on the map,
                    then come back here.
                  </p>
                ) : (
                  <p className="text-sm text-[var(--checks-muted)]">
                    Open a book on the map first — prep uses that title, not a separate pick.
                  </p>
                )}
              </div>
            </section>

            {!bookReady ? null : (
              <div className="overflow-hidden rounded-xl border border-[var(--checks-border)] bg-white">
                <section className="space-y-3 border-b border-[var(--checks-border)] px-3 py-3">
                  <PrepStepHeader
                    step={1}
                    label="Story"
                    done={storyPicked}
                    active={!storyPicked}
                    trailing={
                      storyPicked ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-[var(--checks-muted)]"
                          onClick={clearStorySelection}
                        >
                          Change
                        </Button>
                      ) : null
                    }
                  />
                  <div className="space-y-2 pl-8">
                    {addingNew ? (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label htmlFor="prep-story-title">Title</Label>
                          <Input
                            id="prep-story-title"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="Story title"
                          />
                        </div>
                        <div className="flex gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="prep-story-start">Start page</Label>
                            <Input
                              id="prep-story-start"
                              className="w-24"
                              inputMode="numeric"
                              value={newStart}
                              onChange={(e) => setNewStart(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="prep-story-end">End page</Label>
                            <Input
                              id="prep-story-end"
                              className="w-24"
                              inputMode="numeric"
                              value={newEnd}
                              onChange={(e) => setNewEnd(e.target.value)}
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-[var(--checks-muted)]">
                          Use the book’s printed page numbers when this title has page alignment;
                          otherwise count from the start of the unit PDF.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy === 'create' || !selectedUnit}
                            onClick={() => void createManualStory()}
                          >
                            {busy === 'create' ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                Saving…
                              </>
                            ) : (
                              'Save story pages'
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy === 'create'}
                            onClick={cancelAddStory}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : storyPicked && activeStory ? (
                      (() => {
                        const meta = storyListMeta(activeStory)
                        return (
                          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--checks-border)] bg-[var(--checks-bg)]/60 p-2">
                            {unitFileUrl && meta.thumbPdfPage != null ? (
                              <PdfPageThumbnail
                                fileUrl={unitFileUrl}
                                unitId={activeStory.unitId}
                                pageNumber={meta.thumbPdfPage}
                                width={PREP_STORY_THUMB_WIDTH}
                                pdfReady={unitPdfReady}
                                label={`p${meta.thumbPdfPage}`}
                                eager
                              />
                            ) : (
                              <div
                                className="shrink-0 rounded-md border border-dashed border-[var(--checks-border)] bg-white"
                                style={{
                                  width: PREP_STORY_THUMB_WIDTH,
                                  aspectRatio: '1 / 1.414',
                                }}
                              />
                            )}
                            <div className="min-w-0 flex-1 pt-0.5">
                              <p className="text-sm font-medium text-[var(--checks-ink)]">
                                {editTitle.trim() || activeStory.title}
                              </p>
                              <p className="mt-0.5 text-[11px] text-[var(--checks-muted)]">
                                {meta.rangeLabel ?? 'Set pages below'}
                                {' · '}
                                {meta.pagesLabel}
                                {' · '}
                                {meta.textLabel}
                                {' · '}
                                {meta.checksLabel}
                              </p>
                            </div>
                          </div>
                        )
                      })()
                    ) : loadingStories ? (
                      <p className="text-xs text-[var(--checks-muted)]">Loading stories…</p>
                    ) : (
                      <div className="space-y-2">
                        {unitStories.length === 0 ? (
                          <p className="text-xs text-[var(--checks-muted)]">
                            No stories in this unit yet.
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {unitStories.map((story) => {
                              const meta = storyListMeta(story)
                              const title =
                                overridesById[story.id]?.title?.trim() || story.title
                              return (
                                <li key={story.id}>
                                  <button
                                    type="button"
                                    onClick={() => selectStory(story.id)}
                                    className="flex w-full items-start gap-2.5 rounded-lg border border-[var(--checks-border)] bg-[var(--checks-bg)]/40 p-2 text-left transition-colors hover:border-[var(--checks-accent)]/40 hover:bg-[var(--checks-accent-soft)]/40"
                                  >
                                    {unitFileUrl && meta.thumbPdfPage != null ? (
                                      <PdfPageThumbnail
                                        fileUrl={unitFileUrl}
                                        unitId={story.unitId}
                                        pageNumber={meta.thumbPdfPage}
                                        width={PREP_STORY_THUMB_WIDTH}
                                        pdfReady={unitPdfReady}
                                        label={`p${meta.thumbPdfPage}`}
                                      />
                                    ) : (
                                      <div
                                        className="flex shrink-0 items-center justify-center rounded-md border border-dashed border-[var(--checks-border)] bg-white text-[10px] text-[var(--checks-muted)]"
                                        style={{
                                          width: PREP_STORY_THUMB_WIDTH,
                                          aspectRatio: '1 / 1.414',
                                        }}
                                      >
                                        —
                                      </div>
                                    )}
                                    <span className="min-w-0 flex-1 pt-0.5">
                                      <span className="block text-sm font-medium text-[var(--checks-ink)]">
                                        {title}
                                      </span>
                                      <span className="mt-0.5 block text-[11px] text-[var(--checks-muted)]">
                                        {meta.rangeLabel ?? 'Pages not set'}
                                      </span>
                                      <span className="mt-1 flex flex-wrap gap-1">
                                        {[meta.pagesLabel, meta.textLabel, meta.checksLabel].map(
                                          (chip) => (
                                            <span
                                              key={chip}
                                              className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-[var(--checks-muted)] ring-1 ring-[var(--checks-border)]"
                                            >
                                              {chip}
                                            </span>
                                          ),
                                        )}
                                      </span>
                                    </span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full justify-center gap-1.5"
                          onClick={startAddStory}
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          {unitStories.length === 0 ? 'Add a story' : 'Add another story'}
                        </Button>
                      </div>
                    )}
                  </div>
                </section>

                {storyPicked && activeStory ? (
                  <>
                    <section className="space-y-3 border-b border-[var(--checks-border)] px-3 py-3">
                      <PrepStepHeader
                        step={2}
                        label="Pages"
                        done={pagesReady}
                        active={storyPicked && !pagesReady}
                        trailing={
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-[var(--checks-muted)] hover:text-rose-700"
                            disabled={busy === 'delete'}
                            onClick={() => void deleteActiveStory()}
                          >
                            {busy === 'delete' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            )}
                            <span className="sr-only">Delete story</span>
                          </Button>
                        }
                      />
                      <div className="space-y-2 pl-8">
                        <div className="space-y-1">
                          <Label htmlFor="prep-edit-title">Title</Label>
                          <Input
                            id="prep-edit-title"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="prep-edit-start">Start page</Label>
                            <Input
                              id="prep-edit-start"
                              className="w-24"
                              inputMode="numeric"
                              value={editStart}
                              onChange={(e) => setEditStart(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="prep-edit-end">End page</Label>
                            <Input
                              id="prep-edit-end"
                              className="w-24"
                              inputMode="numeric"
                              value={editEnd}
                              onChange={(e) => setEditEnd(e.target.value)}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy === 'savePages'}
                          onClick={() => void saveStoryPages()}
                        >
                          {busy === 'savePages' ? 'Saving…' : 'Update pages'}
                        </Button>
                      </div>
                    </section>

                    <section className="space-y-3 border-b border-[var(--checks-border)] px-3 py-3">
                      <PrepStepHeader
                        step={3}
                        label="Text"
                        done={textStepDone}
                        active={pagesReady && !textStepDone}
                      />
                      <div className="pl-8">
                        <StoryTextFuelPanel
                          storyTitle={editTitle.trim() || activeStory.title}
                          pageRangeLabel={pageRangeLabel}
                          textDraft={textDraft}
                          onTextDraftChange={setTextDraft}
                          hasStoryText={hasStoryText}
                          busy={
                            busy === 'saveText'
                              ? 'saveText'
                              : scanRunning || busy === 'scan'
                                ? 'scan'
                                : null
                          }
                          scanProgress={scanProgress}
                          onScan={(opts) => scanText(opts)}
                          onStopScan={stopScan}
                          onSave={() => saveTextPaste()}
                          scanDisabled={!pagesReady || !selectedUnit}
                          canContinueScan={canContinueScan}
                          dialogOpen={textDialogOpen}
                          onDialogOpenChange={setTextDialogOpen}
                        />
                      </div>
                    </section>

                    <section className="space-y-3 px-3 py-3">
                      <PrepStepHeader
                        step={4}
                        label="Checks"
                        done={pack?.status === 'approved'}
                        active={checksStepFocus || (storyPicked && pagesReady)}
                      />
                      <div className="pl-8">
                        <StoryCheckPackPanel
                          storyId={activeStory.id}
                          bookId={activeStory.bookId}
                          unitId={activeStory.unitId}
                          storyTitle={editTitle.trim() || activeStory.title}
                          hasStoryText={hasStoryText}
                          pack={pack}
                          defaultDisplayPage={
                            Number.isFinite(Number(editStart)) && Number(editStart) >= 1
                              ? Math.floor(Number(editStart))
                              : null
                          }
                          onPackChange={(next) => {
                            setPack(next)
                            if (next) {
                              setPackById((prev) => ({ ...prev, [activeStory.id]: next }))
                            }
                          }}
                          onOpenStoryText={() => setTextDialogOpen(true)}
                        />
                      </div>
                    </section>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
