import type { VocabularyEntry, VocabularySet, VocabularySetStatus, VocabularySourceContext } from '@/lib/vocabulary/types'

export interface VocabularyStore {
  getSet(setId: string): Promise<VocabularySet | null>
  getSetByContext(context: VocabularySourceContext): Promise<VocabularySet | null>
  saveDraftSet(set: VocabularySet): Promise<VocabularySet>
  updateEntry(
    setId: string,
    entryId: string,
    patch: Partial<
      Pick<
        VocabularyEntry,
        | 'word'
        | 'lemma'
        | 'definition'
        | 'examples'
        | 'synonyms'
        | 'antonyms'
        | 'relevanceTags'
        | 'confidence'
        | 'reviewFlags'
        | 'sourcePage'
        | 'approved'
      >
    >,
  ): Promise<VocabularySet | null>
  removeEntry(setId: string, entryId: string): Promise<VocabularySet | null>
  bulkUpdateEntries(
    setId: string,
    predicate: (entry: VocabularyEntry) => boolean,
    patch: Partial<VocabularyEntry>,
  ): Promise<VocabularySet | null>
  listEntriesByRisk(
    setId: string,
    options?: { onlyFlags?: boolean; excludeApproved?: boolean },
  ): Promise<VocabularyEntry[] | null>
  setStatus(setId: string, status: VocabularySetStatus): Promise<VocabularySet | null>
}
