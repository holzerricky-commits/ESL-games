import {

  BRUSH_PATTERN_MANIFEST,

  getBrushPattern,

  getBrushPatternUrl,

  isAssetBrushPattern,

  listManifestBrushPatternIds,

} from '@/lib/books/brush-pattern-manifest'



const tileCache = new Map<string, HTMLCanvasElement>()

const loadPromises = new Map<string, Promise<HTMLCanvasElement | null>>()

const tileLoadListeners = new Set<() => void>()

const loadStateListeners = new Set<() => void>()



function tileCacheKey(id: string): string {

  return `${id}:v${BRUSH_PATTERN_MANIFEST.version}`

}



function notifyTileLoaded(): void {

  for (const cb of tileLoadListeners) {

    try {

      cb()

    } catch {

      /* listener */

    }

  }

  notifyLoadState()

}



function notifyLoadState(): void {

  for (const cb of loadStateListeners) {

    try {

      cb()

    } catch {

      /* listener */

    }

  }

}



/** Repaint annotation canvases when an asset tile finishes loading. */

export function subscribeBrushPatternTileLoads(listener: () => void): () => void {

  tileLoadListeners.add(listener)

  return () => tileLoadListeners.delete(listener)

}



/** React hook: manifest preload progress (all manifest PNGs cached). */

export function subscribeBrushPatternLoadState(listener: () => void): () => void {

  loadStateListeners.add(listener)

  return () => loadStateListeners.delete(listener)

}



function imageToTile(img: HTMLImageElement, sizePx: number): HTMLCanvasElement {

  const canvas = document.createElement('canvas')

  canvas.width = sizePx

  canvas.height = sizePx

  const ctx = canvas.getContext('2d')

  if (!ctx) return canvas

  ctx.imageSmoothingEnabled = true

  ctx.drawImage(img, 0, 0, sizePx, sizePx)

  return canvas

}



function loadImage(url: string): Promise<HTMLImageElement> {

  return new Promise((resolve, reject) => {

    const img = new Image()

    img.decoding = 'async'

    img.onload = () => resolve(img)

    img.onerror = () => reject(new Error(`Failed to load brush pattern: ${url}`))

    img.src = url

  })

}



/**

 * Load one manifest pattern tile (cached). Returns null on failure.

 * Safe to call in browser only.

 */

export async function loadBrushPatternTile(id: string): Promise<HTMLCanvasElement | null> {

  if (typeof document === 'undefined') return null

  if (!isAssetBrushPattern(id)) return null



  const key = tileCacheKey(id)

  const cached = tileCache.get(key)

  if (cached) return cached



  const inflight = loadPromises.get(key)

  if (inflight) return inflight



  const url = getBrushPatternUrl(id)

  if (!url) return null



  const promise = (async () => {

    try {

      const img = await loadImage(url)

      const sizePx = BRUSH_PATTERN_MANIFEST.tileSizePx

      const tile = imageToTile(img, sizePx)

      tileCache.set(key, tile)

      notifyTileLoaded()

      return tile

    } catch {

      return null

    } finally {

      loadPromises.delete(key)

    }

  })()



  loadPromises.set(key, promise)

  notifyLoadState()

  return promise

}



/** Synchronous tile access when preload/load has completed. */

export function getCachedBrushPatternTile(id: string): HTMLCanvasElement | null {

  if (!isAssetBrushPattern(id)) return null

  return tileCache.get(tileCacheKey(id)) ?? null

}



export function isBrushPatternTileReady(id: string): boolean {

  if (!isAssetBrushPattern(id)) return true

  return getCachedBrushPatternTile(id) != null

}



export function areManifestBrushPatternsReady(): boolean {

  if (typeof document === 'undefined') return true

  const ids = listManifestBrushPatternIds()

  if (ids.length === 0) return true

  return ids.every((id) => isBrushPatternTileReady(id))

}



/** Start loading if needed; does not block. */

export function ensureBrushPatternTileLoaded(id: string): void {

  if (!isAssetBrushPattern(id)) return

  if (getCachedBrushPatternTile(id)) return

  void loadBrushPatternTile(id)

}



export function preloadBrushPatterns(ids: readonly string[]): void {

  if (typeof document === 'undefined') return

  for (const id of ids) {

    ensureBrushPatternTileLoaded(id)

  }

}



/** Preload every pattern listed in `manifest.json` (call when fullscreen book opens). */

export function preloadAllManifestBrushPatterns(): void {

  preloadBrushPatterns(listManifestBrushPatternIds())

}



export async function waitForManifestBrushPatterns(): Promise<void> {

  if (typeof document === 'undefined') return

  await Promise.all(listManifestBrushPatternIds().map((id) => loadBrushPatternTile(id)))

}



/** @internal Test hook */

export function clearBrushPatternTileCacheForTests(): void {

  tileCache.clear()

  loadPromises.clear()

  tileLoadListeners.clear()

  loadStateListeners.clear()

}


