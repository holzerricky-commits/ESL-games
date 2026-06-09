'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import { ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS } from '@/lib/books/annotation-storage'
import { cn } from '@/lib/utils'
import { popoverSectionLabelClass } from '@/components/students/annotation-popover-controls'

const THICKNESS_STEP_MAX = 6
const SLIDER_THUMB_PX = 14
const SLIDER_THUMB_PX_COMPACT = 10

/** Neutral preview fill — diameter equals on-canvas line width (no border). */
const PREVIEW_DOT_CLASS = 'shrink-0 rounded-full bg-white/60'
const PREVIEW_DOT_ACTIVE_CLASS = 'shrink-0 rounded-full bg-white/85'

function sliderStepLeft(step: number, thumbPx: number): string {
  const thumbInset = thumbPx / 2
  const ratio = step / THICKNESS_STEP_MAX
  return `calc(${thumbInset}px + (100% - ${thumbPx}px) * ${ratio})`
}

function clientXToThicknessStep(
  clientX: number,
  railRect: DOMRect,
  thumbPx: number,
): AnnotationStrokeThicknessStep {
  const thumbInset = thumbPx / 2
  const usable = railRect.width - thumbPx
  const x = clientX - railRect.left - thumbInset
  const ratio = usable > 0 ? Math.max(0, Math.min(1, x / usable)) : 0
  return Math.round(ratio * THICKNESS_STEP_MAX) as AnnotationStrokeThicknessStep
}

function ThicknessPreviewDot({
  diameterPx,
  active = false,
  className,
}: {
  diameterPx: number
  active?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(active ? PREVIEW_DOT_ACTIVE_CLASS : PREVIEW_DOT_CLASS, className)}
      style={{ width: diameterPx, height: diameterPx }}
    />
  )
}

/** Click/drag rail to jump steps; preview dots match on-canvas line width in px. */
export function ThicknessSliderRow({
  value,
  onChange,
  idPrefix,
  previewDots = ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS,
  ariaLabel = 'Thickness',
  compact = false,
}: {
  value: AnnotationStrokeThicknessStep
  onChange: (s: AnnotationStrokeThicknessStep) => void
  idPrefix: string
  previewDots?: readonly number[]
  ariaLabel?: string
  compact?: boolean
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const thumbPx = compact ? SLIDER_THUMB_PX_COMPACT : SLIDER_THUMB_PX
  const maxDotPx = previewDots[THICKNESS_STEP_MAX] ?? previewDots[previewDots.length - 1] ?? 14
  const currentDotPx = previewDots[value] ?? previewDots[0] ?? 8

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const rail = railRef.current
      if (!rail) return
      onChange(clientXToThicknessStep(clientX, rail.getBoundingClientRect(), thumbPx))
    },
    [onChange, thumbPx],
  )

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return
      updateFromClientX(e.clientX)
    }
    const onPointerUp = () => {
      draggingRef.current = false
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [updateFromClientX])

  const startDrag = (clientX: number) => {
    draggingRef.current = true
    updateFromClientX(clientX)
  }

  const rail = (
    <div
      ref={railRef}
      id={`${idPrefix}-thick-slider`}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={THICKNESS_STEP_MAX}
      aria-valuenow={value}
      aria-valuetext={`Stroke size ${value + 1}`}
      className={cn(
        'relative flex w-full cursor-pointer touch-none items-center select-none',
        compact ? 'h-6' : 'h-8',
      )}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        startDrag(e.clientX)
      }}
    >
      <div className="pointer-events-none relative h-1 w-full rounded-full bg-[#2a2118]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-amber-500/45"
          style={{ width: sliderStepLeft(value, thumbPx) }}
        />
      </div>
      <div
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-400/70 bg-amber-100 shadow-sm',
          compact ? 'size-2.5' : 'size-3.5',
        )}
        style={{ left: sliderStepLeft(value, thumbPx) }}
        aria-hidden
      />
    </div>
  )

  if (compact) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className="flex shrink-0 items-center justify-center"
          style={{ width: maxDotPx, height: maxDotPx }}
          aria-hidden
        >
          <ThicknessPreviewDot
            diameterPx={currentDotPx}
            className="transition-[width,height] duration-100 ease-out"
          />
        </div>
        {rail}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <p className={popoverSectionLabelClass}>Thickness</p>
      {rail}
      <div className="relative mt-1 w-full" style={{ minHeight: maxDotPx }}>
        {previewDots.map((dotPx, i) => {
          const step = i as AnnotationStrokeThicknessStep
          if (step > THICKNESS_STEP_MAX) return null
          const active = value === step
          return (
            <button
              key={step}
              type="button"
              id={`${idPrefix}-thick-${i}`}
              aria-label={`Stroke size ${i + 1}`}
              aria-pressed={active}
              onClick={() => onChange(step)}
              className="absolute bottom-0 z-[1] flex h-10 w-10 -translate-x-1/2 items-end justify-center rounded-md"
              style={{ left: sliderStepLeft(step, thumbPx) }}
            >
              <ThicknessPreviewDot diameterPx={dotPx} active={active} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
