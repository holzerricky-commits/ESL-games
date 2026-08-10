'use client'

import type { ReactNode } from 'react'
import { BookOpen, Languages, ListChecks, Presentation, Settings, Smartphone, Wrench, X } from 'lucide-react'
import { BookOverlayPageListButton } from '@/components/students/fullscreen-book-overlay/sections/BookOverlayPageListButton'
import {
  FloatingSideToolbarButton,
  FloatingSideToolbarDivider,
  FLOATING_SIDE_TOOLBAR_BUTTON_ACTIVE,
  FLOATING_SIDE_TOOLBAR_ICON,
} from '@/components/students/fullscreen-book-overlay/FloatingSideToolbar'
import { BOOK_OVERLAY_SHORTCUT_LABELS as SC } from '@/lib/books/book-overlay-keyboard-shortcuts'
import { bookPageNavigationChromeEnabled } from '@/lib/books/feature-flags'
import { cn } from '@/lib/utils'

interface BookWorkspaceLeftBarProps {
  hasResolvedUnit: boolean
  numPages: number | null
  suppressChrome: boolean
  isPageListOpen: boolean
  onTogglePageList: () => void
  isWhiteboardOpen: boolean
  isWhiteboardSessionOpen: boolean
  isWhiteboardMinimized: boolean
  onWhiteboardClick: () => void
  translateDockOpen: boolean
  onTranslateDockToggle: () => void
  onOpenCoachDialog: () => void
  onClose: () => void
  /** Lesson settings drawer (praise style, etc.). */
  lessonSettingsOpen?: boolean
  onLessonSettingsToggle?: () => void
  /** In-class toolbox menu / floating mini-app panel. */
  toolboxOpen?: boolean
  onToolboxToggle?: () => void
  /** When set, shows a Vocabulary launcher on this spread. */
  hasInteractiveVocab?: boolean
  interactiveVocabOpen?: boolean
  onInteractiveVocabToggle?: () => void
  /** When set, shows Reading checks launcher for an approved story pack. */
  hasReadingChecks?: boolean
  readingChecksOpen?: boolean
  onReadingChecksToggle?: () => void
}

function RailIconStack({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col items-center gap-0.5 px-0 py-1">{children}</div>
}

/** Full-height dark left strip — no scroll; navigation top, assist tools bottom. */
export function BookWorkspaceLeftBar({
  hasResolvedUnit,
  numPages,
  suppressChrome,
  isPageListOpen,
  onTogglePageList,
  isWhiteboardOpen,
  isWhiteboardSessionOpen,
  isWhiteboardMinimized,
  onWhiteboardClick,
  translateDockOpen,
  onTranslateDockToggle,
  onOpenCoachDialog,
  onClose,
  lessonSettingsOpen = false,
  onLessonSettingsToggle,
  toolboxOpen = false,
  onToolboxToggle,
  hasInteractiveVocab = false,
  interactiveVocabOpen = false,
  onInteractiveVocabToggle,
  hasReadingChecks = false,
  readingChecksOpen = false,
  onReadingChecksToggle,
}: BookWorkspaceLeftBarProps) {
  if (!bookPageNavigationChromeEnabled) return null
  if (!hasResolvedUnit || numPages == null) return null

  return (
    <div
      className={cn(
        'book-workspace-left-bar floating-side-toolbar floating-side-toolbar--full-height pointer-events-auto fixed inset-y-0 left-0 z-[55] flex flex-col items-center justify-between overflow-hidden py-2',
        suppressChrome && 'pointer-events-none invisible opacity-0',
      )}
      role="toolbar"
      aria-label="Workspace tools"
    >
      <RailIconStack>
        <FloatingSideToolbarButton
          aria-label="Close book overlay"
          title={`Close book (${SC.closePanelOrBook})`}
          onClick={onClose}
        >
          <X className={FLOATING_SIDE_TOOLBAR_ICON} strokeWidth={2} aria-hidden />
        </FloatingSideToolbarButton>
        <FloatingSideToolbarDivider />
        <BookOverlayPageListButton
          numPages={numPages}
          isPageListOpen={isPageListOpen}
          onToggle={onTogglePageList}
        />
        <FloatingSideToolbarDivider />
        <FloatingSideToolbarButton
          className={cn(
            isWhiteboardOpen && FLOATING_SIDE_TOOLBAR_BUTTON_ACTIVE,
            isWhiteboardMinimized && 'floating-side-toolbar__btn--active opacity-90',
          )}
          aria-label={
            !isWhiteboardSessionOpen
              ? 'Open lesson board'
              : isWhiteboardMinimized
                ? 'Restore lesson board'
                : 'Minimize lesson board'
          }
          aria-pressed={isWhiteboardSessionOpen}
          title={
            !isWhiteboardSessionOpen
              ? `Lesson board (${SC.whiteboard})`
              : isWhiteboardMinimized
                ? `Restore lesson board (${SC.whiteboard})`
                : `Minimize lesson board (${SC.whiteboard})`
          }
          onClick={onWhiteboardClick}
        >
          <Presentation className={FLOATING_SIDE_TOOLBAR_ICON} aria-hidden />
        </FloatingSideToolbarButton>
        {hasInteractiveVocab && onInteractiveVocabToggle ? (
          <FloatingSideToolbarButton
            className={cn(interactiveVocabOpen && FLOATING_SIDE_TOOLBAR_BUTTON_ACTIVE)}
            aria-label={interactiveVocabOpen ? 'Close vocabulary' : 'Open vocabulary'}
            aria-pressed={interactiveVocabOpen}
            title="Vocabulary for this spread"
            onClick={onInteractiveVocabToggle}
          >
            <BookOpen className={FLOATING_SIDE_TOOLBAR_ICON} aria-hidden />
          </FloatingSideToolbarButton>
        ) : null}
        {hasReadingChecks && onReadingChecksToggle ? (
          <FloatingSideToolbarButton
            className={cn(readingChecksOpen && FLOATING_SIDE_TOOLBAR_BUTTON_ACTIVE)}
            aria-label={readingChecksOpen ? 'Close reading checks' : 'Open reading checks'}
            aria-pressed={readingChecksOpen}
            title="Reading checks for this story"
            onClick={onReadingChecksToggle}
          >
            <ListChecks className={FLOATING_SIDE_TOOLBAR_ICON} aria-hidden />
          </FloatingSideToolbarButton>
        ) : null}
      </RailIconStack>

      <RailIconStack>
        {onToolboxToggle ? (
          <FloatingSideToolbarButton
            className={cn(toolboxOpen && FLOATING_SIDE_TOOLBAR_BUTTON_ACTIVE)}
            aria-label={toolboxOpen ? 'Close toolbox' : 'Open toolbox'}
            aria-pressed={toolboxOpen}
            title="Toolbox"
            onClick={onToolboxToggle}
            data-class-toolbox-anchor
          >
            <Wrench className={FLOATING_SIDE_TOOLBAR_ICON} aria-hidden />
          </FloatingSideToolbarButton>
        ) : null}
        <FloatingSideToolbarButton
          className={cn(translateDockOpen && FLOATING_SIDE_TOOLBAR_BUTTON_ACTIVE)}
          aria-label={translateDockOpen ? 'Close translate dock' : 'Open translate dock'}
          aria-pressed={translateDockOpen}
          title={`Translate to Chinese (${SC.translate})`}
          onClick={onTranslateDockToggle}
          data-book-translate-anchor
        >
          <Languages className={FLOATING_SIDE_TOOLBAR_ICON} />
        </FloatingSideToolbarButton>
        <FloatingSideToolbarButton
          aria-label="Open teacher coach on phone"
          title="Coach on phone (same Wi‑Fi)"
          onClick={onOpenCoachDialog}
        >
          <Smartphone className={FLOATING_SIDE_TOOLBAR_ICON} />
        </FloatingSideToolbarButton>
        {onLessonSettingsToggle ? (
          <FloatingSideToolbarButton
            className={cn(lessonSettingsOpen && FLOATING_SIDE_TOOLBAR_BUTTON_ACTIVE)}
            aria-label={lessonSettingsOpen ? 'Close lesson settings' : 'Open lesson settings'}
            aria-pressed={lessonSettingsOpen}
            title="Lesson settings"
            onClick={onLessonSettingsToggle}
          >
            <Settings className={FLOATING_SIDE_TOOLBAR_ICON} aria-hidden />
          </FloatingSideToolbarButton>
        ) : null}
      </RailIconStack>
    </div>
  )
}
