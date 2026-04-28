/**
 * Ensures TOC / AI lesson labels read as "Lesson N …" with a descriptive suffix when missing.
 * If the source already starts with "Lesson" + number, it is returned unchanged (trimmed).
 */
export function formatLessonTitleWithNumber(lessonIndexOneBased: number, titleFromSource: string): string {
  const n = Math.max(1, Math.floor(lessonIndexOneBased))
  const t = titleFromSource.trim()
  if (!t) return `Lesson ${n}`
  if (/^lesson\s*\d+/i.test(t)) return t
  return `Lesson ${n}: ${t}`
}
