'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { BookBrowseCornerButton, BookBrowseSpreadPreview } from '@/components/books/book-browse-spread-preview'
import { LessonFrameFuelPanel } from '@/components/books/lesson-frame-fuel-panel'
import { LiteratureWorkshopLinkForm } from '@/components/books/literature-workshop-link-panel'
import { StopCheckHarvestPanel } from '@/components/books/stop-check-harvest-panel'
import { StoryRangeSpreadPreview } from '@/components/books/story-range-spread-preview'
import { StoryCheckPackPanel } from '@/components/books/story-check-pack-panel'
import { StoryTextFuelPanel, type StoryTextFuelPanelProps } from '@/components/books/story-text-fuel-panel'
import type { ScanNotice } from '@/components/books/dismissible-scan-notice'
import { isLessonFrameReady, type LessonFrameRecord } from '@/lib/books/lesson-frame'
import { isLiteratureReadingBook } from '@/lib/books/reading-story-workshop-peers'
import type { ReadingStoryWorkshopLink } from '@/lib/books/reading-story-workshop-link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import type {
  ReadingStoryMap,
  ReadingStoryPdfRange,
  ReadingStoryRangeOverride,
} from '@/lib/books/reading-story-map'
import {
  countUsableReadingCheckStops,
  type ReadingCheckPack,
} from '@/lib/books/reading-check-pack'
import {
  getReadingStoryPageStatus,
  mergeStoriesForBook,
  readingStoryManualKey,
  resolveReadingStoryRange,
  resolveStoryDisplayRangeToPdfPages,
} from '@/lib/books/reading-story-map'
import {
  readingStoryTextStatus,
  type ReadingStoryTextRecord,
} from '@/lib/books/reading-story-text'
import { storyTextScanCanContinue } from '@/lib/books/reading-story-page-markers'
import {
  runChunkedStoryTextScan,
  type StoryScanProgress,
  type StoryTextScanMode,
} from '@/lib/books/story-text-scan-client'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'
import { useSearchablePdfJob } from '@/lib/books/use-searchable-pdf-job'

interface BookStoriesTabProps {
  book: BookRecord
  /** Full library — used to pick peer Workshop books on Literature. */
  libraryBooks?: BookRecord[]
  selectedUnit: BookUnitRecord | null
  numPages: number | null
  currentPdfPage: number | null
  pdfReady: boolean
  onPdfNumPages?: (numPages: number) => void
  /** Deep link from Prepare glance — scroll/highlight this story row. */
  focusStoryId?: string | null
}

type StoryRowState = {
  startPage: string
  endPage: string
  saving: boolean
}

/** `'all'` or a concrete unit id */
type UnitFilterId = 'all' | string

function StoryTextFuelWithSelectable({
  story,
  totalPdfPages,
  scanDisabled,
  ...fuelProps
}: {
  story: ReadingStoryMap
  totalPdfPages?: number | null
} & StoryTextFuelPanelProps) {
  const job = useSearchablePdfJob(story.id)
  return (
    <StoryTextFuelPanel
      {...fuelProps}
      scanDisabled={scanDisabled}
      onMakeSelectable={() => {
        if (scanDisabled) {
          toast.error('Set pages for this story first.')
          return
        }
        job.startSelectable({
          bookId: story.bookId,
          unitId: story.unitId,
          lessonId: story.lessonId,
          partId: story.partId,
          title: story.title,
          totalPdfPages,
        })
      }}
      onStopMakeSelectable={job.stopSelectable}
      selectableProgress={job.selectableProgress}
      selectableRunning={job.selectableRunning}
    />
  )
}

function kindLabel(kind: ReadingStoryMap['kind']): string | null {
  if (kind === 'main_story') return 'Main story'
  if (kind === 'paired_story') return 'Paired story'
  if (kind === 'manual') return 'Manual'
  return null
}

function draftMatchesOverride(
  state: StoryRowState | undefined,
  override: ReadingStoryRangeOverride | undefined,
): boolean {
  if (!state || !override?.rangeConfirmed) return false
  const start = Math.floor(Number(state.startPage))
  const end = Math.floor(Number(state.endPage))
  return start === override.startPage && end === override.endPage
}

export function BookStoriesTab({
  book,
  libraryBooks = [],
  selectedUnit,
  numPages,
  currentPdfPage,
  pdfReady,
  onPdfNumPages,
  focusStoryId = null,
}: BookStoriesTabProps) {
  const [stories, setStories] = useState<ReadingStoryMap[]>([])
  const [overridesById, setOverridesById] = useState<Record<string, ReadingStoryRangeOverride>>({})
  const [textById, setTextById] = useState<Record<string, ReadingStoryTextRecord>>({})
  const [packById, setPackById] = useState<Record<string, ReadingCheckPack>>({})
  /** Keyed by `${unitId}::${lessonId}` for local frames, or `${bookId}::${unitId}::${lessonId}` for Workshop */
  const [frameByLessonKey, setFrameByLessonKey] = useState<Record<string, LessonFrameRecord>>({})
  const [workshopLinkByStoryId, setWorkshopLinkByStoryId] = useState<
    Record<string, ReadingStoryWorkshopLink>
  >({})
  const literatureMode = isLiteratureReadingBook(book)
  const [textDraftById, setTextDraftById] = useState<Record<string, string>>({})
  const [textBusyId, setTextBusyId] = useState<string | null>(null)
  const [scanProgressById, setScanProgressById] = useState<Record<string, StoryScanProgress>>({})
  const [scanNoticeById, setScanNoticeById] = useState<Record<string, ScanNotice>>({})
  const scanAbortRef = useRef<AbortController | null>(null)
  const [loading, setLoading] = useState(true)
  const [rowState, setRowState] = useState<Record<string, StoryRowState>>({})
  const [editingPagesById, setEditingPagesById] = useState<Record<string, boolean>>({})
  const [textDialogStoryId, setTextDialogStoryId] = useState<string | null>(null)
  const [manualTitle, setManualTitle] = useState('')
  const [manualStart, setManualStart] = useState('')
  const [manualEnd, setManualEnd] = useState('')
  const [manualUnitId, setManualUnitId] = useState<string>('')
  const [adding, setAdding] = useState(false)
  const [unitFilter, setUnitFilter] = useState<UnitFilterId>('all')
  const [filterInitialized, setFilterInitialized] = useState(false)
  const [focusedStoryFlash, setFocusedStoryFlash] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [browseUnitId, setBrowseUnitId] = useState<string | null>(null)
  const [browsePage, setBrowsePage] = useState(1)
  const [browseNumPages, setBrowseNumPages] = useState<number | null>(null)

  const unitById = useMemo(() => {
    const map = new Map<string, BookUnitRecord>()
    for (const u of book.units) map.set(u.id, u)
    return map
  }, [book.units])

  const browsableUnits = useMemo(
    () => book.units.filter((unit) => Boolean(unit.filePath?.trim())),
    [book.units],
  )
  const browseUnit = browsableUnits.find((unit) => unit.id === browseUnitId) ?? null

  useEffect(() => {
    setPreviewOpen(false)
    setBrowseUnitId(null)
    setBrowsePage(1)
    setBrowseNumPages(null)
  }, [book.id])

  const openStoryInBook = useCallback(
    (unitId: string, pdfPage: number) => {
      const next = unitById.get(unitId)
      if (!next?.filePath?.trim()) return
      setBrowseNumPages((prev) => {
        if (!browseUnitId) return null
        const prevUnit = unitById.get(browseUnitId)
        return prevUnit?.filePath === next.filePath ? prev : null
      })
      setBrowseUnitId(unitId)
      setBrowsePage(Math.max(1, Math.floor(pdfPage)))
      setPreviewOpen(true)
    },
    [browseUnitId, unitById],
  )

  const syncRowFields = useCallback(
    (nextStories: ReadingStoryMap[], byId: Record<string, ReadingStoryRangeOverride>) => {
      const next: Record<string, StoryRowState> = {}
      for (const story of nextStories) {
        const unit = unitById.get(story.unitId)
        if (!unit) {
          next[story.id] = { startPage: '', endPage: '', saving: false }
          continue
        }
        const totalForUnit =
          selectedUnit?.id === unit.id ||
          (selectedUnit != null && selectedUnit.filePath === unit.filePath)
            ? numPages
            : null
        const range = resolveReadingStoryRange(story, book, unit, totalForUnit, byId[story.id])
        next[story.id] = {
          startPage: String(range.startDisplayPage),
          endPage: String(range.endDisplayPage),
          saving: false,
        }
      }
      setRowState(next)
    },
    [book, numPages, selectedUnit?.id, selectedUnit?.filePath, unitById],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [storiesRes, textRes, packsRes, framesRes, linksRes] = await Promise.all([
        fetch(`/api/reading-stories?bookId=${encodeURIComponent(book.id)}`),
        fetch(`/api/reading-stories/text?bookId=${encodeURIComponent(book.id)}`),
        fetch(`/api/reading-stories/checks?bookId=${encodeURIComponent(book.id)}`),
        fetch(`/api/reading-lessons/frame?bookId=${encodeURIComponent(book.id)}`),
        fetch(`/api/reading-stories/workshop-link?bookId=${encodeURIComponent(book.id)}`),
      ])
      const data = (await storiesRes.json()) as {
        ok?: boolean
        stories?: ReadingStoryMap[]
        overrides?: ReadingStoryRangeOverride[]
        error?: string
      }
      const textData = (await textRes.json()) as {
        ok?: boolean
        texts?: ReadingStoryTextRecord[]
      }
      const packsData = (await packsRes.json()) as {
        ok?: boolean
        packs?: ReadingCheckPack[]
      }
      const framesData = (await framesRes.json()) as {
        ok?: boolean
        frames?: LessonFrameRecord[]
      }
      const linksData = (await linksRes.json()) as {
        ok?: boolean
        links?: ReadingStoryWorkshopLink[]
      }
      if (!data.ok) {
        toast.error(data.error ?? 'Could not load stories.')
        return
      }
      const overrides = data.overrides ?? []
      const byId: Record<string, ReadingStoryRangeOverride> = {}
      for (const o of overrides) byId[o.storyId] = o
      const nextStories = mergeStoriesForBook(book.id, overrides, book)
      setOverridesById(byId)
      setStories(nextStories)
      syncRowFields(nextStories, byId)

      const nextText: Record<string, ReadingStoryTextRecord> = {}
      const nextDraft: Record<string, string> = {}
      for (const record of textData.texts ?? []) {
        nextText[record.storyId] = record
        nextDraft[record.storyId] = record.text
      }
      setTextById(nextText)
      setTextDraftById(nextDraft)

      const nextPacks: Record<string, ReadingCheckPack> = {}
      for (const pack of packsData.packs ?? []) {
        nextPacks[pack.storyId] = pack
      }
      setPackById(nextPacks)

      const nextFrames: Record<string, LessonFrameRecord> = {}
      for (const frame of framesData.frames ?? []) {
        nextFrames[`${frame.unitId}::${frame.lessonId}`] = frame
        nextFrames[`${frame.bookId}::${frame.unitId}::${frame.lessonId}`] = frame
      }
      setFrameByLessonKey(nextFrames)

      const nextLinks: Record<string, ReadingStoryWorkshopLink> = {}
      for (const link of linksData.links ?? []) {
        nextLinks[link.storyId] = link
      }
      setWorkshopLinkByStoryId(nextLinks)

      // Prefetch Workshop frames for linked stories
      const workshopBookIds = [
        ...new Set((linksData.links ?? []).map((l) => l.workshopBookId)),
      ].filter((id) => id && id !== book.id)
      await Promise.all(
        workshopBookIds.map(async (wsBookId) => {
          try {
            const res = await fetch(
              `/api/reading-lessons/frame?bookId=${encodeURIComponent(wsBookId)}`,
            )
            const payload = (await res.json()) as { ok?: boolean; frames?: LessonFrameRecord[] }
            if (!payload.ok || !payload.frames) return
            setFrameByLessonKey((prev) => {
              const copy = { ...prev }
              for (const frame of payload.frames!) {
                copy[`${frame.unitId}::${frame.lessonId}`] = frame
                copy[`${frame.bookId}::${frame.unitId}::${frame.lessonId}`] = frame
              }
              return copy
            })
          } catch {
            // ignore
          }
        }),
      )
    } catch {
      toast.error('Could not load stories.')
    } finally {
      setLoading(false)
    }
  }, [book, syncRowFields])

  useEffect(() => {
    void load()
  }, [load])

  const unitsWithStories = useMemo(() => {
    const ids = new Set(stories.map((s) => s.unitId))
    const list = book.units.filter((u) => ids.has(u.id))
    return list.length > 0 ? list : book.units
  }, [book.units, stories])

  useEffect(() => {
    if (filterInitialized || loading) return
    const focus = focusStoryId?.trim()
    const focusStory = focus ? stories.find((s) => s.id === focus) : null
    if (focusStory) {
      setUnitFilter(focusStory.unitId)
    } else if (selectedUnit && stories.some((s) => s.unitId === selectedUnit.id)) {
      setUnitFilter(selectedUnit.id)
    } else if (unitsWithStories[0]) {
      setUnitFilter(unitsWithStories[0].id)
    } else {
      setUnitFilter('all')
    }
    setFilterInitialized(true)
  }, [filterInitialized, loading, selectedUnit, stories, unitsWithStories, focusStoryId])

  useEffect(() => {
    if (unitFilter !== 'all') {
      setManualUnitId(unitFilter)
    } else if (selectedUnit) {
      setManualUnitId(selectedUnit.id)
    } else if (book.units[0]) {
      setManualUnitId(book.units[0].id)
    }
  }, [unitFilter, selectedUnit, book.units])

  const filteredStories = useMemo(() => {
    if (unitFilter === 'all') return stories
    return stories.filter((s) => s.unitId === unitFilter)
  }, [stories, unitFilter])

  useEffect(() => {
    const focus = focusStoryId?.trim()
    if (!focus || loading || !filterInitialized) return
    if (!filteredStories.some((s) => s.id === focus)) return
    const el = document.getElementById(`reading-story-row-${focus}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFocusedStoryFlash(true)
    const t = window.setTimeout(() => setFocusedStoryFlash(false), 2200)
    return () => window.clearTimeout(t)
  }, [focusStoryId, loading, filterInitialized, filteredStories])
  const groupedByUnit = useMemo(() => {
    const groups: { unit: BookUnitRecord | null; unitId: string; stories: ReadingStoryMap[] }[] = []
    const order: string[] = []
    const map = new Map<string, ReadingStoryMap[]>()
    for (const story of filteredStories) {
      if (!map.has(story.unitId)) {
        map.set(story.unitId, [])
        order.push(story.unitId)
      }
      map.get(story.unitId)!.push(story)
    }
    for (const unitId of order) {
      groups.push({
        unitId,
        unit: unitById.get(unitId) ?? null,
        stories: map.get(unitId) ?? [],
      })
    }
    return groups
  }, [filteredStories, unitById])

  const progress = useMemo(() => {
    let confirmed = 0
    let needText = 0
    let approved = 0
    for (const story of filteredStories) {
      const range = (() => {
        const unit = unitById.get(story.unitId)
        if (!unit) return null
        const totalForUnit =
          selectedUnit?.id === unit.id ||
          (selectedUnit != null && selectedUnit.filePath === unit.filePath)
            ? numPages
            : null
        return resolveReadingStoryRange(story, book, unit, totalForUnit, overridesById[story.id])
      })()
      const pageStatus = range ? getReadingStoryPageStatus(range) : 'none'
      if (pageStatus === 'confirmed') confirmed += 1
      if (readingStoryTextStatus(textById[story.id]?.text) !== 'ready') needText += 1
      const pack = packById[story.id]
      if (pack?.status === 'approved' && countUsableReadingCheckStops(pack) > 0) approved += 1
    }
    return { confirmed, needText, approved, total: filteredStories.length }
  }, [filteredStories, unitById, selectedUnit, numPages, book, overridesById, textById, packById])

  function rangeFor(story: ReadingStoryMap): ReadingStoryPdfRange | null {
    const unit = unitById.get(story.unitId)
    if (!unit) return null
    const totalForUnit =
      selectedUnit?.id === unit.id ||
      (selectedUnit != null && selectedUnit.filePath === unit.filePath)
        ? numPages
        : null
    return resolveReadingStoryRange(story, book, unit, totalForUnit, overridesById[story.id])
  }

  function livePdfRangeForDraft(
    unit: BookUnitRecord,
    draftStart: number,
    draftEnd: number,
  ): { startPdfPage: number; endPdfPage: number } {
    const totalForUnit =
      selectedUnit?.id === unit.id ||
      (selectedUnit != null && selectedUnit.filePath === unit.filePath)
        ? numPages
        : null
    return resolveStoryDisplayRangeToPdfPages(book, unit, totalForUnit, draftStart, draftEnd, {
      tocAnchored: true,
    })
  }

  async function saveStoryRange(story: ReadingStoryMap, confirm: boolean) {
    const state = rowState[story.id]
    if (!state) return
    const startPage = Math.max(1, Math.floor(Number(state.startPage)))
    const endPage = Math.max(1, Math.floor(Number(state.endPage)))
    if (!Number.isFinite(startPage) || !Number.isFinite(endPage)) {
      toast.error('Enter valid start and end pages.')
      return
    }
    setRowState((prev) => ({ ...prev, [story.id]: { ...state, saving: true } }))
    try {
      const res = await fetch('/api/reading-stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: story.id,
          bookId: story.bookId,
          unitId: story.unitId,
          lessonId: story.lessonId,
          partId: story.partId,
          title: story.title,
          startPage,
          endPage,
          rangeConfirmed: confirm,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; override?: ReadingStoryRangeOverride; error?: string }
      if (!data.ok || !data.override) {
        toast.error(data.error ?? 'Could not save.')
        return
      }
      setOverridesById((prev) => ({ ...prev, [data.override!.storyId]: data.override! }))
      setEditingPagesById((prev) => ({ ...prev, [story.id]: false }))
      toast.success(confirm ? 'Story pages confirmed.' : 'Story pages saved.')
    } catch {
      toast.error('Could not save.')
    } finally {
      setRowState((prev) => {
        const cur = prev[story.id]
        if (!cur) return prev
        return { ...prev, [story.id]: { ...cur, saving: false } }
      })
    }
  }

  async function scanStoryText(
    story: ReadingStoryMap,
    opts?: { mode?: StoryTextScanMode },
  ) {
    const unit = unitById.get(story.unitId)
    if (!unit) {
      toast.error('Unit missing for this story.')
      return
    }
    const mode = opts?.mode ?? 'full'
    scanAbortRef.current?.abort()
    const controller = new AbortController()
    scanAbortRef.current = controller
    setTextBusyId(story.id)
    setScanNoticeById((prev) => {
      const copy = { ...prev }
      delete copy[story.id]
      return copy
    })
    setScanProgressById((prev) => ({
      ...prev,
      [story.id]: {
        pages: [],
        doneCount: 0,
        totalCount: 0,
        percent: 0,
        activeLabel: null,
        message: 'Planning pages…',
      },
    }))
    try {
      const prior = textById[story.id] ?? null
      const draft = textDraftById[story.id] ?? prior?.text ?? ''
      const existing =
        mode === 'continue' && prior
          ? { ...prior, text: draft || prior.text }
          : null
      const result = await runChunkedStoryTextScan({
        storyId: story.id,
        bookId: story.bookId,
        unitId: story.unitId,
        lessonId: story.lessonId,
        partId: story.partId,
        title: story.title,
        totalPdfPages: numPages,
        signal: controller.signal,
        mode,
        existingText: existing,
        onProgress: (progress) => {
          setScanProgressById((prev) => ({ ...prev, [story.id]: progress }))
        },
        onChunkSaved: (text) => {
          setTextById((prev) => ({ ...prev, [story.id]: text }))
          setTextDraftById((prev) => ({ ...prev, [story.id]: text.text }))
        },
      })
      if (result.ok) {
        setTextById((prev) => ({ ...prev, [story.id]: result.text }))
        setTextDraftById((prev) => ({ ...prev, [story.id]: result.text.text }))
        if (result.interrupted) {
          setScanNoticeById((prev) => ({
            ...prev,
            [story.id]: {
              kind: 'info',
              message:
                'Scan stopped — finished pages were kept. Use Continue scan to finish. (Click to dismiss)',
            },
          }))
        } else {
          setScanNoticeById((prev) => ({
            ...prev,
            [story.id]: {
              kind: 'success',
              message:
                result.text.source === 'gemini'
                  ? 'Story text saved (read from page images). Click to dismiss.'
                  : 'Story text saved from the PDF. Click to dismiss.',
            },
          }))
        }
      } else if (result.text) {
        setTextById((prev) => ({ ...prev, [story.id]: result.text! }))
        setTextDraftById((prev) => ({ ...prev, [story.id]: result.text!.text }))
        setScanNoticeById((prev) => ({
          ...prev,
          [story.id]: {
            kind: 'error',
            message: `${result.error} Finished pages were kept. Click to dismiss.`,
          },
        }))
      } else if (result.error !== 'Scan stopped.') {
        setScanNoticeById((prev) => ({
          ...prev,
          [story.id]: {
            kind: 'error',
            message: `${result.error} Click to dismiss.`,
          },
        }))
      }
    } catch {
      setScanNoticeById((prev) => ({
        ...prev,
        [story.id]: {
          kind: 'error',
          message: 'Could not scan story text. Click to dismiss.',
        },
      }))
    } finally {
      if (scanAbortRef.current === controller) scanAbortRef.current = null
      setTextBusyId(null)
      setScanProgressById((prev) => {
        const next = { ...prev }
        delete next[story.id]
        return next
      })
    }
  }

  function stopStoryScan() {
    scanAbortRef.current?.abort()
  }

  async function saveStoryTextPaste(story: ReadingStoryMap): Promise<boolean> {
    const unit = unitById.get(story.unitId)
    if (!unit) return false
    const draft = textDraftById[story.id] ?? ''
    setTextBusyId(story.id)
    try {
      const res = await fetch('/api/reading-stories/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          storyId: story.id,
          bookId: story.bookId,
          unitId: story.unitId,
          text: draft,
          startDisplayPage: Math.floor(Number(rowState[story.id]?.startPage)) || undefined,
          endDisplayPage: Math.floor(Number(rowState[story.id]?.endPage)) || undefined,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; text?: ReadingStoryTextRecord; error?: string }
      if (!data.ok || !data.text) {
        toast.error(data.error ?? 'Could not save text.')
        return false
      }
      setTextById((prev) => ({ ...prev, [story.id]: data.text! }))
      setTextDraftById((prev) => ({ ...prev, [story.id]: data.text!.text }))
      toast.success('Story text saved.')
      return true
    } catch {
      toast.error('Could not save text.')
      return false
    } finally {
      setTextBusyId(null)
    }
  }

  async function addManualStory() {
    const unitId = manualUnitId.trim()
    const unit = unitById.get(unitId)
    if (!unit) {
      toast.error('Pick a unit for the new story.')
      return
    }
    const title = manualTitle.trim()
    const startPage = Math.max(1, Math.floor(Number(manualStart)))
    const endPage = Math.max(1, Math.floor(Number(manualEnd)))
    if (!title) {
      toast.error('Give the story a title.')
      return
    }
    if (!Number.isFinite(startPage) || !Number.isFinite(endPage)) {
      toast.error('Enter valid start and end pages.')
      return
    }
    setAdding(true)
    const localId = `s${Date.now().toString(36)}`
    const storyId = readingStoryManualKey(book.id, unit.id, localId)
    try {
      const res = await fetch('/api/reading-stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId,
          bookId: book.id,
          unitId: unit.id,
          lessonId: null,
          partId: null,
          title,
          startPage,
          endPage,
          rangeConfirmed: true,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!data.ok) {
        toast.error(data.error ?? 'Could not add story.')
        return
      }
      setManualTitle('')
      setManualStart('')
      setManualEnd('')
      toast.success('Story map added.')
      setUnitFilter(unit.id)
      await load()
    } catch {
      toast.error('Could not add story.')
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading stories…</p>
  }

  const filterUnitLabel =
    unitFilter === 'all' ? 'All units' : (unitById.get(unitFilter)?.title ?? 'This unit')

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">Reading stories</h4>
        <p className="text-sm text-muted-foreground">
          Confirm pages with the preview, then scan or paste story text for reading checks.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="stories-unit-filter" className="text-xs text-muted-foreground">
              Unit
            </Label>
            <Select value={unitFilter} onValueChange={(v) => setUnitFilter(v)}>
              <SelectTrigger id="stories-unit-filter" size="sm" className="min-w-[11rem]">
                <SelectValue placeholder="Choose unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All units</SelectItem>
                {unitsWithStories.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground">
            {progress.total} stor{progress.total === 1 ? 'y' : 'ies'}
            {progress.total > 0
              ? ` · ${progress.confirmed} confirmed · ${progress.needText} need text · ${progress.approved} approved`
              : null}
          </span>
        </div>
      </div>

      {filteredStories.length === 0 ? (
        <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
          No stories in {filterUnitLabel}. Switch to All units, pick another unit, or add a story manually below.
        </p>
      ) : (
        <div className="space-y-6">
          {groupedByUnit.map((group) => (
            <section key={group.unitId} className="space-y-3">
              {unitFilter === 'all' || groupedByUnit.length > 1 ? (
                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.unit?.title ?? group.unitId}
                </h5>
              ) : null}
              <ul className="space-y-4">
                {group.stories.map((story) => {
                  const unit = unitById.get(story.unitId)
                  const range = rangeFor(story)
                  const state = rowState[story.id]
                  const override = overridesById[story.id]
                  const pageStatus = range ? getReadingStoryPageStatus(range) : 'none'
                  const pagesConfirmed = pageStatus === 'confirmed'
                  const pagesDirty = pagesConfirmed && !draftMatchesOverride(state, override)
                  const editingPages =
                    !pagesConfirmed || pagesDirty || Boolean(editingPagesById[story.id])
                  const kind = kindLabel(story.kind)
                  const inside =
                    currentPdfPage != null &&
                    range &&
                    range.source !== 'none' &&
                    selectedUnit?.id === story.unitId
                      ? currentPdfPage >= range.startPdfPage && currentPdfPage <= range.endPdfPage
                      : false
                  const fileUrl = unit?.filePath ? makeUnitFileUrl(unit.filePath) : null
                  const draftStart = Math.floor(Number(state?.startPage))
                  const draftEnd = Math.floor(Number(state?.endPage))
                  const hasDraftRange =
                    Number.isFinite(draftStart) &&
                    draftStart >= 1 &&
                    Number.isFinite(draftEnd) &&
                    draftEnd >= 1
                  const totalForPreview =
                    selectedUnit?.id === story.unitId ||
                    (selectedUnit != null && unit != null && selectedUnit.filePath === unit.filePath)
                      ? numPages
                      : null
                  const livePdf =
                    unit && hasDraftRange ? livePdfRangeForDraft(unit, draftStart, draftEnd) : null

                  const textRecord = textById[story.id] ?? null
                  const textReady = readingStoryTextStatus(textRecord?.text) === 'ready'
                  const textBusy = textBusyId === story.id
                  const pageRangeLabel =
                    Number.isFinite(draftStart) &&
                    draftStart >= 1 &&
                    Number.isFinite(draftEnd) &&
                    draftEnd >= 1
                      ? `p${draftStart}–${draftEnd}`
                      : null
                  const fuelBusy: 'scan' | 'saveText' | null = textBusy
                    ? scanProgressById[story.id]
                      ? 'scan'
                      : 'saveText'
                    : null
                  const canContinueScan = storyTextScanCanContinue({
                    text: textDraftById[story.id] ?? textRecord?.text ?? '',
                    startPdfPage: textRecord?.startPdfPage,
                    endPdfPage: textRecord?.endPdfPage,
                  })
                  const lessonKey =
                    story.lessonId != null ? `${story.unitId}::${story.lessonId}` : null
                  const workshopLink = workshopLinkByStoryId[story.id] ?? null
                  const workshopFrameKey = workshopLink
                    ? `${workshopLink.workshopBookId}::${workshopLink.workshopUnitId}::${workshopLink.workshopLessonId}`
                    : null
                  const lessonFrame = lessonKey ? frameByLessonKey[lessonKey] ?? null : null
                  const workshopFrame = workshopFrameKey
                    ? frameByLessonKey[workshopFrameKey] ?? null
                    : null
                  const frameReady = literatureMode
                    ? isLessonFrameReady(workshopFrame)
                    : isLessonFrameReady(lessonFrame)
                  const lessonLinkedForGenerate = literatureMode
                    ? Boolean(workshopLink)
                    : Boolean(story.lessonId)

                  return (
                    <li
                      key={story.id}
                      id={`reading-story-row-${story.id}`}
                      className={
                        focusStoryId === story.id && focusedStoryFlash
                          ? 'rounded-lg border border-[var(--brand-blue)] bg-[color-mix(in_srgb,var(--brand-blue)_8%,transparent)] p-4 ring-2 ring-[var(--brand-blue)]/30'
                          : 'rounded-lg border border-[var(--border)] bg-background/60 p-4'
                      }
                    >
                      <div className="space-y-4">
                        {/* Header: preview + pages setup (outside fuel box) */}
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                          <div className="group relative w-[188px] shrink-0">
                            {fileUrl && unit && hasDraftRange && livePdf ? (
                              <StoryRangeSpreadPreview
                                fileUrl={fileUrl}
                                unitId={story.unitId}
                                book={book}
                                unit={unit}
                                pdfReady={pdfReady}
                                totalPdfPages={totalForPreview}
                                startPdfPage={livePdf.startPdfPage}
                                endPdfPage={livePdf.endPdfPage}
                                rangeStartDisplay={draftStart}
                                rangeEndDisplay={draftEnd}
                                onPdfNumPages={onPdfNumPages}
                                onRangeChange={(startDisplay, endDisplay) => {
                                  setRowState((prev) => ({
                                    ...prev,
                                    [story.id]: {
                                      startPage: String(startDisplay),
                                      endPage: String(endDisplay),
                                      saving: prev[story.id]?.saving ?? false,
                                    },
                                  }))
                                  if (pagesConfirmed) {
                                    setEditingPagesById((prev) => ({ ...prev, [story.id]: true }))
                                  }
                                }}
                              />
                            ) : (
                              <div className="flex h-[124px] w-[188px] items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-muted/30 text-[10px] text-muted-foreground">
                                No preview
                              </div>
                            )}
                            {unit?.filePath?.trim() &&
                            ((livePdf && livePdf.startPdfPage >= 1) ||
                              (range && range.source !== 'none')) ? (
                              <BookBrowseCornerButton
                                label="Open book at this story"
                                className="right-1.5 top-1.5"
                                onClick={() =>
                                  openStoryInBook(
                                    story.unitId,
                                    livePdf?.startPdfPage ?? range!.startPdfPage,
                                  )
                                }
                              />
                            ) : null}
                            {literatureMode ? (
                              <Popover modal={false}>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className={cn(
                                      'absolute -left-1 -top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background shadow-sm transition-colors',
                                      workshopLink
                                        ? 'bg-[var(--brand-blue)] text-white hover:brightness-110'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                                    )}
                                    aria-label={
                                      workshopLink
                                        ? 'Workshop linked — edit link'
                                        : 'Link Workshop lesson'
                                    }
                                  >
                                    <Link2 className="h-3.5 w-3.5" aria-hidden />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align="start" side="bottom" className="w-80 p-3">
                                  <LiteratureWorkshopLinkForm
                                    storyId={story.id}
                                    literatureBook={book}
                                    libraryBooks={libraryBooks.length > 0 ? libraryBooks : [book]}
                                    link={workshopLink}
                                    onLinkChange={(next) => {
                                      setWorkshopLinkByStoryId((prev) => {
                                        if (!next) {
                                          const copy = { ...prev }
                                          delete copy[story.id]
                                          return copy
                                        }
                                        return { ...prev, [story.id]: next }
                                      })
                                    }}
                                    compact
                                  />
                                </PopoverContent>
                              </Popover>
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="min-w-0 space-y-0.5">
                              <p className="font-medium text-foreground">{story.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {unit?.title ?? story.unitId}
                                {story.lessonTitle ? ` · ${story.lessonTitle}` : null}
                                {kind ? ` · ${kind}` : null}
                                {inside ? ' · on current page' : null}
                              </p>
                              {literatureMode && workshopLink?.workshopLessonTitle ? (
                                <p className="text-[11px] text-muted-foreground">
                                  Workshop · {workshopLink.workshopLessonTitle}
                                </p>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">Pages</span>
                                {pageStatus === 'guessed' && !pagesConfirmed ? (
                                  <span className="text-xs text-amber-800 dark:text-amber-200">
                                    Guessed — confirm or fix the range
                                  </span>
                                ) : null}
                              </div>
                              {pagesConfirmed && !editingPages ? (
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm text-foreground">
                                    <span className="tabular-nums">
                                      p{draftStart}–{draftEnd}
                                    </span>
                                    <span className="text-muted-foreground"> · confirmed</span>
                                  </p>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-8"
                                    onClick={() =>
                                      setEditingPagesById((prev) => ({ ...prev, [story.id]: true }))
                                    }
                                  >
                                    Edit
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-end gap-3">
                                    <div className="space-y-1">
                                      <Label htmlFor={`story-start-${story.id}`}>Start</Label>
                                      <Input
                                        id={`story-start-${story.id}`}
                                        className="w-24"
                                        inputMode="numeric"
                                        value={state?.startPage ?? ''}
                                        onChange={(e) =>
                                          setRowState((prev) => ({
                                            ...prev,
                                            [story.id]: {
                                              startPage: e.target.value,
                                              endPage: prev[story.id]?.endPage ?? '',
                                              saving: false,
                                            },
                                          }))
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label htmlFor={`story-end-${story.id}`}>End</Label>
                                      <Input
                                        id={`story-end-${story.id}`}
                                        className="w-24"
                                        inputMode="numeric"
                                        value={state?.endPage ?? ''}
                                        onChange={(e) =>
                                          setRowState((prev) => ({
                                            ...prev,
                                            [story.id]: {
                                              startPage: prev[story.id]?.startPage ?? '',
                                              endPage: e.target.value,
                                              saving: false,
                                            },
                                          }))
                                        }
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={state?.saving || !unit}
                                      onClick={() => void saveStoryRange(story, true)}
                                    >
                                      {state?.saving
                                        ? 'Saving…'
                                        : pagesConfirmed
                                          ? 'Save'
                                          : 'Confirm'}
                                    </Button>
                                    {pagesConfirmed ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        disabled={state?.saving}
                                        onClick={() => {
                                          if (override) {
                                            setRowState((prev) => ({
                                              ...prev,
                                              [story.id]: {
                                                startPage: String(override.startPage),
                                                endPage: String(override.endPage),
                                                saving: false,
                                              },
                                            }))
                                          }
                                          setEditingPagesById((prev) => ({
                                            ...prev,
                                            [story.id]: false,
                                          }))
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    ) : null}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground">
                                    Flip the preview past the story edges — outside pages look faded. Use
                                    Add page to grow the range, then confirm.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Fuel box: text / frame / checks */}
                        <div className="divide-y divide-[var(--border)] overflow-hidden rounded-md border border-[var(--border)] bg-background/40">
                          <div className="flex gap-3 p-3 sm:gap-4">
                            <div className="w-12 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
                              Text
                            </div>
                            <div className="min-w-0 flex-1">
                              <StoryTextFuelWithSelectable
                                story={story}
                                totalPdfPages={numPages}
                                storyTitle={story.title}
                                pageRangeLabel={pageRangeLabel}
                                textDraft={textDraftById[story.id] ?? ''}
                                onTextDraftChange={(value) =>
                                  setTextDraftById((prev) => ({ ...prev, [story.id]: value }))
                                }
                                hasStoryText={textReady}
                                busy={fuelBusy}
                                scanProgress={scanProgressById[story.id] ?? null}
                                scanNotice={scanNoticeById[story.id] ?? null}
                                onDismissScanNotice={() =>
                                  setScanNoticeById((prev) => {
                                    const copy = { ...prev }
                                    delete copy[story.id]
                                    return copy
                                  })
                                }
                                onScan={(opts) => void scanStoryText(story, opts)}
                                onStopScan={stopStoryScan}
                                onSave={() => saveStoryTextPaste(story)}
                                scanDisabled={textBusy || !unit || !hasDraftRange}
                                canContinueScan={canContinueScan}
                                dialogOpen={textDialogStoryId === story.id}
                                onDialogOpenChange={(next) =>
                                  setTextDialogStoryId(next ? story.id : null)
                                }
                                hideRowLabel
                              />
                            </div>
                          </div>

                          {textReady ? (
                            <StopCheckHarvestPanel
                              storyId={story.id}
                              bookId={story.bookId}
                              unitId={story.unitId}
                              storyText={textDraftById[story.id] ?? textRecord?.text ?? ''}
                              pack={packById[story.id] ?? null}
                              onPackChange={(next) =>
                                setPackById((prev) => ({ ...prev, [story.id]: next }))
                              }
                            />
                          ) : null}

                          {literatureMode && workshopLink ? (
                            <div className="flex gap-3 p-3 sm:gap-4">
                              <div className="w-12 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
                                Frame
                              </div>
                              <div className="min-w-0 flex-1">
                                <LessonFrameFuelPanel
                                  bookId={workshopLink.workshopBookId}
                                  unitId={workshopLink.workshopUnitId}
                                  lessonId={workshopLink.workshopLessonId}
                                  lessonTitle={workshopLink.workshopLessonTitle}
                                  frame={workshopFrame}
                                  onFrameChange={(next) => {
                                    const key = `${workshopLink.workshopBookId}::${workshopLink.workshopUnitId}::${workshopLink.workshopLessonId}`
                                    setFrameByLessonKey((prev) => {
                                      if (!next) {
                                        const copy = { ...prev }
                                        delete copy[key]
                                        return copy
                                      }
                                      return { ...prev, [key]: next }
                                    })
                                  }}
                                  hideRowLabel
                                />
                              </div>
                            </div>
                          ) : !literatureMode && story.lessonId ? (
                            <div className="flex gap-3 p-3 sm:gap-4">
                              <div className="w-12 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
                                Frame
                              </div>
                              <div className="min-w-0 flex-1">
                                <LessonFrameFuelPanel
                                  bookId={story.bookId}
                                  unitId={story.unitId}
                                  lessonId={story.lessonId}
                                  lessonTitle={story.lessonTitle}
                                  frame={lessonFrame}
                                  onFrameChange={(next) => {
                                    const key = `${story.unitId}::${story.lessonId}`
                                    const fullKey = `${story.bookId}::${story.unitId}::${story.lessonId}`
                                    setFrameByLessonKey((prev) => {
                                      if (!next) {
                                        const copy = { ...prev }
                                        delete copy[key]
                                        delete copy[fullKey]
                                        return copy
                                      }
                                      return { ...prev, [key]: next, [fullKey]: next }
                                    })
                                  }}
                                  totalPdfPages={totalForPreview}
                                  hideRowLabel
                                />
                              </div>
                            </div>
                          ) : null}

                          <div className="flex gap-3 p-3 sm:gap-4">
                            <div className="w-12 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
                              Checks
                            </div>
                            <div className="min-w-0 flex-1">
                              <StoryCheckPackPanel
                                storyId={story.id}
                                bookId={story.bookId}
                                unitId={story.unitId}
                                storyTitle={story.title}
                                hasStoryText={textReady}
                                hasLessonFrameReady={frameReady}
                                lessonLinked={lessonLinkedForGenerate}
                                lessonId={story.lessonId}
                                pack={packById[story.id] ?? null}
                                defaultDisplayPage={
                                  Number.isFinite(draftStart) && draftStart >= 1 ? draftStart : null
                                }
                                onPackChange={(next) =>
                                  setPackById((prev) => ({ ...prev, [story.id]: next }))
                                }
                                onOpenStoryText={() => setTextDialogStoryId(story.id)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-dashed border-[var(--border)] p-4">
        <h4 className="text-sm font-medium text-foreground">Add story manually</h4>
        <p className="text-xs text-muted-foreground">
          For Literature or any book without a story part in the outline. Choose which unit it belongs to.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="manual-story-unit">Unit</Label>
            <Select value={manualUnitId} onValueChange={setManualUnitId}>
              <SelectTrigger id="manual-story-unit" className="min-w-[11rem]">
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                {book.units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label htmlFor="manual-story-title">Title</Label>
            <Input
              id="manual-story-title"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="Story title"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="manual-story-start">Start</Label>
            <Input
              id="manual-story-start"
              className="w-24"
              inputMode="numeric"
              value={manualStart}
              onChange={(e) => setManualStart(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="manual-story-end">End</Label>
            <Input
              id="manual-story-end"
              className="w-24"
              inputMode="numeric"
              value={manualEnd}
              onChange={(e) => setManualEnd(e.target.value)}
            />
          </div>
          <Button type="button" size="sm" disabled={adding || !manualUnitId} onClick={() => void addManualStory()}>
            {adding ? 'Adding…' : 'Add story'}
          </Button>
        </div>
      </div>

      {browseUnit ? (
        <BookBrowseSpreadPreview
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          fileUrl={makeUnitFileUrl(browseUnit.filePath)}
          pdfReady={pdfReady}
          book={book}
          unit={browseUnit}
          units={browsableUnits}
          onSelectUnit={(unitId) => {
            setBrowseUnitId(unitId)
            setBrowsePage(1)
            setBrowseNumPages(null)
          }}
          pageNumber={browsePage}
          totalPdfPages={browseNumPages}
          onDocumentLoad={setBrowseNumPages}
          onPageChange={setBrowsePage}
        />
      ) : null}
    </div>
  )
}
