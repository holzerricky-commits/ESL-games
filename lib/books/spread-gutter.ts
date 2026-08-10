import type { BookRecord } from '@/lib/books/types'
import { spreadGutterOverlapEnabled } from '@/lib/books/feature-flags'

/** Default spread seam overlap as a fraction of page width (matches legacy reader). */
export const DEFAULT_SPREAD_GUTTER_PULL_RATIO = 0.018

export const MIN_SPREAD_GUTTER_PULL_RATIO = 0
/** Max overlap as fraction of page width (20% — enough for badly cropped scans). */
export const MAX_SPREAD_GUTTER_PULL_RATIO = 0.2

export function clampSpreadGutterPullRatio(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SPREAD_GUTTER_PULL_RATIO
  return Math.min(MAX_SPREAD_GUTTER_PULL_RATIO, Math.max(MIN_SPREAD_GUTTER_PULL_RATIO, value))
}

/**
 * Resolved pull ratio for a unit PDF: file override → book default → global default.
 */
export function resolveSpreadGutterPullRatio(
  book: BookRecord | null | undefined,
  filePath: string | null | undefined,
): number {
  if (filePath && book?.spreadGutterByFile) {
    const fileOverride = book.spreadGutterByFile[filePath]
    if (typeof fileOverride === 'number' && Number.isFinite(fileOverride)) {
      return clampSpreadGutterPullRatio(fileOverride)
    }
  }
  if (typeof book?.spreadGutterPullRatio === 'number' && Number.isFinite(book.spreadGutterPullRatio)) {
    return clampSpreadGutterPullRatio(book.spreadGutterPullRatio)
  }
  return DEFAULT_SPREAD_GUTTER_PULL_RATIO
}

/** Pixels to pull the right page left at the spread seam (overlap only — never inset-clip page art). */
export function spreadSidePullPx(spreadPageWidthPx: number, pullRatio: number): number {
  if (!(spreadPageWidthPx > 0)) return 0
  return Math.max(0, Math.round(spreadPageWidthPx * clampSpreadGutterPullRatio(pullRatio)))
}

/**
 * Layout gutter pull — respects `spreadGutterOverlapEnabled` (0 when overlap is off).
 */
export function effectiveSpreadGutterPullPx(spreadPageWidthPx: number, pullRatio: number): number {
  if (!spreadGutterOverlapEnabled) return 0
  return spreadSidePullPx(spreadPageWidthPx, pullRatio)
}

/** Two-page cluster width: 2×page width minus one overlap pull (0 when overlap off). */
export function effectiveSpreadOverlayWidthPx(
  spreadPageWidthPx: number,
  pullRatio: number,
): number {
  const pullPx = effectiveSpreadGutterPullPx(spreadPageWidthPx, pullRatio)
  return Math.max(0, Math.round(spreadPageWidthPx * 2 - pullPx))
}

/**
 * Build manifest `spreadGutterByFile` after save: omit keys equal to book default or when override off.
 */
export function buildSpreadGutterByFileForSave(
  existing: Record<string, number> | undefined,
  sourceFilePath: string,
  bookDefaultRatio: number,
  fileOverrideEnabled: boolean,
  fileOverrideRatio: number,
): Record<string, number> | undefined {
  const next = { ...(existing ?? {}) }
  const bookDefault = clampSpreadGutterPullRatio(bookDefaultRatio)

  if (!fileOverrideEnabled) {
    delete next[sourceFilePath]
  } else {
    const clamped = clampSpreadGutterPullRatio(fileOverrideRatio)
    if (clamped === bookDefault) {
      delete next[sourceFilePath]
    } else {
      next[sourceFilePath] = clamped
    }
  }

  return Object.keys(next).length ? next : undefined
}

/**
 * Book-level ratio for manifest: omit when equal to global default.
 */
export function bookSpreadGutterPullRatioForSave(ratio: number): number | undefined {
  const clamped = clampSpreadGutterPullRatio(ratio)
  return clamped === DEFAULT_SPREAD_GUTTER_PULL_RATIO ? undefined : clamped
}
