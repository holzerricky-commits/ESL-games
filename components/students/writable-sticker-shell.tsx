'use client'

import type { CSSProperties, ReactNode, RefObject } from 'react'
import type { WritableStickerVariant } from '@/lib/books/annotation-command-types'
import {
  BubbleBodyShape,
  BubbleTailShape,
  BUBBLE_BODY_PAD_PX,
  SPEECH_BUBBLE_EXTRA_BOTTOM_PAD_PX,
  isBubbleWritableVariant,
} from '@/components/students/bubble-sticker-shape'
import {
  THOUGHT_TAIL_SIDE_RESERVE_PX,
  writableStickerChrome,
  WRITABLE_STICKER_HEADER_PX,
} from '@/lib/books/writable-sticker-visuals'
import { cn } from '@/lib/utils'

export interface WritableStickerShellProps {
  variant: WritableStickerVariant
  fillColor: string
  leftPct: number
  topPct: number
  widthPct: number
  shellMinPx: number
  bodyMinPx: number
  /** When set (e.g. while typing), overrides bodyMinPx for live bubble growth. */
  liveBodyMinPx?: number
  shellRef: RefObject<HTMLDivElement | null>
  annotationLabelId?: string
  showEditChrome: boolean
  blockPointerEvents: string
  stackZ?: number
  deleteButton: ReactNode
  onShellPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onShellPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void
  onShellClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  allowContentOverflow?: boolean
  shellClassName?: string
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
  liveBodyMinPx,
  shellRef,
  annotationLabelId,
  showEditChrome,
  blockPointerEvents,
  stackZ,
  deleteButton,
  onShellPointerDown,
  onShellPointerUp,
  onShellClick,
  allowContentOverflow = false,
  shellClassName,
  children,
}: WritableStickerShellProps) {
  const chrome = writableStickerChrome(variant, fillColor)
  const isNote = variant === 'note'
  const isBubble = isBubbleWritableVariant(variant)
  const isThought = variant === 'thought'
  const effectiveBodyMinPx = liveBodyMinPx ?? bodyMinPx
  const effectiveShellMinPx = isBubble ? effectiveBodyMinPx : shellMinPx

  const editRing =
    showEditChrome &&
    'shadow-[0_2px_4px_rgba(59,130,246,0.08),0_8px_20px_rgba(59,130,246,0.12)] ring-2 ring-[var(--brand-blue)]/55'

  const textSlotPadding: CSSProperties = {
    padding: BUBBLE_BODY_PAD_PX,
    paddingBottom:
      variant === 'speech'
        ? BUBBLE_BODY_PAD_PX + SPEECH_BUBBLE_EXTRA_BOTTOM_PAD_PX
        : BUBBLE_BODY_PAD_PX,
  }

  if (isNote) {
    return (
      <div
        ref={shellRef}
        data-annotation-label={annotationLabelId}
        className={cn(
          'group/sticky absolute box-border flex flex-col rounded-lg border',
          allowContentOverflow ? 'overflow-visible' : 'overflow-hidden',
          chrome.shadowClass,
          'transition-[box-shadow,ring-color] duration-150',
          blockPointerEvents,
          editRing,
          shellClassName,
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

  const positionedStyle: CSSProperties = {
    left: `${leftPct}%`,
    top: `${topPct}%`,
    width: `${widthPct}%`,
    minWidth: isBubble ? 64 : 56,
    minHeight: isBubble ? effectiveShellMinPx : shellMinPx,
    ...(stackZ != null ? { zIndex: stackZ } : {}),
  }

  if (isBubble) {
    return (
      <div
        ref={shellRef}
        className={cn('group/sticky absolute', isThought && 'overflow-visible', shellClassName)}
        style={positionedStyle}
      >
        <div
          data-annotation-label={annotationLabelId}
          className={cn(
            'relative transition-[box-shadow,ring-color] duration-150',
            isThought || allowContentOverflow ? 'overflow-visible' : 'overflow-hidden',
            chrome.shadowClass,
            blockPointerEvents,
            editRing,
          )}
          style={isThought ? { paddingLeft: THOUGHT_TAIL_SIDE_RESERVE_PX } : undefined}
          onPointerDown={onShellPointerDown}
          onPointerUp={onShellPointerUp}
          onClick={onShellClick}
        >
          <div className="absolute right-1.5 top-1.5 z-10">{deleteButton}</div>
          <div
            className="relative w-full overflow-visible"
            style={{ height: effectiveBodyMinPx, minHeight: bodyMinPx }}
          >
            <BubbleBodyShape
              variant={variant}
              fillColor={chrome.backgroundColor}
              strokeColor={chrome.strokeColor}
            />
            <BubbleTailShape
              variant={variant}
              fillColor={chrome.backgroundColor}
              strokeColor={chrome.strokeColor}
            />
            <div
              className={cn(
                'absolute inset-0 z-[1] box-border flex items-center justify-center overflow-hidden',
                allowContentOverflow && 'overflow-visible',
              )}
              style={textSlotPadding}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={shellRef} className={cn('group/sticky absolute', shellClassName)} style={positionedStyle}>
      <div
        data-annotation-label={annotationLabelId}
        className={cn(
          'relative box-border rounded-md transition-[box-shadow,ring-color] duration-150',
          allowContentOverflow ? 'overflow-visible' : 'overflow-hidden',
          chrome.shadowClass,
          blockPointerEvents,
          editRing,
        )}
        style={{
          minHeight: bodyMinPx,
          backgroundColor: chrome.backgroundColor,
          borderColor: chrome.borderColor,
          borderWidth: chrome.borderWidthPx,
          borderStyle: chrome.borderStyle,
        }}
        onPointerDown={onShellPointerDown}
        onPointerUp={onShellPointerUp}
        onClick={onShellClick}
      >
        <div className="absolute right-1.5 top-1.5 z-10">{deleteButton}</div>
        <div
          className="relative z-[2] flex min-h-0 flex-col justify-center px-2.5 py-1.5"
          style={{ minHeight: bodyMinPx }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
