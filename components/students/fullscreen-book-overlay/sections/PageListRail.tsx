'use client'

import { PencilLine, RectangleHorizontal, RectangleVertical, X } from 'lucide-react'
import { LessonBoardNewPageMenu } from '@/components/students/fullscreen-book-overlay/sections/LessonBoardNewPageMenu'
import type { LessonBoardPageOrientation } from '@/lib/books/lesson-board-types'
import type { MutableRefObject, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { LessonBoardPageThumbnail } from '@/components/students/fullscreen-book-overlay/sections/LessonBoardPageThumbnail'
import { Button } from '@/components/ui/button'
import { lessonBoardPageDisplayLabel } from '@/lib/books/lesson-board-session-ops'
import { mapPdfPageToDisplayLabel, type PageNumberingMode } from '@/lib/books/page-numbering'
import { PDF_THUMB_WIDTH } from '@/lib/books/pdf-thumbnail-cache'
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
  isSinglePageMode: boolean
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
  lessonBoardActivePageRowRef: MutableRefObject<HTMLButtonElement | null>
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
          ? 'bg-white/80 text-[#2a1d12] shadow-sm ring-1 ring-[#5c4030]/15'
          : 'text-[#5c4030]/75 hover:bg-white/40 hover:text-[#3d2918]',
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
  isSinglePageMode,
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

  const boardPages = whiteboardSessionDoc?.pages ?? []
  const activeBoardPageId = whiteboardSessionDoc?.activePageId ?? ''

  const commitRename = (pageId: string) => {
    onRenameLessonBoardPage?.(pageId, renameDraft)
    setRenamingPageId(null)
    setRenameDraft('')
  }

  return (
    <>
      <div
        className={cn(
          'absolute inset-y-0 left-0 z-50 flex min-h-0 w-[min(168px,calc(100vw-12px))] flex-col border-r border-[#4a3421]/18 bg-gradient-to-b from-[#faf6ef] to-[#e8dfd2] shadow-[4px_0_16px_rgba(12,6,2,0.12)] transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none [scrollbar-gutter:stable]',
          isPageListOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none',
        )}
        aria-hidden={!isPageListOpen}
      >
        <header className="flex shrink-0 flex-col gap-1.5 border-b border-[#4a3421]/12 px-2 py-2">
          <div className="flex items-center justify-between gap-1.5">
            <p className="min-w-0 truncate text-[11px] font-semibold leading-tight text-[#3d2918]">
              {activeTab === 'board' ? 'Lesson board' : selectedUnitTitle}
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-md border-[#5c4030]/25 bg-white/50 p-0 text-[#3d2918] hover:bg-white/80"
              onClick={() => setIsPageListOpen(false)}
              aria-label="Close page list"
            >
              <X size={14} />
            </Button>
          </div>
          {showBoardTab ? (
            <div className="flex gap-1 rounded-lg bg-[#5c4030]/[0.06] p-0.5" role="tablist" aria-label="Page list mode">
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
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-2 [scrollbar-color:rgba(107,78,50,0.3)_transparent] [scrollbar-width:thin]"
          role="list"
        >
          {activeTab === 'book'
            ? pageListNumbers.map((p) => {
                const rowActive = isSinglePageMode
                  ? p === pageNumber
                  : p === pageNumber || (showSpreadRightPage && p === spreadRightPage)
                return (
                  <button
                    key={p}
                    type="button"
                    ref={p === pageNumber ? activePageRowRef : undefined}
                    role="listitem"
                    onClick={() => goToPage(p)}
                    className={cn(
                      'flex w-full flex-col items-center gap-0.5 rounded-md py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-600/45 focus-visible:ring-offset-1 focus-visible:ring-offset-[#faf6ef]',
                      rowActive ? 'bg-amber-200/35 ring-1 ring-amber-700/25' : 'hover:bg-[#5c4030]/[0.06]',
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
                        rowActive ? 'font-semibold text-[#2a1d12]' : 'font-medium text-[#5c4030]/85',
                      )}
                    >
                      {mapPdfPageToDisplayLabel(p, selectedBook, selectedUnit, numPages, numberingMode)}
                    </span>
                  </button>
                )
              })
            : boardPages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-1 py-8 text-center">
                  <PencilLine className="h-5 w-5 text-[#5c4030]/40" aria-hidden />
                  <p className="text-[10px] font-medium leading-snug text-[#5c4030]/70">
                    No board pages yet. Tap New page below.
                  </p>
                </div>
              )
            : boardPages.map((page, index) => {
                const rowActive = page.id === activeBoardPageId
                const label = lessonBoardPageDisplayLabel(page, index)
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
                      rowActive ? 'bg-amber-200/35 ring-1 ring-amber-700/25' : 'hover:bg-[#5c4030]/[0.06]',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectLessonBoardPage(page.id)}
                      className="flex w-full flex-col items-center gap-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-amber-600/45 focus-visible:ring-offset-1 focus-visible:ring-offset-[#faf6ef]"
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
                        className="w-full rounded border border-[#5c4030]/25 bg-white/80 px-1.5 py-0.5 text-center text-[10px] text-[#2a1d12] outline-none focus:ring-1 focus:ring-amber-600/40"
                        aria-label="Rename board page"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectLessonBoardPage(page.id)}
                        onDoubleClick={(e) => {
                          if (!onRenameLessonBoardPage) return
                          e.preventDefault()
                          setRenamingPageId(page.id)
                          setRenameDraft(page.title?.trim() ?? `Page ${index + 1}`)
                        }}
                        title={onRenameLessonBoardPage ? 'Double-click to rename' : undefined}
                        className={cn(
                          'flex max-w-full items-center justify-center gap-1 truncate px-1 text-[10px] leading-tight',
                          rowActive ? 'font-semibold text-[#2a1d12]' : 'font-medium text-[#5c4030]/85',
                        )}
                      >
                        {page.orientation === 'wide' ? (
                          <RectangleHorizontal className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                        ) : (
                          <RectangleVertical className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                        )}
                        <span className="truncate">{label}</span>
                      </button>
                    )}
                  </div>
                )
              })}
        </div>
        {activeTab === 'board' && onNewLessonBoardPage ? (
          <div className="shrink-0 border-t border-[#4a3421]/12 px-2 py-2">
            <LessonBoardNewPageMenu variant="footer" onCreatePage={onNewLessonBoardPage} />
          </div>
        ) : null}
      </div>
      {isPageListOpen ? (
        <button
          type="button"
          onClick={() => setIsPageListOpen(false)}
          aria-label="Close page list"
          className="absolute inset-0 z-40 bg-[#120a03]/45"
        ></button>
      ) : null}
    </>
  )
}
