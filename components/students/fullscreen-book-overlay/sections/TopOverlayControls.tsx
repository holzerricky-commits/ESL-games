import { LayoutTemplate, List, NotebookPen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TopOverlayControlsProps {
  hasResolvedUnit: boolean
  suppressChrome: boolean
  numPages: number | null
  isPageListOpen: boolean
  setIsPageListOpen: (v: boolean) => void
  isNotesOpen: boolean
  setIsNotesOpen: (v: boolean) => void
  isWhiteboardOpen: boolean
  setIsWhiteboardOpen: (v: boolean) => void
  isSinglePageMode: boolean
  pageNumber: number
  annotationTargetPage: number
  setNotesPage: (v: number) => void
  setWhiteboardPage: (v: number) => void
  isLessonPaperOpen: boolean
  setIsLessonPaperOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  interactiveVocabNode: ReactNode
}

export function TopOverlayControls({
  hasResolvedUnit,
  suppressChrome,
  numPages,
  isPageListOpen,
  setIsPageListOpen,
  isNotesOpen,
  setIsNotesOpen,
  isWhiteboardOpen,
  setIsWhiteboardOpen,
  isSinglePageMode,
  pageNumber,
  annotationTargetPage,
  setNotesPage,
  setWhiteboardPage,
  isLessonPaperOpen,
  setIsLessonPaperOpen,
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
          setIsNotesOpen(false)
          setIsWhiteboardOpen(false)
          setIsPageListOpen(true)
        }}
        aria-expanded={isPageListOpen}
        aria-controls={numPages != null ? 'book-page-list' : undefined}
        aria-label={numPages == null ? 'Loading pages' : 'Open page list'}
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
          setIsWhiteboardOpen(false)
          setNotesPage(isSinglePageMode ? pageNumber : annotationTargetPage)
          setIsNotesOpen(true)
        }}
        aria-expanded={isNotesOpen}
        aria-label={numPages == null ? 'Loading pages' : 'Open page notes'}
        className={`absolute left-[3.25rem] top-2 z-[60] h-9 w-9 rounded-full bg-[var(--card)]/95 ${
          isNotesOpen || isPageListOpen || isWhiteboardOpen ? 'invisible pointer-events-none' : ''
        }`}
      >
        <NotebookPen size={16} />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={numPages == null}
        onClick={() => {
          setIsPageListOpen(false)
          setIsNotesOpen(false)
          setWhiteboardPage(isSinglePageMode ? pageNumber : annotationTargetPage)
          setIsWhiteboardOpen(true)
        }}
        aria-expanded={isWhiteboardOpen}
        aria-label={numPages == null ? 'Loading pages' : 'Open whiteboard'}
        className={`absolute left-[5.75rem] top-2 z-[60] h-9 w-9 rounded-full bg-[var(--card)]/95 ${
          isWhiteboardOpen || isPageListOpen ? 'invisible pointer-events-none' : ''
        }`}
      >
        <LayoutTemplate size={16} />
      </Button>
      <Button
        type="button"
        variant={isLessonPaperOpen ? 'secondary' : 'outline'}
        size="icon"
        disabled={numPages == null || !hasResolvedUnit}
        onClick={() => setIsLessonPaperOpen((o) => !o)}
        aria-label={isLessonPaperOpen ? 'Hide lesson paper' : 'Show lesson paper'}
        aria-pressed={isLessonPaperOpen}
        title="Lesson paper"
        className={`absolute left-[8.25rem] top-2 z-[60] h-9 w-9 rounded-full bg-[var(--card)]/95 ${
          isPageListOpen || isNotesOpen || isWhiteboardOpen ? 'invisible pointer-events-none' : ''
        }`}
      >
        {isLessonPaperOpen ? <PanelRightClose size={16} aria-hidden /> : <PanelRightOpen size={16} aria-hidden />}
      </Button>
      <div
        className={cn(
          'absolute right-[5.25rem] top-2 z-[60]',
          suppressChrome && 'pointer-events-none invisible opacity-0',
          (isPageListOpen || isNotesOpen || isWhiteboardOpen) && 'invisible pointer-events-none',
        )}
        aria-hidden={suppressChrome || isPageListOpen || isNotesOpen || isWhiteboardOpen}
      >
        {interactiveVocabNode}
      </div>
    </div>
  )
}
