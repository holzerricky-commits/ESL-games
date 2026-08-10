'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

export function StudentRewardStylePicker({
  collapsed,
  variant = 'sidebar',
}: {
  collapsed: boolean
  /** `overlay` = floating panel on class map / book (no teacher sidebar there). */
  variant?: 'sidebar' | 'overlay'
}) {
  const [style, setStyle] = useStudentRewardStylePreference()
  const [portalReady, setPortalReady] = useState(false)
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

  useEffect(() => () => clearTimers(), [clearTimers])

  useLayoutEffect(() => {
    if (variant === 'overlay') setPortalReady(true)
  }, [variant])

  const runPreview = useCallback(
    (nextStyle: StudentRewardStyle, phrase = 'Great job!') => {
      clearTimers()
      const id = Date.now()
      setPreview({ id, phrase, phase: 'in', style: nextStyle })
      playRewardChime()
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

  const previewNode = preview ? (
    <StudentRewardBurst
      key={preview.id}
      phrase={preview.phrase}
      phase={preview.phase}
      style={preview.style}
    />
  ) : null

  if (variant === 'overlay') {
    if (!portalReady) return null

    return createPortal(
      <div
        className="pointer-events-auto fixed z-[700]"
        style={{
          // Clear of the ~44px book left tool strip
          top: 12,
          left: 56,
        }}
        data-student-reward-style-picker="overlay"
      >
        <div
          className={cn(
            'flex w-[11.5rem] flex-col gap-1.5 rounded-xl border px-2 py-2 shadow-lg',
            'border-white/25 bg-black/80 text-white',
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 px-0.5">
            <p className="text-[11px] font-semibold tracking-wide text-white/95">Praise (G)</p>
            <button
              type="button"
              title="Try current style"
              onClick={(e) => {
                e.stopPropagation()
                runPreview(style)
              }}
              className="pointer-events-auto rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Play size={12} fill="currentColor" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {STUDENT_REWARD_STYLES.map((id) => {
              const meta = STUDENT_REWARD_STYLE_META[id]
              const selected = style === id
              return (
                <button
                  key={id}
                  type="button"
                  title={`${meta.label}: ${meta.blurb}`}
                  aria-pressed={selected}
                  onPointerDown={(e) => {
                    // Prefer pointerdown so book tools cannot steal the gesture.
                    e.preventDefault()
                    e.stopPropagation()
                    selectStyle(id)
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  className={cn(
                    'pointer-events-auto flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left',
                    selected
                      ? 'border-emerald-300/80 bg-white/15 text-white'
                      : 'border-white/20 bg-white/5 text-white/90 hover:bg-white/10',
                  )}
                >
                  <span
                    className={cn(
                      'h-7 w-7 shrink-0 rounded-md border border-white/70 shadow-sm',
                      STYLE_SWATCH[id],
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold leading-tight">
                      {meta.shortLabel}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        {previewNode}
      </div>,
      document.body,
    )
  }

  if (collapsed) {
    return (
      <div className="mt-4 flex flex-col items-center gap-2 border-t border-border pt-4">
        <p className="sr-only">Praise style (G key)</p>
        {STUDENT_REWARD_STYLES.map((id) => {
          const meta = STUDENT_REWARD_STYLE_META[id]
          const selected = style === id
          return (
            <button
              key={id}
              type="button"
              title={`${meta.label}: ${meta.blurb}`}
              aria-pressed={selected}
              onClick={() => selectStyle(id)}
              className={cn(
                'h-8 w-8 rounded-lg border-2 transition-shadow',
                STYLE_SWATCH[id],
                selected
                  ? 'border-foreground shadow-sm ring-2 ring-primary/40'
                  : 'border-border/80 opacity-80 hover:opacity-100',
              )}
            />
          )
        })}
        {previewNode}
      </div>
    )
  }

  return (
    <div className="mt-4 shrink-0 border-t border-border pt-4">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div>
          <p className="text-xs font-semibold text-foreground">Praise (G)</p>
          <p className="text-[11px] text-muted-foreground leading-snug">Pick a look for students</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          title="Try current style"
          onClick={() => runPreview(style)}
        >
          <Play size={14} fill="currentColor" />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        {STUDENT_REWARD_STYLES.map((id) => {
          const meta = STUDENT_REWARD_STYLE_META[id]
          const selected = style === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => selectStyle(id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg border px-2 py-2 text-left transition-colors',
                selected
                  ? 'border-primary/50 bg-accent text-foreground'
                  : 'border-transparent bg-transparent text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <span
                className={cn(
                  'h-8 w-8 shrink-0 rounded-md border border-white/80 shadow-sm',
                  STYLE_SWATCH[id],
                )}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-foreground">{meta.label}</span>
                <span className="block text-[11px] text-muted-foreground leading-snug">
                  {meta.blurb}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {previewNode}
    </div>
  )
}
