'use client'

import { Check, ChevronDown } from 'lucide-react'
import type { LessonBoardShelfEntry } from '@/lib/books/lesson-board-nav'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface LessonBoardNotebookTitleProps {
  label?: string
  bookFullTitle?: string
  accentColor?: string
  shelf?: LessonBoardShelfEntry[]
  activeBookId?: string
  activeUnitId?: string
  onSelectNotebook?: (next: { bookId: string; unitId: string }) => void
  /** Existing next unit in the same book (never invented). */
  nextUnit?: { id: string; title: string } | null
  onOpenNextUnitBoard?: () => void
  /** Extra class on the trigger / static label. */
  className?: string
}

/**
 * Header-left notebook identity: short role label + Boards menu (cross-book).
 */
export function LessonBoardNotebookTitle({
  label: labelProp,
  bookFullTitle,
  accentColor,
  shelf = [],
  activeBookId,
  activeUnitId,
  onSelectNotebook,
  nextUnit = null,
  onOpenNextUnitBoard,
  className,
}: LessonBoardNotebookTitleProps) {
  const showPicker = shelf.length >= 2 && Boolean(onSelectNotebook)
  const label = labelProp?.trim() || 'Board'
  const tooltip = bookFullTitle
    ? `${bookFullTitle}${labelProp?.trim() ? ` · ${labelProp.trim()}` : ''}`
    : label
  const nextTitle = nextUnit?.title.trim() || nextUnit?.id || ''
  const showNextInMenu = Boolean(nextUnit && onOpenNextUnitBoard && nextTitle)

  if (showPicker) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'pointer-events-auto flex h-7 max-w-[8.5rem] items-center gap-1.5 rounded-md px-1.5',
              'bg-transparent transition-colors duration-150 ease-out',
              'hover:bg-black/[0.05] active:bg-black/[0.08]',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D1D5DB]',
              className,
            )}
            aria-label={`Board: ${label}. Choose another board.`}
            title={tooltip}
          >
            {accentColor ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: accentColor }}
                aria-hidden
              />
            ) : null}
            <span className="min-w-0 truncate text-left text-[11px] font-medium text-[#374151]">
              {label}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 text-[#6B7280]" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start" className="min-w-[14rem] max-w-[18rem]">
          {shelf.map((entry) => {
            const selected = entry.bookId === activeBookId && entry.unitId === activeUnitId
            const primary = entry.unitTitle
              ? `${entry.displayLabel} · ${entry.unitTitle}`
              : entry.displayLabel
            return (
              <DropdownMenuItem
                key={`${entry.bookId}::${entry.unitId}`}
                onSelect={() =>
                  onSelectNotebook?.({ bookId: entry.bookId, unitId: entry.unitId })
                }
                className="items-start gap-2 py-2"
              >
                <Check
                  className={cn('mt-0.5 size-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
                  aria-hidden
                />
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.accentColor }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{primary}</span>
                  {entry.bookTitle !== entry.displayLabel ? (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {entry.bookTitle}
                    </span>
                  ) : null}
                </span>
                {entry.hasNotes ? (
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563EB]"
                    title="Has notes"
                    aria-label="Has notes"
                  />
                ) : (
                  <span className="w-1.5 shrink-0" aria-hidden />
                )}
              </DropdownMenuItem>
            )
          })}
          {showNextInMenu ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => onOpenNextUnitBoard?.()}
                className="py-2 text-sm font-medium text-[#2563EB]"
              >
                Open {nextTitle} board
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div
      className={cn('flex h-7 max-w-[8.5rem] items-center gap-1.5 px-1.5', className)}
      title={tooltip}
    >
      {accentColor ? (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: accentColor }}
          aria-hidden
        />
      ) : null}
      <span className="min-w-0 truncate text-[11px] font-medium text-[#374151]">{label}</span>
    </div>
  )
}
