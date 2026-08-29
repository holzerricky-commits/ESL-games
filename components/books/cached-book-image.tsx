'use client'

import { useCachedBookImage } from '@/components/books/use-cached-book-image'
import { cn } from '@/lib/utils'

export interface CachedBookImageProps {
  src: string
  alt?: string
  className?: string
  draggable?: boolean
}

/** Book cover / thumb picture that remembers the file locally after the first load. */
export function CachedBookImage({
  src,
  alt = '',
  className,
  draggable = false,
}: CachedBookImageProps) {
  const { displaySrc, phase } = useCachedBookImage(src, true)
  const showSrc = displaySrc ?? (phase === 'ready' ? src : null)

  if (!showSrc) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local book-library images
    <img src={showSrc} alt={alt} className={cn(className)} draggable={draggable} />
  )
}
