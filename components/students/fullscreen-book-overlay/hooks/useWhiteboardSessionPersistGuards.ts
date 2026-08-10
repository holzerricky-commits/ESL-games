'use client'

import { useEffect, useRef } from 'react'

type UseWhiteboardSessionPersistGuardsOptions = {
  enabled: boolean
  checkpointWhiteboardSession: () => void
  flushWhiteboardSessionToLegacy: () => void
}

/** Checkpoint session on tab hide; checkpoint + legacy flush before unload. */
export function useWhiteboardSessionPersistGuards({
  enabled,
  checkpointWhiteboardSession,
  flushWhiteboardSessionToLegacy,
}: UseWhiteboardSessionPersistGuardsOptions): void {
  const checkpointRef = useRef(checkpointWhiteboardSession)
  const flushRef = useRef(flushWhiteboardSessionToLegacy)
  checkpointRef.current = checkpointWhiteboardSession
  flushRef.current = flushWhiteboardSessionToLegacy

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
