'use client'

import { useEffect, useSyncExternalStore } from 'react'
import {
  areManifestBrushPatternsReady,
  preloadAllManifestBrushPatterns,
  subscribeBrushPatternLoadState,
} from '@/lib/books/brush-pattern-loader'

function subscribe(callback: () => void): () => void {
  return subscribeBrushPatternLoadState(callback)
}

function getSnapshot(): boolean {
  return areManifestBrushPatternsReady()
}

function getServerSnapshot(): boolean {
  return true
}

/**
 * Preload manifest brush PNGs when the book reader is open.
 * `manifestTilesLoading` is true until every manifest tile is in the canvas cache.
 */
export function useBrushPatternPreload(enabled: boolean): {
  manifestTilesReady: boolean
  manifestTilesLoading: boolean
} {
  const ready = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  useEffect(() => {
    if (!enabled) return
    preloadAllManifestBrushPatterns()
  }, [enabled])

  const manifestTilesReady = !enabled || ready
  const manifestTilesLoading = enabled && !ready

  return { manifestTilesReady, manifestTilesLoading }
}
