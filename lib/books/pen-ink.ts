import type { CSSProperties } from 'react'
import {
  BRUSH_PATTERN_MANIFEST,
  getBrushPatternFallbackColor,
  getBrushPatternUrl,
  isAssetBrushPattern,
} from '@/lib/books/brush-pattern-manifest'
import {
  clearBrushPatternTileCacheForTests,
  ensureBrushPatternTileLoaded,
  getCachedBrushPatternTile,
  preloadAllManifestBrushPatterns,
  preloadBrushPatterns,
} from '@/lib/books/brush-pattern-loader'

/**
 * Procedural effect inks (no PNG in manifest yet).
 * When you add `public/brush-patterns/{id}.png` + a manifest row, asset tiles take precedence automatically.
 */
export const PROCEDURAL_BRUSH_PATTERN_IDS = [
  'lava',
  'ocean',
  'rose-gold',
  'gold',
  'silver',
  'bronze',
] as const

export type ProceduralBrushPatternId = (typeof PROCEDURAL_BRUSH_PATTERN_IDS)[number]

/** Stored on strokes as `penInkStyle` — `solid` or any manifest / procedural pattern id. */
export type PenInkStyle = 'solid' | ProceduralBrushPatternId | (string & {})

/** Bump procedural art here; manifest PNG cache bust uses `manifest.json` `version`. */
const PROCEDURAL_ART_REVISION = 1
/** Combined cache key so manifest tile swaps and procedural edits both invalidate caches. */
export const PEN_INK_TILE_REVISION = `${BRUSH_PATTERN_MANIFEST.version}-p${PROCEDURAL_ART_REVISION}`
const INK_TILE_REVISION = PEN_INK_TILE_REVISION
export const PEN_INK_TILE_PX = BRUSH_PATTERN_MANIFEST.tileSizePx
const INK_TILE_PX = PEN_INK_TILE_PX
const SWATCH_TILE_PX = 48

export { preloadAllManifestBrushPatterns, preloadBrushPatterns }

export function isProceduralBrushPattern(id: string): id is ProceduralBrushPatternId {
  return (
    (PROCEDURAL_BRUSH_PATTERN_IDS as readonly string[]).includes(id) && !isAssetBrushPattern(id)
  )
}

/** Accepts `solid`, any manifest pattern id, or procedural ids not overridden by manifest. */
export function isPenInkStyle(v: unknown): v is PenInkStyle {
  if (v === 'solid') return true
  if (typeof v !== 'string' || v.length === 0) return false
  return isAssetBrushPattern(v) || isProceduralBrushPattern(v)
}

export function isEffectPenInkStyle(v: unknown): v is Exclude<PenInkStyle, 'solid'> {
  return isPenInkStyle(v) && v !== 'solid'
}

function closedStops(stops: readonly string[]): string[] {
  if (stops.length === 0) return []
  return [...stops, stops[0]!]
}

/** Horizontal gradient; left/right edges match for seamless repeat. */
function fillSeamlessHorizontal(
  t: CanvasRenderingContext2D,
  size: number,
  stops: readonly string[],
): void {
  const g = t.createLinearGradient(0, 0, size, 0)
  const loop = closedStops(stops)
  for (let i = 0; i < loop.length; i++) {
    g.addColorStop(i / (loop.length - 1), loop[i]!)
  }
  t.fillStyle = g
  t.fillRect(0, 0, size, size)
}

/** Vertical gradient overlay; top/bottom edges match for seamless repeat. */
function overlaySeamlessVertical(
  t: CanvasRenderingContext2D,
  size: number,
  stops: readonly string[],
  alpha: number,
  composite: GlobalCompositeOperation = 'source-over',
): void {
  t.save()
  t.globalAlpha = alpha
  t.globalCompositeOperation = composite
  const g = t.createLinearGradient(0, 0, 0, size)
  const loop = closedStops(stops)
  for (let i = 0; i < loop.length; i++) {
    g.addColorStop(i / (loop.length - 1), loop[i]!)
  }
  t.fillStyle = g
  t.fillRect(0, 0, size, size)
  t.restore()
}

/** Diagonal highlight bands where (x+y) wraps — tiles seamlessly in 2D. */
function overlayDiagonalSheen(
  t: CanvasRenderingContext2D,
  size: number,
  period: number,
  strength = 48,
): void {
  const img = t.createImageData(size, size)
  const d = img.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const phase = (x + y) % period
      const a = phase < 1.25 ? strength : 0
      const i = (y * size + x) * 4
      d[i] = 255
      d[i + 1] = 255
      d[i + 2] = 255
      d[i + 3] = a
    }
  }
  t.save()
  t.globalCompositeOperation = 'overlay'
  t.putImageData(img, 0, 0)
  t.restore()
}

function paintMetallicTile(
  t: CanvasRenderingContext2D,
  size: number,
  stops: readonly string[],
): void {
  fillSeamlessHorizontal(t, size, stops)
  overlayDiagonalSheen(t, size, 8, 42)
}

function paintProceduralInkTile(tile: HTMLCanvasElement, patternId: ProceduralBrushPatternId): void {
  const s = INK_TILE_PX
  tile.width = s
  tile.height = s
  const t = tile.getContext('2d')
  if (!t) return

  t.clearRect(0, 0, s, s)
  t.imageSmoothingEnabled = true

  switch (patternId) {
    case 'lava':
      fillSeamlessHorizontal(t, s, ['#1c1917', '#7f1d1d', '#dc2626', '#f97316', '#7f1d1d'])
      overlaySeamlessVertical(t, s, ['#1c1917', '#ef4444', '#1c1917'], 0.4, 'screen')
      break
    case 'ocean':
      fillSeamlessHorizontal(t, s, ['#042f2e', '#0d9488', '#0c4a6e', '#164e63'])
      overlaySeamlessVertical(t, s, ['#042f2e', '#06b6d4', '#042f2e'], 0.35, 'screen')
      break
    case 'rose-gold':
      paintMetallicTile(t, s, ['#9f7a5a', '#f5d0c5', '#e8b4a0', '#b76e79'])
      break
    case 'gold':
      paintMetallicTile(t, s, ['#a16207', '#fde047', '#fef9c3', '#ca8a04'])
      break
    case 'silver':
      paintMetallicTile(t, s, ['#64748b', '#f1f5f9', '#cbd5e1', '#475569'])
      break
    case 'bronze':
      paintMetallicTile(t, s, ['#78350f', '#f59e0b', '#fcd34d', '#92400e'])
      break
    default:
      break
  }
}

const proceduralTileCache = new Map<string, HTMLCanvasElement>()

function proceduralTileCacheKey(patternId: ProceduralBrushPatternId): string {
  return `${patternId}:r${INK_TILE_REVISION}`
}

function getProceduralInkTile(patternId: ProceduralBrushPatternId): HTMLCanvasElement {
  const key = proceduralTileCacheKey(patternId)
  let tile = proceduralTileCache.get(key)
  if (!tile) {
    tile = document.createElement('canvas')
    paintProceduralInkTile(tile, patternId)
    proceduralTileCache.set(key, tile)
  }
  return tile
}

function resolveInkTile(inkStyle: PenInkStyle): HTMLCanvasElement | null {
  if (inkStyle === 'solid') return null
  if (isAssetBrushPattern(inkStyle)) {
    const assetTile = getCachedBrushPatternTile(inkStyle)
    if (assetTile) return assetTile
    ensureBrushPatternTileLoaded(inkStyle)
    return null
  }
  if (isProceduralBrushPattern(inkStyle)) {
    return getProceduralInkTile(inkStyle)
  }
  return null
}

function applyPatternTransform(pattern: CanvasPattern, ox: number, oy: number): void {
  if (ox === 0 && oy === 0) return
  try {
    if (typeof pattern.setTransform === 'function') {
      pattern.setTransform(new DOMMatrix().translate(-ox, -oy))
    }
  } catch {
    /* unsupported */
  }
}

/** Page-space origin for pattern sampling (spread overlay uses 0,0). */
export type PenInkPatternOrigin = {
  x?: number
  y?: number
}

export type PenInkPatternPhase = {
  penInkPatternPhaseX?: number
  penInkPatternPhaseY?: number
}

/** Random shift within one tile so each new stroke gets different effect colors. */
export function newPenInkPatternPhase(): { x: number; y: number } {
  return {
    x: Math.random() * PEN_INK_TILE_PX,
    y: Math.random() * PEN_INK_TILE_PX,
  }
}

export function attachPenInkPatternPhase(
  cmd: PenInkPatternPhase,
  inkStyle: PenInkStyle | undefined,
): void {
  if (!inkStyle || inkStyle === 'solid') return
  const phase = newPenInkPatternPhase()
  cmd.penInkPatternPhaseX = phase.x
  cmd.penInkPatternPhaseY = phase.y
}

/** Page alignment (spread vs page canvas) plus per-stroke phase. */
export function resolvePenInkPatternOrigin(
  pageOrigin?: PenInkPatternOrigin,
  stroke?: PenInkPatternPhase,
): PenInkPatternOrigin | undefined {
  const x = (pageOrigin?.x ?? 0) + (stroke?.penInkPatternPhaseX ?? 0)
  const y = (pageOrigin?.y ?? 0) + (stroke?.penInkPatternPhaseY ?? 0)
  if (x === 0 && y === 0) return undefined
  return { x, y }
}

/**
 * Set `ctx.strokeStyle` for pen ink.
 * Effect inks use a page-space repeating pattern (OneNote-style): uniform along a stroke,
 * different phase when you start drawing elsewhere on the page.
 */
export function applyPenStrokeStyle(
  ctx: CanvasRenderingContext2D,
  inkStyle: PenInkStyle | undefined,
  color: string,
  patternOrigin?: PenInkPatternOrigin,
): void {
  if (!inkStyle || inkStyle === 'solid') {
    ctx.strokeStyle = color
    return
  }

  const fallback = getBrushPatternFallbackColor(inkStyle) ?? color
  const tile = resolveInkTile(inkStyle)
  if (!tile) {
    ctx.strokeStyle = fallback
    return
  }

  const pattern = ctx.createPattern(tile, 'repeat')
  if (pattern) {
    const ox = patternOrigin?.x ?? 0
    const oy = patternOrigin?.y ?? 0
    applyPatternTransform(pattern, ox, oy)
    ctx.strokeStyle = pattern
    return
  }

  ctx.strokeStyle = fallback
}

const METALLIC_BRUSH_CSS =
  'repeating-linear-gradient(90deg, rgba(255,255,255,0.28) 0px, rgba(255,255,255,0.28) 1px, transparent 1px, transparent 8px)'

const repeatSwatch = (backgroundImage: string, backgroundColor?: string): CSSProperties => ({
  ...(backgroundColor ? { backgroundColor } : {}),
  backgroundImage,
  backgroundRepeat: 'repeat',
  backgroundSize: `${SWATCH_TILE_PX}px ${SWATCH_TILE_PX}px`,
})

const PROCEDURAL_SWATCH_CSS: Record<ProceduralBrushPatternId, () => CSSProperties> = {
  lava: () =>
    repeatSwatch(
      'linear-gradient(90deg, #1c1917 0%, #7f1d1d 25%, #dc2626 50%, #f97316 75%, #7f1d1d 100%)',
    ),
  ocean: () =>
    repeatSwatch(
      'linear-gradient(90deg, #042f2e 0%, #0d9488 35%, #0c4a6e 65%, #164e63 100%)',
    ),
  'rose-gold': () =>
    repeatSwatch(
      `${METALLIC_BRUSH_CSS}, linear-gradient(90deg, #9f7a5a 0%, #f5d0c5 35%, #e8b4a0 65%, #b76e79 100%)`,
    ),
  gold: () =>
    repeatSwatch(
      `${METALLIC_BRUSH_CSS}, linear-gradient(90deg, #a16207 0%, #fde047 35%, #fef9c3 65%, #ca8a04 100%)`,
    ),
  silver: () =>
    repeatSwatch(
      `${METALLIC_BRUSH_CSS}, linear-gradient(90deg, #64748b 0%, #f1f5f9 35%, #cbd5e1 65%, #475569 100%)`,
    ),
  bronze: () =>
    repeatSwatch(
      `${METALLIC_BRUSH_CSS}, linear-gradient(90deg, #78350f 0%, #f59e0b 35%, #fcd34d 65%, #92400e 100%)`,
    ),
}

/** Swatch tile background (matches repeating ink tiles). */
export function penSwatchPreviewStyle(inkStyle: PenInkStyle, color: string): CSSProperties {
  if (inkStyle === 'solid') {
    return { backgroundColor: color }
  }

  const assetUrl = getBrushPatternUrl(inkStyle)
  if (assetUrl) {
    return repeatSwatch(`url(${assetUrl})`)
  }

  if (isProceduralBrushPattern(inkStyle)) {
    return PROCEDURAL_SWATCH_CSS[inkStyle]()
  }

  return { backgroundColor: color }
}

/** @internal Test hook: clear cached tiles/patterns between tests. */
export function clearPenInkPatternCacheForTests(): void {
  proceduralTileCache.clear()
  clearBrushPatternTileCacheForTests()
}
