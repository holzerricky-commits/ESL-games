'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, X } from 'lucide-react'
import { StudentRewardBurst } from '@/components/students/student-reward-burst'
import {
  STUDENT_REWARD_HOLD_MS,
  STUDENT_REWARD_PREVIEW_TOTAL_MS,
  useStudentRewardStylePreference,
} from '@/components/students/student-reward-burst-context'
import { playRewardChime } from '@/lib/audio/play-reward-chime'
import {
  STUDENT_REWARD_STYLE_META,
  STUDENT_REWARD_STYLES,
  type StudentRewardStyle,
} from '@/lib/students/student-reward-style'
import { cn } from '@/lib/utils'

const STYLE_SWATCH: Record<StudentRewardStyle, string> = {
  sticker: 'bg-gradient-to-br from-[#ff4d6d] via-[#ff8fab] to-[#ffd93d]',
  billboard: 'bg-gradient-to-b from-[#1a1a24] via-[#3d3420] to-[#ffe566]',
  'warm-card': 'bg-gradient-to-r from-[#2563eb] via-[#3b82f6] to-[#fbbf24]',
}

/**
 * Lesson settings drawer from the book left strip.
 * Portaled to document.body so book tools cannot sit on top of the choices.
 */
export function ClassLessonSettingsPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [style, setStyle] = useStudentRewardStylePreference()
  const [preview, setPreview] = useState<{
    id: number
    phrase: string
    phase: 'in' | 'out'
    style: StudentRewardStyle
  } | null>(null)
  const timersRef = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id)
    timersRef.current = []
  }, [])

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  useEffect(() => {
    if (!open) {
      clearTimers()
      setPreview(null)
      return
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose, clearTimers])

  const runPreview = useCallback(
    (nextStyle: StudentRewardStyle, phrase = 'Great job!') => {
      clearTimers()
      const id = Date.now()
      setPreview({ id, phrase, phase: 'in', style: nextStyle })
      try {
        playRewardChime()
      } catch {
        /* ignore audio failures */
      }
      timersRef.current.push(
        window.setTimeout(() => {
          setPreview((prev) => (prev?.id === id ? { ...prev, phase: 'out' } : prev))
        }, STUDENT_REWARD_HOLD_MS),
        window.setTimeout(() => {
          setPreview((prev) => (prev?.id === id ? null : prev))
        }, STUDENT_REWARD_PREVIEW_TOTAL_MS),
      )
    },
    [clearTimers],
  )

  const selectStyle = useCallback(
    (next: StudentRewardStyle) => {
      setStyle(next)
      runPreview(next)
    },
    [runPreview, setStyle],
  )

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[700]"
      data-class-lesson-settings="open"
    >
      {/* Dimmer behind the card — not a <button>, so it cannot steal focus/hits from the list */}
      <div
        aria-hidden
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lesson settings"
        className={cn(
          'absolute left-14 top-1/2 z-10 w-[min(20rem,calc(100vw-4.5rem))] -translate-y-1/2',
          'rounded-2xl border border-white/15 bg-[#1c1c20] p-3 text-white shadow-2xl',
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold tracking-wide">Lesson settings</p>
            <p className="mt-0.5 text-[11px] text-white/55">Changes apply to this class screen</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            title="Close"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <section className="rounded-xl border border-white/10 bg-white/5 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-white">Praise (G)</p>
              <p className="text-[11px] leading-snug text-white/50">
                Look students see when you press G
              </p>
            </div>
            <button
              type="button"
              title="Try current style"
              onClick={() => runPreview(style)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 text-[11px] font-medium text-white/90 hover:bg-white/15"
            >
              <Play size={12} fill="currentColor" aria-hidden />
              Try
            </button>
          </div>

          <div className="flex flex-col gap-1.5" role="listbox" aria-label="Praise style">
            {STUDENT_REWARD_STYLES.map((id) => {
              const meta = STUDENT_REWARD_STYLE_META[id]
              const selected = style === id
              return (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  title={`${meta.label}: ${meta.blurb}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    selectStyle(id)
                  }}
                  className={cn(
                    'relative z-10 flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition-colors',
                    selected
                      ? 'border-emerald-400/70 bg-emerald-500/15 text-white'
                      : 'border-white/10 bg-black/20 text-white/85 hover:border-white/25 hover:bg-white/10',
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none h-9 w-9 shrink-0 rounded-lg border border-white/70 shadow-sm',
                      STYLE_SWATCH[id],
                    )}
                    aria-hidden
                  />
                  <span className="pointer-events-none min-w-0 flex-1">
                    <span className="block text-xs font-semibold leading-tight">{meta.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-white/55">
                      {meta.blurb}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'pointer-events-none grid h-4 w-4 shrink-0 place-items-center rounded-full border',
                      selected ? 'border-emerald-300 bg-emerald-400' : 'border-white/35',
                    )}
                    aria-hidden
                  >
                    {selected ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#1c1c20]" />
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      {/* Preview sits over the dimmer but under the options card so rows stay clickable */}
      {preview ? (
        <div className="pointer-events-none absolute inset-0 z-[5]">
          <StudentRewardBurst
            key={preview.id}
            phrase={preview.phrase}
            phase={preview.phase}
            style={preview.style}
            portalToBody={false}
          />
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
