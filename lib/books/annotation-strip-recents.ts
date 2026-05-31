import {
  ANNOTATION_MARKER_SWATCHES,
  ANNOTATION_PEN_SWATCHES,
  ANNOTATION_STICKY_FILL_SWATCHES,
  ANNOTATION_TEXT_STROKE_SWATCHES,
  isKnownPenSwatchId,
  migratePenSwatchId,
} from '@/lib/books/annotation-palettes'

export type StripRecentKind = 'pen' | 'marker' | 'shape' | 'text' | 'sticky'

const STORAGE_KEYS: Record<StripRecentKind, string> = {
  pen: 'esl-strip-recents-pen',
  marker: 'esl-strip-recents-marker',
  shape: 'esl-strip-recents-shape',
  text: 'esl-strip-recents-text',
  sticky: 'esl-strip-recents-sticky',
}

const RECENTS_CHANGED_EVENT = 'esl-strip-recents-changed'
const MAX_RECENTS = 4

const DEFAULT_PEN_RECENTS = ANNOTATION_PEN_SWATCHES.filter((s) => s.patternId === 'solid')
  .slice(0, MAX_RECENTS)
  .map((s) => s.id)

const DEFAULT_MARKER_RECENTS = ANNOTATION_MARKER_SWATCHES.slice(0, MAX_RECENTS)

const DEFAULT_SHAPE_RECENTS = DEFAULT_PEN_RECENTS
const DEFAULT_TEXT_RECENTS = ANNOTATION_TEXT_STROKE_SWATCHES.slice(0, MAX_RECENTS)
const DEFAULT_STICKY_RECENTS = ANNOTATION_STICKY_FILL_SWATCHES.slice(0, MAX_RECENTS)

function defaultsFor(kind: StripRecentKind): readonly string[] {
  if (kind === 'marker') return DEFAULT_MARKER_RECENTS
  if (kind === 'shape') return DEFAULT_SHAPE_RECENTS
  if (kind === 'text') return DEFAULT_TEXT_RECENTS
  if (kind === 'sticky') return DEFAULT_STICKY_RECENTS
  return DEFAULT_PEN_RECENTS
}

function parseStoredList(raw: string | null, kind: StripRecentKind): string[] {
  if (!raw) return [...defaultsFor(kind)]
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...defaultsFor(kind)]
    const strings = parsed.filter((x): x is string => typeof x === 'string')
    return strings.length > 0 ? strings.slice(0, MAX_RECENTS) : [...defaultsFor(kind)]
  } catch {
    return [...defaultsFor(kind)]
  }
}

export function readStripRecents(kind: StripRecentKind): string[] {
  if (typeof window === 'undefined') return [...defaultsFor(kind)]
  try {
    return parseStoredList(window.sessionStorage.getItem(STORAGE_KEYS[kind]), kind)
  } catch {
    return [...defaultsFor(kind)]
  }
}

export function pushStripRecent(kind: StripRecentKind, value: string) {
  if (typeof window === 'undefined') return
  const hexKind = kind === 'marker' || kind === 'text' || kind === 'sticky'
  const norm = hexKind ? value.toLowerCase() : value
  const cur = readStripRecents(kind).filter((v) =>
    hexKind ? v.toLowerCase() !== norm : v !== norm,
  )
  const next = [value, ...cur].slice(0, MAX_RECENTS)
  try {
    window.sessionStorage.setItem(STORAGE_KEYS[kind], JSON.stringify(next))
    window.dispatchEvent(new Event(RECENTS_CHANGED_EVENT))
  } catch {
    /* quota / private mode */
  }
}

export function subscribeStripRecents(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => onStoreChange()
  window.addEventListener(RECENTS_CHANGED_EVENT, handler)
  return () => window.removeEventListener(RECENTS_CHANGED_EVENT, handler)
}

/** Stable primitive for useSyncExternalStore — avoids new array refs each snapshot. */
export function getStripRecentsSyncSnapshot(kind: StripRecentKind): string {
  if (typeof window === 'undefined') return `default:${kind}`
  try {
    return window.sessionStorage.getItem(STORAGE_KEYS[kind]) ?? `default:${kind}`
  } catch {
    return `default:${kind}`
  }
}

/** Recents for display: up to 4, excluding the active value. */
export function stripRecentsForDisplay(kind: StripRecentKind, active: string): string[] {
  const list = readStripRecents(kind)
  const hexKind = kind === 'marker' || kind === 'text' || kind === 'sticky'
  const isSame = (a: string, b: string) => (hexKind ? a.toLowerCase() === b.toLowerCase() : a === b)
  return list.filter((v) => !isSame(v, active)).slice(0, MAX_RECENTS)
}

export function isValidPenSwatchId(id: string): boolean {
  return isKnownPenSwatchId(id)
}

export function normalizePenRecentId(id: string): string {
  return migratePenSwatchId(id)
}
