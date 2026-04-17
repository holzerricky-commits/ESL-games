'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { ChallengeMapCanvas } from '@/components/students/challenge-map/challenge-map-canvas'
import { ChallengeMapEnvironment } from '@/components/students/challenge-map/challenge-map-environment'
import { LevelQuestStartModal } from '@/components/students/challenge-map/level-quest-start-modal'
import type { ChallengeMapNode } from '@/lib/students/challenge-map'
import type { MapPathPoint } from '@/lib/students/challenge-map-layout'
import {
  getStudentMapNodeLayout,
  getStudentMapPathSegments,
  getStudentMapPathStartPoint,
  getStudentMapPathStartSegmentRaw,
  getStudentProfileView,
} from '@/lib/students/selectors'
import { buildChallengeMapNodes } from '@/lib/students/challenge-map'
import {
  clearMapViewportSession,
  getInitialViewportState,
  writeMapViewportSession,
} from '@/lib/students/map-viewport-session'
import type { StudentProfileView } from '@/lib/students/types'

interface StudentMapTabProps {
  student: StudentProfileView
  fullscreen?: boolean
  introMode?: 'mission' | null
}

export function StudentMapTab({ student, fullscreen = false, introMode = null }: StudentMapTabProps) {
  const router = useRouter()
  const liveStudent = useMemo(() => getStudentProfileView(student.id) ?? student, [student])
  const nodes = useMemo(() => buildChallengeMapNodes(liveStudent), [liveStudent])
  const nodeLayout = useMemo(() => getStudentMapNodeLayout(liveStudent.id), [liveStudent.id])
  const pathSegments = useMemo(() => getStudentMapPathSegments(liveStudent.id), [liveStudent.id])
  const introStartSegment = useMemo(() => getStudentMapPathStartSegmentRaw(liveStudent.id), [liveStudent.id])
  const introLegacyStartPoint = useMemo(() => getStudentMapPathStartPoint(liveStudent.id), [liveStudent.id])
  const initialViewport = useMemo(() => getInitialViewportState(student.id, fullscreen), [student.id, fullscreen])
  const [offset, setOffset] = useState(initialViewport.offset)
  const [scale, setScale] = useState(initialViewport.scale)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const hasDraggedRef = useRef(initialViewport.restored)
  const prevViewportDepsRef = useRef<{
    introMode: typeof introMode
    liveStudentId: string
    fullscreen: boolean
    nodesLength: number
  } | null>(null)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const latestOffsetRef = useRef(offset)
  const latestScaleRef = useRef(scale)
  latestOffsetRef.current = offset
  latestScaleRef.current = scale
  const [introCompleted, setIntroCompleted] = useState(false)
  const [questPreviewNode, setQuestPreviewNode] = useState<ChallengeMapNode | null>(null)
  const [avatarCamera, setAvatarCamera] = useState<{
    position: MapPathPoint
    progress: number
    isMoving: boolean
  } | null>(null)

  /** Keeps follow framing if `avatarCamera` is briefly null during layout/resize. */
  const lastMissionAvatarCameraRef = useRef<{
    position: MapPathPoint
    progress: number
    isMoving: boolean
  } | null>(null)
  if (avatarCamera) {
    lastMissionAvatarCameraRef.current = avatarCamera
  }

  const avatarCameraRef = useRef(avatarCamera)
  avatarCameraRef.current = avatarCamera

  const shouldPlayMissionIntro = fullscreen && introMode === 'mission'
  const isAutoCamera = shouldPlayMissionIntro && !introCompleted

  const shouldPlayMissionIntroRef = useRef(shouldPlayMissionIntro)
  shouldPlayMissionIntroRef.current = shouldPlayMissionIntro

  const introCompletedRef = useRef(introCompleted)
  introCompletedRef.current = introCompleted

  const clampOffset = useCallback((x: number, y: number, nextScale = 1) => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return { x, y }
    const viewportWidth = viewport.clientWidth
    const viewportHeight = viewport.clientHeight
    const contentWidth = content.offsetWidth * nextScale
    const contentHeight = content.offsetHeight * nextScale
    const centeredX = (viewportWidth - contentWidth) / 2
    const centeredY = (viewportHeight - contentHeight) / 2
    const minX = Math.min(0, viewportWidth - contentWidth)
    const minY = Math.min(0, viewportHeight - contentHeight)
    return {
      x: contentWidth <= viewportWidth ? centeredX : Math.max(minX, Math.min(0, x)),
      y: contentHeight <= viewportHeight ? centeredY : Math.max(minY, Math.min(0, y)),
    }
  }, [])

  const getFitScale = useCallback(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return 1
    if (!fullscreen) return 1
    const contentWidth = content.offsetWidth
    if (contentWidth <= 0) return 1
    return viewport.clientWidth / contentWidth
  }, [fullscreen])

  const handleIntroMotionComplete = useCallback(() => {
    setIntroCompleted(true)
  }, [])

  const centerOnPoint = useCallback(
    (point: MapPathPoint, nextScale: number) => {
      const viewport = viewportRef.current
      const content = contentRef.current
      if (!viewport || !content) return { x: 0, y: 0 }
      const pointX = content.offsetWidth * (point.xPct / 100)
      const pointY = content.offsetHeight * (point.yCanvasPct / 100)
      const desiredX = viewport.clientWidth / 2 - pointX * nextScale
      const desiredY = viewport.clientHeight / 2 - pointY * nextScale
      return clampOffset(desiredX, desiredY, nextScale)
    },
    [clampOffset],
  )

  const missionFollowZoom = useCallback(() => {
    const nextScale = getFitScale()
    return Math.min(nextScale * 1.7, nextScale + 0.85)
  }, [getFitScale])

  /** After the intro walk: stay on the character, slightly zoomed out vs the peak follow zoom. */
  const missionSettledFollowZoom = useCallback(() => {
    return missionFollowZoom() * 0.88
  }, [missionFollowZoom])

  const applySettledMissionCamera = useCallback(() => {
    if (!shouldPlayMissionIntroRef.current || hasDraggedRef.current) return false
    const ac = avatarCameraRef.current ?? lastMissionAvatarCameraRef.current
    if (!ac) return false
    const targetScale = missionSettledFollowZoom()
    setScale(targetScale)
    setOffset(centerOnPoint(ac.position, targetScale))
    return true
  }, [centerOnPoint, missionSettledFollowZoom])

  const applyIntroCameraFromRefs = useCallback(() => {
    if (!shouldPlayMissionIntroRef.current || introCompletedRef.current) return false
    const ac = avatarCameraRef.current
    if (!ac) return false
    const nextScale = getFitScale()
    const eased = 1 - Math.pow(1 - ac.progress, 3)
    const targetScale = missionFollowZoom()
    const introScale = nextScale + (targetScale - nextScale) * eased
    setScale(introScale)
    setOffset(centerOnPoint(ac.position, introScale))
    return true
  }, [centerOnPoint, getFitScale, missionFollowZoom])

  /** After intro walk ends: keep the same zoom band and stay centered on the character until the user pans. */
  const applyMissionFollowCameraFromRefs = useCallback(() => {
    if (!introCompletedRef.current) return false
    return applySettledMissionCamera()
  }, [applySettledMissionCamera])

  useEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return
    const syncViewport = () => {
      if (applyIntroCameraFromRefs()) return
      if (applyMissionFollowCameraFromRefs()) return

      // Mission mode should never snap back to fit-width after arrival unless the user takes control.
      if (shouldPlayMissionIntroRef.current && !hasDraggedRef.current) {
        return
      }

      const nextScale = getFitScale()
      setScale(nextScale)
      setOffset((prev) => {
        if (!fullscreen || hasDraggedRef.current) {
          return clampOffset(prev.x, prev.y, nextScale)
        }

        return clampOffset(0, 0, nextScale)
      })
    }

    syncViewport()

    const observer = new ResizeObserver(() => {
      syncViewport()
    })
    observer.observe(viewport)
    observer.observe(content)
    return () => observer.disconnect()
  }, [applyIntroCameraFromRefs, applyMissionFollowCameraFromRefs, clampOffset, fullscreen, getFitScale, introCompleted, nodes.length])

  useEffect(() => {
    if (!shouldPlayMissionIntro) return
    if (!introCompleted) {
      applyIntroCameraFromRefs()
    } else {
      applyMissionFollowCameraFromRefs()
    }
  }, [
    applyIntroCameraFromRefs,
    applyMissionFollowCameraFromRefs,
    avatarCamera,
    introCompleted,
    shouldPlayMissionIntro,
  ])

  useEffect(() => {
    setIntroCompleted(false)
    setAvatarCamera(null)
    lastMissionAvatarCameraRef.current = null
    const next = {
      introMode,
      liveStudentId: liveStudent.id,
      fullscreen,
      nodesLength: nodes.length,
    }
    const prev = prevViewportDepsRef.current
    prevViewportDepsRef.current = next
    if (!prev) return
    if (
      prev.introMode === next.introMode &&
      prev.liveStudentId === next.liveStudentId &&
      prev.fullscreen === next.fullscreen &&
      prev.nodesLength === next.nodesLength
    ) {
      return
    }
    hasDraggedRef.current = false
    if (fullscreen) {
      clearMapViewportSession(liveStudent.id)
    }
  }, [introMode, liveStudent.id, fullscreen, nodes.length])

  useEffect(() => {
    if (!fullscreen) return
    const id = liveStudent.id
    return () => {
      writeMapViewportSession(id, { offset: latestOffsetRef.current, scale: latestScaleRef.current })
    }
  }, [fullscreen, liveStudent.id])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isAutoCamera) return
    const target = event.target as HTMLElement
    if (target.closest('a,button,input,textarea,select,[role="button"]')) return
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    }
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    hasDraggedRef.current = true
    const next = clampOffset(drag.originX + (event.clientX - drag.startX), drag.originY + (event.clientY - drag.startY), scale)
    setOffset(next)
  }

  const handleQuestNodeSelect = useCallback((node: ChallengeMapNode) => {
    setQuestPreviewNode(node)
  }, [])

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragStateRef.current = null
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div className={fullscreen ? 'flex h-full min-h-0 w-full flex-col' : 'w-full'}>
      {nodes.length === 0 ? (
        <div
          className={
            fullscreen
              ? 'flex h-full items-center justify-center bg-[var(--surface-2)] p-6'
              : 'rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6'
          }
        >
          <div className={fullscreen ? 'max-w-md rounded-2xl border border-dashed border-[var(--border)] bg-black/20 p-6 text-center backdrop-blur-sm' : ''}>
            <h2 className="text-lg font-semibold text-foreground">Map</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your teacher has not assigned a challenge path yet. Once assigned, your map appears here.
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={viewportRef}
          className={[
            fullscreen
              ? 'relative h-full min-h-0 w-full overflow-hidden bg-[var(--surface-2)]'
              : 'relative h-[calc(100dvh-7.5rem)] min-h-[32rem] w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]',
            isDragging ? 'cursor-grabbing' : 'cursor-grab',
          ].join(' ')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ touchAction: 'none' }}
        >
          <div
            className="relative will-change-transform"
            style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
          >
            <div
              ref={contentRef}
              className="relative w-full origin-top-left will-change-transform"
              style={{ transform: `scale(${scale})` }}
            >
              <ChallengeMapEnvironment nodes={nodes} />
              <div className={fullscreen ? 'relative p-0' : 'relative p-3 sm:p-4'}>
                <ChallengeMapCanvas
                  nodes={nodes}
                  layout="zigzag"
                  nodeLayout={nodeLayout}
                  pathSegments={pathSegments}
                  introStartSegment={introStartSegment}
                  introLegacyStartPoint={introLegacyStartPoint}
                  selectedNodeId={questPreviewNode?.id}
                  onNodeSelect={handleQuestNodeSelect}
                  showWalkingAvatar={fullscreen}
                  walkingAvatarMode={isAutoCamera ? 'intro' : 'idle'}
                  onWalkingAvatarPositionChange={setAvatarCamera}
                  onWalkingAvatarMotionComplete={handleIntroMotionComplete}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      <LevelQuestStartModal
        open={questPreviewNode !== null}
        node={questPreviewNode}
        onClose={() => setQuestPreviewNode(null)}
        onStartQuest={(href) => {
          setQuestPreviewNode(null)
          router.push(href)
        }}
      />
    </div>
  )
}
