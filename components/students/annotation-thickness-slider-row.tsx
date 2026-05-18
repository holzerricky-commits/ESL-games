'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import { ANNOTATION_PEN_THICKNESS_PREVIEW_DOTS } from '@/lib/books/annotation-storage'
import { cn } from '@/lib/utils'
import { popoverSectionLabelClass } from '@/components/students/annotation-popover-controls'

const THICKNESS_STEP_MAX = 6
const SLIDER_THUMB_PX = 14

/** Default marker / eraser preview dot sizes (matches legacy ThicknessRow). */
export const ANNOTATION_DEFAULT_THICKNESS_PREVIEW_DOTS = [0, 1, 2, 3, 4, 5, 6].map(
  (i) => 4 + i * 1.75,
) as readonly number[]

function sliderStepLeft(step: number): string {
  const thumbInset = SLIDER_THUMB_PX / 2
  const ratio = step / THICKNESS_STEP_MAX
  return `calc(${thumbInset}px + (100% - ${SLIDER_THUMB_PX}px) * ${ratio})`
}

function clientXToThicknessStep(clientX: number, railRect: DOMRect): AnnotationStrokeThicknessStep {
  const thumbInset = SLIDER_THUMB_PX / 2
  const usable = railRect.width - SLIDER_THUMB_PX
  const x = clientX - railRect.left - thumbInset
  const ratio = usable > 0 ? Math.max(0, Math.min(1, x / usable)) : 0
  return Math.round(ratio * THICKNESS_STEP_MAX) as AnnotationStrokeThicknessStep
}

/** Click/drag rail to jump steps; preview dots below are direct size targets. */
export function ThicknessSliderRow({
  value,
  onChange,
  idPrefix,
  previewDots = ANNOTATION_PEN_THICKNESS_PREVIEW_DOTS,
  ariaLabel = 'Thickness',
}: {
  value: AnnotationStrokeThicknessStep
  onChange: (s: AnnotationStrokeThicknessStep) => void
  idPrefix: string
  previewDots?: readonly number[]
  ariaLabel?: string
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const maxDotPx = previewDots[THICKNESS_STEP_MAX] ?? previewDots[previewDots.length - 1] ?? 14

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const rail = railRef.current
      if (!rail) return
      onChange(clientXToThicknessStep(clientX, rail.getBoundingClientRect()))
    },
    [onChange],
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

  return (
    <div className="space-y-2.5">
      <p className={popoverSectionLabelClass}>Thickness</p>
      <div
        ref={railRef}
        id={`${idPrefix}-thick-slider`}
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={THICKNESS_STEP_MAX}
        aria-valuenow={value}
        aria-valuetext={`Stroke size ${value + 1}`}
        className="relative flex h-8 w-full cursor-pointer touch-none items-center select-none"
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.preventDefault()
          startDrag(e.clientX)
        }}
      >
        <div className="pointer-events-none relative h-1 w-full rounded-full bg-[#2a2118]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-amber-500/45"
            style={{ width: sliderStepLeft(value) }}
          />
        </div>
        <div
          className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-400/70 bg-amber-100 shadow-sm"
          style={{ left: sliderStepLeft(value) }}
          aria-hidden
        />
      </div>
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
              style={{ left: sliderStepLeft(i) }}
            >
              <span
                className={cn(
                  'shrink-0 rounded-full transition-colors',
                  active ? 'bg-amber-200 ring-2 ring-amber-400/70' : 'bg-[#9c8b7a]/75',
                )}
                style={{ width: dotPx, height: dotPx }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
