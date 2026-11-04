'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Delete, Lightbulb } from 'lucide-react'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import { spellCheck } from '@/lib/lesson-vault/games'
import { cn } from '@/lib/utils'
import { REVIEW_HEADER_BTN } from './lesson-vault-review-parts'

type LessonVaultSpellItProps = {
  word: string
  /** Shuffled letters; a tile's id is its index here. */
  letters: string[]
  /** `clean` = spelled with no wrong tries and no hints. */
  onSolved: (clean: boolean) => void
  /** Called once, on the first wrong try or hint. */
  onMistake: () => void
}

type Status = 'idle' | 'wrong' | 'right'

const WRONG_MS = 900

/** Letter tiles → slots. Click or type letters; a full wrong word shakes and sends the wrong letters back. */
export function LessonVaultSpellIt({ word, letters, onSolved, onMistake }: LessonVaultSpellItProps) {
  const target = useMemo(() => [...word.trim()], [word])
  const [slots, setSlots] = useState<(number | null)[]>(() => target.map(() => null))
  const [status, setStatus] = useState<Status>('idle')
  const [wrongSlots, setWrongSlots] = useState<boolean[]>([])
  const [hinted, setHinted] = useState<ReadonlySet<number>>(() => new Set())
  const missedRef = useRef(false)

  const used = useMemo(() => new Set(slots.filter((id): id is number => id != null)), [slots])
  const letterAt = useCallback((id: number | null) => (id == null ? null : (letters[id] ?? null)), [letters])

  const miss = useCallback(() => {
    if (missedRef.current) return
    missedRef.current = true
    onMistake()
  }, [onMistake])

  const settle = useCallback(
    (next: (number | null)[]) => {
      setSlots(next)
      if (next.some((id) => id == null)) return
      const ok = spellCheck(word, next.map(letterAt))
      if (ok.every(Boolean)) {
        setStatus('right')
        onSolved(!missedRef.current)
        return
      }
      miss()
      setWrongSlots(ok.map((v) => !v))
      setStatus('wrong')
    },
    [word, letterAt, onSolved, miss],
  )

  useEffect(() => {
    if (status !== 'wrong') return
    const t = window.setTimeout(() => {
      setSlots((prev) => prev.map((id, i) => (wrongSlots[i] ? null : id)))
      setWrongSlots([])
      setStatus('idle')
    }, WRONG_MS)
    return () => window.clearTimeout(t)
  }, [status, wrongSlots])

  const place = useCallback(
    (tileId: number) => {
      if (status !== 'idle' || used.has(tileId)) return
      const i = slots.indexOf(null)
      if (i < 0) return
      const next = slots.slice()
      next[i] = tileId
      settle(next)
    },
    [status, used, slots, settle],
  )

  const remove = useCallback(
    (slot: number) => {
      if (status !== 'idle' || slots[slot] == null || hinted.has(slot)) return
      const next = slots.slice()
      next[slot] = null
      setSlots(next)
    },
    [status, slots, hinted],
  )

  const undo = useCallback(() => {
    for (let i = slots.length - 1; i >= 0; i--) {
      if (slots[i] != null && !hinted.has(i)) return remove(i)
    }
  }, [slots, hinted, remove])

  const typeLetter = useCallback(
    (key: string) => {
      const id = letters.findIndex((l, i) => !used.has(i) && l.toLowerCase() === key.toLowerCase())
      if (id >= 0) place(id)
    },
    [letters, used, place],
  )

  const hint = useCallback(() => {
    if (status !== 'idle') return
    const ok = spellCheck(word, slots.map(letterAt))
    const i = ok.findIndex((v) => !v)
    if (i < 0) return
    const want = target[i]!.toLowerCase()
    const next = slots.slice()
    next[i] = null
    const taken = new Set(next.filter((id): id is number => id != null))
    let id = letters.findIndex((l, k) => !taken.has(k) && l.toLowerCase() === want)
    if (id < 0) {
      const j = next.findIndex((sid, k) => !ok[k] && sid != null && letterAt(sid)?.toLowerCase() === want)
      if (j < 0) return
      id = next[j]!
      next[j] = null
    }
    next[i] = id
    setHinted((prev) => new Set(prev).add(i))
    miss()
    settle(next)
  }, [status, word, slots, letterAt, target, letters, miss, settle])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isBookOverlayKeyboardTypingTarget()) return
      if (e.key === 'Backspace') undo()
      else if (/^\p{L}$/u.test(e.key)) typeLetter(e.key)
      else return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [undo, typeLetter])

  const long = target.length > 8
  const tileSize = long ? 'h-14 w-11 text-3xl' : 'h-16 w-14 text-4xl'
  const anyPlaced = slots.some((id, i) => id != null && !hinted.has(i))

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div
        className={cn(
          'flex flex-wrap justify-center gap-2',
          status === 'wrong' && 'animate-[reading-check-shake_400ms_ease-in-out] motion-reduce:animate-none',
        )}
        aria-label={`Spell the word, ${target.length} letters`}
      >
        {slots.map((id, i) => {
          const ch = letterAt(id)
          const isWrong = status === 'wrong' && wrongSlots[i]
          return (
            <button
              key={i}
              type="button"
              onClick={() => remove(i)}
              disabled={ch == null || status !== 'idle' || hinted.has(i)}
              aria-label={ch ? `Letter ${ch}, click to take back` : `Empty letter ${i + 1}`}
              className={cn(
                'flex items-center justify-center rounded-xl border-2 font-bold transition-colors duration-150 motion-reduce:transition-none',
                tileSize,
                ch == null
                  ? 'border-dashed border-white/20 bg-white/[0.03]'
                  : 'cursor-pointer border-sky-400/50 bg-sky-500/15 text-white disabled:cursor-default',
                hinted.has(i) && 'border-amber-300/60 bg-amber-400/15 text-amber-50',
                isWrong && 'border-rose-400/70 bg-rose-500/25 text-rose-100',
                status === 'right' &&
                  'border-emerald-400/70 bg-emerald-500/25 text-emerald-50 animate-[reading-check-choice-pop_350ms_ease-out] fill-mode-backwards motion-reduce:animate-none',
              )}
              style={status === 'right' ? { animationDelay: `${i * 50}ms` } : undefined}
            >
              {ch}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {letters.map((ch, id) => {
          const isUsed = used.has(id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => place(id)}
              disabled={isUsed || status !== 'idle'}
              tabIndex={isUsed ? -1 : undefined}
              aria-hidden={isUsed || undefined}
              className={cn(
                'flex items-center justify-center rounded-xl border font-bold transition-all duration-150 motion-reduce:transition-none',
                'animate-in fade-in zoom-in-75 fill-mode-backwards duration-300 motion-reduce:animate-none',
                tileSize,
                isUsed
                  ? 'border-dashed border-white/10 bg-transparent text-transparent'
                  : 'cursor-pointer border-white/15 bg-white/[0.1] text-white shadow-[0_4px_0_rgba(0,0,0,0.35)] hover:-translate-y-0.5 hover:bg-white/[0.16] active:translate-y-0.5 active:shadow-none disabled:cursor-default',
              )}
              style={{ animationDelay: `${id * 40}ms` }}
            >
              {ch}
            </button>
          )
        })}
      </div>

      {status === 'right' ? null : (
        <div className="flex items-center gap-2">
          <button type="button" className={REVIEW_HEADER_BTN} onClick={undo} disabled={!anyPlaced || status !== 'idle'}>
            <Delete className="h-4 w-4" aria-hidden />
            Undo
          </button>
          <button type="button" className={REVIEW_HEADER_BTN} onClick={hint} disabled={status !== 'idle'}>
            <Lightbulb className="h-4 w-4" aria-hidden />
            Hint
          </button>
        </div>
      )}
    </div>
  )
}
