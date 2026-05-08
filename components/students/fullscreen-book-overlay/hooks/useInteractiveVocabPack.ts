import { useEffect, useMemo, useState } from 'react'
import {
  buildInteractiveVocabPack,
  getInteractiveVocabPackForPartKey,
  interactiveVocabPartKey,
  resolveLessonAndPartAtPdfPage,
  type InteractiveVocabWord,
} from '@/lib/books/interactive-vocab'
import type { BookLibraryPayload } from '@/lib/books/types'
import { resolvePartStructureTag } from '@/lib/books/part-structure-tag'

interface UseInteractiveVocabPackArgs {
  selectedBook: BookLibraryPayload['books'][number] | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  pageNumber: number
  numPages: number | null
}

export function useInteractiveVocabPack({
  selectedBook,
  selectedUnit,
  pageNumber,
  numPages,
}: UseInteractiveVocabPackArgs) {
  const vocabReaderHit = useMemo(() => {
    if (!selectedBook || !selectedUnit) return null
    return resolveLessonAndPartAtPdfPage(selectedBook, selectedUnit, null, pageNumber, numPages)
  }, [selectedBook, selectedUnit, pageNumber, numPages])

  const vocabReaderTag = useMemo(() => {
    if (!vocabReaderHit) return null
    const parts = vocabReaderHit.lesson.parts ?? []
    const partIndex = Math.max(0, parts.findIndex((p) => p.id === vocabReaderHit.part.id))
    return resolvePartStructureTag(vocabReaderHit.part, partIndex)
  }, [vocabReaderHit])

  const [savedPartInteractiveVocab, setSavedPartInteractiveVocab] = useState<InteractiveVocabWord[] | null>(null)

  useEffect(() => {
    if (!selectedBook || !selectedUnit || !vocabReaderHit) {
      setSavedPartInteractiveVocab(null)
      return
    }
    if (vocabReaderTag !== 'vocabulary_in_context' && vocabReaderTag !== 'vocabulary_background') {
      setSavedPartInteractiveVocab(null)
      return
    }
    const { lesson, part } = vocabReaderHit
    setSavedPartInteractiveVocab(null)
    const qs = new URLSearchParams({
      bookId: selectedBook.id,
      unitId: selectedUnit.id,
      lessonId: lesson.id,
      partId: part.id,
    })
    let cancelled = false
    void fetch(`/api/context/get?${qs.toString()}`)
      .then((r) => r.json())
      .then((data: { ok?: boolean; context?: { interactiveVocabulary?: InteractiveVocabWord[] } | null }) => {
        if (cancelled) return
        const list = data.ok ? data.context?.interactiveVocabulary : undefined
        setSavedPartInteractiveVocab(Array.isArray(list) && list.length ? list : null)
      })
      .catch(() => {
        if (!cancelled) setSavedPartInteractiveVocab(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedBook, selectedUnit, vocabReaderHit, vocabReaderTag])

  const interactiveVocabPack = useMemo(() => {
    if (!selectedBook || !selectedUnit || !vocabReaderHit) return null
    if (vocabReaderTag !== 'vocabulary_in_context' && vocabReaderTag !== 'vocabulary_background') return null
    const key = interactiveVocabPartKey(
      selectedBook.id,
      selectedUnit.id,
      vocabReaderHit.lesson.id,
      vocabReaderHit.part.id,
    )
    const sectionLabel = vocabReaderHit.part.title ?? 'Vocabulary'
    const hardcoded = getInteractiveVocabPackForPartKey(key)
    return buildInteractiveVocabPack(key, sectionLabel, savedPartInteractiveVocab, hardcoded)
  }, [selectedBook, selectedUnit, vocabReaderHit, vocabReaderTag, savedPartInteractiveVocab])

  return { vocabReaderHit, vocabReaderTag, interactiveVocabPack }
}
