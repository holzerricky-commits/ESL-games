'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import { formatAnnotationSizePx } from '@/lib/books/text-font-size-pixel'
import { inkPreviewDiameterPx } from '@/lib/books/ink-thickness-pixel'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { SELECTION_CONTEXT_POPOVER_CONTENT_CLASS } from '@/components/students/selection-context-bar/selection-context-bar-styles'

const STEP_BTN =
  'flex h-3.5 w-6 shrink-0 items-center justify-center rounded text-white/45 transition-colors hover:bg-white/10 hover:text-white/80 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/55'

const VALUE_BTN =
  'inline-flex h-7 min-w-[3.75rem] shrink-0 items-center justify-center gap-0.5 rounded-lg px-1.5 text-[11px] font-medium tabular-nums text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/55'

const MENU_ITEM =
  'flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs tabular-nums text-white/75 transition-colors hover:bg-white/10'

export type SelectionContextSizeStepOption = {
  step: AnnotationStrokeThicknessStep
  px: number
}

export function SelectionContextSizeStepper({
  valueStep,
  options,
  onChange,
  showInkPreview = false,
  ariaLabel,
  idPrefix,
}: {
  valueStep: AnnotationStrokeThicknessStep
  options: readonly SelectionContextSizeStepOption[]
  onChange: (step: AnnotationStrokeThicknessStep) => void
  showInkPreview?: boolean
  ariaLabel: string
  idPrefix: string
}) {
  const [open, setOpen] = useState(false)

  const current = useMemo(
    () => options.find((o) => o.step === valueStep) ?? options[0]!,
    [options, valueStep],
  )

  const currentIndex = options.findIndex((o) => o.step === valueStep)
  const canIncrease = currentIndex >= 0 && currentIndex < options.length - 1
  const canDecrease = currentIndex > 0

  function stepBy(delta: 1 | -1) {
    const idx = currentIndex < 0 ? 0 : currentIndex + delta
    const next = options[idx]
    if (next) onChange(next.step)
  }

  const previewDiameter = inkPreviewDiameterPx(current.px)

  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={ariaLabel}>
      {showInkPreview ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden>
          <span
            className="rounded-full bg-white/75"
            style={{ width: previewDiameter, height: previewDiameter }}
          />
        </span>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={`${idPrefix}-size-value`}
            className={VALUE_BTN}
            aria-label={`${ariaLabel}: ${formatAnnotationSizePx(current.px)} pixels`}
            title={`${formatAnnotationSizePx(current.px)} px`}
          >
            <span>{formatAnnotationSizePx(current.px)}</span>
            <span className="text-[10px] font-normal text-white/45">px</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-white/45" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={10}
          collisionPadding={12}
          className={cn(SELECTION_CONTEXT_POPOVER_CONTENT_CLASS, 'w-[min(8rem,calc(100vw-2rem))] p-1')}
        >
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-white/45">
            Size
          </p>
          <div className="max-h-[min(14rem,50vh)] space-y-0.5 overflow-y-auto">
            {options.map((opt) => {
              const selected = opt.step === valueStep
              return (
                <button
                  key={opt.step}
                  type="button"
                  className={cn(MENU_ITEM, selected && 'bg-white/15 font-semibold text-white')}
                  onClick={() => {
                    onChange(opt.step)
                    setOpen(false)
                  }}
                >
                  {formatAnnotationSizePx(opt.px)} px
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex shrink-0 flex-col gap-px" role="group" aria-label={`${ariaLabel} step`}>
        <button
          type="button"
          className={STEP_BTN}
          aria-label={`Increase ${ariaLabel.toLowerCase()}`}
          title="Increase"
          disabled={!canIncrease}
          onClick={() => stepBy(1)}
        >
          <ChevronUp className="h-3 w-3" strokeWidth={2.25} aria-hidden />
        </button>
        <button
          type="button"
          className={STEP_BTN}
          aria-label={`Decrease ${ariaLabel.toLowerCase()}`}
          title="Decrease"
          disabled={!canDecrease}
          onClick={() => stepBy(-1)}
        >
          <ChevronDown className="h-3 w-3" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </div>
  )
}
