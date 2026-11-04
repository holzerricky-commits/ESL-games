'use client'

import { Pencil, PencilLine, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LessonBoardPageThumbnail } from '@/components/students/fullscreen-book-overlay/sections/LessonBoardPageThumbnail'
import { Button } from '@/components/ui/button'
import {
  lessonBoardPageDisplayLabel,
  orderLessonBoardPagesForToc,
} from '@/lib/books/lesson-board-session-ops'
import type { WhiteboardSessionDocument } from '@/lib/books/whiteboard-session-types'
import { cn } from '@/lib/utils'

const PANEL_WIDTH_PX = 220

function formatBookHint(page: {
  bookPageHint?: number
  primaryLink?: { bookId: string; pdfPage: number }
}): string | null {
  if (page.primaryLink) return `Book p.${page.primaryLink.pdfPage}`
  if (page.bookPageHint == null || !(page.bookPageHint >= 1)) return null
  return `Book p.${page.bookPageHint}`
}

export interface NotebookPageListPanelProps {
  open: boolean
  onClose: () => void
  whiteboardSessionDoc: WhiteboardSessionDocument
  onSelectPage: (pageId: string) => void
  onRenamePage?: (pageId: string, title: string | undefined) => void
}

/** In-notebook pages TOC — opened from the footer page pill. */
export function NotebookPageListPanel({
  open,
  onClose,
  whiteboardSessionDoc,
  onSelectPage,
  onRenamePage,
}: NotebookPageListPanelProps) {
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
  const activeRowRef = useRef<HTMLDivElement | null>(null)

  const boardPageRows = useMemo(
    () => orderLessonBoardPagesForToc(whiteboardSessionDoc.pages ?? []),
    [whiteboardSessionDoc.pages],
  )
  const activePageId = whiteboardSessionDoc.activePageId ?? ''

  useEffect(() => {
    if (!open) return
    activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [open, activePageId])

  useEffect(() => {
    if (!open) {
      setRenamingPageId(null)
      setRenameDraft('')
    }
  }, [open])

  const commitRename = (pageId: string) => {
    onRenamePage?.(pageId, renameDraft)
    setRenamingPageId(null)
    setRenameDraft('')
  }

  const startRename = (pageId: string, index: number, currentTitle?: string) => {
    if (!onRenamePage) return
    setRenamingPageId(pageId)
    setRenameDraft(currentTitle?.trim() || `Page ${index + 1}`)
  }

  return (
    <div
      className={cn(
        'absolute inset-y-0 left-0 z-40 flex w-full max-w-[220px] flex-col border-r border-[#E5E7EB] bg-[#F9FAFB] shadow-[4px_0_16px_rgba(0,0,0,0.08)] transition-transform duration-200 ease-out',
        open ? 'translate-x-0' : '-translate-x-full pointer-events-none',
      )}
      style={{ width: PANEL_WIDTH_PX }}
      aria-hidden={!open}
      aria-label="Notebook pages"
    >
      <header className="flex shrink-0 items-center justify-between gap-1.5 border-b border-[#E5E7EB] px-2.5 py-2">
        <p className="min-w-0 truncate text-[12px] font-semibold text-[#374151]">Pages</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-md text-[#6B7280] hover:bg-black/[0.05] hover:text-[#111827]"
          onClick={onClose}
          aria-label="Close pages list"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </header>
      <div
        ref={setScrollRoot}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
      >
        {boardPageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-2 py-10 text-center">
            <PencilLine className="h-5 w-5 text-[#9CA3AF]" aria-hidden />
            <p className="text-[12px] font-medium leading-snug text-[#9CA3AF]">
              No pages yet. Tap New page below.
            </p>
          </div>
        ) : (
          boardPageRows.map(({ page, index }) => {
            const rowActive = page.id === activePageId
            const label = lessonBoardPageDisplayLabel(page, index)
            const bookHint = formatBookHint(page)
            const commands = rowActive ? whiteboardSessionDoc.commands : page.commands
            return (
              <div
                key={page.id}
                role="listitem"
                ref={rowActive ? activeRowRef : undefined}
                className={cn(
                  'flex w-full items-start gap-2 rounded-lg px-1.5 py-1.5 outline-none transition-colors',
                  rowActive ? 'bg-[#E5E7EB] ring-1 ring-[#D1D5DB]' : 'hover:bg-[#F3F4F6]',
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectPage(page.id)
                    onClose()
                  }}
                  className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#D1D5DB]"
                >
                  <LessonBoardPageThumbnail
                    commands={commands}
                    scrollRoot={scrollRoot}
                    label={label}
                  />
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                  {renamingPageId === page.id ? (
                    <input
                      type="text"
                      value={renameDraft}
                      autoFocus
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={() => commitRename(page.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitRename(page.id)
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setRenamingPageId(null)
                          setRenameDraft('')
                        }
                      }}
                      className="w-full rounded border border-[#D1D5DB] bg-white px-1.5 py-1 text-left text-[12px] text-[#111827] outline-none focus:ring-1 focus:ring-[#9CA3AF]"
                      aria-label="Rename notebook page"
                    />
                  ) : (
                    <div className="flex min-w-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPage(page.id)
                          onClose()
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault()
                          startRename(page.id, index, page.title)
                        }}
                        title={onRenamePage ? 'Open page · double-click to rename' : undefined}
                        className={cn(
                          'min-w-0 flex-1 truncate text-left text-[12.5px] leading-snug',
                          rowActive ? 'font-semibold text-[#111827]' : 'font-medium text-[#4B5563]',
                        )}
                      >
                        {label}
                      </button>
                      {onRenamePage ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            startRename(page.id, index, page.title)
                          }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#9CA3AF] transition-colors hover:bg-black/[0.05] hover:text-[#374151]"
                          aria-label={`Rename ${label}`}
                          title="Rename page"
                        >
                          <Pencil className="h-3 w-3" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  )}
                  {bookHint ? (
                    <span
                      className={cn(
                        'tabular-nums text-[10px] leading-none',
                        rowActive ? 'text-[#6B7280]' : 'text-[#9CA3AF]',
                      )}
                    >
                      {bookHint}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
