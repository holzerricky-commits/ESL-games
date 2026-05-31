import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TopOverlayControlsProps {
  hasResolvedUnit: boolean
  suppressChrome: boolean
  isPageListOpen: boolean
  /** Board expanded in a slot or fullscreen — hides vocab shelf only then. */
  isWhiteboardExpanded: boolean
  interactiveVocabNode: ReactNode
}

export function TopOverlayControls({
  hasResolvedUnit,
  suppressChrome,
  isPageListOpen,
  isWhiteboardExpanded,
  interactiveVocabNode,
}: TopOverlayControlsProps) {
  if (!hasResolvedUnit) return null

  return (
    <div className={cn(suppressChrome && 'pointer-events-none invisible opacity-0')} aria-hidden={suppressChrome}>
      <div
        className={cn(
          'absolute right-14 top-14 z-[60]',
          suppressChrome && 'pointer-events-none invisible opacity-0',
          (isPageListOpen || isWhiteboardExpanded) && 'invisible pointer-events-none',
        )}
        aria-hidden={suppressChrome || isPageListOpen || isWhiteboardExpanded}
      >
        {interactiveVocabNode}
      </div>
    </div>
  )
}
