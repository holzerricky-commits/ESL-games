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
}
