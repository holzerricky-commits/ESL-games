import { List } from 'lucide-react'
import { FloatingSideToolbarButton } from '@/components/students/fullscreen-book-overlay/FloatingSideToolbar'
import { BOOK_OVERLAY_SHORTCUT_LABELS as SC } from '@/lib/books/book-overlay-keyboard-shortcuts'
import { cn } from '@/lib/utils'

interface BookOverlayPageListButtonProps {
  numPages: number | null
  isPageListOpen: boolean
  onToggle: () => void
  className?: string
}

export function BookOverlayPageListButton({
  numPages,
  isPageListOpen,
  onToggle,
  className,
}: BookOverlayPageListButtonProps) {
  return (
    <FloatingSideToolbarButton
      icon={List}
      disabled={numPages == null}
      onClick={onToggle}
      aria-expanded={isPageListOpen}
      aria-controls={numPages != null ? 'book-page-list' : undefined}
      aria-label={numPages == null ? 'Loading pages' : 'Open page list'}
      title={numPages == null ? undefined : `Page list (${SC.pageList})`}
      active={isPageListOpen}
      className={className}
    />
  )
}
