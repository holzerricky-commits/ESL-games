'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BookmarkPlus, BookOpen, Image as ImageIcon, Languages, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useVocabNotebook } from '@/components/students/fullscreen-book-overlay/hooks/useVocabNotebook'
import { toast } from 'sonner'

const DOCK_SURFACE =
  'rounded-2xl border border-white/10 bg-black/30 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-md'

const DOCK_BOTTOM_INSET_PX = 56
const DOCK_SIDE_INSET_PX = 12
const PAGE_LIST_LEFT_INSET_PX = 152

type TranslateResult = {
  source: string
  chinese: string
  pinyin: string
  exampleEn: string
  exampleZh: string
  alternatives: Array<{
    chinese: string
    pinyin: string
    partOfSpeech: string
    exampleEn: string
    exampleZh: string
  }>
}

type DockPosition = { x: number; y: number }

interface TranslateDockProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  suppressChrome: boolean
  pageListOpen: boolean
  onOpenNotebook?: () => void
}

function isInteractiveDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, button, textarea, a, select, [role="button"], [data-translate-no-drag]'))
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function contextFromSelection(query: string): string {
  if (typeof window === 'undefined') return ''
  const selected = window.getSelection()?.toString().trim() ?? ''
  if (!selected) return ''
  if (selected.length < 4) return ''
  if (selected.length > 360) return selected.slice(0, 360)
  const q = query.trim().toLowerCase()
  if (!q) return ''
  const s = selected.toLowerCase()
  // Prefer context that likely contains the lookup token/phrase.
  if (!s.includes(q) && s.length <= q.length + 8) return ''
  return selected
}

export function TranslateDock({
  open,
  onOpenChange,
  suppressChrome,
  pageListOpen,
  onOpenNotebook,
}: TranslateDockProps) {
  const dockRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TranslateResult | null>(null)
  const [resultImageUrl, setResultImageUrl] = useState('')
  const [imageLoading, setImageLoading] = useState(false)
  const [savingWord, setSavingWord] = useState(false)
  const [position, setPosition] = useState<DockPosition | null>(null)
  const [dragging, setDragging] = useState(false)
  const clientCacheRef = useRef<Map<string, TranslateResult>>(new Map())
  const {
    entries: notebookEntries,
    saveWord,
  } = useVocabNotebook({
    onPersistenceError: (message) => toast.error(message),
  })

  const defaultLeftInset = pageListOpen ? PAGE_LIST_LEFT_INSET_PX : DOCK_SIDE_INSET_PX

  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) {
      setPosition(null)
      setDragging(false)
      dragRef.current = null
    }
  }, [open])

  const placeAtDefault = useCallback(() => {
    const el = dockRef.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) return
    const x = defaultLeftInset
    const y = Math.max(0, parent.clientHeight - el.offsetHeight - DOCK_BOTTOM_INSET_PX)
    setPosition({ x, y })
  }, [defaultLeftInset])

  useLayoutEffect(() => {
    if (!open || position) return
    placeAtDefault()
  }, [open, position, placeAtDefault])

  useLayoutEffect(() => {
    if (!open || dragging) return
    setPosition((prev) => {
      if (!prev) return prev
      const el = dockRef.current
      const parent = el?.offsetParent as HTMLElement | null
      if (!el || !parent) return prev
      const x = clamp(prev.x, 0, Math.max(0, parent.clientWidth - el.offsetWidth))
      const y = clamp(prev.y, 0, Math.max(0, parent.clientHeight - el.offsetHeight))
      if (x === prev.x && y === prev.y) return prev
      return { x, y }
    })
  }, [open, pageListOpen, dragging, position])

  const runTranslate = useCallback(async (raw: string) => {
    const text = raw.trim()
    if (!text) return
    const context = contextFromSelection(text)
    const cacheId = context ? `${text.toLowerCase()}::ctx:${context.toLowerCase()}` : text.toLowerCase()

    const cached = clientCacheRef.current.get(cacheId)
    if (cached) {
      setResult(cached)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        chinese?: string
        pinyin?: string
        exampleEn?: string
        exampleZh?: string
        alternatives?: Array<{
          chinese?: string
          pinyin?: string
          partOfSpeech?: string
          exampleEn?: string
          exampleZh?: string
        }>
        error?: string
      }
      if (!res.ok || !data.ok || !data.chinese) {
        toast.error(data.error ?? 'Translation failed.')
        return
      }
      const entry: TranslateResult = {
        source: text,
        chinese: data.chinese,
        pinyin: data.pinyin ?? '',
        exampleEn: typeof data.exampleEn === 'string' ? data.exampleEn.trim() : '',
        exampleZh: typeof data.exampleZh === 'string' ? data.exampleZh.trim() : '',
        alternatives: Array.isArray(data.alternatives)
          ? data.alternatives
              .map((item) => {
                const chinese = typeof item?.chinese === 'string' ? item.chinese.trim() : ''
                const pinyin = typeof item?.pinyin === 'string' ? item.pinyin.trim() : ''
                const partOfSpeech = typeof item?.partOfSpeech === 'string' ? item.partOfSpeech.trim() : ''
                const exampleEn = typeof item?.exampleEn === 'string' ? item.exampleEn.trim() : ''
                const exampleZh = typeof item?.exampleZh === 'string' ? item.exampleZh.trim() : ''
                if (!chinese) return null
                return { chinese, pinyin, partOfSpeech, exampleEn, exampleZh }
              })
              .filter(
                (item): item is {
                  chinese: string
                  pinyin: string
                  partOfSpeech: string
                  exampleEn: string
                  exampleZh: string
                } => item != null,
              )
              .slice(0, 3)
          : [],
      }
      clientCacheRef.current.set(cacheId, entry)
      setResult(entry)
      setResultImageUrl('')
    } catch {
      toast.error('Translation failed. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void runTranslate(draft)
  }

  const requestResultImage = useCallback(async () => {
    const word = result?.source?.trim()
    if (!word) return
    setImageLoading(true)
    try {
      const variant = Date.now().toString(36)
      const imageUrl = `/api/quiz-image?q=${encodeURIComponent(word)}&type=static&v=${encodeURIComponent(variant)}`
      setResultImageUrl(imageUrl)
    } finally {
      setImageLoading(false)
    }
  }, [result?.source])

  const saveCurrentWord = useCallback(() => {
    if (!result) return
    setSavingWord(true)
    try {
      const mode = saveWord({
        source: result.source,
        chinese: result.chinese,
        pinyin: result.pinyin,
        exampleEn: result.exampleEn,
        exampleZh: result.exampleZh,
        imageUrl: resultImageUrl,
      })
      toast.success(mode === 'updated' ? 'Word updated in notebook.' : 'Word saved to notebook.')
    } finally {
      setSavingWord(false)
    }
  }, [result, resultImageUrl, saveWord])

  const onDockPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isInteractiveDragTarget(e.target)) return

    const el = dockRef.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) return

    e.preventDefault()

    const parentRect = parent.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    const originX = position?.x ?? rect.left - parentRect.left
    const originY = position?.y ?? rect.top - parentRect.top

    if (!position) setPosition({ x: originX, y: originY })

    dragRef.current = { startX: e.clientX, startY: e.clientY, originX, originY }
    setDragging(true)
    el.setPointerCapture(e.pointerId)
  }

  const onDockPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const el = dockRef.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!drag || !el || !parent) return

    setPosition({
      x: clamp(
        drag.originX + e.clientX - drag.startX,
        0,
        Math.max(0, parent.clientWidth - el.offsetWidth),
      ),
      y: clamp(
        drag.originY + e.clientY - drag.startY,
        0,
        Math.max(0, parent.clientHeight - el.offsetHeight),
      ),
    })
  }

  const endDockDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  if (suppressChrome || !open) return null

  return (
    <div
      ref={dockRef}
      className={cn(
        DOCK_SURFACE,
        'pointer-events-auto absolute z-[62] flex w-[min(100%,23rem)] flex-col gap-2 p-3 select-none',
        dragging ? 'cursor-grabbing touch-none' : 'cursor-grab',
      )}
      style={
        position
          ? { left: position.x, top: position.y }
          : { left: defaultLeftInset, bottom: DOCK_BOTTOM_INSET_PX }
      }
      role="dialog"
      aria-label="Translate to Chinese"
      onPointerDown={onDockPointerDown}
      onPointerMove={onDockPointerMove}
      onPointerUp={endDockDrag}
      onPointerCancel={endDockDrag}
    >
      <div className={cn('flex items-center justify-between gap-2', dragging ? 'cursor-grabbing' : 'cursor-grab')}>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <Languages className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Translate
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 cursor-pointer rounded-full text-white/70 hover:bg-white/15 hover:text-white"
          onClick={() => onOpenChange(false)}
          aria-label="Close translate dock"
          data-translate-no-drag
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={onSubmit} className="flex cursor-auto gap-1.5 select-text" data-translate-no-drag>
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="English word or phrase…"
          disabled={loading}
          className="h-9 flex-1 cursor-text border-white/15 bg-white/10 text-sm text-white placeholder:text-white/45 focus-visible:ring-white/30"
          autoComplete="off"
          spellCheck={false}
        />
        <Button
          type="submit"
          size="sm"
          disabled={loading || !draft.trim()}
          className="h-9 shrink-0 cursor-pointer bg-white/20 px-3 text-white hover:bg-white/30"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Go'}
        </Button>
      </form>

      {result ? (
        <div
          className="cursor-auto space-y-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 select-text"
          data-translate-no-drag
        >
          <p className="text-2xl font-semibold leading-tight text-white">{result.chinese}</p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 bg-white/20 px-2.5 text-[11px] text-white hover:bg-white/30"
              data-translate-no-drag
              onClick={() => void requestResultImage()}
              disabled={imageLoading}
            >
              {imageLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden /> : <ImageIcon className="mr-1 h-3.5 w-3.5" aria-hidden />}
              {resultImageUrl ? 'Change image' : 'Show image'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 bg-white/20 px-2.5 text-[11px] text-white hover:bg-white/30"
              data-translate-no-drag
              onClick={saveCurrentWord}
              disabled={savingWord}
            >
              {savingWord ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden /> : <BookmarkPlus className="mr-1 h-3.5 w-3.5" aria-hidden />}
              Save word
            </Button>
            {onOpenNotebook ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 bg-white/20 px-2.5 text-[11px] text-white hover:bg-white/30"
                data-translate-no-drag
                onClick={() => onOpenNotebook()}
              >
                <BookOpen className="mr-1 h-3.5 w-3.5" aria-hidden />
                Notebook ({notebookEntries.length})
              </Button>
            ) : null}
          </div>
          {resultImageUrl ? (
            <div className="overflow-hidden rounded-lg border border-white/15 bg-black/25">
              <img
                src={resultImageUrl}
                alt={`Visual for ${result.source}`}
                className="block h-28 w-full object-cover"
                loading="lazy"
                draggable={false}
              />
            </div>
          ) : null}
          {result.pinyin ? <p className="text-sm text-white/70">{result.pinyin}</p> : null}
          {result.exampleEn && result.exampleZh ? (
            <p className="pt-0.5 text-[11px] leading-relaxed text-white/65">
              {result.exampleEn}
              {' -> '}
              {result.exampleZh}
            </p>
          ) : null}
          {result.alternatives.length > 0 ? (
            <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">Other common meanings</p>
              <ul className="space-y-2">
                {result.alternatives.map((alt, idx) => (
                  <li
                    key={`${alt.chinese}-${alt.pinyin}-${idx}`}
                    className="space-y-1.5 border-b border-white/10 pb-2.5 text-xs leading-tight text-white/75 last:border-b-0 last:pb-0"
                  >
                    <p className="flex flex-wrap items-center gap-x-1 gap-y-1">
                      {alt.partOfSpeech ? (
                        <span className="mr-1 rounded bg-white/10 px-1 py-[1px] text-[9px] uppercase tracking-wide text-white/55">
                          {alt.partOfSpeech}
                        </span>
                      ) : null}
                      <span className="text-base font-semibold leading-tight text-white">{alt.chinese}</span>
                      {alt.pinyin ? <span className="text-[11px] text-white/50">({alt.pinyin})</span> : null}
                    </p>
                    {alt.exampleEn && alt.exampleZh ? (
                      <p className="pt-0.5 text-[12px] leading-relaxed text-white/65">
                        {alt.exampleEn}
                        {' -> '}
                        {alt.exampleZh}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-white/50">Simplified Chinese + pinyin for your students.</p>
      )}
    </div>
  )
}
