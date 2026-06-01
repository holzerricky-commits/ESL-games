'use client'

import { useSyncExternalStore } from 'react'

let revision = 0
let lastDpr = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1
const listeners = new Set<() => void>()

function bumpIfDprChanged() {
  if (typeof window === 'undefined') return
  const nextDpr = window.devicePixelRatio
  if (nextDpr === lastDpr) return
  lastDpr = nextDpr
  revision += 1
  for (const listener of listeners) listener()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('resize', bumpIfDprChanged)
    window.visualViewport?.addEventListener('resize', bumpIfDprChanged)
  }
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('resize', bumpIfDprChanged)
      window.visualViewport?.removeEventListener('resize', bumpIfDprChanged)
    }
  }
}

function getSnapshot() {
  return revision
}

/** Bumps when browser zoom changes devicePixelRatio (Ctrl +/-). */
export function useBrowserZoomRepaintRevision(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0)
}
