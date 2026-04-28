import type { DifficultyTier, StudentClassSession, StudentClassStatus } from '@/lib/types'

export type StudentProfileTab = 'challenges' | 'curriculum' | 'classes' | 'map' | 'avatar' | 'info'

export interface StudentCurriculumUnitAssignmentView {
  bookId: string
  unitId: string
}

export interface StudentCurriculumHistoryEntryView {
  id: string
  bookId: string
  unitId: string
  page: number
  openedAt: string
  closedAt?: string
}

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
  /** Human-readable nearest upcoming class label (or fallback if none). */
  nextClassLabel: string
  /** Resolved book title (or id) for list cards. */
  curriculumBookLabel: string
  curriculumUnitLabel: string
  curriculumPageLabel: string
  /** When all set, list card may show a PDF page thumbnail (requires book library). */
  curriculumThumbFilePath: string | null
  curriculumThumbUnitId: string | null
  curriculumThumbPage: number | null
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

export interface StudentClassSessionView extends StudentClassSession {}

export interface StudentClassPrepSuggestionView {
  priorities: string[]
  activities: string[]
  wordsToRevisit: Array<{ word: string; reason: string }>
  summary: string
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
  assignedBookIds: string[]
  assignedUnitRefs: StudentCurriculumUnitAssignmentView[]
  curriculumHistory: StudentCurriculumHistoryEntryView[]
  scheduledClasses: StudentClassSessionView[]
}

export interface StudentClassSessionInputView {
  title: string
  scheduledFor: string
  durationMin: number
  status?: StudentClassStatus
  goals?: string[]
  activities?: string[]
  plannedVocabulary?: string[]
}
