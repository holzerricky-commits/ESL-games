'use client'

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { ChevronDown, Headphones, ImagePlus, Loader2, ScanSearch, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BOOK_SETUP_COPY } from '@/lib/books/book-setup-copy'
import {
  BOOK_AUDIO_MAX_FILE_BYTES,
  LISTENING_MARK_MAX_FILE_BYTES,
  isBookAudioExtension,
  type BookAudioTrack,
  type ListeningMarkScanPlan,
} from '@/lib/books/book-audio'
import type { ListeningMarkHitSample } from '@/lib/books/listening-mark-hits'
import { cn } from '@/lib/utils'

interface BookAudioTabProps {
  bookId: string
  units?: Array<{ id: string; title: string; filePath?: string }>
}

function isAudioFile(file: File): boolean {
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
  return isBookAudioExtension(ext)
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

async function uploadOneTrack(bookId: string, file: File): Promise<BookAudioTrack> {
  const form = new FormData()
  form.set('bookId', bookId)
  form.set('file', file)
  const res = await fetch('/api/books/audio/upload', { method: 'POST', body: form })
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; item?: BookAudioTrack }
  if (!res.ok || !body.ok || !body.item) {
    throw new Error(body.error ?? `Failed to upload ${file.name}`)
  }
  return body.item
}

type PlaceProgress = {
  doneChunks: number
  totalChunks: number
  message: string
  placed: number
  unmatched: number
  ambiguous: number
  skippedDuplicate: number
}

function formatHitSampleLine(sample: ListeningMarkHitSample): string {
  const shortName = sample.matchedFileName
    ? sample.matchedFileName.length > 42
      ? `…${sample.matchedFileName.slice(-40)}`
      : sample.matchedFileName
    : null
  switch (sample.reason) {
    case 'placed':
      return `p.${sample.pdfPage} · ${sample.label} → ${shortName ?? 'file'}`
    case 'unmatched':
      return `p.${sample.pdfPage} · ${sample.label} → no matching file`
    case 'ambiguous':
      return `p.${sample.pdfPage} · ${sample.label} → matches more than one file`
    case 'duplicate':
    case 'queued_duplicate':
      return `p.${sample.pdfPage} · ${sample.label} → already on page (${shortName ?? 'file'})`
    default:
      return `p.${sample.pdfPage} · ${sample.label}`
  }
}

const WHOLE_BOOK = '__whole__'

export function BookAudioTab({ bookId, units = [] }: BookAudioTabProps) {
  const [tracks, setTracks] = useState<BookAudioTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const markInputRef = useRef<HTMLInputElement>(null)
  const loadRevRef = useRef(0)

  const [markExists, setMarkExists] = useState(false)
  const [markPreviewUrl, setMarkPreviewUrl] = useState<string | null>(null)
  const [markLoading, setMarkLoading] = useState(true)
  const [markSaving, setMarkSaving] = useState(false)
  const [scanScope, setScanScope] = useState<string>(WHOLE_BOOK)
  const [placing, setPlacing] = useState(false)
  const [placeProgress, setPlaceProgress] = useState<PlaceProgress | null>(null)
  const placeAbortRef = useRef<AbortController | null>(null)
  const [keepRedoOpen, setKeepRedoOpen] = useState(false)
  const [existingPinCount, setExistingPinCount] = useState(0)
  const [checkingPins, setCheckingPins] = useState(false)
  /** When keeping existing speakers: skip AI scan on pages that already have one. */
  const [skipPagesWithPins, setSkipPagesWithPins] = useState(true)
  const [scanLogLines, setScanLogLines] = useState<string[]>([])
  const [scanLogOpen, setScanLogOpen] = useState(false)
  const scanLogEndRef = useRef<HTMLDivElement>(null)

  const appendScanLog = useCallback((line: string) => {
    setScanLogLines((prev) => [...prev, line])
  }, [])

  useEffect(() => {
    if (!scanLogOpen || !placing) return
    scanLogEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [scanLogLines, scanLogOpen, placing])

  const copy = BOOK_SETUP_COPY.audio
  const unitsWithPdf = units.filter((u) => Boolean(u.filePath?.trim()))
  const scopeUnitId = scanScope === WHOLE_BOOK ? null : scanScope
  const scopeUnitTitle =
    scopeUnitId == null
      ? null
      : unitsWithPdf.find((u) => u.id === scopeUnitId)?.title?.trim() || 'this unit'

  const loadTracks = useCallback(async () => {
    const rev = ++loadRevRef.current
    setLoading(true)
    try {
      const res = await fetch(`/api/books/audio?bookId=${encodeURIComponent(bookId)}`)
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: BookAudioTrack[]; error?: string }
      if (rev !== loadRevRef.current) return
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? 'Could not load audio tracks.')
        setTracks([])
        return
      }
      setTracks(Array.isArray(body.items) ? body.items : [])
    } catch {
      if (rev !== loadRevRef.current) return
      toast.error('Could not load audio tracks.')
      setTracks([])
    } finally {
      if (rev === loadRevRef.current) setLoading(false)
    }
  }, [bookId])

  const loadMark = useCallback(async () => {
    setMarkLoading(true)
    setMarkPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    try {
      const metaRes = await fetch(`/api/books/audio/mark?bookId=${encodeURIComponent(bookId)}`)
      const meta = (await metaRes.json().catch(() => ({}))) as {
        ok?: boolean
        exists?: boolean
      }
      if (!metaRes.ok || !meta.ok || !meta.exists) {
        setMarkExists(false)
        return
      }
      setMarkExists(true)
      const imgRes = await fetch(
        `/api/books/audio/mark?bookId=${encodeURIComponent(bookId)}&raw=1`,
      )
      if (!imgRes.ok) {
        setMarkExists(false)
        return
      }
      const blob = await imgRes.blob()
      setMarkPreviewUrl(URL.createObjectURL(blob))
    } catch {
      setMarkExists(false)
    } finally {
      setMarkLoading(false)
    }
  }, [bookId])

  useEffect(() => {
    void loadTracks()
  }, [loadTracks])

  useEffect(() => {
    void loadMark()
    return () => {
      setMarkPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [loadMark])

  useEffect(() => {
    return () => {
      placeAbortRef.current?.abort()
    }
  }, [])

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const audioFiles = files.filter(isAudioFile)
      if (!audioFiles.length) {
        toast.error('No audio files found. Use mp3, m4a, wav, ogg, or aac.')
        return
      }
      const tooBig = audioFiles.filter((f) => f.size > BOOK_AUDIO_MAX_FILE_BYTES)
      if (tooBig.length) {
        toast.error(`${tooBig.length} file(s) exceed the 50 MB limit and were skipped.`)
      }
      const eligible = audioFiles.filter((f) => f.size > 0 && f.size <= BOOK_AUDIO_MAX_FILE_BYTES)
      if (!eligible.length) return

      setUploading(true)
      setUploadProgress({ done: 0, total: eligible.length })
      let okCount = 0
      let failCount = 0
      for (let i = 0; i < eligible.length; i += 1) {
        const file = eligible[i]!
        try {
          await uploadOneTrack(bookId, file)
          okCount += 1
        } catch (err) {
          failCount += 1
          toast.error(err instanceof Error ? err.message : `Failed: ${file.name}`)
        }
        setUploadProgress({ done: i + 1, total: eligible.length })
      }
      setUploading(false)
      setUploadProgress(null)
      await loadTracks()
      if (okCount > 0) {
        toast.success(okCount === 1 ? '1 track added.' : `${okCount} tracks added.`)
      }
      if (failCount > 0 && okCount === 0) {
        toast.error('No tracks were uploaded.')
      }
    },
    [bookId, loadTracks],
  )

  const onPickFiles = (list: FileList | null) => {
    if (!list?.length) return
    void uploadFiles(Array.from(list))
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    if (uploading) return
    const files = Array.from(event.dataTransfer.files ?? [])
    void uploadFiles(files)
  }

  const deleteTrack = async (track: BookAudioTrack) => {
    setDeletingId(track.id)
    try {
      const res = await fetch(
        `/api/books/audio?bookId=${encodeURIComponent(bookId)}&trackId=${encodeURIComponent(track.id)}`,
        { method: 'DELETE' },
      )
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? 'Could not delete track.')
        return
      }
      setTracks((prev) => prev.filter((item) => item.id !== track.id))
      toast.success('Track removed.')
    } catch {
      toast.error('Could not delete track.')
    } finally {
      setDeletingId(null)
    }
  }

  const uploadMark = async (file: File | null) => {
    if (!file) return
    if (file.size > LISTENING_MARK_MAX_FILE_BYTES) {
      toast.error('Mark image exceeds 2 MB.')
      return
    }
    setMarkSaving(true)
    try {
      const form = new FormData()
      form.set('bookId', bookId)
      form.set('file', file)
      const res = await fetch('/api/books/audio/mark', { method: 'POST', body: form })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? 'Could not save the mark crop.')
        return
      }
      toast.success('Listening mark saved.')
      await loadMark()
    } catch {
      toast.error('Could not save the mark crop.')
    } finally {
      setMarkSaving(false)
    }
  }

  const clearMark = async () => {
    try {
      const res = await fetch(`/api/books/audio/mark?bookId=${encodeURIComponent(bookId)}`, {
        method: 'DELETE',
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? 'Could not remove the mark.')
        return
      }
      setMarkExists(false)
      setMarkPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      toast.success('Listening mark removed.')
    } catch {
      toast.error('Could not remove the mark.')
    }
  }

  const stopPlacing = () => {
    placeAbortRef.current?.abort()
  }

  const runPlaceScan = async (options?: { skipPagesWithPins?: boolean }) => {
    if (placing) return
    const skipPinnedPages = Boolean(options?.skipPagesWithPins)

    const controller = new AbortController()
    placeAbortRef.current = controller
    setScanLogLines([])
    setScanLogOpen(true)
    setPlacing(true)
    setPlaceProgress({
      doneChunks: 0,
      totalChunks: 0,
      message: skipPinnedPages ? 'Planning pages (skipping ones with speakers)…' : 'Planning pages…',
      placed: 0,
      unmatched: 0,
      ambiguous: 0,
      skippedDuplicate: 0,
    })
    appendScanLog(
      skipPinnedPages
        ? 'Planning… (will skip pages that already have speakers)'
        : 'Planning pages…',
    )

    try {
      const unitId = scopeUnitId ?? undefined
      const planRes = await fetch('/api/books/audio/place-from-mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'plan',
          bookId,
          unitId,
          skipPagesWithPins: skipPinnedPages,
        }),
        signal: controller.signal,
      })
      const planBody = (await planRes.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        plan?: ListeningMarkScanPlan
      }
      if (!planRes.ok || !planBody.ok || !planBody.plan?.chunks.length) {
        const err = planBody.error ?? 'Could not plan the scan.'
        appendScanLog(`Error: ${err}`)
        toast.error(err)
        return
      }

      const plan = planBody.plan
      appendScanLog(
        `Plan ready · ${plan.chunks.length} page group${plan.chunks.length === 1 ? '' : 's'}` +
          (plan.skippedPages > 0
            ? ` · skipped ${plan.skippedPages} page${plan.skippedPages === 1 ? '' : 's'} with speakers`
            : ''),
      )
      if (plan.skippedPages > 0) {
        toast.message(
          `Skipping ${plan.skippedPages} page${plan.skippedPages === 1 ? '' : 's'} that already have speakers.`,
        )
      }
      let placed = 0
      let unmatched = 0
      let ambiguous = 0
      let skippedDuplicate = 0
      let interrupted = false

      for (let i = 0; i < plan.chunks.length; i += 1) {
        if (controller.signal.aborted) {
          interrupted = true
          break
        }
        const chunk = plan.chunks[i]!
        const rangeLabel =
          chunk.pdfPageStart === chunk.pdfPageEnd
            ? String(chunk.pdfPageStart)
            : `${chunk.pdfPageStart}–${chunk.pdfPageEnd}`
        setPlaceProgress({
          doneChunks: i,
          totalChunks: plan.chunks.length,
          message: `Scanning ${chunk.unitTitle} pages ${rangeLabel}…`,
          placed,
          unmatched,
          ambiguous,
          skippedDuplicate,
        })

        const chunkRes = await fetch('/api/books/audio/place-from-mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'chunk',
            bookId,
            unitId: chunk.unitId,
            pdfPageStart: chunk.pdfPageStart,
            pdfPageEnd: chunk.pdfPageEnd,
          }),
          signal: controller.signal,
        })
        const chunkBody = (await chunkRes.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          rateLimited?: boolean
          placed?: number
          unmatched?: number
          ambiguous?: number
          skippedDuplicate?: number
          marksFound?: number
          hitsSample?: ListeningMarkHitSample[]
        }

        if (!chunkRes.ok || !chunkBody.ok) {
          if (controller.signal.aborted) {
            interrupted = true
            break
          }
          const err = chunkBody.error ?? 'Scan stopped on an error.'
          appendScanLog(`Pages ${rangeLabel} · error: ${err}`)
          toast.error(err)
          interrupted = true
          break
        }

        const chunkPlaced = chunkBody.placed ?? 0
        const chunkFound = chunkBody.marksFound ?? 0
        placed += chunkPlaced
        unmatched += chunkBody.unmatched ?? 0
        ambiguous += chunkBody.ambiguous ?? 0
        skippedDuplicate += chunkBody.skippedDuplicate ?? 0
        appendScanLog(
          `Pages ${rangeLabel} · found ${chunkFound} · placed ${chunkPlaced}`,
        )
        for (const sample of chunkBody.hitsSample ?? []) {
          appendScanLog(`  ${formatHitSampleLine(sample)}`)
        }
        setPlaceProgress({
          doneChunks: i + 1,
          totalChunks: plan.chunks.length,
          message: `Scanned ${chunk.unitTitle} pages ${rangeLabel}`,
          placed,
          unmatched,
          ambiguous,
          skippedDuplicate,
        })
      }

      if (interrupted && controller.signal.aborted) {
        appendScanLog(`Stopped. Placed ${placed} so far.`)
        toast.message(
          `Stopped. Placed ${placed} so far` +
            (unmatched ? `; ${unmatched} with no matching file` : '') +
            '.',
        )
      } else if (!interrupted) {
        const parts = [`Placed ${placed}.`]
        if (unmatched) parts.push(`${unmatched} mark(s) had no matching file.`)
        if (ambiguous) parts.push(`${ambiguous} number(s) matched more than one file.`)
        if (skippedDuplicate) parts.push(`${skippedDuplicate} already on the page.`)
        if (plan.skippedPages > 0) {
          parts.push(`Skipped ${plan.skippedPages} page${plan.skippedPages === 1 ? '' : 's'} with speakers.`)
        }
        appendScanLog(`Done. ${parts.join(' ')}`)
        if (placed === 0) setScanLogOpen(true)
        toast.success(parts.join(' '))
      }
    } catch (err) {
      if (controller.signal.aborted) {
        appendScanLog('Stopped. Speakers already placed were kept.')
        toast.message('Stopped. Speakers already placed were kept.')
      } else {
        const msg = err instanceof Error ? err.message : 'Could not place speakers.'
        appendScanLog(`Error: ${msg}`)
        toast.error(msg)
      }
    } finally {
      placeAbortRef.current = null
      setPlacing(false)
      setPlaceProgress(null)
    }
  }

  const clearPinsInScope = async (): Promise<boolean> => {
    try {
      const params = new URLSearchParams({ bookId })
      if (scopeUnitId) {
        params.set('unitId', scopeUnitId)
      } else {
        params.set('scope', 'all')
      }
      const res = await fetch(`/api/books/audio/pins?${params.toString()}`, { method: 'DELETE' })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        removed?: number
      }
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? 'Could not clear existing speakers.')
        return false
      }
      return true
    } catch {
      toast.error('Could not clear existing speakers.')
      return false
    }
  }

  const onPlaceClick = async () => {
    if (placing || checkingPins) return
    if (!markExists) {
      toast.error('Upload a crop of the listening mark first.')
      return
    }
    if (!tracks.length) {
      toast.error('Upload listening tracks first.')
      return
    }
    if (!unitsWithPdf.length) {
      toast.error('This book has no PDF units to scan.')
      return
    }

    setCheckingPins(true)
    try {
      const params = new URLSearchParams({ bookId })
      if (scopeUnitId) params.set('unitId', scopeUnitId)
      const res = await fetch(`/api/books/audio/pins?${params.toString()}`)
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        items?: unknown[]
        error?: string
      }
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? 'Could not check existing speakers.')
        return
      }
      const count = Array.isArray(body.items) ? body.items.length : 0
      if (count === 0) {
        await runPlaceScan({ skipPagesWithPins: false })
        return
      }
      setExistingPinCount(count)
      setSkipPagesWithPins(true)
      setKeepRedoOpen(true)
    } catch {
      toast.error('Could not check existing speakers.')
    } finally {
      setCheckingPins(false)
    }
  }

  const onKeepAndContinue = () => {
    setKeepRedoOpen(false)
    void runPlaceScan({ skipPagesWithPins })
  }

  const onClearAndRedo = async () => {
    setKeepRedoOpen(false)
    const cleared = await clearPinsInScope()
    if (!cleared) return
    await runPlaceScan({ skipPagesWithPins: false })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{copy.label}</p>
        <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        <p className="text-xs text-muted-foreground">{copy.detail}</p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!uploading) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center transition',
          dragOver
            ? 'border-[var(--brand-blue)] bg-[var(--accent)]/40'
            : 'border-[var(--border)] bg-[var(--surface-2)]/40',
          uploading && 'pointer-events-none opacity-70',
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-blue)]" />
            <p className="text-sm font-medium text-foreground">
              Uploading {uploadProgress?.done ?? 0} of {uploadProgress?.total ?? 0}…
            </p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-[var(--brand-blue)]" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Drop a folder or audio files here</p>
              <p className="text-xs text-muted-foreground">mp3, m4a, wav, ogg, aac · up to 50 MB each</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                Choose files
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => folderInputRef.current?.click()}>
                Choose folder
              </Button>
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.m4a,.wav,.ogg,.aac,audio/*"
          multiple
          className="hidden"
          onChange={(e) => {
            onPickFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          onChange={(e) => {
            onPickFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/30 p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{copy.autoPlaceLabel}</p>
          <p className="text-xs text-muted-foreground">{copy.autoPlaceDetail}</p>
        </div>

        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--border)] bg-background">
            {markLoading || markSaving ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : markPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={markPreviewUrl} alt="Listening mark crop" className="h-full w-full object-contain" />
            ) : (
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={markSaving || placing}
                onClick={() => markInputRef.current?.click()}
              >
                {markExists ? 'Replace crop' : 'Upload crop'}
              </Button>
              {markExists ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={markSaving || placing}
                  onClick={() => void clearMark()}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, or WebP · up to 2 MB. Crop tight around the icon (number can be in the picture).
            </p>
          </div>
        </div>
        <input
          ref={markInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null
            e.target.value = ''
            void uploadMark(file)
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={scanScope}
            onValueChange={setScanScope}
            disabled={placing || unitsWithPdf.length === 0}
          >
            <SelectTrigger className="w-[min(100%,16rem)]" size="sm">
              <SelectValue placeholder="Scan range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WHOLE_BOOK}>Whole book</SelectItem>
              {unitsWithPdf.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.title || unit.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {placing ? (
            <Button type="button" size="sm" variant="outline" onClick={stopPlacing}>
              Stop
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={!markExists || tracks.length === 0 || unitsWithPdf.length === 0 || checkingPins}
              onClick={() => void onPlaceClick()}
            >
              {checkingPins ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ScanSearch className="mr-1.5 h-4 w-4" />
              )}
              Place speakers
            </Button>
          )}
        </div>

        {placing && placeProgress ? (
          <div className="space-y-1">
            <p className="text-sm text-foreground">{placeProgress.message}</p>
            <p className="text-xs text-muted-foreground">
              {placeProgress.doneChunks} of {placeProgress.totalChunks || '…'} page groups · placed{' '}
              {placeProgress.placed}
              {placeProgress.unmatched ? ` · ${placeProgress.unmatched} unmatched` : ''}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full bg-[var(--brand-blue)] transition-all"
                style={{
                  width: `${
                    placeProgress.totalChunks > 0
                      ? Math.round((placeProgress.doneChunks / placeProgress.totalChunks) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {scanLogLines.length > 0 ? (
          <div className="rounded-md border border-[var(--border)] bg-background">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-foreground"
              onClick={() => setScanLogOpen((open) => !open)}
              aria-expanded={scanLogOpen}
            >
              <span>Scan log ({scanLogLines.length})</span>
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', scanLogOpen && 'rotate-180')}
              />
            </button>
            {scanLogOpen ? (
              <div className="max-h-48 overflow-y-auto border-t border-[var(--border)] px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {scanLogLines.map((line, index) => (
                  <div key={`${index}-${line.slice(0, 24)}`} className="whitespace-pre-wrap break-all">
                    {line}
                  </div>
                ))}
                <div ref={scanLogEndRef} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            Tracks{loading ? '' : ` (${tracks.length})`}
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading tracks…</p>
        ) : tracks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No audio yet. Drop your listening folder here so tracks show up in class.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-background">
            {tracks.map((track) => (
              <li key={track.id} className="flex items-center gap-3 px-3 py-2.5">
                <Headphones className="h-4 w-4 shrink-0 text-[var(--brand-blue)]" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
                    {track.title}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {track.fileName} · {formatBytes(track.sizeBytes)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={deletingId === track.id || uploading || placing}
                  onClick={() => void deleteTrack(track)}
                  aria-label={`Delete ${track.title}`}
                >
                  {deletingId === track.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={keepRedoOpen} onOpenChange={setKeepRedoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Speakers already on the book</AlertDialogTitle>
            <AlertDialogDescription>
              {scopeUnitId
                ? `“${scopeUnitTitle}” already has ${existingPinCount} speaker${existingPinCount === 1 ? '' : 's'}. Keep them and only add new ones, or clear this unit and place again?`
                : `This book already has ${existingPinCount} speaker${existingPinCount === 1 ? '' : 's'}. Keep them and only add new ones, or clear all and place again?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-2.5 text-sm">
            <Checkbox
              checked={skipPagesWithPins}
              onCheckedChange={(value) => setSkipPagesWithPins(value === true)}
              className="mt-0.5"
            />
            <span className="min-w-0 space-y-0.5">
              <span className="block font-medium text-foreground">
                Skip pages that already have speakers
              </span>
              <span className="block text-xs text-muted-foreground">
                Faster when continuing. Turn off if a page might still be missing a mark.
              </span>
            </span>
          </label>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                onKeepAndContinue()
              }}
            >
              Keep and continue
            </AlertDialogAction>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void onClearAndRedo()}
            >
              Clear and redo
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
