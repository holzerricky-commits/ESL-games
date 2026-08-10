export const PASTED_TEXT_MAX_LENGTH = 2000

/** Normalize OS clipboard plain text for a new board label. */
export function sanitizePastedPlainText(raw: string): string | null {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!normalized) return null
  if (normalized.length <= PASTED_TEXT_MAX_LENGTH) return normalized
  return normalized.slice(0, PASTED_TEXT_MAX_LENGTH)
}

export function readPlainTextFromClipboardData(clipboard: DataTransfer): string | null {
  const hasImage = Array.from(clipboard.items).some((item) => item.type.startsWith('image/'))
  if (hasImage) return null
  const raw = clipboard.getData('text/plain')
  if (!raw) return null
  return sanitizePastedPlainText(raw)
}

export async function readPlainTextFromNavigatorClipboard(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return null
  try {
    const raw = await navigator.clipboard.readText()
    return sanitizePastedPlainText(raw)
  } catch {
    return null
  }
}

/** Paste point in normalized board coordinates (click anchor or viewport center). */
export function textPasteNormPoint(
  boardContentHeightPx: number,
  viewportHeightPx: number,
  scrollTopPx: number,
  anchorNorm?: { x: number; y: number } | null,
): { x: number; y: number } {
  if (anchorNorm) return { x: anchorNorm.x, y: anchorNorm.y }
  const boardH = Math.max(1, boardContentHeightPx)
  const yPx = scrollTopPx + viewportHeightPx / 2
  return {
    x: 0.5,
    y: Math.max(0, Math.min(1, yPx / boardH)),
  }
}

/** When focus is in a field, let the browser handle paste. */
export function shouldDeferClipboardPasteToBrowser(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el instanceof HTMLElement && el.isContentEditable) return true
  return false
}
