'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
}: ClassPrepVocabEditorProps) {
  const [rows, setRows] = useState<WordRow[]>([])
  const [examplesTextById, setExamplesTextById] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const previewPdfUrl = useMemo(() => {
    const params = new URLSearchParams({ bookId, unitId })
    if (typeof startPageHint === 'number' && Number.isFinite(startPageHint)) {
      params.set('startPageHint', String(Math.floor(startPageHint)))
    }
    if (typeof endPageHint === 'number' && Number.isFinite(endPageHint)) {
      params.set('endPageHint', String(Math.floor(endPageHint)))
    }
    return `/api/context/preview-vocab-pdf?${params.toString()}`
  }, [bookId, unitId, startPageHint, endPageHint])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/context/get?bookId=${encodeURIComponent(bookId)}&unitId=${encodeURIComponent(unitId)}&lessonId=${encodeURIComponent(lessonId)}&partId=${encodeURIComponent(partId)}`,
      )
      const data = (await res.json()) as { ok?: boolean; context?: { interactiveVocabulary?: WordRow[] } | null }
      const list = data.context?.interactiveVocabulary
      if (res.ok && list?.length) {
        setRows(
          list.map((w) => ({
            id: w.id,
            word: w.word,
            definition: w.definition,
            examples: Array.isArray(w.examples) ? w.examples : [],
          })),
        )
        const ex: Record<string, string> = {}
        for (const w of list) {
          ex[w.id] = (w.examples ?? []).join('\n')
        }
        setExamplesTextById(ex)
      } else {
        const first = newRow()
        setRows([first])
        setExamplesTextById({ [first.id]: '' })
      }
    } catch {
      const first = newRow()
      setRows([first])
      setExamplesTextById({ [first.id]: '' })
    } finally {
      setLoading(false)
    }
  }, [bookId, unitId, lessonId, partId])

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
      toast.success('Word list saved for this book section.')
    } catch {
      toast.error('Could not save word list.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading saved word list…</p>
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Interactive reader — vocabulary words
        </p>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            disabled={extracting || saving}
            onClick={() => void suggestFromBookPages()}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            {extracting ? 'Reading pages…' : 'Suggest from book'}
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => void addRow()}>
            <Plus className="mr-1 h-3 w-3" />
            Add word
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">Suggest from book</span> sends the same two-page PDF window as
        the preview below (aligned to your section hints and book page mapping). If the spread looks wrong, adjust page
        hints in the book structure editor, then reopen prep. One example per line in the form.
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,400px)_minmax(0,1fr)]">
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
        <div className="min-w-0 space-y-3">
          <div className="max-h-[min(52vh,480px)] space-y-3 overflow-y-auto pr-1">
            {rows.map((row) => (
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
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save word list to book'}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void load()}>
              Reload
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
