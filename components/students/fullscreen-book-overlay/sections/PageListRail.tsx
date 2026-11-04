'use client'

import { X } from 'lucide-react'
import { BookPageListToc } from '@/components/students/fullscreen-book-overlay/sections/BookPageListToc'
import type { MutableRefObject } from 'react'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { Button } from '@/components/ui/button'
import { bookHasLessonOutline } from '@/lib/books/book-outline-tree'
import { mapPdfPageToDisplayLabel, type PageNumberingMode } from '@/lib/books/page-numbering'
import { PDF_THUMB_WIDTH } from '@/lib/books/pdf-thumbnail-cache'
import {
  BOOK_PAGE_LIST_RAIL_WIDTH_PX,
  BOOK_WORKSPACE_LEFT_BAR_WIDTH,
  BOOK_WORKSPACE_RAIL_MOTION_TW,
} from '@/components/students/fullscreen-book-overlay/constants'
import type { BookLibraryPayload } from '@/lib/books/types'
import { cn } from '@/lib/utils'

interface PageListRailProps {
  hasResolvedUnit: boolean
  numPages: number | null
  isPageListOpen: boolean
  selectedUnitTitle?: string
  pageListNumbers: number[]
  pageNumber: number
  showSpreadRightPage: boolean
  spreadRightPage: number | null
  unitThumbFileUrl: string
  selectedUnitId: string
  pageListScrollRoot: HTMLDivElement | null
  setPageListScrollRoot: (el: HTMLDivElement | null) => void
  pdfReady: boolean
  selectedBook: BookLibraryPayload['books'][number] | null
  selectedUnit: NonNullable<BookLibraryPayload['books'][number]['units']>[number] | null
  numberingMode: PageNumberingMode
  activePageRowRef: MutableRefObject<HTMLButtonElement | null>
  goToPage: (page: number) => void
  /** TOC jump: unit id + mapped/printed start page. */
  onJumpToUnitPage?: (unitId: string, mappedPage: number) => void
  setIsPageListOpen: (open: boolean) => void
}

/** Book Contents rail (L). Notebook pages live inside the notebook panel. */
export function PageListRail({
  hasResolvedUnit,
  numPages,
  isPageListOpen,
  selectedUnitTitle,
  pageListNumbers,
  pageNumber,
  showSpreadRightPage,
  spreadRightPage,
  unitThumbFileUrl,
  selectedUnitId,
  pageListScrollRoot,
  setPageListScrollRoot,
  pdfReady,
  selectedBook,
  selectedUnit,
  numberingMode,
  activePageRowRef,
  goToPage,
  onJumpToUnitPage,
  setIsPageListOpen,
}: PageListRailProps) {
  const showBookToc = bookHasLessonOutline(selectedBook) && onJumpToUnitPage != null

  if (!hasResolvedUnit || numPages == null) return null

  return (
    <div
      className={cn(
        'absolute inset-y-0 z-50 flex min-h-0 flex-col overflow-hidden border-r border-white/10 bg-[#2a2a2e] text-[#a1a1aa] shadow-[4px_0_16px_rgba(0,0,0,0.35)] transition-transform',
        BOOK_WORKSPACE_RAIL_MOTION_TW,
        isPageListOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none',
      )}
      style={{
        left: BOOK_WORKSPACE_LEFT_BAR_WIDTH,
        width: `min(${BOOK_PAGE_LIST_RAIL_WIDTH_PX}px, calc(100vw - ${BOOK_WORKSPACE_LEFT_BAR_WIDTH} - 12px))`,
      }}
      aria-hidden={!isPageListOpen}
    >
      <header className="flex shrink-0 flex-col gap-2 border-b border-white/10 px-3 py-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <p className="min-w-0 truncate text-[13px] font-semibold leading-tight text-white/90">
            {showBookToc
              ? selectedBook?.title?.trim() || 'Contents'
              : selectedUnitTitle}
          </p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-md border-white/15 bg-white/5 p-0 text-[#a1a1aa] hover:bg-white/10 hover:text-white"
            onClick={() => setIsPageListOpen(false)}
            aria-label="Close page list"
          >
            <X size={14} />
          </Button>
        </div>
      </header>
      <div
        id="book-page-list"
        ref={setPageListScrollRoot}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role={showBookToc ? undefined : 'list'}
      >
        {showBookToc && selectedBook && onJumpToUnitPage ? (
          <BookPageListToc
            book={selectedBook}
            selectedUnitId={selectedUnitId}
            pageNumber={pageNumber}
            numPages={numPages}
            numberingMode={numberingMode}
            onJumpToUnitPage={onJumpToUnitPage}
            pdfReady={pdfReady}
            scrollRoot={pageListScrollRoot}
          />
        ) : (
          pageListNumbers.map((p) => {
            const rowActive =
              p === pageNumber || (showSpreadRightPage && p === spreadRightPage)
            const pageLabel = mapPdfPageToDisplayLabel(
              p,
              selectedBook,
              selectedUnit,
              numPages,
              numberingMode,
            )
            return (
              <button
                key={p}
                type="button"
                ref={p === pageNumber ? activePageRowRef : undefined}
                role="listitem"
                onClick={() => goToPage(p)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-1 focus-visible:ring-offset-[#2a2a2e]',
                  rowActive ? 'bg-white/15 ring-1 ring-white/20' : 'hover:bg-white/10',
                )}
              >
                <PdfPageThumbnail
                  fileUrl={unitThumbFileUrl}
                  unitId={selectedUnitId}
                  pageNumber={p}
                  width={PDF_THUMB_WIDTH}
                  scrollRoot={pageListScrollRoot}
                  pdfReady={pdfReady}
                  label={`Page ${pageLabel}`}
                  className="shrink-0"
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[12.5px] leading-snug tabular-nums',
                    rowActive ? 'font-semibold text-white' : 'font-medium text-[#a1a1aa]',
                  )}
                >
                  Page {pageLabel}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
