'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { VocabWordPrepCard } from '@/components/books/vocab-word-prep-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { PartContextVocabularyWord } from '@/lib/context/types'

type WordRow = PartContextVocabularyWord

function newRow(): WordRow {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `w-${crypto.randomUUID().slice(0, 8)}`
      : `w-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  return { id, word: '', definition: '', examples: [] }
}

export interface ClassPrepVocabEditorProps {
  bookId: string
  unitId: string
  lessonId: string
  partId: string
  /** e.g. book / unit / lesson / part — sent to Gemini for grounding */
  sectionPath: string
  partTitle?: string
  startPageHint?: number
  endPageHint?: number
  /** Primary scan button label. Default: Suggest from book */
  scanButtonLabel?: string
  /** Bold lead-in for the scan help line. Default: Suggest from book */
  scanHelpLead?: string
  /** When plain, skip the inset border box (Books part-prep card provides chrome). */
  chrome?: 'inset' | 'plain'
  /** Hide the embedded PDF preview (Books header already shows the spread). */
  hidePagePreview?: boolean
  /** Fired when saved word readiness changes (≥1 word with a meaning). */
  onReadyChange?: (ready: boolean) => void
}

function isVocabListReady(words: WordRow[]): boolean {
  return words.some((w) => w.word.trim().length > 0 && w.definition.trim().length > 0)
}

export function ClassPrepVocabEditor({
  bookId,
  unitId,
  lessonId,
  partId,
  sectionPath,
  partTitle,
  startPageHint,
  endPageHint,
  scanButtonLabel = 'Suggest from book',
  scanHelpLead = 'Suggest from book',
  chrome = 'inset',
  hidePagePreview = false,
  onReadyChange,
}: ClassPrepVocabEditorProps) {
  const [rows, setRows] = useState<WordRow[]>([])
  const [examplesTextById, setExamplesTextById] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const previewPdfUrl = useMemo(() => {
    if (hidePagePreview) return null
    const params = new URLSearchParams({ bookId, unitId })
    if (typeof startPageHint === 'number' && Number.isFinite(startPageHint)) {
      params.set('startPageHint', String(Math.floor(startPageHint)))
    }
    if (typeof endPageHint === 'number' && Number.isFinite(endPageHint)) {
      params.set('endPageHint', String(Math.floor(endPageHint)))
    }
    return `/api/context/preview-vocab-pdf?${params.toString()}`
  }, [bookId, unitId, startPageHint, endPageHint, hidePagePreview])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/context/get?bookId=${encodeURIComponent(bookId)}&unitId=${encodeURIComponent(unitId)}&lessonId=${encodeURIComponent(lessonId)}&partId=${encodeURIComponent(partId)}`,
      )
      const data = (await res.json()) as { ok?: boolean; context?: { interactiveVocabulary?: WordRow[] } | null }
      const list = data.context?.interactiveVocabulary
      if (res.ok && list?.length) {
        const mapped = list.map((w) => ({
          id: w.id,
          word: w.word,
          definition: w.definition,
          examples: Array.isArray(w.examples) ? w.examples : [],
        }))
        setRows(mapped)
        const ex: Record<string, string> = {}
        for (const w of list) {
          ex[w.id] = (w.examples ?? []).join('\n')
        }
        setExamplesTextById(ex)
        onReadyChange?.(isVocabListReady(mapped))
      } else {
        const first = newRow()
        setRows([first])
        setExamplesTextById({ [first.id]: '' })
        onReadyChange?.(false)
      }
    } catch {
      const first = newRow()
      setRows([first])
      setExamplesTextById({ [first.id]: '' })
      onReadyChange?.(false)
    } finally {
      setLoading(false)
    }
  }, [bookId, unitId, lessonId, partId, onReadyChange])

  useEffect(() => {
    void load()
  }, [load])

  function addRow() {
    const r = newRow()
    setRows((prev) => [...prev, r])
    setExamplesTextById((prev) => ({ ...prev, [r.id]: '' }))
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.id !== id)))
    setExamplesTextById((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  async function suggestFromBookPages() {
    setExtracting(true)
    try {
      const res = await fetch('/api/context/extract-context-cards-vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          unitId,
          lessonId,
          partId,
          partTitle,
          sectionPath,
          startPageHint,
          endPageHint,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        words?: WordRow[]
        pdfWindow?: { start: number; end: number }
      }
      if (!res.ok || !data.ok || !data.words?.length) {
        toast.error(data.error ?? 'Could not extract words from these pages.')
        return
      }
      setRows(
        data.words.map((w) => ({
          id: w.id,
          word: w.word,
          definition: w.definition,
          examples: Array.isArray(w.examples) ? w.examples : [],
        })),
      )
      const ex: Record<string, string> = {}
      for (const w of data.words) {
        ex[w.id] = (w.examples ?? []).join('\n')
      }
      setExamplesTextById(ex)
      const pw = data.pdfWindow
      toast.success(
        pw ? `Filled ${data.words.length} rows from PDF pages ${pw.start}–${pw.end}.` : `Filled ${data.words.length} rows.`,
      )
    } catch {
      toast.error('Extraction request failed.')
    } finally {
      setExtracting(false)
    }
  }

  async function save() {
    setSaving(true)
    const words = rows
      .map((r) => {
        const exRaw = examplesTextById[r.id] ?? (r.examples ?? []).join('\n')
        const examples = exRaw
          .split(/\n+/)
          .map((s) => s.trim())
          .filter(Boolean)
        return {
          id: r.id,
          word: r.word.trim(),
          definition: r.definition.trim(),
          examples,
        }
      })
      .filter((r) => r.word.length > 0)
    const start = startPageHint
    const end = endPageHint ?? startPageHint
    try {
      const res = await fetch('/api/context/save-part-vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          unitId,
          lessonId,
          partId,
          partTitle,
          words,
          sourcePageRange:
            typeof start === 'number' && Number.isFinite(start)
              ? {
                  startPage: Math.max(1, Math.floor(start)),
                  endPage: Math.max(1, Math.floor(end ?? start)),
                }
              : undefined,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? 'Could not save word list.')
        return
      }
      onReadyChange?.(isVocabListReady(words))
      toast.success('Word list saved for this book section.')
    } catch {
      toast.error('Could not save word list.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    if (chrome === 'plain') {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="h-9 w-28 animate-pulse rounded-full bg-[var(--surface-3)]" />
            <div className="h-9 w-24 animate-pulse rounded-full bg-[var(--surface-3)]" />
          </div>
          <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-3)]" />
          <p className="text-[13px] text-muted-foreground">Loading words…</p>
        </div>
      )
    }
    return <p className="text-xs text-muted-foreground">Loading saved word list…</p>
  }

  const isPlain = chrome === 'plain'

  const shellClass = isPlain ? 'space-y-4' : 'space-y-3 rounded-lg border border-[var(--border)] bg-background p-3'

  const scrollClass =
    hidePagePreview && isPlain
      ? 'grid grid-cols-1 gap-3'
      : hidePagePreview
        ? 'max-h-[min(52vh,480px)] space-y-3 overflow-y-auto pr-1 lg:max-h-[min(70vh,640px)]'
        : 'max-h-[min(52vh,480px)] space-y-3 overflow-y-auto pr-1'

  function renderWordRows() {
    if (isPlain) {
      return rows.map((row, index) => (
        <VocabWordPrepCard
          key={row.id}
          index={index}
          word={row.word}
          definition={row.definition}
          examplesText={examplesTextById[row.id] ?? row.examples.join('\n')}
          canRemove={rows.length > 1}
          onWordChange={(value) =>
            setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, word: value } : r)))
          }
          onDefinitionChange={(value) =>
            setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, definition: value } : r)))
          }
          onExamplesChange={(value) =>
            setExamplesTextById((prev) => ({
              ...prev,
              [row.id]: value,
            }))
          }
          onRemove={() => removeRow(row.id)}
        />
      ))
    }

    return rows.map((row) => (
      <div key={row.id} className="rounded border border-[var(--border)]/80 p-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid flex-1 gap-1 text-[11px] text-muted-foreground">
            Word
            <Input
              className="h-8 text-sm"
              value={row.word}
              onChange={(e) =>
                setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, word: e.target.value } : r)))
              }
            />
          </label>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={() => removeRow(row.id)}
            disabled={rows.length <= 1}
            aria-label="Remove word"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <label className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
          Meaning
          <Textarea
            className="min-h-[48px] text-sm"
            value={row.definition}
            onChange={(e) =>
              setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, definition: e.target.value } : r)))
            }
          />
        </label>
        <label className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
          Examples (one per line)
          <Textarea
            className="min-h-[56px] text-sm"
            value={examplesTextById[row.id] ?? row.examples.join('\n')}
            onChange={(e) =>
              setExamplesTextById((prev) => ({
                ...prev,
                [row.id]: e.target.value,
              }))
            }
          />
        </label>
      </div>
    ))
  }

  return (
    <div className={shellClass}>
      <div className={cn('flex flex-wrap items-center gap-2', isPlain ? 'justify-end' : 'justify-between')}>
        {!isPlain ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Interactive reader — vocabulary words
          </p>
        ) : (
          <span className="sr-only">Vocabulary words</span>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={cn(
              'gap-1.5',
              isPlain ? 'h-9 rounded-full px-4 text-[13px]' : 'h-7 text-xs',
            )}
            disabled={extracting || saving}
            onClick={() => void suggestFromBookPages()}
          >
            <Sparkles className={cn(isPlain ? 'size-3.5' : 'mr-1 h-3 w-3')} aria-hidden />
            {extracting ? 'Reading pages…' : scanButtonLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isPlain ? 'ghost' : 'outline'}
            className={cn(
              'gap-1.5',
              isPlain ? 'h-9 rounded-full px-3 text-[13px] text-muted-foreground' : 'h-7 text-xs',
            )}
            onClick={() => void addRow()}
          >
            <Plus className={cn(isPlain ? 'size-3.5' : 'mr-1 h-3 w-3')} aria-hidden />
            Add word
          </Button>
        </div>
      </div>
      {!isPlain ? (
        <p className="text-[11px] text-muted-foreground">
          {hidePagePreview ? (
            <>
              <span className="font-medium text-foreground">{scanHelpLead}</span> reads the page spread on the left
              (aligned to your section hints and book page mapping). Tap the book icon on the preview for full size. If
              it looks wrong, adjust page hints in the book structure editor, then reopen prep. One example per line in
              the form.
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">{scanHelpLead}</span> sends the same two-page PDF window as
              the preview below (aligned to your section hints and book page mapping). If the spread looks wrong, adjust
              page hints in the book structure editor, then reopen prep. One example per line in the form.
            </>
          )}
        </p>
      ) : null}
      <div className={hidePagePreview ? 'min-w-0 space-y-3' : 'grid gap-4 lg:grid-cols-[minmax(260px,400px)_minmax(0,1fr)]'}>
        {!hidePagePreview && previewPdfUrl ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Preview — pages the AI reads
          </p>
          <div className="overflow-hidden rounded-md border border-[var(--border)] bg-muted/30 shadow-sm">
            <iframe
              title="Vocabulary extract — two-page PDF preview"
              src={previewPdfUrl}
              className="h-[min(52vh,480px)] w-full bg-background"
              loading="lazy"
            />
          </div>
          <p className="text-[10px] leading-snug text-muted-foreground">
            If the preview is blank, your browser may block embedded PDFs —{' '}
            <a
              href={previewPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
            >
              Open this slice in a new tab
            </a>{' '}
            or confirm in Books that these PDF page numbers match the spread you want.
          </p>
        </div>
        ) : null}
        <div className="min-w-0 space-y-3">
          <div className={scrollClass}>{renderWordRows()}</div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={saving}
              className={cn(isPlain && 'h-10 rounded-full px-5 text-[14px]')}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : isPlain ? 'Save to book' : 'Save word list to book'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isPlain ? 'ghost' : 'outline'}
              disabled={saving}
              className={cn(isPlain && 'h-10 rounded-full px-4 text-[13px] text-muted-foreground')}
              onClick={() => void load()}
            >
              Reload
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
