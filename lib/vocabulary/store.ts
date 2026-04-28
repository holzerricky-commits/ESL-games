import type { VocabularyEntry, VocabularySet, VocabularySetStatus, VocabularySourceContext } from '@/lib/vocabulary/types'

export interface VocabularyStore {
  getSet(setId: string): Promise<VocabularySet | null>
  getSetByContext(context: VocabularySourceContext): Promise<VocabularySet | null>
  saveDraftSet(set: VocabularySet): Promise<VocabularySet>
  updateEntry(
    setId: string,
    entryId: string,
    patch: Partial<Pick<VocabularyEntry, 'word' | 'lemma' | 'definition' | 'examples' | 'synonyms' | 'antonyms' | 'sourcePage' | 'approved'>>,
  ): Promise<VocabularySet | null>
  removeEntry(setId: string, entryId: string): Promise<VocabularySet | null>
  setStatus(setId: string, status: VocabularySetStatus): Promise<VocabularySet | null>
}
