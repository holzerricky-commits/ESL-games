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
  SELECTION_ROTATION_HANDLE_SIZE_PX,
} from '@/lib/books/annotation-selection-chrome'

/** Corner squares only — matches text-box selection mockup. */
const CORNER_HANDLE_IDS: ScaleHandleId[] = ['nw', 'ne', 'se', 'sw']

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
  showRotationHandle = false,
  layoutWidthPx,
  layoutHeightPx,
}: {
  outlineFrames: OrientedSelectionFrame[]
  handleFrame: OrientedSelectionFrame | null
  showHandles: boolean
  showRotationHandle?: boolean
  layoutWidthPx: number
  layoutHeightPx: number
}) {
  const half = SELECTION_HANDLE_SIZE_PX / 2
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
            style={{ border: SELECTION_BOX_BORDER }}
          />
        </OrientedFrameShell>
      ))}

      {showHandles && handleFrame ? (
        <OrientedFrameShell
          frame={handleFrame}
          layoutWidthPx={layoutWidthPx}
          layoutHeightPx={layoutHeightPx}
        >
          {showRotationHandle ? (
            <>
              <div
                className="absolute pointer-events-none"
                style={{
                  left: '50%',
                  top: -stemOffsetPx,
                  width: SELECTION_BOX_BORDER_WIDTH_PX,
                  height: stemOffsetPx,
                  backgroundColor: SELECTION_ACCENT,
                  transform: `translateX(-${SELECTION_BOX_BORDER_WIDTH_PX / 2}px)`,
                }}
              />
              <div
                className={SELECTION_HANDLE_CLASS}
                style={{
                  left: '50%',
                  top: -(stemOffsetPx + rotationHalf),
                  width: SELECTION_ROTATION_HANDLE_SIZE_PX,
                  height: SELECTION_ROTATION_HANDLE_SIZE_PX,
                  borderRadius: '9999px',
                  backgroundColor: SELECTION_ACCENT,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </>
          ) : null}

          {CORNER_HANDLE_IDS.map((id) => {
            const left =
              id === 'nw' || id === 'sw' ? -half : `calc(100% - ${half}px)`
            const top =
              id === 'nw' || id === 'ne' ? -half : `calc(100% - ${half}px)`
            return (
              <div
                key={`handle-${id}`}
                className={SELECTION_HANDLE_CLASS}
                style={{
                  left,
                  top,
                  width: SELECTION_HANDLE_SIZE_PX,
                  height: SELECTION_HANDLE_SIZE_PX,
                  backgroundColor: SELECTION_ACCENT,
                }}
              />
            )
          })}
        </OrientedFrameShell>
      ) : null}
    </>
  )
}
