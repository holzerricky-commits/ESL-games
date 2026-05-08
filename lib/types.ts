import type { BookLessonPartTag } from '@/lib/books/types'

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

export type StudentClassStatus = 'planned' | 'prepared' | 'in_progress' | 'completed' | 'cancelled'

/** Bookmark captured when the teacher ends class (last viewed PDF page for that book). */
export interface ClassSessionBookmarkAtEnd {
  bookId: string
  pdfPage: number
  unitId?: string
}

export type BookSectionType = 'unit' | 'lesson' | 'part'

export interface StudentBookSectionRef {
  id: string
  type: BookSectionType
  bookId: string
  bookTitle: string
  unitId: string
  unitTitle: string
  lessonId?: string
  lessonTitle?: string
  partId?: string
  partTitle?: string
  title: string
  /** Resolved lesson-part kind when `type` is `part` (for display and light logic). */
  partStructureTag?: BookLessonPartTag
  /** Optional section page hints (display numbering) for notebook anchoring. */
  startPageHint?: number
  endPageHint?: number
}

export interface TeacherWeeklyScheduleConfig {
  workingDays: number[]
  startMinute: number
  endMinute: number
  slotMinutes: 30
}

export interface WeeklySlotAssignment {
  id: string
  dayOfWeek: number
  startMinute: number
  durationMinutes: 30 | 60
  studentId: string
  createdAt: string
  updatedAt: string
}

export interface StudentClassSession {
  id: string
  title: string
  scheduledFor: string
  durationMin: number
  status: StudentClassStatus
  goals: string[]
  activities: string[]
  plannedVocabulary: string[]
  /** Optional AI-generated vocabulary set linked to this class session. */
  vocabularySetId?: string
  vocabularySetStatus?: 'draft' | 'approved' | 'published'
  unitContextId?: string
  lessonContextId?: string
  selectedSection?: StudentBookSectionRef
  /** Source weekly schedule slot id when session is generated automatically. */
  sourceSlotId?: string
  introducedWords: string[]
  practicedWords: string[]
  reviewedWords: string[]
  learnedWords: string[]
  vocabularyFeedback?: {
    tooEasy: number
    offTheme: number
    wrongSkillSupport: number
    editedMeaning: number
    removedWords: string[]
  }
  vocabularyReviewPlan?: Array<{
    word: string
    lastSeenAt: string
    intervalDays: number
    nextReviewAt: string
  }>
  practiceItems?: Array<{
    id: string
    type: 'meaning_match'
    word: string
    prompt: string
    choices: string[]
    correctChoiceIndex: number
    createdAt: string
  }>
  teacherNotes?: string
  aiPrepSummary?: string
  /** When the teacher tapped Start class (ISO). */
  classStartedAt?: string
  /** When the teacher confirmed End class (ISO). */
  classEndedAt?: string
  /** Short recap after class (separate from prep `teacherNotes`). */
  classEndNote?: string
  /**
   * Longer session log for this call: pages covered, what worked, plan for next time.
   * Distinct from `classEndNote` (one-line recap).
   */
  sessionNote?: string
  /** Teacher dismissed the optional “add a recap” prompt without adding text. */
  postClassRecapPromptDismissed?: boolean
  /** Last-viewed PDF page at end class, per your bookmark rule. */
  bookmarkAtEnd?: ClassSessionBookmarkAtEnd
  /** Session-scoped lesson notebook (Prompt 1 foundation). */
  lessonNotebookSession?: LessonNotebookSession
  createdAt: string
  updatedAt: string
}

export type LessonNotebookAnchorType = 'page_span' | 'toc_part'
export type LessonNotebookEntryLayer = 'doc' | 'overlay'

export interface LessonNotebookSession {
  sessionId: string
  studentId: string
  classSessionId: string
  bookId: string
  unitId?: string
  startedAt: string
  endedAt?: string
  sections: LessonNotebookSection[]
}

export interface LessonNotebookSection {
  sectionId: string
  sessionId: string
  anchorType: LessonNotebookAnchorType
  anchorKey: string
  title: string
  order: number
  entries: LessonNotebookEntry[]
}

export interface LessonNotebookEntry {
  entryId: string
  sectionId: string
  layer: LessonNotebookEntryLayer
  payload: Record<string, unknown>
  createdAt: string
  updatedAt: string
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
  /** Teacher-assigned curriculum books for local reader flow. */
  assignedBookIds?: string[]
  /** Teacher-assigned curriculum units (book+unit reference). */
  assignedUnitRefs?: Array<{ bookId: string; unitId: string }>
  /**
   * Optional `StudentSectionOption.id` from the book outline — where reading should start
   * when there is no earlier completed class with a chosen section.
   */
  curriculumAnchorSectionId?: string
  /** Per-session reading history entries captured from the Books reader when opened from a student context. */
  curriculumHistory?: Array<{
    id: string
    bookId: string
    unitId: string
    page: number
    openedAt: string
    closedAt?: string
  }>
  /** Scheduled class sessions for this student (teacher planning flow). */
  scheduledClasses?: StudentClassSession[]
  /** Per-lesson page range overrides keyed by `bookId::unitId::lessonId`. */
  lessonRangeOverrides?: Record<string, { startPage: number; endPage: number; updatedAt: string }>
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
