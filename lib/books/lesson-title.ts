/**
 * Ensures TOC / AI chunk labels read as "Lesson N …" or "Week N …"
 * with a descriptive suffix when missing.
 * If the source already starts with the same label + number, it is returned unchanged (trimmed).
 * `plain` keeps the model title as-is (generic / unknown series).
 */
export type TocChunkLabelStyle = 'lesson' | 'week' | 'plain'

/**
 * Compact TOC row: number + descriptive title (drops redundant "Lesson N:" / "Week N:" prefix).
 * `fallbackIndexOneBased` is used when the title has no lesson/week number.
 */
export function parseCompactLessonTocLabel(
  titleFromSource: string | null | undefined,
  fallbackIndexOneBased: number,
): { number: number; title: string } {
  const fallback = Math.max(1, Math.floor(fallbackIndexOneBased))
  const raw = (titleFromSource ?? '').trim()
  if (!raw) return { number: fallback, title: `Lesson ${fallback}` }

  const labeled = raw.match(/^(?:lesson|week)\s+(\d+)\s*[:.\-–—]?\s*(.*)$/i)
  if (labeled) {
    const number = Number(labeled[1])
    const rest = (labeled[2] ?? '').replace(/^[\s•·\-–—:]+/, '').trim()
    if (Number.isFinite(number) && number > 0) {
      return { number, title: rest || `Lesson ${number}` }
    }
  }

  return { number: fallback, title: raw }
}

export function formatLessonTitleWithNumber(lessonIndexOneBased: number, titleFromSource: string): string {
  return formatTocChunkTitle(lessonIndexOneBased, titleFromSource, 'lesson')
}

export function formatTocChunkTitle(
  indexOneBased: number,
  titleFromSource: string,
  style: TocChunkLabelStyle = 'lesson',
): string {
  const n = Math.max(1, Math.floor(indexOneBased))
  const t = titleFromSource.trim()
  if (style === 'plain') {
    return t || `Section ${n}`
  }
  const label = style === 'week' ? 'Week' : 'Lesson'
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
