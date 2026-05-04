export type ContextScanProfile = 'quick' | 'balanced' | 'deep'

export const DEFAULT_BOOK_FOCUS_AREAS = [
  'Selection',
  'Phonics',
  'Fluency',
  'Comprehension',
  'Listening/Speaking/Viewing',
  'Vocabulary',
  'Spelling',
  'Grammar',
  'Writing',
] as const

export interface ContextPageRange {
  startPage: number
  endPage: number
}

export interface ContextLanguageFocus {
  grammarNotes: string[]
  writingNotes: string[]
}

export interface UnitContextRecord {
  id: string
  kind: 'unit'
  bookId: string
  unitId: string
  unitTitle?: string
  theme: string
  bigIdeas: string[]
  crossCurricularLinks: string[]
  targetLanguageDomains: string[]
  sourcePageRange: ContextPageRange
  scanProfile: ContextScanProfile
  contextVersion: string
  createdAt: string
  updatedAt: string
}

export interface LessonContextRecord {
  id: string
  kind: 'lesson'
  bookId: string
  unitId: string
  lessonId: string
  lessonTitle?: string
  textType: string
  lessonGoals: string[]
  comprehensionSkill: string
  strategy: string
  essentialQuestions: string[]
  languageFocus: ContextLanguageFocus
  sourcePageRange: ContextPageRange
  scanProfile: ContextScanProfile
  contextVersion: string
  createdAt: string
  updatedAt: string
}

/** Same fields as `InteractiveVocabWord` in `lib/books/interactive-vocab.ts` (reader word list). */
export interface PartContextVocabularyWord {
  id: string
  word: string
  definition: string
  examples: string[]
}

export interface PartContextRecord {
  id: string
  kind: 'part'
  bookId: string
  unitId: string
  lessonId: string
  partId: string
  partTitle?: string
  partGoals: string[]
  activityNotes: string[]
  languageFocus: ContextLanguageFocus
  sourcePageRange: ContextPageRange
  scanProfile: ContextScanProfile
  contextVersion: string
  createdAt: string
  updatedAt: string
  /** Teacher-authored words for the in-book interactive vocab reader (shared for all students). */
  interactiveVocabulary?: PartContextVocabularyWord[]
}

export interface BookContextSummaryRecord {
  kind: 'book-summary'
  bookId: string
  summary: string
  sourcePageRange: ContextPageRange | null
  updatedAt: string | null
  unitContextCount: number
  lessonContextCount: number
}

export type ContextFieldConfidence = 'high' | 'medium' | 'low'

export interface BookContextEvidenceRecord {
  field:
    | 'summary'
    | 'goals'
    | 'pacing'
    | 'instructionalPriorities'
  sourceUrl: string
  snippet: string
  confidence: ContextFieldConfidence
}

export interface BookContextSourceRecord {
  title: string
  url: string
  snippet: string
  trustScore: number
  confidence: ContextFieldConfidence
}

export interface BookContextMaterialRecord {
  type:
    | 'pacing-guide'
    | 'scope-sequence'
    | 'teacher-edition'
    | 'assessment'
    | 'intervention'
    | 'grammar-writing'
    | 'vocabulary'
    | 'digital-resource'
    | 'other'
  title: string
  url: string
  notes: string
  confidence: ContextFieldConfidence
}

export interface BookContextRecord {
  id: string
  kind: 'book'
  bookId: string
  summary: string
  goals: string[]
  pacing: string[]
  instructionalPriorities: string[]
  focusAreas: string[]
  focusNotesByLesson?: Record<string, Record<string, string>>
  sourcePageRange: ContextPageRange | null
  materials: BookContextMaterialRecord[]
  evidence: BookContextEvidenceRecord[]
  contextVersion: string
  createdAt: string
  updatedAt: string
}

export interface BookContextDraftRecord {
  kind: 'book-draft'
  bookId: string
  summary: string
  goals: string[]
  pacing: string[]
  instructionalPriorities: string[]
  focusAreas: string[]
  focusNotesByLesson?: Record<string, Record<string, string>>
  sourcePageRange: ContextPageRange | null
  materials: BookContextMaterialRecord[]
  sources: BookContextSourceRecord[]
  evidence: BookContextEvidenceRecord[]
  generatedAt: string
}

export interface MaterialLessonSections {
  readAloud: string[]
  anchorText: string[]
  pairedSelection: string[]
  selection: string[]
  targetVocabulary: string[]
  spelling: string[]
  grammar: string[]
  writing: string[]
  essentialQuestion: string[]
  comprehensionTargets: string[]
  grammarVocabTargets: string[]
  weeklyAssessments: string[]
}

export type ContextRecord = UnitContextRecord | LessonContextRecord | PartContextRecord | BookContextRecord

export interface UnitContextScanInput {
  bookId: string
  unitId: string
  unitTitle?: string
  sourcePageRange: ContextPageRange
  sectionSummary?: string
  scanProfile?: ContextScanProfile
}

export interface LessonContextScanInput {
  bookId: string
  unitId: string
  lessonId: string
  lessonTitle?: string
  sourcePageRange: ContextPageRange
  sectionSummary?: string
  scanProfile?: ContextScanProfile
}

export interface BookContextScanInput {
  bookId: string
  bookTitle?: string
  bookDescription?: string
  gradeHint?: string
  versionHints?: string[]
  materialTypes?: BookContextMaterialRecord['type'][]
  searchMode?: 'official-first' | 'broad'
  downloadableOnly?: boolean
  maxResults?: number
  queryOverride?: string
  sourcePageRange?: ContextPageRange | null
  scanProfile?: ContextScanProfile
}
