import type { DifficultyTier } from '@/lib/types'

export type StudentProfileTab = 'overview' | 'practice' | 'challenges' | 'map' | 'avatar' | 'info'

export interface StudentChallengeItemView {
  id: string
  /** Underlying Timed Challenge quiz id (for covers and linking). */
  quizId: string
  title: string
  description: string
  status: 'locked' | 'unlocked' | 'completed'
  bestScorePct: number
  attemptCount: number
  coinReward: number
}

export interface StudentListItemView {
  id: string
  studentKey: string
  name: string
  avatarUrl?: string
  levelLabel: string
  progressLabel: string
  coinsLabel: string
  currentChallengeLabel: string
  totalAttempts: number
  lastActiveLabel: string
}

export interface StudentCoinTransactionView {
  id: string
  amount: number
  createdAt: string
  reasonLabel: string
  challengeTitle?: string
  /** Running balance after this transaction (oldest → newest); matches banking-style ledgers. */
  balanceAfter: number
}

export interface StudentProfileView extends StudentListItemView {
  recentActivity: string[]
  practiceSummary: string
  challengeSummary: string
  completedChallengesLabel: string
  nextChallengeLabel: string
  totalCoins: number
  coinTransactions: StudentCoinTransactionView[]
  challengeItems: StudentChallengeItemView[]
  avatarSummary: string
  infoSummary: string
  /** Timed Challenge default difficulty (preselected on play setup). */
  defaultDifficultyTier: DifficultyTier
}
