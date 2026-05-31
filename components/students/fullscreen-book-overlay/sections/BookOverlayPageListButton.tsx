import { List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BOOK_OVERLAY_GLASS_CHROME } from '@/components/students/fullscreen-book-overlay/constants'
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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={numPages == null}
      onClick={onToggle}
      aria-expanded={isPageListOpen}
      aria-controls={numPages != null ? 'book-page-list' : undefined}
      aria-label={numPages == null ? 'Loading pages' : 'Open page list'}
      title={numPages == null ? undefined : `Page list (${SC.pageList})`}
      className={cn(
        BOOK_OVERLAY_GLASS_CHROME,
        'pointer-events-auto h-8 w-8 shrink-0 rounded-2xl border p-0 text-white hover:bg-white/10 hover:text-white/85',
        isPageListOpen && 'pointer-events-none invisible',
        className,
      )}
    >
      <List className="h-4 w-4" strokeWidth={2} aria-hidden />
    </Button>
  )
}
