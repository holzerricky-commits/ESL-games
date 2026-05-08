import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { mapPdfPageToDisplayLabel, type PageNumberingMode } from '@/lib/books/page-numbering'
import type { BookLibraryPayload } from '@/lib/books/types'

interface WhiteboardHeaderProps {
  isWhiteboardOpen: boolean
  selectedBookId: string | null
  numPages: number | null
  suppressChrome: boolean
  isSinglePageMode: boolean
  showSpreadRightPage: boolean
  spreadRightPage: number | null
  whiteboardPage: number
  setWhiteboardPage: (v: number) => void
  pageNumber: number
  selectedBook: BookLibraryPayload['books'][number] | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  numberingMode: PageNumberingMode
  setIsWhiteboardOpen: (v: boolean) => void
}

export function WhiteboardHeader({
  isWhiteboardOpen,
  selectedBookId,
  numPages,
  suppressChrome,
  isSinglePageMode,
  showSpreadRightPage,
  spreadRightPage,
  whiteboardPage,
  setWhiteboardPage,
  pageNumber,
  selectedBook,
  selectedUnit,
  numberingMode,
  setIsWhiteboardOpen,
}: WhiteboardHeaderProps) {
  if (!isWhiteboardOpen || !selectedBookId || numPages == null) return null

  return (
    <div
      className={cn(
        'pointer-events-auto absolute bottom-full left-0 right-0 z-[20] mb-1 flex items-center justify-between gap-2 px-0.5 pb-0.5',
        suppressChrome && 'pointer-events-none invisible opacity-0',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
        {!isSinglePageMode && showSpreadRightPage && spreadRightPage != null ? (
          <div className="flex gap-1" role="tablist" aria-label="Whiteboard page">
            <Button
              type="button"
              size="sm"
              variant={whiteboardPage === pageNumber ? 'default' : 'outline'}
              className={
                whiteboardPage === pageNumber
                  ? 'h-7 bg-[#5c4030] px-2 text-xs text-white hover:bg-[#5c4030]/90'
                  : 'h-7 border-[#5c4030]/25 bg-white/80 px-2 text-xs text-[#3d2918]'
              }
              onClick={() => setWhiteboardPage(pageNumber)}
            >
              Page {mapPdfPageToDisplayLabel(pageNumber, selectedBook, selectedUnit, numPages, numberingMode)}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={whiteboardPage === spreadRightPage ? 'default' : 'outline'}
              className={
                whiteboardPage === spreadRightPage
                  ? 'h-7 bg-[#5c4030] px-2 text-xs text-white hover:bg-[#5c4030]/90'
                  : 'h-7 border-[#5c4030]/25 bg-white/80 px-2 text-xs text-[#3d2918]'
              }
              onClick={() => setWhiteboardPage(spreadRightPage)}
            >
              Page {mapPdfPageToDisplayLabel(spreadRightPage, selectedBook, selectedUnit, numPages, numberingMode)}
            </Button>
          </div>
        ) : (
          <span className="text-[11px] font-semibold tabular-nums text-[#3d2918]">
            Whiteboard · Page {mapPdfPageToDisplayLabel(whiteboardPage, selectedBook, selectedUnit, numPages, numberingMode)}
          </span>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 shrink-0 border-[#5c4030]/25 bg-white/80 text-[11px] text-[#3d2918]"
        onClick={() => setIsWhiteboardOpen(false)}
      >
        Done
      </Button>
    </div>
  )
}
