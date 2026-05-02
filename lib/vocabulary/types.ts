export type VocabularySetStatus = 'draft' | 'approved' | 'published'

export interface VocabularyPageRange {
  startPage: number
  endPage: number
}

export interface VocabularySourceContext {
  studentId: string
  classId: string
  classTitle: string
  bookId: string
  unitId: string
  sectionId?: string
  sectionTitle?: string
  pageRange: VocabularyPageRange
}

export interface VocabularyEntry {
  id: string
  word: string
  lemma: string
  definition: string
  examples: string[]
  synonyms: string[]
  antonyms: string[]
  relevanceTags: string[]
  confidence: number
  reviewFlags: string[]
  sourcePage: number | null
  approved: boolean
  updatedAt: string
}

export interface VocabularySet {
  id: string
  status: VocabularySetStatus
  context: VocabularySourceContext
  entries: VocabularyEntry[]
  generationVersion: string
  createdAt: string
  updatedAt: string
}

export interface VocabularyGenerationInput {
  context: VocabularySourceContext
  requestedCount?: number
  seedWords?: string[]
  unitContext?: {
    theme?: string
    bigIdeas?: string[]
    targetLanguageDomains?: string[]
  }
  lessonContext?: {
    textType?: string
    comprehensionSkill?: string
    strategy?: string
    essentialQuestions?: string[]
  }
  outcomeContext?: {
    introducedWords?: string[]
    practicedWords?: string[]
    reviewedWords?: string[]
    learnedWords?: string[]
    dueReviewWords?: string[]
  }
  feedbackContext?: {
    tooEasyCount?: number
    offThemeCount?: number
    wrongSkillSupportCount?: number
    editedMeaningCount?: number
    recentlyRemovedWords?: string[]
  }
}
