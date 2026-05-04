/**
 * Vocabulary-in-context spreads are typically a **two-page** PDF window.
 * Uses section `startPageHint` / `endPageHint` (1-based PDF indices).
 * If the hinted span is longer than two pages, only the **first two** pages are used
 * so Gemini stays focused on the opening spread of the part.
 */
export function pdfTwoPageWindowForVocabPart(
  startHint?: number | null,
  endHint?: number | null,
): { start: number; end: number } {
  const s =
    typeof startHint === 'number' && Number.isFinite(startHint) ? Math.max(1, Math.floor(startHint)) : 1
  let e =
    typeof endHint === 'number' && Number.isFinite(endHint) ? Math.max(s, Math.floor(endHint)) : s + 1
  if (e <= s) e = s + 1
  const span = e - s + 1
  if (span > 2) {
    return { start: s, end: s + 1 }
  }
  return { start: s, end: e }
}
