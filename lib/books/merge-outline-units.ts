import { findBookVolume, listBookVolumes, normalizeBookFilePath } from '@/lib/books/book-volumes'
import { bookHasDistinctUnitFiles } from '@/lib/books/split-stacked-pdf-ranges'
import { draftsToUnits, type TocUnitDraft } from '@/lib/books/toc-import'
import type { BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'

/**
 * Merge outline drafts onto the book.
 * A multi-PDF book only replaces the volume or file being edited.
 * Each draft keeps its own PDF path so a later save cannot point another file’s unit at the preview PDF.
 */
export function mergeOutlineUnitsOntoBook(
  book: BookRecord,
  fallbackFilePath: string,
  drafts: TocUnitDraft[],
  lessonsByUnitIndex: BookLessonRecord[][],
  options?: { volumeId?: string | null },
): BookUnitRecord[] {
  const volumeId = options?.volumeId?.trim() || null
  const volume = volumeId ? findBookVolume(book, volumeId) : null
  const filePath = normalizeBookFilePath(volume?.filePath || fallbackFilePath)
  const fromDrafts = draftsToUnits(filePath, drafts, lessonsByUnitIndex).map((unit) => {
    const unitPath = normalizeBookFilePath(unit.filePath || filePath)
    const onTargetFile = Boolean(filePath) && unitPath === filePath
    return {
      ...unit,
      filePath: unitPath,
      ...(volumeId && onTargetFile
        ? { volumeId }
        : unit.volumeId
          ? { volumeId: unit.volumeId }
          : {}),
    }
  })

  if (!volumeId && !bookHasDistinctUnitFiles(book) && listBookVolumes(book).length < 2) {
    return fromDrafts
  }

  const draftIds = new Set(fromDrafts.map((unit) => unit.id))

  if (volumeId || filePath) {
    const targetPath = filePath
    const replaced = (unit: BookUnitRecord) => {
      if (draftIds.has(unit.id)) return true
      if (volumeId && unit.volumeId === volumeId) return true
      return normalizeBookFilePath(unit.filePath ?? '') === targetPath
    }
    const firstReplacedIndex = book.units.findIndex((unit) => {
      if (volumeId && unit.volumeId === volumeId) return true
      return normalizeBookFilePath(unit.filePath ?? '') === targetPath
    })
    if (firstReplacedIndex < 0) {
      return [...book.units.filter((unit) => !draftIds.has(unit.id)), ...fromDrafts]
    }
    const before = book.units.slice(0, firstReplacedIndex).filter((unit) => !replaced(unit))
    const after = book.units.slice(firstReplacedIndex).filter((unit) => !replaced(unit))
    return [...before, ...fromDrafts, ...after]
  }

  const draftById = new Map(fromDrafts.map((unit) => [unit.id, unit]))
  const seen = new Set<string>()
  const merged: BookUnitRecord[] = book.units.map((existing) => {
    seen.add(existing.id)
    const updated = draftById.get(existing.id)
    if (!updated) return existing
    return {
      ...existing,
      ...updated,
      id: existing.id,
      filePath: existing.filePath,
      ...(existing.volumeId ? { volumeId: existing.volumeId } : {}),
    }
  })
  for (const draftUnit of fromDrafts) {
    if (seen.has(draftUnit.id)) continue
    merged.push(draftUnit)
  }
  return merged
}
