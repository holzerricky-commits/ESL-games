'use client'

import type { CSSProperties, ReactNode } from 'react'
import {
  bookSpreadCoverSpineBandPx,
  bookSpreadFrameBookBodyHeightPx,
  bookSpreadFrameBookBodyWidthPx,
  bookSpreadFrameShellPaddingStyle,
  bookSpreadHardcoverShellRadiusPx,
  bookSpreadSpineCenterInCoverPx,
  bookSpreadSpineStripLayout,
  computeBookSpreadFrameMetrics,
  BOOK_SPREAD_FRAME_SCALE,
} from '@/lib/books/book-spread-frame-metrics'
import {
  hardcoverLeatherCoverStyle,
  hardcoverLeatherOverlayStyle,
} from '@/lib/books/book-cover-leather-texture'
import {
  hardcoverBoardBevelInsetBoxShadow,
  hardcoverBoardPanelCornerRadiusStyle,
} from '@/lib/books/book-cover-board-depth'
import {
  BINDING_GUTTER_LEFT_FALLOFF_PX,
  BINDING_SEAM_SHADOW_WIDTH_PX,
  bookBindingGutterLeftPageShadowStyle,
  bookBindingGutterLightingOverlayStyle,
  bookBindingGutterRightPageHighlightStyle,
  bookBindingGutterRightPageShadowStyle,
} from '@/lib/books/book-binding-seam-shadow'
import {
  bookCoverBoardAmbientDeskShadowStyle,
  bookCoverBoardContactDeskShadowStyle,
  bookSpineGutterAmbientDeskShadowStyle,
  bookSpineGutterBentDeskShadowStrokeWidthPx,
} from '@/lib/books/book-spread-desk-shadow'
import { bookSpineGutterBottomConcaveEdgePathData } from '@/lib/books/book-spine-gutter-depth'
import { bookSpineGutterStripStyle, BOOK_COVER_BOARD_COLOR, BOOK_COVER_BOARD_SPINE_OVERLAP_PX } from '@/lib/books/book-spine-gutter-strip'
import { bookSpreadHardcoverGutterOnlyForFrameTuning } from '@/lib/books/feature-flags'
import { cn } from '@/lib/utils'

const PAGE_STACK_COLOR = '#e4dfd4'
const PAGE_STACK_UNDER_COLOR = '#d5cfc4'
const PAGE_STACK_LAYER_OFFSET_X_PX = Math.round(5 * BOOK_SPREAD_FRAME_SCALE)
const PAGE_STACK_LAYER_OFFSET_Y_PX = Math.round(5 * BOOK_SPREAD_FRAME_SCALE)

function pageStackLayerStyle(
  contentWidthPx: number,
  contentHeightPx: number,
  pageStackInsetPx: number,
  pageStackBottomInsetPx: number,
  twoPage: boolean,
  extra?: CSSProperties,
): CSSProperties {
  return {
    boxSizing: 'border-box',
    width: contentWidthPx,
    minHeight: contentHeightPx,
    paddingLeft: twoPage ? 0 : pageStackInsetPx,
    paddingRight: twoPage ? 0 : pageStackInsetPx,
    paddingBottom: pageStackBottomInsetPx,
    ...extra,
  }
}

function SpineGutterAmbientDeskShadow({
  leftPx,
  widthPx,
  heightPx,
}: {
  leftPx: number
  widthPx: number
  heightPx: number
}) {
  if (widthPx <= 0 || heightPx <= 0) return null

  const edgePath = bookSpineGutterBottomConcaveEdgePathData(widthPx, heightPx)
  const strokeWidthPx = bookSpineGutterBentDeskShadowStrokeWidthPx(widthPx)

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute top-0 z-[1] overflow-visible"
      width={widthPx}
      height={heightPx}
      style={{
        left: leftPx,
        overflow: 'visible',
        ...bookSpineGutterAmbientDeskShadowStyle(widthPx, heightPx),
      }}
    >
      <path
        d={edgePath}
        fill="none"
        stroke="black"
        strokeWidth={strokeWidthPx}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function SpineGutterStrip({
  leftPx,
  widthPx,
  heightPx,
}: {
  leftPx: number
  widthPx: number
  heightPx: number
}) {
  if (widthPx <= 0 || heightPx <= 0) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 z-[1]"
      style={{
        left: leftPx,
        width: widthPx,
        height: heightPx,
        ...bookSpineGutterStripStyle(widthPx, heightPx),
      }}
    />
  )
}

/** Tier 0 — wide ambient desk shadow under a cover board. */
function CoverBoardAmbientDeskShadow({
  side,
  leftPx,
  widthPx,
  heightPx,
  shellRadiusPx,
}: {
  side: 'left' | 'right'
  leftPx: number
  widthPx: number
  heightPx: number
  shellRadiusPx: number
}) {
  if (widthPx <= 0) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 z-[0]"
      style={{
        left: leftPx,
        width: widthPx,
        height: heightPx,
        ...bookCoverBoardAmbientDeskShadowStyle(side, shellRadiusPx),
      }}
    />
  )
}

/** Tier 1 — sharp contact desk shadow under a cover board. */
function CoverBoardContactDeskShadow({
  side,
  leftPx,
  widthPx,
  heightPx,
  shellRadiusPx,
}: {
  side: 'left' | 'right'
  leftPx: number
  widthPx: number
  heightPx: number
  shellRadiusPx: number
}) {
  if (widthPx <= 0) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 z-[1]"
      style={{
        left: leftPx,
        width: widthPx,
        height: heightPx,
        ...bookCoverBoardContactDeskShadowStyle(side, shellRadiusPx),
      }}
    />
  )
}

/** Left or right cover board — leather fill with wrapped-cardboard bevel. */
function CoverBoardPanel({
  side,
  leftPx,
  widthPx,
  heightPx,
  shellRadiusPx,
}: {
  side: 'left' | 'right'
  leftPx: number
  widthPx: number
  heightPx: number
  shellRadiusPx: number
}) {
  if (widthPx <= 0) return null

  const cornerRadius = hardcoverBoardPanelCornerRadiusStyle(side, shellRadiusPx)

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 z-[2] overflow-hidden"
      style={{
        left: leftPx,
        width: widthPx,
        height: heightPx,
        backgroundColor: BOOK_COVER_BOARD_COLOR,
        boxShadow: hardcoverBoardBevelInsetBoxShadow(),
        ...cornerRadius,
      }}
    >
      <div
        className="absolute inset-0"
        style={hardcoverLeatherCoverStyle(BOOK_COVER_BOARD_COLOR)}
      />
      <div className="absolute inset-0" style={hardcoverLeatherOverlayStyle()} />
    </div>
  )
}

/** Left and right cover board ambient desk shadows. */
function CoverBoardAmbientDeskShadowShell({
  shellRadiusPx,
  shellWidthPx,
  spineLeftPx,
  spineWidthPx,
  shellHeightPx,
}: {
  shellRadiusPx: number
  shellWidthPx: number
  spineLeftPx: number
  spineWidthPx: number
  shellHeightPx: number
}) {
  const overlapPx = BOOK_COVER_BOARD_SPINE_OVERLAP_PX
  const leftBoardWidthPx = Math.max(0, spineLeftPx + overlapPx)
  const rightBoardLeftPx = spineLeftPx + spineWidthPx - overlapPx
  const rightBoardWidthPx = Math.max(0, shellWidthPx - rightBoardLeftPx)

  return (
    <>
      <CoverBoardAmbientDeskShadow
        side="left"
        leftPx={0}
        widthPx={leftBoardWidthPx}
        heightPx={shellHeightPx}
        shellRadiusPx={shellRadiusPx}
      />
      <CoverBoardAmbientDeskShadow
        side="right"
        leftPx={rightBoardLeftPx}
        widthPx={rightBoardWidthPx}
        heightPx={shellHeightPx}
        shellRadiusPx={shellRadiusPx}
      />
    </>
  )
}

/** Left and right cover board contact desk shadows. */
function CoverBoardContactDeskShadowShell({
  shellRadiusPx,
  shellWidthPx,
  spineLeftPx,
  spineWidthPx,
  shellHeightPx,
}: {
  shellRadiusPx: number
  shellWidthPx: number
  spineLeftPx: number
  spineWidthPx: number
  shellHeightPx: number
}) {
  const overlapPx = BOOK_COVER_BOARD_SPINE_OVERLAP_PX
  const leftBoardWidthPx = Math.max(0, spineLeftPx + overlapPx)
  const rightBoardLeftPx = spineLeftPx + spineWidthPx - overlapPx
  const rightBoardWidthPx = Math.max(0, shellWidthPx - rightBoardLeftPx)

  return (
    <>
      <CoverBoardContactDeskShadow
        side="left"
        leftPx={0}
        widthPx={leftBoardWidthPx}
        heightPx={shellHeightPx}
        shellRadiusPx={shellRadiusPx}
      />
      <CoverBoardContactDeskShadow
        side="right"
        leftPx={rightBoardLeftPx}
        widthPx={rightBoardWidthPx}
        heightPx={shellHeightPx}
        shellRadiusPx={shellRadiusPx}
      />
    </>
  )
}

/** Left and right cover boards — leather fill with wrapped-cardboard bevel. */
function CoverBoardShell({
  shellRadiusPx,
  shellWidthPx,
  spineLeftPx,
  spineWidthPx,
  shellHeightPx,
}: {
  shellRadiusPx: number
  shellWidthPx: number
  spineLeftPx: number
  spineWidthPx: number
  shellHeightPx: number
}) {
  const overlapPx = BOOK_COVER_BOARD_SPINE_OVERLAP_PX
  const leftBoardWidthPx = Math.max(0, spineLeftPx + overlapPx)
  const rightBoardLeftPx = spineLeftPx + spineWidthPx - overlapPx
  const rightBoardWidthPx = Math.max(0, shellWidthPx - rightBoardLeftPx)

  return (
    <>
      <CoverBoardPanel
        side="left"
        leftPx={0}
        widthPx={leftBoardWidthPx}
        heightPx={shellHeightPx}
        shellRadiusPx={shellRadiusPx}
      />
      <CoverBoardPanel
        side="right"
        leftPx={rightBoardLeftPx}
        widthPx={rightBoardWidthPx}
        heightPx={shellHeightPx}
        shellRadiusPx={shellRadiusPx}
      />
    </>
  )
}

/** Asymmetric binding lighting — transparent multiply shadows + screen highlights only. */
function BindingGutterLighting({ pageCanvasHeightPx }: { pageCanvasHeightPx: number }) {
  const seamInColumnPx = BINDING_SEAM_SHADOW_WIDTH_PX / 2

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-0 z-[3]"
      style={bookBindingGutterLightingOverlayStyle(pageCanvasHeightPx)}
    >
      <div
        className="absolute top-0"
        style={{
          left: seamInColumnPx - BINDING_GUTTER_LEFT_FALLOFF_PX,
          ...bookBindingGutterLeftPageShadowStyle(pageCanvasHeightPx),
        }}
      />
      <div
        className="absolute top-0"
        style={{
          left: seamInColumnPx,
          ...bookBindingGutterRightPageShadowStyle(pageCanvasHeightPx),
        }}
      />
      <div
        className="absolute top-0"
        style={{
          left: seamInColumnPx,
          ...bookBindingGutterRightPageHighlightStyle(pageCanvasHeightPx),
        }}
      />
    </div>
  )
}

export interface BookSpreadFrameProps {
  contentWidthPx: number
  contentHeightPx: number
  /** Single-page width — centers the seam column on the binding. */
  spreadPageWidthPx?: number
  twoPage?: boolean
  className?: string
  children: ReactNode
  /** Spread overlays (board, ink, session layer) — painted above the crease shadow. */
  overlayChildren?: ReactNode
  /**
   * Dim the whole book body (cover, page stacks, open pages) for Full board mode.
   * Does not cover the desk outside the shell. Overlays stay above the dim.
   */
  dimBook?: boolean
}

/**
 * Layer stack (back → front): board ambient → board contact → soft spine pool →
 * spine cloth → cover boards → padded page nest → crease shadow → optional book dim →
 * spread overlays.
 */
export function BookSpreadFrame({
  contentWidthPx,
  contentHeightPx,
  spreadPageWidthPx: _spreadPageWidthPx,
  twoPage = true,
  className,
  children,
  overlayChildren,
  dimBook = false,
}: BookSpreadFrameProps) {
  const hardcoverGutterOnly = bookSpreadHardcoverGutterOnlyForFrameTuning
  const metrics = computeBookSpreadFrameMetrics(contentWidthPx, contentHeightPx)
  const {
    pageStackInsetPx,
    pageStackBottomInsetPx,
    gutterShadowWidthPx,
  } = metrics

  const bookBodyWidthPx = bookSpreadFrameBookBodyWidthPx(contentWidthPx, metrics)
  const bookBodyHeightPx = bookSpreadFrameBookBodyHeightPx(contentHeightPx, metrics)
  const pageCanvasHeightPx = contentHeightPx
  const shellRadiusPx = bookSpreadHardcoverShellRadiusPx()
  const shellPaddingStyle = bookSpreadFrameShellPaddingStyle(metrics)

  const bookShellStyle: CSSProperties = {
    boxSizing: 'border-box',
    position: 'relative',
    flexShrink: 0,
    width: bookBodyWidthPx,
    height: bookBodyHeightPx,
    overflow: 'visible',
  }

  const spineStripWidthPx = bookSpreadCoverSpineBandPx(gutterShadowWidthPx, bookBodyWidthPx)
  const spineCenterInCoverPx = bookSpreadSpineCenterInCoverPx(
    contentWidthPx,
    metrics.coverInsetPx,
  )
  const shellSpineLayout = bookSpreadSpineStripLayout(
    bookBodyHeightPx,
    spineCenterInCoverPx,
    spineStripWidthPx,
  )

  const interiorStackWidthPx = twoPage ? contentWidthPx : contentWidthPx + 2 * pageStackInsetPx
  const interiorStackHeightPx = twoPage ? contentHeightPx : contentHeightPx + pageStackBottomInsetPx

  return (
    <div
      className={cn('relative inline-block shrink-0 leading-none', className)}
      style={{
        boxSizing: 'border-box',
        width: bookBodyWidthPx,
        height: bookBodyHeightPx,
        overflow: 'visible',
      }}
    >
      <div className="relative isolate" style={bookShellStyle}>
        <CoverBoardAmbientDeskShadowShell
          shellRadiusPx={shellRadiusPx}
          shellWidthPx={bookBodyWidthPx}
          spineLeftPx={shellSpineLayout.spineLeftPx}
          spineWidthPx={shellSpineLayout.spineWidthPx}
          shellHeightPx={bookBodyHeightPx}
        />

        <CoverBoardContactDeskShadowShell
          shellRadiusPx={shellRadiusPx}
          shellWidthPx={bookBodyWidthPx}
          spineLeftPx={shellSpineLayout.spineLeftPx}
          spineWidthPx={shellSpineLayout.spineWidthPx}
          shellHeightPx={bookBodyHeightPx}
        />

        <SpineGutterAmbientDeskShadow
          leftPx={shellSpineLayout.spineLeftPx}
          widthPx={shellSpineLayout.spineWidthPx}
          heightPx={bookBodyHeightPx}
        />

        <SpineGutterStrip
          leftPx={shellSpineLayout.spineLeftPx}
          widthPx={shellSpineLayout.spineWidthPx}
          heightPx={bookBodyHeightPx}
        />

        <CoverBoardShell
          shellRadiusPx={shellRadiusPx}
          shellWidthPx={bookBodyWidthPx}
          spineLeftPx={shellSpineLayout.spineLeftPx}
          spineWidthPx={shellSpineLayout.spineWidthPx}
          shellHeightPx={bookBodyHeightPx}
        />

          <div
            className="relative z-[5] box-border overflow-visible"
          style={{
            ...shellPaddingStyle,
            width: bookBodyWidthPx,
            height: bookBodyHeightPx,
          }}
        >
          <div
            className="relative shrink-0 grow-0"
            style={{
              boxSizing: 'border-box',
              width: interiorStackWidthPx,
              minWidth: interiorStackWidthPx,
              maxWidth: interiorStackWidthPx,
              height: interiorStackHeightPx,
              minHeight: interiorStackHeightPx,
              flexShrink: 0,
              flexGrow: 0,
            }}
          >
            {!hardcoverGutterOnly && !twoPage ? (
              <div
                aria-hidden
                className="pointer-events-none absolute z-0"
                style={{
                  ...pageStackLayerStyle(
                    contentWidthPx,
                    contentHeightPx,
                    pageStackInsetPx,
                    pageStackBottomInsetPx,
                    false,
                    {
                      left: PAGE_STACK_LAYER_OFFSET_X_PX,
                      top: PAGE_STACK_LAYER_OFFSET_Y_PX,
                      backgroundColor: PAGE_STACK_UNDER_COLOR,
                      boxShadow: [
                        '0 1px 2px rgba(0,0,0,0.12)',
                        '1px 0 1px rgba(0,0,0,0.08)',
                        'inset 0 0 0 1px rgba(0,0,0,0.05)',
                      ].join(', '),
                    },
                  ),
                }}
              />
            ) : null}

            <div
              className={cn('relative z-[1] overflow-visible', hardcoverGutterOnly && 'pointer-events-none')}
              style={pageStackLayerStyle(
                contentWidthPx,
                contentHeightPx,
                pageStackInsetPx,
                pageStackBottomInsetPx,
                twoPage,
                hardcoverGutterOnly
                  ? { backgroundColor: 'transparent' }
                  : {
                      ...(!twoPage
                        ? {
                            backgroundColor: PAGE_STACK_COLOR,
                            boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.08)',
                          }
                        : {
                            backgroundColor: 'transparent',
                          }),
                    },
              )}
            >
              <div
                className={cn(
                  'relative z-[2] isolate shrink-0 grow-0 overflow-visible bg-transparent',
                  hardcoverGutterOnly && 'invisible',
                )}
                style={{
                  boxSizing: 'border-box',
                  width: contentWidthPx,
                  minWidth: contentWidthPx,
                  maxWidth: contentWidthPx,
                  height: pageCanvasHeightPx,
                  minHeight: pageCanvasHeightPx,
                  flexShrink: 0,
                  flexGrow: 0,
                }}
              >
                <div className="relative z-[1] h-full w-full shrink-0 grow-0">{children}</div>

                {!hardcoverGutterOnly && twoPage ? (
                  <BindingGutterLighting pageCanvasHeightPx={pageCanvasHeightPx} />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Full-book dim (cover + stacks + pages). Desk outside the shell stays bright. */}
        {!hardcoverGutterOnly ? (
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 z-[6] bg-black/35 transition-opacity duration-200 ease-out',
              dimBook ? 'opacity-100' : 'opacity-0',
            )}
            style={{ borderRadius: shellRadiusPx }}
          />
        ) : null}

        {/* Overlays sit above the dim so Full board stays undimmed. */}
        {overlayChildren ? (
          <div
            className="pointer-events-none absolute z-[7]"
            style={{
              top: shellPaddingStyle.paddingTop,
              left: shellPaddingStyle.paddingLeft,
              width: contentWidthPx,
              height: pageCanvasHeightPx,
            }}
          >
            {overlayChildren}
          </div>
        ) : null}
      </div>
    </div>
  )
}
