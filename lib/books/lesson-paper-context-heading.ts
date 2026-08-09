/** Escape text for safe insertion into HTML text or attribute values. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type LessonPaperContextHeadingParts = {
  contextKey: string
  title: string
  pageSpanKey: string
  activeClassSessionId?: string | null
}

/**
 * Build the HTML block inserted when the lesson notebook adds a part heading.
 * Titles and keys come from the book TOC / AI import and must never run as HTML.
 */
export function buildLessonPaperContextHeadingHtml({
  contextKey,
  title,
  pageSpanKey,
  activeClassSessionId,
}: LessonPaperContextHeadingParts): string {
  const markerId = contextKey.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
  const headingTitle = escapeHtml(title.trim() || pageSpanKey)
  const pageLabel = escapeHtml(pageSpanKey.replace(/^p/i, ''))
  const safeContextKey = escapeHtml(contextKey)
  const safePageSpan = escapeHtml(pageSpanKey)
  const safeSessionKey = escapeHtml((activeClassSessionId ?? '').trim())
  const sessionAttr = safeSessionKey ? ` data-session-key="${safeSessionKey}"` : ''
  return `<p><br/></p><p><br/></p><div data-notebook-context="${safeContextKey}" data-notebook-marker="${markerId}" data-page-span="${safePageSpan}"${sessionAttr} style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:6px 0 12px 0;padding:0 0 6px 0;border-bottom:1px dashed rgba(74,59,42,0.22);"><h3 style="margin:0;font-size:1.55rem;line-height:1.2;font-weight:700;letter-spacing:0.01em;color:rgba(72,92,139,0.72);">${headingTitle}</h3><span style="font-size:0.86rem;line-height:1.2;font-weight:600;letter-spacing:0.03em;color:rgba(74,59,42,0.58);white-space:nowrap;">${pageLabel}</span></div><p><br/></p>`
}
