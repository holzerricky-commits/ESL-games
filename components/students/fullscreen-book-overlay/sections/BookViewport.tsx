import { ChevronLeft, ChevronRight, PanelLeftOpen, PanelRightOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { mapPdfSpreadToDisplayLabel, type PageNumberingMode } from '@/lib/books/page-numbering'
import type { BookLibraryPayload } from '@/lib/books/types'

interface BookViewportProps {
  hasResolvedUnit: boolean
  numPages: number | null
  suppressChrome: boolean
  visiblePages: number[]
  pageNumber: number
  goToAdjacentPage: (delta: -1 | 1) => void
  pageJumpDraft: string
  setPageJumpDraft: (v: string) => void
  setPageJumpFocused: (v: boolean) => void
  spreadRightPage: number | null
  isSinglePageMode: boolean
  selectedBook: BookLibraryPayload['books'][number] | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  numberingMode: PageNumberingMode
  commitPageJump: () => void
  printedJumpBounds: { usePrinted: boolean; min: number; max: number }
  unitPageBounds: { min: number; max: number }
  isLessonPaperOpen: boolean
  setIsLessonPaperOpen: (v: boolean) => void
  isLessonPaperOverlayMode: boolean
  lessonPaperViewMode: 'left' | 'right' | 'split'
  setLessonPaperViewMode: (v: 'left' | 'right' | 'split') => void
}

export function BookViewport({
  hasResolvedUnit,
  numPages,
  suppressChrome,
  visiblePages,
  pageNumber,
  goToAdjacentPage,
  pageJumpDraft,
  setPageJumpDraft,
  setPageJumpFocused,
  spreadRightPage,
  isSinglePageMode,
  selectedBook,
  selectedUnit,
  numberingMode,
  commitPageJump,
  printedJumpBounds,
  unitPageBounds,
  isLessonPaperOpen,
  setIsLessonPaperOpen,
  isLessonPaperOverlayMode,
  lessonPaperViewMode,
  setLessonPaperViewMode,
}: BookViewportProps) {
  return (
    <>
      {hasResolvedUnit && numPages != null ? (
        <div
          className={cn(
            'pointer-events-auto absolute bottom-3 left-1/2 z-[25] flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)] backdrop-blur-[1.5px]',
            suppressChrome && 'pointer-events-none invisible opacity-0',
          )}
          role="group"
          aria-label="Page navigation"
        >
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full text-white hover:bg-white/15" disabled={!visiblePages.length || pageNumber === (visiblePages[0] ?? pageNumber)} onClick={() => goToAdjacentPage(-1)} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="text"
            inputMode="numeric"
            value={pageJumpDraft}
            onChange={(e) => setPageJumpDraft(e.target.value)}
            onFocus={() => {
              setPageJumpFocused(true)
              setPageJumpDraft(mapPdfSpreadToDisplayLabel(pageNumber, spreadRightPage, isSinglePageMode, selectedBook, selectedUnit, numPages, numberingMode))
            }}
            onBlur={() => {
              setPageJumpFocused(false)
              commitPageJump()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            aria-label={printedJumpBounds.usePrinted ? 'Go to printed page' : 'Go to PDF page'}
            aria-valuemin={printedJumpBounds.usePrinted ? printedJumpBounds.min : 1}
            aria-valuemax={printedJumpBounds.usePrinted ? printedJumpBounds.max : Math.min(numPages ?? 1, unitPageBounds.max)}
            className="h-7 min-w-[4.6rem] max-w-[6.5rem] border-0 bg-transparent px-1 text-center text-xs font-medium text-white shadow-none focus-visible:ring-2 focus-visible:ring-white/35"
          />
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full text-white hover:bg-white/15" disabled={!visiblePages.length || pageNumber === (visiblePages[visiblePages.length - 1] ?? pageNumber)} onClick={() => goToAdjacentPage(1)} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      {!isLessonPaperOpen && hasResolvedUnit ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="absolute right-0 top-[34%] z-[55] flex h-24 w-9 flex-col items-center justify-center gap-1 rounded-l-lg border border-r-0 border-[#c4b8a4]/50 bg-[#fbf9f5]/95 py-2 pr-0.5 pl-1 text-[10px] font-semibold uppercase tracking-wide text-[#3d2918] shadow-md hover:bg-[#f5efe4]"
          onClick={() => setIsLessonPaperOpen(true)}
          aria-label="Open notebook mode"
        >
          <PanelRightOpen className="h-4 w-4 shrink-0" aria-hidden />
          <span className="max-w-[1em] leading-tight">Notes</span>
        </Button>
      ) : null}
      {isLessonPaperOverlayMode ? (
        <div
          className={cn(
            'pointer-events-auto absolute bottom-[9.25%] left-1/4 z-[29] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/45 px-1 py-1 text-white shadow-sm backdrop-blur-sm',
            suppressChrome && 'pointer-events-none invisible opacity-0',
          )}
          role="group"
          aria-label="Lesson paper page visibility"
        >
          <Button type="button" variant={lessonPaperViewMode === 'left' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7 rounded-full text-white hover:bg-white/15 data-[state=active]:bg-white/20" onClick={() => setLessonPaperViewMode('left')} aria-pressed={lessonPaperViewMode === 'left'} aria-label="Show left page" title="Show left page">
            <PanelLeftOpen className="h-4 w-4" aria-hidden />
          </Button>
          <Button type="button" variant={lessonPaperViewMode === 'right' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7 rounded-full text-white hover:bg-white/15 data-[state=active]:bg-white/20" onClick={() => setLessonPaperViewMode('right')} aria-pressed={lessonPaperViewMode === 'right'} aria-label="Show right page" title="Show right page">
            <PanelRightOpen className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ) : null}
    </>
  )
}
