'use client'

import { Pencil, PencilLine, RectangleHorizontal, RectangleVertical, X } from 'lucide-react'
import { LessonBoardNewPageMenu } from '@/components/students/fullscreen-book-overlay/sections/LessonBoardNewPageMenu'
import type { LessonBoardPageOrientation } from '@/lib/books/lesson-board-types'
import type { MutableRefObject, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { LessonBoardPageThumbnail } from '@/components/students/fullscreen-book-overlay/sections/LessonBoardPageThumbnail'
import { Button } from '@/components/ui/button'
import {
  lessonBoardPageDisplayLabel,
  orderLessonBoardPagesForToc,
} from '@/lib/books/lesson-board-session-ops'
import { mapPdfPageToDisplayLabel, type PageNumberingMode } from '@/lib/books/page-numbering'
import { PDF_THUMB_WIDTH } from '@/lib/books/pdf-thumbnail-cache'
import {
  BOOK_PAGE_LIST_RAIL_WIDTH_PX,
  BOOK_WORKSPACE_LEFT_BAR_WIDTH,
} from '@/components/students/fullscreen-book-overlay/constants'
import type { WhiteboardSessionDocument } from '@/lib/books/whiteboard-session-types'
import type { BookLibraryPayload } from '@/lib/books/types'
import { cn } from '@/lib/utils'

export type PageListRailTab = 'book' | 'board'

interface PageListRailProps {
  hasResolvedUnit: boolean
  numPages: number | null
  isPageListOpen: boolean
  selectedUnitTitle?: string
  pageListNumbers: number[]
  pageNumber: number
  showSpreadRightPage: boolean
  spreadRightPage: number | null
  unitThumbFileUrl: string
  selectedUnitId: string
  pageListScrollRoot: HTMLDivElement | null
  setPageListScrollRoot: (el: HTMLDivElement | null) => void
  pdfReady: boolean
  selectedBook: BookLibraryPayload['books'][number] | null
  selectedUnit: NonNullable<BookLibraryPayload['books'][number]['units']>[number] | null
  numberingMode: PageNumberingMode
  activePageRowRef: MutableRefObject<HTMLButtonElement | null>
  goToPage: (page: number) => void
  setIsPageListOpen: (open: boolean) => void
  isWhiteboardOpen: boolean
  pageListRailTab: PageListRailTab
  setPageListRailTab: (tab: PageListRailTab) => void
  whiteboardSessionDoc: WhiteboardSessionDocument | null
  onSelectLessonBoardPage: (pageId: string) => void
  onNewLessonBoardPage?: (orientation: LessonBoardPageOrientation) => void
  onRenameLessonBoardPage?: (pageId: string, title: string | undefined) => void
  lessonBoardActivePageRowRef: MutableRefObject<HTMLDivElement | null>
}

function RailTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-w-0 flex-1 rounded-md px-1.5 py-1 text-[10px] font-semibold leading-none transition-colors',
        active
          ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/10'
          : 'text-[#a1a1aa] hover:bg-white/10 hover:text-white/90',
      )}
    >
      {children}
    </button>
  )
}

export function PageListRail({
  hasResolvedUnit,
  numPages,
  isPageListOpen,
  selectedUnitTitle,
  pageListNumbers,
  pageNumber,
  showSpreadRightPage,
  spreadRightPage,
  unitThumbFileUrl,
  selectedUnitId,
  pageListScrollRoot,
  setPageListScrollRoot,
  pdfReady,
  selectedBook,
  selectedUnit,
  numberingMode,
  activePageRowRef,
  goToPage,
  setIsPageListOpen,
  isWhiteboardOpen,
  pageListRailTab,
  setPageListRailTab,
  whiteboardSessionDoc,
  onSelectLessonBoardPage,
  onNewLessonBoardPage,
  onRenameLessonBoardPage,
  lessonBoardActivePageRowRef,
}: PageListRailProps) {
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const showBoardTab = isWhiteboardOpen && whiteboardSessionDoc != null
  const activeTab: PageListRailTab = showBoardTab ? pageListRailTab : 'book'

  const boardPageRows = useMemo(
    () => orderLessonBoardPagesForToc(whiteboardSessionDoc?.pages ?? []),
    [whiteboardSessionDoc?.pages],
  )

  useEffect(() => {
    if (!showBoardTab && pageListRailTab === 'board') {
      setPageListRailTab('book')
    }
  }, [pageListRailTab, setPageListRailTab, showBoardTab])

  useEffect(() => {
    if (!isPageListOpen || activeTab !== 'board') return
    lessonBoardActivePageRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeTab, isPageListOpen, lessonBoardActivePageRowRef, whiteboardSessionDoc?.activePageId])

  if (!hasResolvedUnit || numPages == null) return null

  const activeBoardPageId = whiteboardSessionDoc?.activePageId ?? ''

  const commitRename = (pageId: string) => {
    onRenameLessonBoardPage?.(pageId, renameDraft)
    setRenamingPageId(null)
    setRenameDraft('')
  }

  const startRename = (pageId: string, index: number, currentTitle?: string) => {
    if (!onRenameLessonBoardPage) return
    setRenamingPageId(pageId)
    setRenameDraft(currentTitle?.trim() || `Page ${index + 1}`)
  }

  const formatBookHint = (hint: number | undefined) => {
    if (hint == null || !(hint >= 1)) return null
    const display = mapPdfPageToDisplayLabel(
      hint,
      selectedBook,
      selectedUnit,
      numPages,
      numberingMode,
    )
    return `Book p.${display}`
  }

  return (
    <>
      <div
        className={cn(
          'absolute inset-y-0 z-50 flex min-h-0 flex-col overflow-hidden border-r border-white/10 bg-[#2a2a2e] text-[#a1a1aa] shadow-[4px_0_16px_rgba(0,0,0,0.35)] transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          isPageListOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none',
        )}
        style={{
          left: BOOK_WORKSPACE_LEFT_BAR_WIDTH,
          width: `min(${BOOK_PAGE_LIST_RAIL_WIDTH_PX}px, calc(100vw - ${BOOK_WORKSPACE_LEFT_BAR_WIDTH} - 12px))`,
        }}
        aria-hidden={!isPageListOpen}
      >
        <header className="flex shrink-0 flex-col gap-1.5 border-b border-white/10 px-2 py-2">
          <div className="flex items-center justify-between gap-1.5">
            <p className="min-w-0 truncate text-[11px] font-semibold leading-tight text-white/90">
              {activeTab === 'board' ? 'Lesson board' : selectedUnitTitle}
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-md border-white/15 bg-white/5 p-0 text-[#a1a1aa] hover:bg-white/10 hover:text-white"
              onClick={() => setIsPageListOpen(false)}
              aria-label="Close page list"
            >
              <X size={14} />
            </Button>
          </div>
          {showBoardTab ? (
            <div className="flex gap-1 rounded-lg bg-black/20 p-0.5" role="tablist" aria-label="Page list mode">
              <RailTabButton active={activeTab === 'book'} onClick={() => setPageListRailTab('book')}>
                Book
              </RailTabButton>
              <RailTabButton active={activeTab === 'board'} onClick={() => setPageListRailTab('board')}>
                Board
              </RailTabButton>
            </div>
          ) : null}
        </header>
        <div
          id={activeTab === 'board' ? 'lesson-board-page-list' : 'book-page-list'}
          ref={setPageListScrollRoot}
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="list"
        >
          {activeTab === 'book'
            ? pageListNumbers.map((p) => {
                const rowActive =
                  p === pageNumber || (showSpreadRightPage && p === spreadRightPage)
                return (
                  <button
                    key={p}
                    type="button"
                    ref={p === pageNumber ? activePageRowRef : undefined}
                    role="listitem"
                    onClick={() => goToPage(p)}
                    className={cn(
                      'flex w-full flex-col items-center gap-0.5 rounded-md py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-1 focus-visible:ring-offset-[#2a2a2e]',
                      rowActive ? 'bg-white/15 ring-1 ring-white/20' : 'hover:bg-white/10',
                    )}
                  >
                    <PdfPageThumbnail
                      fileUrl={unitThumbFileUrl}
                      unitId={selectedUnitId}
                      pageNumber={p}
                      width={PDF_THUMB_WIDTH}
                      scrollRoot={pageListScrollRoot}
                      pdfReady={pdfReady}
                      label={`Page ${mapPdfPageToDisplayLabel(p, selectedBook, selectedUnit, numPages, numberingMode)}`}
                    />
                    <span
                      className={cn(
                        'tabular-nums text-[10px] leading-none',
                        rowActive ? 'font-semibold text-white' : 'font-medium text-[#a1a1aa]',
                      )}
                    >
                      {mapPdfPageToDisplayLabel(p, selectedBook, selectedUnit, numPages, numberingMode)}
                    </span>
                  </button>
                )
              })
            : boardPageRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-1 py-8 text-center">
                  <PencilLine className="h-5 w-5 text-[#a1a1aa]/50" aria-hidden />
                  <p className="text-[10px] font-medium leading-snug text-[#a1a1aa]/70">
                    No board pages yet. Tap New page below.
                  </p>
                </div>
              )
            : boardPageRows.map(({ page, index }) => {
                const rowActive = page.id === activeBoardPageId
                const label = lessonBoardPageDisplayLabel(page, index)
                const bookHint = formatBookHint(page.bookPageHint)
                const commands =
                  rowActive && whiteboardSessionDoc
                    ? whiteboardSessionDoc.commands
                    : page.commands
                return (
                  <div
                    key={page.id}
                    role="listitem"
                    ref={rowActive ? lessonBoardActivePageRowRef : undefined}
                    className={cn(
                      'flex w-full flex-col items-center gap-0.5 rounded-md py-1.5 outline-none transition-colors',
                      rowActive ? 'bg-white/15 ring-1 ring-white/20' : 'hover:bg-white/10',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectLessonBoardPage(page.id)}
                      className="flex w-full flex-col items-center gap-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-1 focus-visible:ring-offset-[#2a2a2e]"
                    >
                      <LessonBoardPageThumbnail
                        commands={commands}
                        orientation={page.orientation}
                        scrollRoot={pageListScrollRoot}
                        label={label}
                      />
                    </button>
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
                        className="w-full rounded border border-white/15 bg-[#1f1f23] px-1.5 py-0.5 text-center text-[10px] text-white outline-none focus:ring-1 focus:ring-white/25"
                        aria-label="Rename board page"
                      />
                    ) : (
                      <div className="flex w-full max-w-full flex-col items-center gap-0.5 px-0.5">
                        <div className="flex max-w-full items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => onSelectLessonBoardPage(page.id)}
                            onDoubleClick={(e) => {
                              e.preventDefault()
                              startRename(page.id, index, page.title)
                            }}
                            title={
                              onRenameLessonBoardPage
                                ? 'Open page · double-click to rename'
                                : undefined
                            }
                            className={cn(
                              'flex min-w-0 items-center justify-center gap-1 truncate px-0.5 text-[10px] leading-tight',
                              rowActive ? 'font-semibold text-white' : 'font-medium text-[#a1a1aa]',
                            )}
                          >
                            {page.orientation === 'wide' ? (
                              <RectangleHorizontal className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                            ) : (
                              <RectangleVertical className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                            )}
                            <span className="truncate">{label}</span>
                          </button>
                          {onRenameLessonBoardPage ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                startRename(page.id, index, page.title)
                              }}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#a1a1aa] transition-colors hover:bg-white/10 hover:text-white"
                              aria-label={`Rename ${label}`}
                              title="Rename page"
                            >
                              <Pencil className="h-3 w-3" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                        {bookHint ? (
                          <span
                            className={cn(
                              'tabular-nums text-[9px] leading-none',
                              rowActive ? 'text-white/70' : 'text-[#71717a]',
                            )}
                          >
                            {bookHint}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
        </div>
        {activeTab === 'board' && onNewLessonBoardPage ? (
          <div className="shrink-0 border-t border-white/10 px-2 py-2">
            <LessonBoardNewPageMenu variant="footer" onCreatePage={onNewLessonBoardPage} />
          </div>
        ) : null}
      </div>
      {isPageListOpen ? (
        <button
          type="button"
          onClick={() => setIsPageListOpen(false)}
          aria-label="Close page list"
          className="absolute inset-0 z-40 bg-black/45"
        ></button>
      ) : null}
    </>
  )
}
