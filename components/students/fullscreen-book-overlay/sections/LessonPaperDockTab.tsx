'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LessonPaperDockTabProps {
  isOpen: boolean
  onToggle: () => void
  panelId: string
}

/**
 * Same footprint as annotation toolbox peek/hide handle (`ANNOTATION_RAIL_HANDLE_LAYOUT` in
 * AnnotationRail), mirrored for the right edge: h-11 w-4, flat against the viewport, rounded toward the book.
 */
const LESSON_NOTEBOOK_HANDLE_LAYOUT =
  'flex h-11 w-4 shrink-0 items-center justify-center rounded-r-none rounded-l-2xl'

/** Small viewport-edge handle; moves with the lesson panel (parent applies translateX). */
export function LessonPaperDockTab({ isOpen, onToggle, panelId }: LessonPaperDockTabProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={panelId}
      aria-label={isOpen ? 'Close lesson notebook' : 'Open lesson notebook'}
      title={isOpen ? 'Close lesson notebook' : 'Open lesson notebook'}
      className={cn(
        LESSON_NOTEBOOK_HANDLE_LAYOUT,
        'my-auto self-center border border-[#c4b8a4]/55 border-r-0 bg-[#fbf9f5]/95 text-[#3d2918] shadow-[-2px_0_10px_rgba(0,0,0,0.08)] transition-colors duration-200 hover:bg-[#f5efe4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4b8a4]/70',
      )}
    >
      {isOpen ? (
        <ChevronRight className="h-3 w-3 shrink-0" aria-hidden strokeWidth={2} />
      ) : (
        <ChevronLeft className="h-3 w-3 shrink-0" aria-hidden strokeWidth={2} />
      )}
    </button>
  )
}
