/**
 * Ensures TOC / AI chunk labels read as "Lesson N …" or "Week N …"
 * with a descriptive suffix when missing.
 * If the source already starts with the same label + number, it is returned unchanged (trimmed).
 */
export type TocChunkLabelStyle = 'lesson' | 'week'

export function formatLessonTitleWithNumber(lessonIndexOneBased: number, titleFromSource: string): string {
  return formatTocChunkTitle(lessonIndexOneBased, titleFromSource, 'lesson')
}

export function formatTocChunkTitle(
  indexOneBased: number,
  titleFromSource: string,
  style: TocChunkLabelStyle = 'lesson',
): string {
  const n = Math.max(1, Math.floor(indexOneBased))
  const label = style === 'week' ? 'Week' : 'Lesson'
  const t = titleFromSource.trim()
  if (!t) return `${label} ${n}`
  const alreadyLabeled = new RegExp(`^${label}\\s*\\d+`, 'i')
  if (alreadyLabeled.test(t)) return t
  // Avoid "Week 2: Lesson 2: Theme" if the model echoed the wrong label.
  const other = style === 'week' ? 'Lesson' : 'Week'
  const otherPrefixed = new RegExp(`^${other}\\s*(\\d+)\\s*[:.\\-–—]?\\s*(.*)$`, 'i')
  const otherMatch = t.match(otherPrefixed)
  if (otherMatch) {
    const rest = (otherMatch[2] ?? '').trim()
    return rest ? `${label} ${n}: ${rest}` : `${label} ${n}`
  }
  return `${label} ${n}: ${t}`
}
