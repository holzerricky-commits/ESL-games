'use client'

import { useEffect, useState } from 'react'
import type { SearchablePdfProgress } from '@/lib/books/searchable-pdf-client'
import {
  startSearchablePdfJob,
  stopSearchablePdfJob,
  subscribeSearchablePdfJob,
} from '@/lib/books/searchable-pdf-manager'

export function useSearchablePdfJob(storyId: string) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<SearchablePdfProgress | null>(null)

  useEffect(() => {
    const id = storyId.trim()
    if (!id) return
    return subscribeSearchablePdfJob(id, (snap) => {
      setRunning(snap.running)
      setProgress(snap.progress)
    })
  }, [storyId])

  return {
    selectableRunning: running,
    selectableProgress: progress,
    startSelectable: (input: {
      bookId: string
      unitId: string
      lessonId?: string | null
      partId?: string | null
      title?: string
      totalPdfPages?: number | null
    }) => {
      const id = storyId.trim()
      if (!id) return
      startSearchablePdfJob({ ...input, storyId: id })
    },
    stopSelectable: () => stopSearchablePdfJob(storyId),
  }
}
