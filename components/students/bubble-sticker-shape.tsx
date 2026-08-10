'use client'

import type { WritableStickerVariant } from '@/lib/books/annotation-command-types'
import {
  BUBBLE_STICKER_STROKE_COLOR,
  THOUGHT_TAIL_SIDE_RESERVE_PX,
} from '@/lib/books/writable-sticker-visuals'
import { cn } from '@/lib/utils'

/** Fixed pixel inset between bubble body edge and text. */
export const BUBBLE_BODY_PAD_PX = 12

/** Extra bottom inset so speech text clears the attached pointer. */
export const SPEECH_BUBBLE_EXTRA_BOTTOM_PAD_PX = 6

type BubbleShapeProps = {
  variant: 'speech' | 'thought'
  fillColor: string
  strokeColor?: string
  className?: string
}

export function BubbleBodyShape({
  variant,
  fillColor,
  strokeColor = BUBBLE_STICKER_STROKE_COLOR,
  className,
}: BubbleShapeProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 box-border border-2',
        variant === 'thought' ? 'rounded-[50%]' : 'rounded-sm',
        className,
      )}
      style={{
        backgroundColor: fillColor,
        borderColor: strokeColor,
      }}
    />
  )
}

type BubbleTailProps = {
  fillColor: string
  strokeColor?: string
  className?: string
}

/** Connected pointer overlapping the bottom-left edge of the speech rectangle. */
export function SpeechBubbleTail({
  fillColor,
  strokeColor = BUBBLE_STICKER_STROKE_COLOR,
  className,
}: BubbleTailProps) {
  return (
    <svg
      width={14}
      height={11}
      viewBox="0 0 14 11"
      aria-hidden
      className={cn(
        'pointer-events-none absolute bottom-0 left-3 z-[2] translate-y-1/2',
        className,
      )}
    >
      <path
        d="M 1 0 H 13 L 1 11 Z"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Three small circles trailing diagonally down-left from the oval side. */
export function ThoughtBubbleTail({
  fillColor,
  strokeColor = BUBBLE_STICKER_STROKE_COLOR,
  className,
}: BubbleTailProps) {
  return (
    <svg
      width={THOUGHT_TAIL_SIDE_RESERVE_PX + 6}
      height={28}
      viewBox="0 0 24 28"
      aria-hidden
      className={cn(
        'pointer-events-none absolute z-[2]',
        className,
      )}
      style={{
        left: -THOUGHT_TAIL_SIDE_RESERVE_PX,
        bottom: '22%',
      }}
    >
      <circle cx={16} cy={6} r={5} fill={fillColor} stroke={strokeColor} strokeWidth={1.5} />
      <circle cx={9} cy={15} r={3.5} fill={fillColor} stroke={strokeColor} strokeWidth={1.5} />
      <circle cx={3} cy={23} r={2.25} fill={fillColor} stroke={strokeColor} strokeWidth={1.5} />
    </svg>
  )
}

export function BubbleTailShape({
  variant,
  fillColor,
  strokeColor = BUBBLE_STICKER_STROKE_COLOR,
  className,
}: BubbleTailProps & { variant: 'speech' | 'thought' }) {
  if (variant === 'speech') {
    return <SpeechBubbleTail fillColor={fillColor} strokeColor={strokeColor} className={className} />
  }
  return <ThoughtBubbleTail fillColor={fillColor} strokeColor={strokeColor} className={className} />
}

export function isBubbleWritableVariant(
  variant: WritableStickerVariant,
): variant is 'speech' | 'thought' {
  return variant === 'speech' || variant === 'thought'
}
