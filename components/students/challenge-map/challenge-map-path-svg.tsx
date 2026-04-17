'use client'

import type { MouseEvent as SvgMouseEvent, PointerEvent as SvgPointerEvent } from 'react'
import type { MapPathPoint } from '@/lib/students/challenge-map-layout'

export interface PathSegmentForSvg {
  fromQuizId: string
  points: MapPathPoint[]
  strokeDasharray?: string
  strokeClassName?: string
}

interface ChallengeMapPathSvgProps {
  canvasHeightPx: number
  segments: PathSegmentForSvg[]
  strokeClassName?: string
  strokeDasharray?: string
  /** Polylines only; keep `pointer-events-none` so hits reach handles above. */
  strokeLayerClassName?: string
  /** Waypoint circles; SVG stays `pointer-events-none`, circles use `pointer-events-auto`. */
  handlesLayerClassName?: string
  interactive?: boolean
  waypointFilter?: (fromQuizId: string, pointIndex: number, segmentPointCount: number) => boolean
  waypointCircleClassName?: string
  onWaypointPointerDown?: (fromQuizId: string, pointIndex: number, event: SvgPointerEvent<SVGCircleElement>) => void
  onSvgDoubleClick?: (event: SvgMouseEvent<SVGSVGElement>) => void
}

export function ChallengeMapPathSvg({
  canvasHeightPx,
  segments,
  strokeClassName = 'stroke-[#2ca9b8]/80',
  strokeDasharray: globalDash,
  strokeLayerClassName = 'pointer-events-none absolute inset-0 z-[1] h-full w-full',
  handlesLayerClassName = 'pointer-events-none absolute inset-0 z-[2] h-full w-full',
  interactive,
  waypointFilter,
  waypointCircleClassName = 'pointer-events-auto cursor-grab fill-[#fff0c6] stroke-[#2ca9b8] stroke-[1.5]',
  onWaypointPointerDown,
  onSvgDoubleClick,
}: ChallengeMapPathSvgProps) {
  const vb = `0 0 100 ${canvasHeightPx}`
  const showWaypoint = (fromQuizId: string, pointIndex: number, count: number) =>
    waypointFilter ? waypointFilter(fromQuizId, pointIndex, count) : true

  const polylines = segments.map((seg) => {
    if (seg.points.length < 2) return null
    const d = seg.points.map((p) => `${p.xPct},${(p.yCanvasPct / 100) * canvasHeightPx}`).join(' ')
    const segStroke = seg.strokeClassName ?? strokeClassName
    const dash = seg.strokeDasharray ?? globalDash
    return (
      <polyline
        key={seg.fromQuizId}
        fill="none"
        strokeWidth={interactive ? 2.25 : 2}
        className={segStroke}
        strokeDasharray={dash}
        points={d}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  })

  const circles =
    interactive && onWaypointPointerDown
      ? segments.flatMap((seg) =>
          seg.points.flatMap((p, pointIdx) => {
            if (!showWaypoint(seg.fromQuizId, pointIdx, seg.points.length)) return []
            const cy = (p.yCanvasPct / 100) * canvasHeightPx
            return [
              <circle
                key={`${seg.fromQuizId}-${pointIdx}`}
                cx={p.xPct}
                cy={cy}
                r={5}
                className={waypointCircleClassName}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onWaypointPointerDown(seg.fromQuizId, pointIdx, e)
                }}
              />,
            ]
          }),
        )
      : null

  return (
    <>
      <svg className={strokeLayerClassName} viewBox={vb} preserveAspectRatio="none" aria-hidden>
        {polylines}
      </svg>
      {circles ? (
        <svg
          className={handlesLayerClassName}
          viewBox={vb}
          preserveAspectRatio="none"
          aria-hidden
          onDoubleClick={interactive ? onSvgDoubleClick : undefined}
        >
          {circles}
        </svg>
      ) : null}
    </>
  )
}
