'use client'

import { useEffect, useState } from 'react'
import type { ScanNotice } from '@/components/books/dismissible-scan-notice'
import type { SearchablePdfProgress } from '@/lib/books/searchable-pdf-client'
import {
  dismissSearchablePdfJobNotice,
  startSearchablePdfJob,
  stopSearchablePdfJob,
  subscribeSearchablePdfJob,
} from '@/lib/books/searchable-pdf-manager'

export type StartSelectableInput = {
  bookId: string
  unitId: string
  lessonId?: string | null
  partId?: string | null
  title?: string
  totalPdfPages?: number | null
  force?: boolean
}

export function useSearchablePdfJob(storyId: string) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<SearchablePdfProgress | null>(null)
  const [lastNotice, setLastNotice] = useState<ScanNotice | null>(null)

  useEffect(() => {
    const id = storyId.trim()
    if (!id) return
    return subscribeSearchablePdfJob(id, (snap) => {
      setRunning(snap.running)
      setProgress(snap.progress)
      setLastNotice(snap.lastNotice)
    })
  }, [storyId])

  return {
    selectableRunning: running,
    selectableProgress: progress,
    selectableNotice: lastNotice,
    startSelectable: (input: StartSelectableInput) => {
      const id = storyId.trim()
      if (!id) return
      startSearchablePdfJob({ ...input, storyId: id })
    },
    stopSelectable: () => stopSearchablePdfJob(storyId),
    dismissSelectableNotice: () => dismissSearchablePdfJobNotice(storyId),
  }
}
