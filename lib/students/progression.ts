import type {
  ChallengeDefinition,
  CoinTransaction,
  StudentChallengeProgress,
  StudentProgressRecord,
} from '@/lib/types'

const PROGRESSION_VERSION = 1

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function createInitialProgressRecord(studentKey: string, challenges: ChallengeDefinition[]): StudentProgressRecord {
  const activeChallenges = [...challenges].filter((challenge) => challenge.isActive).sort((a, b) => a.order - b.order)
  const firstOrder = activeChallenges[0]?.order ?? 0

  return {
    studentKey,
    currentChallengeOrder: firstOrder,
    totalCoins: 0,
    challenges: activeChallenges.map((challenge, index) => ({
      challengeId: challenge.id,
      status: index === 0 ? 'unlocked' : 'locked',
      bestScorePct: 0,
      attemptCount: 0,
    })),
    coinTransactions: [],
    updatedAt: new Date().toISOString(),
    version: PROGRESSION_VERSION,
  }
}

/**
 * Rebuild challenge rows for a new catalog while preserving scores/status per challenge id,
 * then restore linear unlock (first incomplete step is unlocked).
 */
export function reconcileProgressWithCatalog(
  existing: StudentProgressRecord,
  catalog: ChallengeDefinition[],
): StudentProgressRecord {
  const activeCatalog = [...catalog].filter((challenge) => challenge.isActive).sort((a, b) => a.order - b.order)
  const oldById = new Map(existing.challenges.map((c) => [c.challengeId, c]))
  const merged: StudentChallengeProgress[] = activeCatalog.map((def) => {
    const prev = oldById.get(def.id)
    if (prev) {
      return {
        challengeId: def.id,
        status: prev.status,
        bestScorePct: prev.bestScorePct,
        attemptCount: prev.attemptCount,
        completedAt: prev.completedAt,
      }
    }
    return {
      challengeId: def.id,
      status: 'locked',
      bestScorePct: 0,
      attemptCount: 0,
    }
  })

  let assignedUnlock = false
  for (let i = 0; i < merged.length; i += 1) {
    if (merged[i].status === 'completed') continue
    if (!assignedUnlock) {
      merged[i] = { ...merged[i], status: 'unlocked' }
      assignedUnlock = true
    } else if (merged[i].status === 'unlocked') {
      merged[i] = { ...merged[i], status: 'locked' }
    }
  }

  const unlocked = merged.find((c) => c.status === 'unlocked')
  const currentChallengeOrder = unlocked
    ? (activeCatalog.find((d) => d.id === unlocked.challengeId)?.order ?? 0)
    : 0

  return {
    ...existing,
    challenges: merged,
    currentChallengeOrder,
    updatedAt: new Date().toISOString(),
    version: PROGRESSION_VERSION,
  }
}

/**
 * If stored progress rows don’t match the current catalog (e.g. stale empty record, teacher changed path),
 * reconcile before applying an attempt so `applyChallengeAttempt` always finds the challenge row.
 */
export function ensureProgressAlignsWithCatalog(
  existing: StudentProgressRecord,
  catalog: ChallengeDefinition[],
): StudentProgressRecord {
  const active = [...catalog].filter((c) => c.isActive).sort((a, b) => a.order - b.order)
  if (active.length === 0) {
    if (existing.challenges.length === 0) return existing
    return {
      ...existing,
      challenges: [],
      currentChallengeOrder: 0,
      updatedAt: new Date().toISOString(),
      version: PROGRESSION_VERSION,
    }
  }
  const expectedIds = new Set(active.map((c) => c.id))
  const sameLength = existing.challenges.length === active.length
  const sameIds = sameLength && existing.challenges.every((c) => expectedIds.has(c.challengeId))
  if (sameIds) return existing
  return reconcileProgressWithCatalog(existing, catalog)
}

interface ProgressAttemptInput {
  challengeId: string
  scorePct: number
  attemptedAt: string
}

export function applyChallengeAttempt(
  existing: StudentProgressRecord,
  challengeCatalog: ChallengeDefinition[],
  input: ProgressAttemptInput,
): StudentProgressRecord {
  const catalog = [...challengeCatalog].filter((challenge) => challenge.isActive).sort((a, b) => a.order - b.order)
  const catalogById = new Map(catalog.map((challenge) => [challenge.id, challenge]))
  const challengeDef = catalogById.get(input.challengeId)
  if (!challengeDef) return existing

  const updatedChallenges = existing.challenges.map((challengeProgress) => {
    if (challengeProgress.challengeId !== input.challengeId) return challengeProgress
    if (challengeProgress.status === 'locked') return challengeProgress
    const bestScorePct = Math.max(challengeProgress.bestScorePct, Math.round(input.scorePct))
    const isFirstCompletion = challengeProgress.status !== 'completed' && bestScorePct >= challengeDef.passThreshold
    return {
      ...challengeProgress,
      bestScorePct,
      attemptCount: challengeProgress.attemptCount + 1,
      status: isFirstCompletion ? 'completed' : challengeProgress.status,
      completedAt: isFirstCompletion ? input.attemptedAt : challengeProgress.completedAt,
    }
  })

  const updatedChallenge = updatedChallenges.find((challenge) => challenge.challengeId === input.challengeId)
  if (!updatedChallenge) return existing

  const wasCompletedBefore = existing.challenges.find((challenge) => challenge.challengeId === input.challengeId)?.status === 'completed'
  const isNowCompleted = updatedChallenge.status === 'completed'
  const isFirstCompletion = !wasCompletedBefore && isNowCompleted

  let coinTransactions: CoinTransaction[] = existing.coinTransactions
  let totalCoins = existing.totalCoins

  if (isFirstCompletion) {
    const tx: CoinTransaction = {
      id: generateId(),
      studentKey: existing.studentKey,
      challengeId: input.challengeId,
      amount: challengeDef.coinReward,
      reason: 'challenge_completion',
      createdAt: input.attemptedAt,
    }
    coinTransactions = [...existing.coinTransactions, tx]
    totalCoins += challengeDef.coinReward
  }

  const currentIndex = catalog.findIndex((challenge) => challenge.id === input.challengeId)
  if (isFirstCompletion && currentIndex >= 0 && currentIndex < catalog.length - 1) {
    const nextChallengeId = catalog[currentIndex + 1].id
    for (let i = 0; i < updatedChallenges.length; i += 1) {
      if (updatedChallenges[i].challengeId === nextChallengeId && updatedChallenges[i].status === 'locked') {
        updatedChallenges[i] = { ...updatedChallenges[i], status: 'unlocked' }
        break
      }
    }
  }

  const unlocked = updatedChallenges.find((challenge) => challenge.status === 'unlocked')
  const currentChallengeOrder = unlocked
    ? (catalogById.get(unlocked.challengeId)?.order ?? existing.currentChallengeOrder)
    : 0

  return {
    ...existing,
    challenges: updatedChallenges,
    totalCoins,
    coinTransactions,
    currentChallengeOrder,
    updatedAt: input.attemptedAt,
    version: PROGRESSION_VERSION,
  }
}
