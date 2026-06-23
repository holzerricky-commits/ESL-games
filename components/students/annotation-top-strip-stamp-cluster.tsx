'use client'

import { ChevronDown } from 'lucide-react'
import type { StampVariant } from '@/lib/books/annotation-command-types'
import { ANNOTATION_STAMP_QUESTION_SWATCHES } from '@/lib/books/annotation-palettes'
import { ColorSwatchRow } from '@/components/students/annotation-swatch-picker'
import { PopoverIconGridRow } from '@/components/students/annotation-popover-controls'
import {
  TOP_STRIP_POPOVER_CLASS,
  TOP_STRIP_POPOVER_STACK,
} from '@/components/students/annotation-top-strip-controls'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

import { STICKER_QUICK_LABEL } from '@/lib/books/sticker-tool'

const STAMP_LABEL = STICKER_QUICK_LABEL

export function TopStripStampCluster({
  stampVariant,
  setStampVariant,
  stampQuestionColor,
  setStampQuestionColor,
  stampIconForVariant,
  paletteOpen,
  onPaletteOpenChange,
  idPrefix,
}: {
  stampVariant: StampVariant
  setStampVariant: (v: StampVariant) => void
  stampQuestionColor: string
  setStampQuestionColor: (c: string) => void
  stampIconForVariant: (variant: StampVariant, questionColor: string) => ReactNode
  paletteOpen: boolean
  onPaletteOpenChange: (open: boolean) => void
  idPrefix: string
}) {
  const chevronClass = cn(
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/55 hover:bg-white/10 hover:text-white/90',
    paletteOpen && 'bg-white/10 text-white/90',
  )

  const stampOptions = (['check', 'cross', 'question', 'star', 'heart'] as const).map((v) => ({
    value: v,
    ariaLabel: STAMP_LABEL[v],
    icon: stampIconForVariant(v, v === 'question' ? stampQuestionColor : ''),
  }))

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-2 ring-amber-400/70"
        aria-label={`Stamp: ${STAMP_LABEL[stampVariant]}`}
        onClick={() => onPaletteOpenChange(true)}
      >
        {stampIconForVariant(stampVariant, stampQuestionColor)}
      </button>

      <Popover open={paletteOpen} onOpenChange={onPaletteOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={chevronClass}
            aria-label="More stamps"
            title="More stamps"
            aria-expanded={paletteOpen}
          >
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className={TOP_STRIP_POPOVER_CLASS}>
          <div className={TOP_STRIP_POPOVER_STACK}>
            <PopoverIconGridRow
              label="Stamp"
              labelHidden
              value={stampVariant}
              onChange={(v) => setStampVariant(v as StampVariant)}
              idPrefix={`${idPrefix}-variant`}
              options={stampOptions}
            />
            {stampVariant === 'question' ? (
              <ColorSwatchRow
                colors={ANNOTATION_STAMP_QUESTION_SWATCHES}
                current={stampQuestionColor}
                onPick={setStampQuestionColor}
                idPrefix={`${idPrefix}-question`}
                label="Question color"
                swatchSize="compact"
              />
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
