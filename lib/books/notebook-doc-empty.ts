const EMPTY_VARIANTS = new Set(['<p><br></p>', '<p><br/></p>', '<p></p>'])

export function isNotebookDocEmpty(html: string): boolean {
  const trimmed = html.trim()
  if (!trimmed || EMPTY_VARIANTS.has(trimmed)) return true
  if (trimmed.includes('data-notebook-entry=') || trimmed.includes('data-notebook-marker=')) return false
  const text = trimmed.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim()
  return text.length === 0
}
