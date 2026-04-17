'use client'

import { useEffect, useRef, useState } from 'react'
import { ChallengeMapNodeCard } from '@/components/students/challenge-map/challenge-map-node'
import { ChallengeMapWalkingAvatar } from '@/components/students/challenge-map/challenge-map-walking-avatar'
import type { ChallengeMapNode } from '@/lib/students/challenge-map'
import type { MapPathPoint, MapPathSegments } from '@/lib/students/challenge-map-layout'

interface ChallengeMapCanvasProps {
  nodes: ChallengeMapNode[]
  showActions?: boolean
  compact?: boolean
  layout?: 'linear' | 'zigzag'
  nodeLayout?: Record<string, { xPct: number; yPct: number }>
  selectedNodeId?: string
  onNodeSelect?: (node: ChallengeMapNode) => void
  pathSegments?: MapPathSegments
  introStartSegment?: { points: MapPathPoint[] } | null
  introLegacyStartPoint?: MapPathPoint | null
  showWalkingAvatar?: boolean
  walkingAvatarMode?: 'idle' | 'intro'
  onWalkingAvatarPositionChange?: (payload: {
    position: MapPathPoint
    progress: number
    isMoving: boolean
  }) => void
  onWalkingAvatarMotionComplete?: () => void
}

const MAP_TILE_ASPECT_RATIO = 1024 / 687
const MAP_PATH_ANCHORS: Array<{ x: number; y: number }> = [
  { x: 53, y: 8 },
  { x: 41, y: 20 },
  { x: 62, y: 33 },
  { x: 36, y: 48 },
  { x: 57, y: 63 },
  { x: 40, y: 79 },
  { x: 52, y: 92 },
]

export function ChallengeMapCanvas({
  nodes,
  showActions = true,
  compact = false,
  layout = 'zigzag',
  nodeLayout,
  selectedNodeId,
  onNodeSelect,
  pathSegments,
  introStartSegment = null,
  introLegacyStartPoint = null,
  showWalkingAvatar = false,
  walkingAvatarMode = 'idle',
  onWalkingAvatarPositionChange,
  onWalkingAvatarMotionComplete,
}: ChallengeMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateWidth = () => setContainerWidth(element.clientWidth)
    updateWidth()

    const observer = new ResizeObserver(() => updateWidth())
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const nodesPerTile = MAP_PATH_ANCHORS.length
  const tileCount = Math.max(1, Math.ceil(nodes.length / nodesPerTile))
  const tileHeight = Math.max(compact ? 380 : 520, containerWidth * MAP_TILE_ASPECT_RATIO)
  const canvasHeight = tileCount * tileHeight

  const w = containerWidth > 0 ? containerWidth : 800

  return (
    <div ref={containerRef} className="relative" style={{ height: `${canvasHeight}px` }}>
      <div
        aria-hidden
        className="absolute inset-0 rounded-xl"
        style={{
          background:
            'radial-gradient(circle at center, rgba(252, 233, 172, 0.12) 0%, rgba(252, 233, 172, 0.03) 28%, rgba(252, 233, 172, 0) 60%)',
        }}
      />
      <ol aria-label="Challenge progression map" className="relative z-[4] h-full">
        {nodes.map((node, index) => (
          <li
            key={node.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={(() => {
              if (layout === 'linear') {
                const y = ((index + 1) / (nodes.length + 1)) * 100
                return { top: `${y}%`, left: '50%' }
              }

              const custom = nodeLayout?.[node.quizId]
              if (custom) {
                const tileIndex = Math.floor(index / nodesPerTile)
                const topPx = tileIndex * tileHeight + (custom.yPct / 100) * tileHeight
                return { top: `${topPx}px`, left: `${custom.xPct}%` }
              }

              const tileIndex = Math.floor(index / nodesPerTile)
              const anchorIndex = index % nodesPerTile
              const anchor = MAP_PATH_ANCHORS[anchorIndex]
              const topPx = tileIndex * tileHeight + (anchor.y / 100) * tileHeight
              return { top: `${topPx}px`, left: `${anchor.x}%` }
            })()}
          >
            <ChallengeMapNodeCard
              node={node}
              showAction={showActions}
              compact={compact}
              isSelected={selectedNodeId === node.id}
              onSelect={onNodeSelect}
            />
          </li>
        ))}
      </ol>
      {showWalkingAvatar && nodes.length > 0 ? (
        <ChallengeMapWalkingAvatar
          nodes={nodes}
          nodeLayout={nodeLayout ?? {}}
          pathSegments={pathSegments ?? {}}
          introStartSegment={introStartSegment}
          introLegacyStartPoint={introLegacyStartPoint}
          containerWidth={w}
          compact={compact}
          mode={walkingAvatarMode}
          onPositionChange={onWalkingAvatarPositionChange}
          onMotionComplete={onWalkingAvatarMotionComplete}
        />
      ) : null}
    </div>
  )
}
