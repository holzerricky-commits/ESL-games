'use client'

import { useEffect, useState } from 'react'
import {
  clearFinishedPasteReveals,
  getActivePasteRevealIds,
  hasActivePasteReveals,
  subscribePasteRevealChanges,
} from '@/lib/books/board-paste-reveal'
import {
  clearFinishedStampPlacementEffects,
  getActiveStampPlacementIds,
  hasActiveStampPlacementEffects,
  subscribeStampPlacementChanges,
} from '@/lib/books/stamp-placement-effect'

export type BoardPasteRevealState = {
  pasteRevealIds: ReadonlySet<string>
  pasteRevealTick: number
}

/** Keeps DOM/canvas layers in sync with active paste pop and stamp placement animations. */
export function useBoardPasteReveal(): BoardPasteRevealState {
  const [pasteRevealIds, setPasteRevealIds] = useState<ReadonlySet<string>>(() => new Set())
  const [pasteRevealTick, setPasteRevealTick] = useState(0)

  useEffect(() => {
    let rafId = 0

    const sync = () => {
      const now = Date.now()
      clearFinishedPasteReveals(now)
      clearFinishedStampPlacementEffects(now)
      const ids = new Set<string>([
        ...getActivePasteRevealIds(now),
        ...getActiveStampPlacementIds(now),
      ])
      setPasteRevealIds(ids)
      setPasteRevealTick((t) => t + 1)
    }

    const scheduleFrame = () => {
      if (!hasActivePasteReveals() && !hasActiveStampPlacementEffects()) return
      rafId = window.requestAnimationFrame(() => {
        sync()
        scheduleFrame()
      })
    }

    const onRegistryChange = () => {
      sync()
      if (hasActivePasteReveals() || hasActiveStampPlacementEffects()) scheduleFrame()
    }

    sync()
    const unsubPaste = subscribePasteRevealChanges(onRegistryChange)
    const unsubStamp = subscribeStampPlacementChanges(onRegistryChange)
    return () => {
      unsubPaste()
      unsubStamp()
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [])

  return { pasteRevealIds, pasteRevealTick }
}
