'use client'

import type { OrientedSelectionFrame } from '@/lib/books/annotation-select'
import { SELECTION_ROTATION_HANDLE_OFFSET_PX } from '@/lib/books/annotation-rotation'
import type { ScaleHandleId } from '@/lib/books/annotation-scale'
import {
  SELECTION_ACCENT,
  SELECTION_BOX_BORDER,
  SELECTION_BOX_BORDER_WIDTH_PX,
  SELECTION_HANDLE_CLASS,
  SELECTION_HANDLE_SIZE_PX,
  SELECTION_HOVER_BOX_BORDER,
  SELECTION_MULTI_UNION_BORDER,
  SELECTION_ROTATION_HANDLE_SIZE_PX,
} from '@/lib/books/annotation-selection-chrome'

const SCALE_HANDLE_IDS: ScaleHandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const HANDLE_ANCHOR: Record<ScaleHandleId, { left: string; top: string }> = {
  nw: { left: '0%', top: '0%' },
  n: { left: '50%', top: '0%' },
  ne: { left: '100%', top: '0%' },
  e: { left: '100%', top: '50%' },
  se: { left: '100%', top: '100%' },
  s: { left: '50%', top: '100%' },
  sw: { left: '0%', top: '100%' },
  w: { left: '0%', top: '50%' },
}

function OrientedFrameShell({
  frame,
  layoutWidthPx,
  layoutHeightPx,
  children,
}: {
  frame: OrientedSelectionFrame
  layoutWidthPx: number
  layoutHeightPx: number
  children: React.ReactNode
}) {
  const cx = frame.rect.x + frame.rect.w / 2
  const cy = frame.rect.y + frame.rect.h / 2
  const wPx = frame.rect.w * layoutWidthPx
  const hPx = frame.rect.h * layoutHeightPx

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        width: wPx,
        height: hPx,
        transform: `translate(-50%, -50%) rotate(${frame.rotationDeg}deg)`,
      }}
    >
      {children}
    </div>
  )
}

export function SelectionBoundsChrome({
  outlineFrames,
  handleFrame,
  showHandles,
  showUnionOutline = false,
  showRotationHandle = false,
  variant = 'selection',
  layoutWidthPx,
  layoutHeightPx,
}: {
  outlineFrames: OrientedSelectionFrame[]
  handleFrame: OrientedSelectionFrame | null
  showHandles: boolean
  /** Dotted neutral border around combined multi-selection bounds. */
  showUnionOutline?: boolean
  showRotationHandle?: boolean
  /** `hover` = dashed preview only (no handles). */
  variant?: 'selection' | 'hover'
  layoutWidthPx: number
  layoutHeightPx: number
}) {
  const outlineBorder = variant === 'hover' ? SELECTION_HOVER_BOX_BORDER : SELECTION_BOX_BORDER
  const rotationHalf = SELECTION_ROTATION_HANDLE_SIZE_PX / 2
  const stemOffsetPx = SELECTION_ROTATION_HANDLE_OFFSET_PX

  return (
    <>
      {outlineFrames.map((frame, i) => (
        <OrientedFrameShell
          key={`outline-${i}`}
          frame={frame}
          layoutWidthPx={layoutWidthPx}
          layoutHeightPx={layoutHeightPx}
        >
          <div
            className="absolute inset-0 box-border"
            style={{ border: outlineBorder }}
          />
        </OrientedFrameShell>
      ))}

      {showHandles && handleFrame ? (
        <OrientedFrameShell
          frame={handleFrame}
          layoutWidthPx={layoutWidthPx}
          layoutHeightPx={layoutHeightPx}
        >
          {showUnionOutline ? (
            <div
              className="absolute inset-0 box-border"
              style={{ border: SELECTION_MULTI_UNION_BORDER }}
            />
          ) : null}

          {showRotationHandle ? (
            <>
              <div
                className="absolute pointer-events-none"
                style={{
                  left: '50%',
                  top: 0,
                  width: SELECTION_BOX_BORDER_WIDTH_PX,
                  height: stemOffsetPx,
                  backgroundColor: SELECTION_ACCENT,
                  transform: 'translate(-50%, -100%)',
                }}
              />
              <div
                className={SELECTION_HANDLE_CLASS}
                style={{
                  left: '50%',
                  top: 0,
                  width: SELECTION_ROTATION_HANDLE_SIZE_PX,
                  height: SELECTION_ROTATION_HANDLE_SIZE_PX,
                  borderRadius: '9999px',
                  backgroundColor: SELECTION_ACCENT,
                  transform: `translate(-50%, calc(-${stemOffsetPx + rotationHalf}px))`,
                }}
              />
            </>
          ) : null}

          {SCALE_HANDLE_IDS.map((id) => {
            const anchor = HANDLE_ANCHOR[id]
            return (
              <div
                key={`handle-${id}`}
                className={SELECTION_HANDLE_CLASS}
                style={{
                  left: anchor.left,
                  top: anchor.top,
                  width: SELECTION_HANDLE_SIZE_PX,
                  height: SELECTION_HANDLE_SIZE_PX,
                  backgroundColor: SELECTION_ACCENT,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            )
          })}
        </OrientedFrameShell>
      ) : null}
    </>
  )
}
