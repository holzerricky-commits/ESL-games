'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { WritableTextGlossReviewRequest } from './hooks/useWritableTextTranslateSelection'

const WritableTextGlossReviewContext = createContext<
  ((request: WritableTextGlossReviewRequest) => void) | null
>(null)

export function WritableTextGlossReviewProvider({
  openReview,
  children,
}: {
  openReview: (request: WritableTextGlossReviewRequest) => void
  children: ReactNode
}) {
  return (
    <WritableTextGlossReviewContext.Provider value={openReview}>
      {children}
    </WritableTextGlossReviewContext.Provider>
  )
}

export function useWritableTextGlossReview() {
  return useContext(WritableTextGlossReviewContext)
}
