'use client'

import { useSyncExternalStore } from 'react'
import {
  getReaderPrefetchCacheRevisionSnapshot,
  subscribeReaderPrefetchCache,
} from '@/lib/books/reader-page-prefetch-queue'

/** Bumps when the reader prefetch LRU gains or loses entries (Phase C3 paint path). */
export function useReaderPrefetchCacheRevision(): number {
  return useSyncExternalStore(
    subscribeReaderPrefetchCache,
    getReaderPrefetchCacheRevisionSnapshot,
    () => 0,
  )
}
