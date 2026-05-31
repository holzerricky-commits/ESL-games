'use client'

import type { NormRect } from '@/lib/books/annotation-select'
import {
  scaleHandlePositions,
  type ScaleHandleId,
} from '@/lib/books/annotation-scale'
import {
  SELECTION_BOX_SHADOW,
  SELECTION_HANDLE_CLASS,
  SELECTION_HANDLE_SIZE_PX,
} from '@/lib/books/annotation-selection-chrome'

const HANDLE_IDS: ScaleHandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export function SelectionBoundsChrome({
  outlineRects,
  unionBounds,
  showHandles,
}: {
  outlineRects: NormRect[]
  unionBounds: NormRect | null
  showHandles: boolean
}) {
  const half = SELECTION_HANDLE_SIZE_PX / 2

  return (
    <>
      {outlineRects.map((bounds, i) => (
        <div
          key={`outline-${i}`}
          className="absolute box-border pointer-events-none"
          style={{
            left: `${bounds.x * 100}%`,
            top: `${bounds.y * 100}%`,
            width: `${bounds.w * 100}%`,
            height: `${bounds.h * 100}%`,
            boxShadow: SELECTION_BOX_SHADOW,
          }}
        />
      ))}
      {showHandles && unionBounds
        ? HANDLE_IDS.map((id) => {
            const [hx, hy] = scaleHandlePositions(unionBounds)[id]!
            return (
              <div
                key={`handle-${id}`}
                className={SELECTION_HANDLE_CLASS}
                style={{
                  left: `calc(${hx * 100}% - ${half}px)`,
                  top: `calc(${hy * 100}% - ${half}px)`,
                  width: SELECTION_HANDLE_SIZE_PX,
                  height: SELECTION_HANDLE_SIZE_PX,
                }}
              />
            )
          })
        : null}
    </>
  )
}
