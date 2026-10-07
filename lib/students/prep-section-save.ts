/**
 * Saving a class note also writes the lesson picker.
 * `undefined` means leave the saved lesson alone.
 * `null` means the teacher cleared the picker on purpose.
 * A string is the section id to store.
 */
export function prepSectionIdToPersist(args: {
  /** False while the book list is missing or empty (still loading, or the load failed). */
  booksReady: boolean
  /** Undefined: picker not filled in yet. Empty string: teacher cleared it. */
  pickerSectionId: string | undefined
  optionIds: readonly string[]
}): string | null | undefined {
  if (!args.booksReady) return undefined
  const id = args.pickerSectionId
  if (id === undefined) return undefined
  if (id === '') return null
  if (!args.optionIds.includes(id)) return undefined
  return id
}
