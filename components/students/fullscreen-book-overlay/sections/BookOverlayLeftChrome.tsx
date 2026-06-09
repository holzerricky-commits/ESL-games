import type { ComponentProps } from 'react'
import { AnnotationRail } from '@/components/students/fullscreen-book-overlay/sections/AnnotationRail'
import { BookOverlayPageListButton } from '@/components/students/fullscreen-book-overlay/sections/BookOverlayPageListButton'
import { cn } from '@/lib/utils'

type AnnotationRailProps = ComponentProps<typeof AnnotationRail>

interface BookOverlayLeftChromeProps extends AnnotationRailProps {
  isPageListOpen: boolean
  onTogglePageList: () => void
}

/** Page list launcher stacked above the annotation toolbox on the left edge. */
export function BookOverlayLeftChrome({
  suppressChrome,
  numPages,
  isPageListOpen,
  onTogglePageList,
  ...railProps
}: BookOverlayLeftChromeProps) {
  if (!railProps.hasResolvedUnit || numPages == null || !railProps.selectedBookId) return null

  return (
    <div
      className={cn(
        'pointer-events-none absolute left-0 top-1/2 z-[28] flex -translate-y-1/2 flex-col items-center gap-2 pl-2 md:pl-3',
        suppressChrome && 'invisible opacity-0',
      )}
    >
      <BookOverlayPageListButton
        numPages={numPages}
        isPageListOpen={isPageListOpen}
        onToggle={onTogglePageList}
      />
      <AnnotationRail suppressChrome={suppressChrome} numPages={numPages} {...railProps} />
    </div>
  )
}
