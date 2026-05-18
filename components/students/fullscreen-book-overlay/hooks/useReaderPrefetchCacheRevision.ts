'use client'

import { useEffect, useState } from 'react'
import { subscribeReaderPrefetchCache } from '@/lib/books/reader-page-prefetch-queue'

/** Bumps when the reader prefetch LRU gains or loses entries (Phase C3 paint path). */
export function useReaderPrefetchCacheRevision(): number {
  const [revision, setRevision] = useState(0)
  useEffect(() => subscribeReaderPrefetchCache(() => setRevision((n) => n + 1)), [])
  return revision
}
