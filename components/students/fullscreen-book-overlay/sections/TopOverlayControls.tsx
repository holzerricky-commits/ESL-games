import { LayoutTemplate, List } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BOOK_OVERLAY_SHORTCUT_LABELS as SC } from '@/lib/books/book-overlay-keyboard-shortcuts'

interface TopOverlayControlsProps {
  hasResolvedUnit: boolean
  suppressChrome: boolean
  numPages: number | null
  isPageListOpen: boolean
  setIsPageListOpen: (v: boolean) => void
  isWhiteboardOpen: boolean
  setIsWhiteboardOpen: (v: boolean) => void
  isSinglePageMode: boolean
  pageNumber: number
  annotationTargetPage: number
  setWhiteboardPage: (v: number) => void
  interactiveVocabNode: ReactNode
}

export function TopOverlayControls({
  hasResolvedUnit,
  suppressChrome,
  numPages,
  isPageListOpen,
  setIsPageListOpen,
  isWhiteboardOpen,
  setIsWhiteboardOpen,
  isSinglePageMode,
  pageNumber,
  annotationTargetPage,
  setWhiteboardPage,
  interactiveVocabNode,
}: TopOverlayControlsProps) {
  if (!hasResolvedUnit) return null

  return (
    <div className={cn(suppressChrome && 'pointer-events-none invisible opacity-0')} aria-hidden={suppressChrome}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={numPages == null}
        onClick={() => {
          setIsWhiteboardOpen(false)
          setIsPageListOpen(true)
        }}
        aria-expanded={isPageListOpen}
        aria-controls={numPages != null ? 'book-page-list' : undefined}
        aria-label={numPages == null ? 'Loading pages' : 'Open page list'}
        title={numPages == null ? undefined : `Page list (${SC.pageList})`}
        className={`absolute left-2 top-2 z-[60] h-9 w-9 rounded-full bg-[var(--card)]/95 ${
          isPageListOpen ? 'invisible pointer-events-none' : ''
        }`}
      >
        <List size={16} />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={numPages == null}
        onClick={() => {
          setIsPageListOpen(false)
          setWhiteboardPage(isSinglePageMode ? pageNumber : annotationTargetPage)
          setIsWhiteboardOpen(true)
        }}
        aria-expanded={isWhiteboardOpen}
        aria-label={numPages == null ? 'Loading pages' : 'Open whiteboard'}
        title={numPages == null ? undefined : `Whiteboard (${SC.whiteboard})`}
        className={`absolute left-[3.25rem] top-2 z-[60] h-9 w-9 rounded-full bg-[var(--card)]/95 ${
          isWhiteboardOpen || isPageListOpen ? 'invisible pointer-events-none' : ''
        }`}
      >
        <LayoutTemplate size={16} />
      </Button>
      <div
        className={cn(
          'absolute right-[5.25rem] top-2 z-[60]',
          suppressChrome && 'pointer-events-none invisible opacity-0',
          (isPageListOpen || isWhiteboardOpen) && 'invisible pointer-events-none',
        )}
        aria-hidden={suppressChrome || isPageListOpen || isWhiteboardOpen}
      >
        {interactiveVocabNode}
      </div>
    </div>
  )
}
