'use client'

import { forwardRef } from 'react'
import { BookPageAnnotationLayerView } from '@/components/students/book-page-annotation-layer/BookPageAnnotationLayerView'
import { useBookPageAnnotationLayer } from '@/components/students/book-page-annotation-layer/hooks/useBookPageAnnotationLayer'
import type {
  BookPageAnnotationHandle,
  BookPageAnnotationLayerProps,
} from '@/components/students/book-page-annotation-layer/types'

export const BookPageAnnotationLayer = forwardRef<
  BookPageAnnotationHandle,
  BookPageAnnotationLayerProps
>(function BookPageAnnotationLayer(props, ref) {
  const viewProps = useBookPageAnnotationLayer(props, ref)
  if (!viewProps) return null
  return <BookPageAnnotationLayerView {...viewProps} />
})

BookPageAnnotationLayer.displayName = 'BookPageAnnotationLayer'
