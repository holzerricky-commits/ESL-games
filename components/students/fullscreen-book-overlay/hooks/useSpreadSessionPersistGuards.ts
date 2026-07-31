'use client'

import { useEffect, useRef } from 'react'

type UseSpreadSessionPersistGuardsOptions = {
  enabled: boolean
  /** Spread-only checkpoint (`bookSpreadSessionV1`). */
  checkpointSpreadSession: () => void
  /** Project spread ink to per-page storage (milestones: close, unload). */
  flushSpreadSessionToPages: () => void
}

/**
 * Phase 3 — checkpoint + page flush when the tab may be discarded.
 */
export function useSpreadSessionPersistGuards({
  enabled,
  checkpointSpreadSession,
  flushSpreadSessionToPages,
}: UseSpreadSessionPersistGuardsOptions): void {
  const checkpointRef = useRef(checkpointSpreadSession)
  const flushRef = useRef(flushSpreadSessionToPages)
  checkpointRef.current = checkpointSpreadSession
  flushRef.current = flushSpreadSessionToPages

  useEffect(() => {
    if (!enabled) return

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        checkpointRef.current()
        flushRef.current()
      }
    }

    const onBeforeUnload = () => {
      checkpointRef.current()
      flushRef.current()
    }

    const onPageHide = () => {
      checkpointRef.current()
      flushRef.current()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [enabled])
}
