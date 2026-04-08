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

export interface Quiz {
  id: string
  name: string
  description: string
  questions: QuizQuestion[]
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
