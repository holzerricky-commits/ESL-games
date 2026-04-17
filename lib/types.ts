export interface QuizQuestion {
  id: string
  questionText: string
  vocabularyWord: string
  /** Weighted higher for challenge sampling when enabled by teacher. */
  isPriority?: boolean
  /** Optional LLM literal stock-search phrase when no curated override exists. */
  imageSearchQuery?: string
  imageUrl: string
  mediaType?: 'static' | 'gif'
  imageStyle?: 'Photo' | 'Cartoon / Illustration' | '3D render'
  customImageUrl?: string
  /** Last resolved CDN URL after /api/quiz-image redirect; client-only, strip before save. */
  resolvedPreviewUrl?: string
}

/** Timed Challenge tier banks (easy / mid / hard). */
export type DifficultyTier = 'easy' | 'mid' | 'hard'

export interface Quiz {
  id: string
  name: string
  description: string
  /** Optional topic-series grouping (e.g. "Animals" with Part 1, Part 2...). */
  seriesId?: string
  seriesTitle?: string
  /** 1-based order inside a series. */
  partIndex?: number
  /** Optional display override for student-facing part title. */
  partLabel?: string
  /** Source quiz id when this part is created from an earlier part card. */
  sourceQuizId?: string
  /**
   * Per-tier question banks (Option A). When set, prefer `getQuizQuestionsForTier` for play.
   * Legacy saves used a single `questions` array (treated as mid on read).
   */
  questionsByTier?: Partial<Record<DifficultyTier, QuizQuestion[]>>
  /** @deprecated Use `questionsByTier`; kept for migration and older readers. */
  questions?: QuizQuestion[]
  coverImageUrl?: string
  coverImageMode?: 'auto' | 'manual'
  challengeQuestionCount: number // number of random questions used in challenge mode
  passThreshold: number // number of correct answers needed; 0 = all
  createdAt: string
  updatedAt: string
}

export interface StudentResult {
  id: string
  studentName: string
  quizId: string
  quizName: string
  score: number
  totalQuestions: number
  answers: { questionId: string; correct: boolean }[]
  completedAt: string
  /** Challenge mode only — which bank was played. */
  difficultyTier?: DifficultyTier
  /** Challenge mode — met quiz pass threshold for this run. */
  passedChallenge?: boolean
}

export interface StudentRecord {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  note?: string
  className?: string
  /** Default Timed Challenge difficulty; used when launching play from profile / plan. */
  defaultDifficultyTier?: DifficultyTier
  /** Ordered quiz IDs the teacher assigned; empty = no path yet (new students). */
  assignedQuizIds?: string[]
  /** Optional map node positions keyed by quiz id (x/y percentages). */
  mapNodeLayout?: Record<string, { xPct: number; yPct: number }>
  /** Optional teacher-edited walking routes keyed by `fromQuizId`. */
  mapPathSegments?: Record<string, { points: Array<{ xPct: number; yCanvasPct: number }> }>
  /**
   * Optional entry position before the first quest (canvas %). Legacy single point;
   * prefer `mapPathStartSegment` for multi-point routes.
   */
  mapPathStartPoint?: { xPct: number; yCanvasPct: number }
  /**
   * Optional polyline from entry to quest 1 (teacher-only). Last point is kept in sync with the first node.
   */
  mapPathStartSegment?: { points: Array<{ xPct: number; yCanvasPct: number }> }
}

/** Distinct students from saved results, for pickers (same source as Student Results page). */
export interface KnownStudentSummary {
  name: string
  lastDate: string
  totalQuizzes: number
}

export type AnimationPresetId = string

export interface AnimationSettings {
  success: AnimationPresetId
  perfect: AnimationPresetId
  fail: AnimationPresetId
}

export interface ChallengeDefinition {
  id: string
  order: number
  title: string
  description: string
  quizId: string
  coinReward: number
  passThreshold: number
  isActive: boolean
}

export type ChallengeProgressStatus = 'locked' | 'unlocked' | 'completed'

export interface StudentChallengeProgress {
  challengeId: string
  status: ChallengeProgressStatus
  bestScorePct: number
  attemptCount: number
  completedAt?: string
}

export interface CoinTransaction {
  id: string
  studentKey: string
  challengeId: string
  amount: number
  reason: 'challenge_completion'
  createdAt: string
}

export interface StudentProgressRecord {
  studentKey: string
  currentChallengeOrder: number
  totalCoins: number
  challenges: StudentChallengeProgress[]
  coinTransactions: CoinTransaction[]
  updatedAt: string
  version: number
}
