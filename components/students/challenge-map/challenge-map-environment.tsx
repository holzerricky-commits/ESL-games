'use client'

import type { ChallengeMapNode } from '@/lib/students/challenge-map'
import { CHALLENGE_MAP_FOREST_BG } from '@/lib/students/challenge-map-assets'
import { ForestTree1Leaves } from '@/components/students/challenge-map/forest-tree1-leaves'

const forestBgStyle = {
  backgroundImage: `url("${CHALLENGE_MAP_FOREST_BG}")`,
  backgroundSize: '100% auto' as const,
  backgroundPosition: 'top center' as const,
  backgroundRepeat: 'repeat-y' as const,
}

interface ChallengeMapEnvironmentProps {
  nodes: ChallengeMapNode[]
}

export function ChallengeMapEnvironment({ nodes }: ChallengeMapEnvironmentProps) {
  if (nodes.length === 0) return null

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden rounded-2xl">
      <div className="absolute inset-0" style={forestBgStyle} />
      <ForestTree1Leaves layout="tiled" />
    </div>
  )
}
