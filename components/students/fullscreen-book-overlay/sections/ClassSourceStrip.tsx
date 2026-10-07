'use client'

import { useEffect, useState } from 'react'
import { Presentation } from 'lucide-react'
import { BOOK_BOTTOM_CHROME_HEIGHT } from '@/components/students/fullscreen-book-overlay/constants'
import {
  formatClassSourcePageLabel,
  resolveClassSourceNotebookPresence,
  resolveClassSourceStripSelection,
  type ClassSourceBookChip,
} from '@/lib/books/class-source-strip'
import { cn } from '@/lib/utils'

interface ClassSourceStripProps {
  books: readonly ClassSourceBookChip[]
  focusedBookId: string | null
  notebookDocked: boolean
  notebookFocus?: boolean
  /** Focus-zoom boxing — strip ignores pointers so the box can cross the top. */
  ignorePointer?: boolean
  onSelectBook: (bookId: string, unitId: string) => void
  onToggleNotebook: () => void
}

const chipClass =
  'inline-flex h-7 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/35'

/** While a stroke starts on the page, don't let it land on source chips. */
function useIgnoreStripDuringPagePointer() {
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    function onDown(event: PointerEvent) {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const target = event.target
      if (target instanceof Element && target.closest('[data-class-source-strip]')) return
      setLocked(true)
    }
    function onUp() {
      setLocked(false)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onUp, true)
    window.addEventListener('blur', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onUp, true)
      window.removeEventListener('blur', onUp)
    }
  }, [])

  return locked
}

export function ClassSourceStrip({
  books,
  focusedBookId,
  notebookDocked,
  notebookFocus = false,
  ignorePointer = false,
  onSelectBook,
  onToggleNotebook,
}: ClassSourceStripProps) {
  const strokeLocksStrip = useIgnoreStripDuringPagePointer()
  if (books.length === 0) return null

  const selection = resolveClassSourceStripSelection({
    focusedBookId,
    notebookFocus,
  })
  const notebookPresence = resolveClassSourceNotebookPresence({
    notebookFocus,
    notebookOnDesk: notebookDocked,
  })
  const notebookLabel = notebookPresence === 'tab' ? 'Park notebook' : 'Open notebook tab'
  const pointerLocked = ignorePointer || strokeLocksStrip

  return (
    <div
      data-class-source-strip=""
      className={cn(
        'flex w-full items-center gap-1 bg-black/35 px-2',
        pointerLocked ? 'pointer-events-none' : 'pointer-events-auto',
      )}
      style={{ height: BOOK_BOTTOM_CHROME_HEIGHT }}
      role="tablist"
      aria-label="Class sources"
      inert={pointerLocked ? true : undefined}
    >
      {books.map((book) => {
        const selected = selection.focusedBookId === book.bookId
        const pageLabel = formatClassSourcePageLabel(book.page)
        return (
          <button
            key={book.bookId}
            type="button"
            role="tab"
            aria-selected={selected}
            title={book.bookTitle}
            onClick={() => onSelectBook(book.bookId, book.unitId)}
            className={cn(
              chipClass,
              selected
                ? 'bg-white/16 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white',
            )}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: book.accentColor }}
              aria-hidden
            />
            <span className="truncate">{book.displayLabel}</span>
            {pageLabel ? (
              <span className={cn('shrink-0 tabular-nums', selected ? 'text-white/70' : 'text-white/45')}>
                {pageLabel}
              </span>
            ) : null}
          </button>
        )
      })}
      <button
        type="button"
        role="tab"
        aria-selected={notebookPresence === 'tab'}
        aria-label={notebookLabel}
        title={notebookLabel}
        onClick={onToggleNotebook}
        className={cn(
          chipClass,
          notebookPresence === 'tab'
            ? 'bg-white/24 text-white ring-1 ring-white/40'
            : notebookPresence === 'present'
              ? 'bg-white/10 text-white/90'
              : 'text-white/70 hover:bg-white/10 hover:text-white',
        )}
      >
        <Presentation className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        <span className="truncate">Notebook</span>
      </button>
    </div>
  )
}
