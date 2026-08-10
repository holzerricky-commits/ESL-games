'use client'

import { useMemo } from 'react'
import {
  BubbleBodyShape,
  SpeechBubbleTail,
  ThoughtBubbleTail,
} from '@/components/students/bubble-sticker-shape'
import type { WritableStickerVariant } from '@/lib/books/annotation-command-types'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import { WRITABLE_STICKER_HEADER_PX, writableStickerChrome } from '@/lib/books/writable-sticker-visuals'
import {
  buildWritableStickerPreviewFill,
  buildWritableStickerPreviewFontSizePx,
  buildWritableStickerPreviewLayout,
} from '@/lib/books/writable-sticker-preview-style'
import { cn } from '@/lib/utils'

export function WritableStickerPreview({
  writableStickerVariant,
  stickyFillColor,
  stickyThicknessStep,
  pageHeightPx,
}: {
  writableStickerVariant: WritableStickerVariant
  stickyFillColor: string
  stickyThicknessStep: AnnotationStrokeThicknessStep
  pageHeightPx?: number
}) {
  const fill = useMemo(
    () => buildWritableStickerPreviewFill(writableStickerVariant, stickyFillColor),
    [writableStickerVariant, stickyFillColor],
  )
  const fontSizePx = useMemo(
    () => buildWritableStickerPreviewFontSizePx(stickyThicknessStep, pageHeightPx),
    [stickyThicknessStep, pageHeightPx],
  )
  const layout = useMemo(
    () => buildWritableStickerPreviewLayout(writableStickerVariant),
    [writableStickerVariant],
  )
  const chrome = useMemo(
    () => writableStickerChrome(writableStickerVariant, fill),
    [writableStickerVariant, fill],
  )

  const isCentered =
    writableStickerVariant === 'caption' ||
    writableStickerVariant === 'speech' ||
    writableStickerVariant === 'thought'

  return (
    <div className="flex w-full items-center justify-center py-1">
      <div
        className={cn('relative overflow-visible', chrome.shadowClass)}
        style={{ width: layout.widthPx, height: layout.heightPx }}
      >
        {writableStickerVariant === 'note' ? (
          <div
            className="relative h-full w-full overflow-hidden rounded-sm border"
            style={{
              backgroundColor: chrome.backgroundColor,
              borderColor: chrome.borderColor,
              borderWidth: chrome.borderWidthPx,
              borderStyle: chrome.borderStyle,
            }}
          >
            <div
              className="w-full border-b"
              style={{
                height: WRITABLE_STICKER_HEADER_PX,
                backgroundColor: chrome.headerColor,
                borderColor: chrome.borderColor,
              }}
            />
            <p
              className="px-2 pt-1 text-[#334155]"
              style={{ fontSize: fontSizePx, lineHeight: 1.25 }}
            >
              {layout.sampleText}
            </p>
          </div>
        ) : writableStickerVariant === 'caption' ? (
          <div
            className="flex h-full w-full items-center justify-center rounded-md px-3"
            style={{ backgroundColor: fill }}
          >
            <span
              className="truncate font-medium text-[#f8fafc]"
              style={{ fontSize: fontSizePx }}
            >
              {layout.sampleText}
            </span>
          </div>
        ) : (
          <div className="relative h-full w-full">
            <BubbleBodyShape variant={writableStickerVariant} fillColor={fill} />
            {writableStickerVariant === 'speech' ? (
              <SpeechBubbleTail fillColor={fill} />
            ) : (
              <ThoughtBubbleTail fillColor={fill} />
            )}
            <div
              className={cn(
                'absolute inset-0 flex px-3',
                isCentered ? 'items-center justify-center text-center' : 'items-start pt-2',
              )}
            >
              <span
                className="truncate font-medium"
                style={{ fontSize: fontSizePx, color: chrome.textColor }}
              >
                {layout.sampleText}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
