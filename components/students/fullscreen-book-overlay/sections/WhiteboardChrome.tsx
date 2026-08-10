'use client'

import {
  ArrowLeftRight,
  CircleDot,
  Dock,
  GripHorizontal,
  Link2Off,
  Minus,
  MoreHorizontal,
  PictureInPicture2,
  Save,
  Trash2,
} from 'lucide-react'
import type { WhiteboardLayoutMode } from '../hooks/useWhiteboardPlacement'
import type { LessonBoardPageOrientation } from '@/lib/books/lesson-board-types'
import type { LessonBoardShelfEntry } from '@/lib/books/lesson-board-nav'
import { LessonBoardNotebookTitle } from '@/components/students/fullscreen-book-overlay/sections/LessonBoardNotebookTitle'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { WHITEBOARD_HEADER_CHROME } from '../constants'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const CHROME_ICON = 'h-3.5 w-3.5 shrink-0 stroke-[2.25] text-[#374151]'

const CHROME_BTN =
  'pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md bg-transparent transition-colors duration-150 ease-out hover:bg-black/[0.05] active:bg-black/[0.08] focus-visible:outline-none focus-visible:bg-black/[0.04] focus-visible:ring-1 focus-visible:ring-[#D1D5DB]'

const HEADER_DIVIDER = 'mx-0.5 h-3.5 w-px shrink-0 bg-[#EBEEF2]'

const HEADER_ACTIONS_REVEAL_MS = 280

function ChromeIconButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type="button" className={cn(CHROME_BTN, className)} {...props}>
      {children}
    </button>
  )
}

function HeaderDivider() {
  return <span className={HEADER_DIVIDER} aria-hidden />
}

export interface WhiteboardHeaderProps {
  suppressChrome: boolean
  /** While true, toolbar controls stay hidden so the bar can appear at full size first. */
  deferChromeActions?: boolean
  layoutMode?: WhiteboardLayoutMode
  /** Active board page orientation — drives compact vs labeled chrome. */
  pageOrientation?: LessonBoardPageOrientation
  onFloat?: () => void
  onDock?: () => void
  swapSlotSide: () => void
  onMinimize: () => void
  slotDragEnabled: boolean
  floatDragEnabled?: boolean
  onSlotDragPointerDown: (e: React.PointerEvent) => void
  onSlotDragPointerMove: (e: React.PointerEvent) => void
  onSlotDragPointerUp: (e: React.PointerEvent) => void
  onSlotDragPointerCancel: () => void
  onFloatDragPointerDown?: (e: React.PointerEvent) => void
  onFloatDragPointerMove?: (e: React.PointerEvent) => void
  onFloatDragPointerUp?: (e: React.PointerEvent) => void
  onFloatDragPointerCancel?: () => void
  onSaveLessonBoard?: () => void
  onDeleteLessonBoardPage?: () => void
  canDeleteLessonBoardPage?: boolean
  onStartBoardLinkPlacement?: () => void
  onRemoveBoardLink?: () => void
  activeBoardPageLinkPdfPage?: number | null
  boardLinkPlacementActive?: boolean
  /**
   * Prep mode: show link-to-book as a header icon instead of under More.
   */
  boardLinkInHeader?: boolean
  /** e.g. lesson board picture search control */
  imageSearchControl?: ReactNode
  boardFooterLabel?: string
  boardBookFullTitle?: string
  boardBookAccentColor?: string
  boardShelf?: LessonBoardShelfEntry[]
  boardActiveBookId?: string
  boardActiveUnitId?: string
  onSelectBoardNotebook?: (next: { bookId: string; unitId: string }) => void
  nextUnitBoard?: { id: string; title: string } | null
  onOpenNextUnitBoard?: () => void
}

export function WhiteboardHeader({
  suppressChrome,
  deferChromeActions = false,
  layoutMode = 'slot',
  pageOrientation = 'standard',
  onFloat,
  onDock,
  swapSlotSide,
  onMinimize,
  slotDragEnabled,
  floatDragEnabled = false,
  onSlotDragPointerDown,
  onSlotDragPointerMove,
  onSlotDragPointerUp,
  onSlotDragPointerCancel,
  onFloatDragPointerDown,
  onFloatDragPointerMove,
  onFloatDragPointerUp,
  onFloatDragPointerCancel,
  onSaveLessonBoard,
  onDeleteLessonBoardPage,
  canDeleteLessonBoardPage = false,
  onStartBoardLinkPlacement,
  onRemoveBoardLink,
  activeBoardPageLinkPdfPage = null,
  boardLinkPlacementActive = false,
  boardLinkInHeader = false,
  imageSearchControl,
  boardFooterLabel,
  boardBookFullTitle,
  boardBookAccentColor,
  boardShelf,
  boardActiveBookId,
  boardActiveUnitId,
  onSelectBoardNotebook,
  nextUnitBoard = null,
  onOpenNextUnitBoard,
}: WhiteboardHeaderProps) {
  const isWide = pageOrientation === 'wide'

  const linkInHeader = boardLinkInHeader && Boolean(onStartBoardLinkPlacement)
  const linkInMoreMenu = Boolean(onStartBoardLinkPlacement) && !linkInHeader
  const showMoreMenu =
    Boolean(onSaveLessonBoard) ||
    linkInMoreMenu ||
    (canDeleteLessonBoardPage && Boolean(onDeleteLessonBoardPage))

  const showLayoutControls = !isWide
  const showFloatOrDock =
    showLayoutControls &&
    ((layoutMode === 'floating' && Boolean(onDock)) || Boolean(onFloat))
  const showSwapSide = showLayoutControls && layoutMode === 'slot'
  const showDragGrip =
    (layoutMode === 'floating' && floatDragEnabled) || slotDragEnabled

  const [chromeActionsVisible, setChromeActionsVisible] = useState(!deferChromeActions)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    if (deferChromeActions) {
      setChromeActionsVisible(false)
      return
    }
    const id = window.setTimeout(() => setChromeActionsVisible(true), HEADER_ACTIONS_REVEAL_MS)
    return () => window.clearTimeout(id)
  }, [deferChromeActions])

  const dragGrip = showDragGrip ? (
    layoutMode === 'floating' && floatDragEnabled ? (
      <div
        role="separator"
        aria-label="Drag to move floating board"
        title="Drag to move board"
        className={cn(
          'pointer-events-auto flex h-7 w-11 cursor-grab touch-none items-center justify-center rounded-md',
          'text-[#4B5563] transition-colors hover:bg-black/[0.04] hover:text-[#374151] active:cursor-grabbing',
        )}
        onPointerDown={onFloatDragPointerDown}
        onPointerMove={onFloatDragPointerMove}
        onPointerUp={onFloatDragPointerUp}
        onPointerCancel={onFloatDragPointerCancel}
      >
        <GripHorizontal className="h-4 w-4 stroke-[2.5]" aria-hidden />
      </div>
    ) : (
      <div
        role="separator"
        aria-label="Drag to move board to the other side"
        title="Drag to move board"
        className={cn(
          'pointer-events-auto flex h-7 w-11 cursor-grab touch-none items-center justify-center rounded-md',
          'text-[#4B5563] transition-colors hover:bg-black/[0.04] hover:text-[#374151] active:cursor-grabbing',
        )}
        onPointerDown={onSlotDragPointerDown}
        onPointerMove={onSlotDragPointerMove}
        onPointerUp={onSlotDragPointerUp}
        onPointerCancel={onSlotDragPointerCancel}
      >
        <GripHorizontal className="h-4 w-4 stroke-[2.5]" aria-hidden />
      </div>
    )
  ) : null

  return (
    <header
      className={cn(
        'relative z-20 flex h-9 shrink-0 items-center px-2.5',
        WHITEBOARD_HEADER_CHROME,
        suppressChrome && 'pointer-events-none invisible',
      )}
    >
      <div
        className={cn(
          'flex w-full min-w-0 items-center transition-opacity duration-200 ease-out',
          chromeActionsVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        {/* Title + Insert */}
        <div className="flex min-w-0 items-center gap-0.5">
          {boardFooterLabel || boardBookAccentColor ? (
            <LessonBoardNotebookTitle
              label={boardFooterLabel}
              bookFullTitle={boardBookFullTitle}
              accentColor={boardBookAccentColor}
              shelf={boardShelf}
              activeBookId={boardActiveBookId}
              activeUnitId={boardActiveUnitId}
              onSelectNotebook={onSelectBoardNotebook}
              nextUnit={nextUnitBoard}
              onOpenNextUnitBoard={onOpenNextUnitBoard}
            />
          ) : null}

          {imageSearchControl ? (
            <>
              {boardFooterLabel || boardBookAccentColor ? <HeaderDivider /> : null}
              {imageSearchControl}
            </>
          ) : null}
        </div>

        {/* Drag grip — only when enabled; no empty center column on wide */}
        {showDragGrip ? (
          <div className="flex min-w-0 flex-1 items-center justify-center">{dragGrip}</div>
        ) : (
          <div className="min-w-0 flex-1" aria-hidden />
        )}

        {/* Link (prep) + More + Layout + Minimize */}
        <div className="flex shrink-0 items-center justify-end gap-0.5">
          {linkInHeader ? (
            <>
              <ChromeIconButton
                onClick={onStartBoardLinkPlacement}
                aria-label={
                  activeBoardPageLinkPdfPage != null
                    ? `Linked to book page ${activeBoardPageLinkPdfPage}. Tap to re-link.`
                    : 'Link this board page to a spot on the book'
                }
                title={
                  activeBoardPageLinkPdfPage != null
                    ? `Linked · p.${activeBoardPageLinkPdfPage}`
                    : 'Link to book'
                }
                className={cn(
                  boardLinkPlacementActive && 'bg-[#2563EB]/10',
                  activeBoardPageLinkPdfPage != null && 'bg-[#2563EB]/8',
                )}
              >
                <CircleDot className={CHROME_ICON} aria-hidden />
              </ChromeIconButton>
              {activeBoardPageLinkPdfPage != null && onRemoveBoardLink ? (
                <ChromeIconButton
                  onClick={onRemoveBoardLink}
                  aria-label="Remove book link"
                  title="Remove link"
                >
                  <Link2Off className={CHROME_ICON} aria-hidden />
                </ChromeIconButton>
              ) : null}
            </>
          ) : null}

          {showMoreMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    CHROME_BTN,
                    linkInMoreMenu && boardLinkPlacementActive && 'bg-[#2563EB]/10',
                    linkInMoreMenu &&
                      activeBoardPageLinkPdfPage != null &&
                      'bg-[#2563EB]/8',
                  )}
                  aria-label="More board actions"
                  title="More"
                >
                  <MoreHorizontal className={CHROME_ICON} aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" className="min-w-[11rem]">
                {onSaveLessonBoard ? (
                  <DropdownMenuItem onSelect={() => onSaveLessonBoard()}>
                    <Save className="size-4" aria-hidden />
                    Save board
                  </DropdownMenuItem>
                ) : null}
                {linkInMoreMenu ? (
                  <DropdownMenuItem onSelect={() => onStartBoardLinkPlacement?.()}>
                    <CircleDot className="size-4" aria-hidden />
                    {activeBoardPageLinkPdfPage != null
                      ? `Linked · p.${activeBoardPageLinkPdfPage}`
                      : 'Link to book'}
                  </DropdownMenuItem>
                ) : null}
                {linkInMoreMenu &&
                activeBoardPageLinkPdfPage != null &&
                onRemoveBoardLink ? (
                  <DropdownMenuItem onSelect={() => onRemoveBoardLink()}>
                    <Link2Off className="size-4" aria-hidden />
                    Remove link
                  </DropdownMenuItem>
                ) : null}
                {canDeleteLessonBoardPage && onDeleteLessonBoardPage ? (
                  <>
                    {(onSaveLessonBoard || linkInMoreMenu) && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        // Defer so the menu can close before the confirm dialog opens.
                        window.setTimeout(() => setDeleteConfirmOpen(true), 0)
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Delete page
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {showFloatOrDock || showSwapSide ? (
            <>
              {showMoreMenu || linkInHeader ? <HeaderDivider /> : null}
              {layoutMode === 'floating' && onDock ? (
                <ChromeIconButton
                  onClick={onDock}
                  aria-label="Dock board to book"
                  title="Dock to book"
                >
                  <Dock className={CHROME_ICON} aria-hidden />
                </ChromeIconButton>
              ) : onFloat ? (
                <ChromeIconButton
                  onClick={onFloat}
                  aria-label="Float board above book"
                  title="Float board"
                >
                  <PictureInPicture2 className={CHROME_ICON} aria-hidden />
                </ChromeIconButton>
              ) : null}
              {showSwapSide ? (
                <ChromeIconButton
                  onClick={swapSlotSide}
                  aria-label="Move board to other side"
                  title="Move to other side"
                >
                  <ArrowLeftRight className={CHROME_ICON} aria-hidden />
                </ChromeIconButton>
              ) : null}
            </>
          ) : null}

          {(showMoreMenu || linkInHeader || showFloatOrDock || showSwapSide) && (
            <HeaderDivider />
          )}

          <ChromeIconButton
            onClick={onMinimize}
            aria-label="Minimize lesson board"
            title="Minimize board"
          >
            <Minus className={CHROME_ICON} aria-hidden />
          </ChromeIconButton>
        </div>
      </div>

      {canDeleteLessonBoardPage && onDeleteLessonBoardPage ? (
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this board page?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the current page and everything on it. You cannot undo this.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  onDeleteLessonBoardPage()
                  setDeleteConfirmOpen(false)
                }}
              >
                Delete page
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </header>
  )
}

/** @deprecated Use WhiteboardHeader */
export const WhiteboardChrome = WhiteboardHeader
