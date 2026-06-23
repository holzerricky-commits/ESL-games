'use client'

import type { ReactNode, RefObject } from 'react'
import type { WritableStickerVariant } from '@/lib/books/annotation-command-types'
import {
  writableStickerChrome,
  WRITABLE_STICKER_HEADER_PX,
} from '@/lib/books/writable-sticker-visuals'
import { cn } from '@/lib/utils'

function SpeechBubbleTail({
  fill,
  stroke,
  className,
}: {
  fill: string
  stroke: string
  className?: string
}) {
  return (
    <svg
      width="22"
      height="14"
      viewBox="0 0 22 14"
      aria-hidden
      className={cn('pointer-events-none absolute', className)}
    >
      <path
        d="M1 1 H21 V9 H10 L5 13 L5 9 H1 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ThoughtBubblePuffs({
  fill,
  stroke,
}: {
  fill: string
  stroke: string
}) {
  const puff = (size: number, className: string) => (
    <span
      className={cn('inline-block rounded-full border-2', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: fill,
        borderColor: stroke,
      }}
    />
  )
  return (
    <div
      className="pointer-events-none absolute bottom-0 left-[22%] flex items-end gap-1.5"
      aria-hidden
    >
      {puff(14, '-translate-y-0.5')}
      {puff(9, 'translate-y-1')}
      {puff(5, 'translate-y-2.5')}
    </div>
  )
}

export interface WritableStickerShellProps {
  variant: WritableStickerVariant
  fillColor: string
  leftPct: number
  topPct: number
  widthPct: number
  shellMinPx: number
  bodyMinPx: number
  shellRef: RefObject<HTMLDivElement | null>
  annotationLabelId?: string
  showEditChrome: boolean
  blockPointerEvents: string
  stackZ?: number
  deleteButton: ReactNode
  onShellPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onShellPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void
  onShellClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  children: ReactNode
}

export function WritableStickerShell({
  variant,
  fillColor,
  leftPct,
  topPct,
  widthPct,
  shellMinPx,
  bodyMinPx,
  shellRef,
  annotationLabelId,
  showEditChrome,
  blockPointerEvents,
  stackZ,
  deleteButton,
  onShellPointerDown,
  onShellPointerUp,
  onShellClick,
  children,
}: WritableStickerShellProps) {
  const chrome = writableStickerChrome(variant, fillColor)
  const isNote = variant === 'note'
  const isSpeech = variant === 'speech'
  const isThought = variant === 'thought'
  const isCaption = variant === 'caption'

  const editRing =
    showEditChrome &&
    'shadow-[0_2px_4px_rgba(59,130,246,0.08),0_8px_20px_rgba(59,130,246,0.12)] ring-2 ring-[var(--brand-blue)]/55'

  if (isNote) {
    return (
      <div
        ref={shellRef}
        data-annotation-label={annotationLabelId}
        className={cn(
          'group/sticky absolute box-border flex flex-col overflow-hidden rounded-lg border',
          chrome.shadowClass,
          'transition-[box-shadow,ring-color] duration-150',
          blockPointerEvents,
          editRing,
        )}
        style={{
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          minWidth: 48,
          minHeight: shellMinPx,
          backgroundColor: chrome.backgroundColor,
          borderColor: chrome.borderColor,
          borderWidth: chrome.borderWidthPx,
          ...(stackZ != null ? { zIndex: stackZ } : {}),
        }}
        onPointerDown={onShellPointerDown}
        onPointerUp={onShellPointerUp}
        onClick={onShellClick}
      >
        <div
          className="relative flex shrink-0 items-center justify-end px-0.5"
          style={{
            height: WRITABLE_STICKER_HEADER_PX,
            backgroundColor: chrome.headerColor,
          }}
        >
          {deleteButton}
        </div>
        <div className="relative min-h-0 flex-1" style={{ minHeight: bodyMinPx }}>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={shellRef}
      className="group/sticky absolute"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${widthPct}%`,
        minWidth: isCaption ? 56 : 52,
        paddingBottom: chrome.tailReservePx,
        ...(stackZ != null ? { zIndex: stackZ } : {}),
      }}
    >
      <div
        data-annotation-label={annotationLabelId}
        className={cn('relative', blockPointerEvents)}
        style={{ minHeight: shellMinPx - chrome.tailReservePx }}
        onPointerDown={onShellPointerDown}
        onPointerUp={onShellPointerUp}
        onClick={onShellClick}
      >
        <div
          className={cn(
            'relative flex flex-col overflow-hidden transition-[box-shadow,ring-color] duration-150',
            isSpeech && 'rounded-[1.25rem]',
            isThought && 'rounded-[999px]',
            isCaption && 'rounded-md',
            chrome.shadowClass,
            editRing,
          )}
          style={{
            minHeight: shellMinPx - chrome.tailReservePx,
            backgroundColor: chrome.backgroundColor,
            borderColor: chrome.borderColor,
            borderWidth: chrome.borderWidthPx,
            borderStyle: chrome.borderStyle,
          }}
        >
          <div className="absolute right-1 top-1 z-10">{deleteButton}</div>
          <div
            className={cn(
              'relative flex min-h-0 flex-1 flex-col justify-center',
              isCaption ? 'px-2.5 py-1.5' : 'px-3.5 py-2.5',
            )}
            style={{ minHeight: bodyMinPx }}
          >
            {children}
          </div>
        </div>

        {isSpeech ? (
          <SpeechBubbleTail
            fill={chrome.backgroundColor}
            stroke={chrome.borderColor}
            className="-bottom-[11px] left-[16%]"
          />
        ) : null}
        {isThought ? <ThoughtBubblePuffs fill={chrome.backgroundColor} stroke={chrome.borderColor} /> : null}
      </div>
    </div>
  )
}
