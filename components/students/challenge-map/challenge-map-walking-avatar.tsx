'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildDefaultSegmentPoints,
  computeCanvasMetrics,
  nodeIndexToCanvasPoint,
  pointAtDistanceAlongPolyline,
  polylineLength,
  resolveMapPathStartSegment,
  sanitizeMapPathSegments,
  type MapPathPoint,
  type MapPathSegments,
} from '@/lib/students/challenge-map-layout'
import type { ChallengeMapNode } from '@/lib/students/challenge-map'

const GIRL_IDLE = '/Characters/Girl/Idle%20natural%20standing.png'
const GIRL_LEFT = '/Characters/Girl/Left%20foot%20forward%20facing%20left.png'
const GIRL_MID = '/Characters/Girl/Mid%20stride%20facing%20left.png'
const GIRL_RIGHT = '/Characters/Girl/Right%20foot%20forward%20facing%20left.png'
const GIRL_IDLE_FRAMES = [
  '/Characters/Girl/Idle%20Movements/Frame%201%20(subtle%20weight%20shift%20to%20right).png',
  '/Characters/Girl/Idle%20Movements/Frame%202%20(weight%20shift%20to%20left).png',
  '/Characters/Girl/Idle%20Movements/Frame%203%20(soft%20blink%20+%20breath).png',
  '/Characters/Girl/Idle%20Movements/Frame%204%20(head%20turn%20+%20hair%20sway).png',
  '/Characters/Girl/Idle%20Movements/Frame%205%20(neutral%20happy%20center).png',
  '/Characters/Girl/Idle%20Movements/Frame%206%20(cheerful%20micro-bounce).png',
] as const

const WALK_FRAMES = [GIRL_LEFT, GIRL_MID, GIRL_RIGHT, GIRL_MID]

/** Uneven holds: neutral dominates; blink/weight shifts are slow; head/bounce are short rare beats (common idle practice). */
const IDLE_TIMELINE_MS: { src: string; durationMs: number }[] = [
  { src: GIRL_IDLE_FRAMES[4], durationMs: 5200 },
  { src: GIRL_IDLE_FRAMES[2], durationMs: 280 },
  { src: GIRL_IDLE_FRAMES[4], durationMs: 1200 },
  { src: GIRL_IDLE_FRAMES[0], durationMs: 1600 },
  { src: GIRL_IDLE_FRAMES[4], durationMs: 900 },
  { src: GIRL_IDLE_FRAMES[1], durationMs: 1600 },
  { src: GIRL_IDLE_FRAMES[4], durationMs: 4800 },
  { src: GIRL_IDLE_FRAMES[3], durationMs: 550 },
  { src: GIRL_IDLE_FRAMES[4], durationMs: 500 },
  { src: GIRL_IDLE_FRAMES[5], durationMs: 420 },
  { src: GIRL_IDLE_FRAMES[4], durationMs: 3600 },
]

const IDLE_LOOP_TOTAL_MS = IDLE_TIMELINE_MS.reduce((sum, step) => sum + step.durationMs, 0)

function idleFrameAtElapsed(elapsedMs: number): string {
  if (IDLE_LOOP_TOTAL_MS <= 0) return GIRL_IDLE
  let t = elapsedMs % IDLE_LOOP_TOTAL_MS
  for (const step of IDLE_TIMELINE_MS) {
    if (t < step.durationMs) return step.src
    t -= step.durationMs
  }
  return GIRL_IDLE_FRAMES[4]
}

interface ChallengeMapWalkingAvatarProps {
  nodes: ChallengeMapNode[]
  nodeLayout: Record<string, { xPct: number; yPct: number }>
  pathSegments: MapPathSegments
  /** Saved polyline from teacher (optional). Legacy single point used when this is absent. */
  introStartSegment?: { points: MapPathPoint[] } | null
  introLegacyStartPoint?: MapPathPoint | null
  containerWidth: number
  compact: boolean
  mode?: 'idle' | 'intro'
  onPositionChange?: (payload: {
    position: MapPathPoint
    progress: number
    isMoving: boolean
  }) => void
  onMotionComplete?: () => void
}

export function ChallengeMapWalkingAvatar({
  nodes,
  nodeLayout,
  pathSegments,
  introStartSegment = null,
  introLegacyStartPoint = null,
  containerWidth,
  compact,
  mode = 'idle',
  onPositionChange,
  onMotionComplete,
}: ChallengeMapWalkingAvatarProps) {
  const [pos, setPos] = useState({ xPct: 50, yCanvasPct: 50 })
  const [faceLeft, setFaceLeft] = useState(true)
  const [spriteSrc, setSpriteSrc] = useState(GIRL_IDLE)
  const prevPosRef = useRef({ xPct: 50, yCanvasPct: 50 })
  const rafRef = useRef<number | null>(null)
  const onPositionChangeRef = useRef(onPositionChange)
  const onMotionCompleteRef = useRef(onMotionComplete)
  onPositionChangeRef.current = onPositionChange
  onMotionCompleteRef.current = onMotionComplete

  const completedCount = useMemo(() => nodes.filter((n) => n.status === 'completed').length, [nodes])

  const assignedIds = useMemo(() => nodes.map((n) => n.quizId), [nodes])
  const currentIndex = nodes.findIndex((n) => n.status === 'current')
  const targetStep = currentIndex >= 0 ? currentIndex : Math.max(0, completedCount - 1)

  const metrics = useMemo(
    () => computeCanvasMetrics(containerWidth, nodes.length, compact),
    [containerWidth, nodes.length, compact],
  )

  const resolved = useMemo(
    () =>
      sanitizeMapPathSegments(pathSegments, assignedIds, nodeLayout, 'zigzag', containerWidth, compact),
    [pathSegments, assignedIds, nodeLayout, containerWidth, compact],
  )

  const pathPoints = useMemo(() => {
    if (assignedIds.length === 0) return []
    if (mode !== 'intro') {
      const settlePoint = nodeIndexToCanvasPoint(
        Math.max(0, targetStep),
        assignedIds.length,
        assignedIds[Math.max(0, targetStep)],
        nodeLayout,
        'zigzag',
        metrics,
      )
      return [settlePoint]
    }

    if (completedCount <= 0) {
      const firstNode = nodeIndexToCanvasPoint(0, assignedIds.length, assignedIds[0], nodeLayout, 'zigzag', metrics)
      return resolveMapPathStartSegment(
        introStartSegment && introStartSegment.points.length >= 2 ? introStartSegment : undefined,
        introStartSegment && introStartSegment.points.length >= 2 ? undefined : introLegacyStartPoint,
        firstNode,
      )
    }

    const fromIndex = Math.max(0, completedCount - 1)
    const toIndex = currentIndex >= 0 ? currentIndex : fromIndex
    if (fromIndex === toIndex) {
      const point = nodeIndexToCanvasPoint(fromIndex, assignedIds.length, assignedIds[fromIndex], nodeLayout, 'zigzag', metrics)
      return [point]
    }
    const fromId = assignedIds[fromIndex]
    const toId = assignedIds[toIndex]
    const defaults = buildDefaultSegmentPoints(fromIndex, toIndex, fromId, toId, assignedIds, nodeLayout, 'zigzag', metrics)
    return resolved[fromId]?.points?.length ? resolved[fromId].points : defaults
  }, [
    assignedIds,
    resolved,
    targetStep,
    nodeLayout,
    metrics,
    mode,
    completedCount,
    currentIndex,
    introStartSegment,
    introLegacyStartPoint,
  ])

  const totalLen = useMemo(() => polylineLength(pathPoints), [pathPoints])

  useEffect(() => {
    for (const src of [...WALK_FRAMES, ...GIRL_IDLE_FRAMES]) {
      const image = new Image()
      image.src = src
    }
  }, [])

  useEffect(() => {
    const startPt = pathPoints[0] ?? { xPct: 50, yCanvasPct: 50 }
    const prevBeforeReset = prevPosRef.current
    prevPosRef.current = startPt
    setPos(startPt)
    const sameAsPrev =
      Math.abs(prevBeforeReset.xPct - startPt.xPct) < 0.001 &&
      Math.abs(prevBeforeReset.yCanvasPct - startPt.yCanvasPct) < 0.001
    if (!sameAsPrev) {
      onPositionChangeRef.current?.({ position: startPt, progress: 0, isMoving: false })
    }

    if (pathPoints.length < 2 || totalLen <= 0) {
      const tickIdle = (now: number) => {
        setSpriteSrc(idleFrameAtElapsed(now))
        rafRef.current = requestAnimationFrame(tickIdle)
      }
      onMotionCompleteRef.current?.()
      rafRef.current = requestAnimationFrame(tickIdle)
      return () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      }
    }

    const durationMs = Math.max(4000, Math.min(12000, totalLen * 40))
    const start = performance.now()

    const tick = (now: number) => {
      const elapsed = now - start
      const rawT = elapsed / durationMs
      const t = mode === 'intro' ? Math.min(1, rawT) : rawT % 1
      const dist = t * totalLen
      const p = pointAtDistanceAlongPolyline(pathPoints, dist)
      setPos(p)
      const prev = prevPosRef.current
      const dx = p.xPct - prev.xPct
      if (Math.abs(dx) > 0.02) setFaceLeft(dx < 0)
      prevPosRef.current = p
      const moving = mode !== 'intro' || t < 1
      const frame = Math.floor((now / 140) % WALK_FRAMES.length)
      setSpriteSrc(moving ? WALK_FRAMES[frame] : idleFrameAtElapsed(now))
      onPositionChangeRef.current?.({ position: p, progress: t, isMoving: moving })
      if (mode === 'intro' && t >= 1) {
        const terminalPoint = pointAtDistanceAlongPolyline(pathPoints, totalLen)
        prevPosRef.current = terminalPoint
        setPos(terminalPoint)
        onPositionChangeRef.current?.({ position: terminalPoint, progress: 1, isMoving: false })
        onMotionCompleteRef.current?.()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [mode, pathPoints, totalLen])

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-[10]"
      style={{
        left: `${pos.xPct}%`,
        top: `${pos.yCanvasPct}%`,
        transform: `translate(-50%, -50%) scaleX(${faceLeft ? 1 : -1})`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local asset */}
      <img src={spriteSrc} alt="" className="h-auto w-[min(7rem,18vw)] max-w-none select-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)]" />
    </div>
  )
}
