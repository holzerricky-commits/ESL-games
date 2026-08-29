'use client'

import type { TextAnnotationAlign } from '@/lib/books/annotation-command-types'
import { FILLED_LINE_GAP_PX } from '@/lib/books/filled-text-layout'
import { FILLED_TEXT_PILL_EDGE_SHADOW, textLabelAlignOrDefault } from '@/lib/books/text-label-layout'
import { cn } from '@/lib/utils'

export type FilledTextPillLayerProps = {
  segments: string[]
  widths: number[]
  fillHex: string
  rowMinPx: number
  textAlign?: TextAnnotationAlign
  className?: string
  /** Pill corner radius class — translation chips use `rounded-lg`. */
  roundedClassName?: string
  boxShadow?: string
}

export function FilledTextPillLayer({
  segments,
  widths,
  fillHex,
  rowMinPx,
  textAlign,
  className,
  roundedClassName = 'rounded-sm',
  boxShadow,
}: FilledTextPillLayerProps) {
  const showBg = segments.some((seg) => seg.length > 0)
  const align = textLabelAlignOrDefault(textAlign)

  return (
    <div
      className={cn('box-border flex w-full flex-col pointer-events-none', className)}
      style={{ gap: FILLED_LINE_GAP_PX }}
      aria-hidden
    >
      {segments.map((seg, i) => {
        const rowWidthPx = widths[i] ?? 8
        const isLastRow = i === segments.length - 1
        const rowHeightPx = rowMinPx + (isLastRow ? FILLED_LINE_GAP_PX : 0)
        const showRow = showBg && seg.length > 0
        const edgeShadow = showRow
          ? boxShadow
            ? `${FILLED_TEXT_PILL_EDGE_SHADOW}, ${boxShadow}`
            : FILLED_TEXT_PILL_EDGE_SHADOW
          : undefined
        return (
          <div key={i} className="box-border w-full" style={{ textAlign: align }}>
            <div
              className={cn('box-border inline-block align-top', roundedClassName)}
              style={{
                width: `${rowWidthPx}px`,
                maxWidth: '100%',
                minHeight: rowHeightPx,
                backgroundColor: showRow ? fillHex : 'transparent',
                ...(edgeShadow ? { boxShadow: edgeShadow } : {}),
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
