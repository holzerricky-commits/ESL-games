import { buildTimedChallengeLaunchHref } from '@/lib/students/challenge-launch'
import type { StudentProfileView } from '@/lib/students/types'

export type ChallengeMapNodeStatus = 'completed' | 'current' | 'locked'

/** Display grouping for the student challenge map “biome” routes UI. */
export interface ChallengeMapBiomeSection {
  biomeRouteName: string
  biomeLabel: string
  biomeIcon: string
  biomeTintClassName: string
}

export interface ChallengeMapNode {
  id: string
  quizId: string
  status: ChallengeMapNodeStatus
  stepNumber: number
  title: string
  reward: number
  bestScorePct: number
  attemptCount: number
  launchHref?: string
  unlockHint?: string
}

export function buildChallengeMapNodes(student: StudentProfileView): ChallengeMapNode[] {
  return student.challengeItems.map((item, index) => {
    const status: ChallengeMapNodeStatus =
      item.status === 'completed' ? 'completed' : item.status === 'unlocked' ? 'current' : 'locked'
    return {
      id: item.id,
      quizId: item.quizId,
      status,
      stepNumber: index + 1,
      title: item.title,
      reward: item.coinReward,
      bestScorePct: item.bestScorePct,
      attemptCount: item.attemptCount,
      launchHref:
        status === 'locked'
          ? undefined
          : buildTimedChallengeLaunchHref({
              mode: 'challenge',
              quizId: item.quizId,
              studentId: student.id,
              studentName: student.name,
              returnTo: `/students/${student.id}/map`,
            }),
      unlockHint: status === 'locked' ? 'Complete the previous step to unlock this challenge.' : undefined,
    }
  })
}

export function getChallengeMapSnapshotNodes(nodes: ChallengeMapNode[]): ChallengeMapNode[] {
  if (nodes.length <= 3) return nodes

  const currentIndex = nodes.findIndex((node) => node.status === 'current')
  const firstLockedIndex = nodes.findIndex((node) => node.status === 'locked')
  const lastCompletedIndex = (() => {
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      if (nodes[i].status === 'completed') return i
    }
    return -1
  })()

  const focusIndex =
    currentIndex >= 0 ? currentIndex : firstLockedIndex >= 0 ? firstLockedIndex : lastCompletedIndex >= 0 ? lastCompletedIndex : 0

  const start = Math.max(0, focusIndex - 1)
  const end = Math.min(nodes.length, focusIndex + 3)
  return nodes.slice(start, end)
}
