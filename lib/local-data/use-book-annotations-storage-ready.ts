'use client'

import { useEffect, useState } from 'react'
import {
  BOOK_ANNOTATIONS_HYDRATED_EVENT,
  ensureBookAnnotationsHydrated,
  isBookAnnotationsDiskActive,
} from '@/lib/local-data/book-annotations-disk-client'

/**
 * True once disk annotations are the source of truth (or hydrate failed and
 * browser storage is the fallback). Epoch bumps on hydrate so open readers reload.
 */
export function useBookAnnotationsStorageReady(): {
  annotationsStorageReady: boolean
  annotationsStorageEpoch: number
} {
  const [annotationsStorageReady, setAnnotationsStorageReady] = useState(() =>
    typeof window === 'undefined' ? false : isBookAnnotationsDiskActive(),
  )
  const [annotationsStorageEpoch, setAnnotationsStorageEpoch] = useState(0)

  useEffect(() => {
    let cancelled = false

    const markReady = () => {
      if (cancelled) return
      setAnnotationsStorageReady(true)
      setAnnotationsStorageEpoch((n) => n + 1)
    }

    if (isBookAnnotationsDiskActive()) {
      setAnnotationsStorageReady(true)
    } else {
      void ensureBookAnnotationsHydrated().then((ok) => {
        if (cancelled || ok) return
        markReady()
      })
    }

    window.addEventListener(BOOK_ANNOTATIONS_HYDRATED_EVENT, markReady)
    return () => {
      cancelled = true
      window.removeEventListener(BOOK_ANNOTATIONS_HYDRATED_EVENT, markReady)
    }
  }, [])

  return { annotationsStorageReady, annotationsStorageEpoch }
}
