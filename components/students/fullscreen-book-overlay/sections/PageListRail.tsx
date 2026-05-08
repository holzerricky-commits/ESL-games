import { X } from 'lucide-react'
import type { MutableRefObject } from 'react'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { Button } from '@/components/ui/button'
import { mapPdfPageToDisplayLabel, type PageNumberingMode } from '@/lib/books/page-numbering'
import { PDF_THUMB_WIDTH } from '@/lib/books/pdf-thumbnail-cache'
import type { BookLibraryPayload } from '@/lib/books/types'

interface PageListRailProps {
  hasResolvedUnit: boolean
  numPages: number | null
  isPageListOpen: boolean
  selectedUnitTitle?: string
  pageListNumbers: number[]
  isSinglePageMode: boolean
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
  setIsPageListOpen: (open: boolean) => void
}

export function PageListRail({
  hasResolvedUnit,
  numPages,
  isPageListOpen,
  selectedUnitTitle,
  pageListNumbers,
  isSinglePageMode,
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
  setIsPageListOpen,
}: PageListRailProps) {
  if (!hasResolvedUnit || numPages == null) return null

  return (
    <>
      <div
        className={`absolute inset-y-0 left-0 z-50 flex min-h-0 w-[min(148px,calc(100vw-12px))] flex-col border-r border-[#4a3421]/18 bg-gradient-to-b from-[#faf6ef] to-[#e8dfd2] shadow-[4px_0_16px_rgba(12,6,2,0.12)] transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none [scrollbar-gutter:stable] ${
          isPageListOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
        aria-hidden={!isPageListOpen}
      >
        <header className="flex shrink-0 items-center justify-between gap-1.5 border-b border-[#4a3421]/12 px-2 py-2">
          <p className="min-w-0 truncate text-[11px] font-semibold leading-tight text-[#3d2918]">{selectedUnitTitle}</p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-md border-[#5c4030]/25 bg-white/50 p-0 text-[#3d2918] hover:bg-white/80"
            onClick={() => setIsPageListOpen(false)}
            aria-label="Close page list"
          >
            <X size={14} />
          </Button>
        </header>
        <div
          id="book-page-list"
          ref={setPageListScrollRoot}
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-2 [scrollbar-color:rgba(107,78,50,0.3)_transparent] [scrollbar-width:thin]"
          role="list"
        >
          {pageListNumbers.map((p) => {
            const rowActive = isSinglePageMode
              ? p === pageNumber
              : p === pageNumber || (showSpreadRightPage && p === spreadRightPage)
            return (
              <button
                key={p}
                type="button"
                ref={p === pageNumber ? activePageRowRef : undefined}
                role="listitem"
                onClick={() => goToPage(p)}
                className={`flex w-full flex-col items-center gap-0.5 rounded-md py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-600/45 focus-visible:ring-offset-1 focus-visible:ring-offset-[#faf6ef] ${
                  rowActive ? 'bg-amber-200/35 ring-1 ring-amber-700/25' : 'hover:bg-[#5c4030]/[0.06]'
                }`}
              >
                <PdfPageThumbnail
                  fileUrl={unitThumbFileUrl}
                  unitId={selectedUnitId}
                  pageNumber={p}
                  width={PDF_THUMB_WIDTH}
                  scrollRoot={pageListScrollRoot}
                  pdfReady={pdfReady}
                  label={`Page ${mapPdfPageToDisplayLabel(p, selectedBook, selectedUnit, numPages, numberingMode)}`}
                />
                <span
                  className={`tabular-nums text-[10px] leading-none ${
                    rowActive ? 'font-semibold text-[#2a1d12]' : 'font-medium text-[#5c4030]/85'
                  }`}
                >
                  {mapPdfPageToDisplayLabel(p, selectedBook, selectedUnit, numPages, numberingMode)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {isPageListOpen ? (
        <button
          type="button"
          onClick={() => setIsPageListOpen(false)}
          aria-label="Close page list"
          className="absolute inset-0 z-40 bg-[#120a03]/45"
        ></button>
      ) : null}
    </>
  )
}
