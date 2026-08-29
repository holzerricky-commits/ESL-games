/** Fired in the browser after a searchable sidecar is written for a unit PDF. */
export const SEARCHABLE_PDF_UPDATED_EVENT = 'esl:searchable-pdf-updated'

export function notifySearchablePdfUpdated(filePath: string): void {
  if (typeof window === 'undefined') return
  const trimmed = filePath.trim()
  if (!trimmed) return
  window.dispatchEvent(
    new CustomEvent(SEARCHABLE_PDF_UPDATED_EVENT, { detail: { filePath: trimmed } }),
  )
}
