'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  fetchSearchablePdfPlan,
  type SearchablePdfRangeStatus,
} from '@/lib/books/searchable-pdf-client'
import { SEARCHABLE_PDF_UPDATED_EVENT } from '@/lib/books/searchable-pdf-events'

export type UseSearchablePdfStatusInput = {
  bookId: string
  unitId: string
  storyId: string
  lessonId?: string | null
  partId?: string | null
  title?: string
  totalPdfPages?: number | null
  /** When false, skip fetching (e.g. pages not set yet). */
  enabled?: boolean
  /** Bump after a successful stamp/redo to refresh. */
  refreshKey?: number
}

export function useSearchablePdfStatus(input: UseSearchablePdfStatusInput) {
  const [status, setStatus] = useState<SearchablePdfRangeStatus>('unknown')
  const [loading, setLoading] = useState(false)
  const [filePath, setFilePath] = useState<string | null>(null)

  const refresh = useCallback(() => {
    const storyId = input.storyId.trim()
    if (!storyId || input.enabled === false) {
      setStatus('unknown')
      setFilePath(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchSearchablePdfPlan({
      bookId: input.bookId,
      unitId: input.unitId,
      storyId,
      lessonId: input.lessonId,
      partId: input.partId,
      title: input.title,
      totalPdfPages: input.totalPdfPages,
    })
      .then((plan) => {
        if (cancelled) return
        setStatus(plan.status)
        setFilePath(plan.filePath)
      })
      .catch(() => {
        if (!cancelled) setStatus('unknown')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    input.bookId,
    input.unitId,
    input.storyId,
    input.lessonId,
    input.partId,
    input.title,
    input.totalPdfPages,
    input.enabled,
    input.refreshKey,
  ])

  useEffect(() => {
    const cleanup = refresh()
    return () => {
      cleanup?.()
    }
  }, [refresh])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ filePath?: string }>).detail
      const updated = detail?.filePath?.trim()
      if (!updated) return
      if (filePath && updated !== filePath) return
      refresh()
    }
    window.addEventListener(SEARCHABLE_PDF_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(SEARCHABLE_PDF_UPDATED_EVENT, onUpdated)
  }, [filePath, refresh])

  return { status, loading, filePath, refresh }
}
