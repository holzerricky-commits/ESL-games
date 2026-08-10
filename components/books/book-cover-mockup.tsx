'use client'

import type { CSSProperties, ReactNode } from 'react'
import {
  BOOK_COVER_MOCKUP_GUTTER_FALLOFF_PERCENT,
  bookCoverMockupGutterHighlightBackground,
  bookCoverMockupGutterShadowBackground,
} from '@/lib/books/book-cover-mockup-gutter'
import {
  BOOK_COVER_MOCKUP_REF_PAGE_HEIGHT,
  BOOK_COVER_MOCKUP_REF_PAGE_WIDTH,
} from '@/lib/books/book-cover-mockup-metrics'
import { cn } from '@/lib/utils'

export interface BookCoverMockupProps {
  /** Front-face width in px (default 240). */
  widthPx?: number
  children?: ReactNode
  className?: string
  /** Enables hover lift + deeper shadow (e.g. inside launcher button). */
  interactive?: boolean
}

export function BookCoverMockup({
  widthPx = 240,
  children,
  className,
  interactive = false,
}: BookCoverMockupProps) {
  const style = {
    '--book-mockup-width': `${widthPx}px`,
    '--book-mockup-aspect': `${BOOK_COVER_MOCKUP_REF_PAGE_WIDTH} / ${BOOK_COVER_MOCKUP_REF_PAGE_HEIGHT}`,
    '--book-mockup-gutter-falloff': `${BOOK_COVER_MOCKUP_GUTTER_FALLOFF_PERCENT}%`,
  } as CSSProperties

  return (
    <div
      className={cn(
        'book-cover-mockup',
        interactive && 'book-cover-mockup--interactive',
        className,
      )}
      style={style}
    >
      <div className="book-cover-mockup__shadow" aria-hidden />
      <div className="book-cover-mockup__perspective">
        <div className="book-cover-mockup__volume">
          <div className="book-cover-mockup__front">
            {children}
            <div className="book-cover-mockup__gutter" aria-hidden>
              <span
                className="book-cover-mockup__gutter-shadow"
                style={{ background: bookCoverMockupGutterShadowBackground() }}
              />
              <span
                className="book-cover-mockup__gutter-highlight"
                style={{ background: bookCoverMockupGutterHighlightBackground() }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
