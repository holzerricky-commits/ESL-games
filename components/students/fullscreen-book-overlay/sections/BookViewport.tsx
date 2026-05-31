import { ChevronLeft, ChevronRight, PanelLeftOpen, PanelRightOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BOOK_OVERLAY_GLASS_CHROME } from '@/components/students/fullscreen-book-overlay/constants'
import { cn } from '@/lib/utils'
import { mapPdfSpreadToDisplayLabel, type PageNumberingMode } from '@/lib/books/page-numbering'
import type { BookLibraryPayload } from '@/lib/books/types'

interface BookPageNavigationProps {
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
}

export function BookPageNavigation({
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
}: BookPageNavigationProps) {
  if (!hasResolvedUnit || numPages == null) return null

  return (
    <div
      className={cn(
        'pointer-events-auto absolute left-1/2 top-full z-[25] mt-2 flex w-max -translate-x-1/2 items-center justify-center',
        suppressChrome && 'pointer-events-none invisible opacity-0',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-white',
          BOOK_OVERLAY_GLASS_CHROME,
        )}
        role="group"
        aria-label="Page navigation"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 rounded-full text-white hover:bg-white/15"
          disabled={!visiblePages.length || pageNumber === (visiblePages[0] ?? pageNumber)}
          onClick={() => goToAdjacentPage(-1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        <Input
          type="text"
          inputMode="numeric"
          value={pageJumpDraft}
          onChange={(e) => setPageJumpDraft(e.target.value)}
          onFocus={() => {
            setPageJumpFocused(true)
            setPageJumpDraft(
              mapPdfSpreadToDisplayLabel(
                pageNumber,
                spreadRightPage,
                isSinglePageMode,
                selectedBook,
                selectedUnit,
                numPages,
                numberingMode,
              ),
            )
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
          aria-valuemax={
            printedJumpBounds.usePrinted
              ? printedJumpBounds.max
              : Math.min(numPages ?? 1, unitPageBounds.max)
          }
          className="h-6 min-w-[3.75rem] max-w-[5.5rem] border-0 bg-transparent px-1 text-center text-[10px] font-medium text-white shadow-none focus-visible:ring-2 focus-visible:ring-white/35"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 rounded-full text-white hover:bg-white/15"
          disabled={
            !visiblePages.length ||
            pageNumber === (visiblePages[visiblePages.length - 1] ?? pageNumber)
          }
          onClick={() => goToAdjacentPage(1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

interface BookLessonPaperViewControlsProps {
  suppressChrome: boolean
  isLessonPaperOverlayMode: boolean
  lessonPaperViewMode: 'left' | 'right' | 'split'
  setLessonPaperViewMode: (v: 'left' | 'right' | 'split') => void
}

export function BookLessonPaperViewControls({
  suppressChrome,
  isLessonPaperOverlayMode,
  lessonPaperViewMode,
  setLessonPaperViewMode,
}: BookLessonPaperViewControlsProps) {
  if (!isLessonPaperOverlayMode) return null

  return (
    <div
      className={cn(
        'pointer-events-auto absolute bottom-[9.25%] left-1/4 z-[29] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/45 px-1 py-1 text-white shadow-sm backdrop-blur-sm',
        suppressChrome && 'pointer-events-none invisible opacity-0',
      )}
      role="group"
      aria-label="Lesson paper page visibility"
    >
      <Button
        type="button"
        variant={lessonPaperViewMode === 'left' ? 'secondary' : 'ghost'}
        size="icon"
        className="h-7 w-7 rounded-full text-white hover:bg-white/15 data-[state=active]:bg-white/20"
        onClick={() => setLessonPaperViewMode('left')}
        aria-pressed={lessonPaperViewMode === 'left'}
        aria-label="Show left page"
        title="Show left page"
      >
        <PanelLeftOpen className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant={lessonPaperViewMode === 'right' ? 'secondary' : 'ghost'}
        size="icon"
        className="h-7 w-7 rounded-full text-white hover:bg-white/15 data-[state=active]:bg-white/20"
        onClick={() => setLessonPaperViewMode('right')}
        aria-pressed={lessonPaperViewMode === 'right'}
        aria-label="Show right page"
        title="Show right page"
      >
        <PanelRightOpen className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  )
}
