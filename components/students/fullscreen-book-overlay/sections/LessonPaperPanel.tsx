import { Bold, Heading3, List, MousePointer2, PanelRightClose, PenTool, Type } from 'lucide-react'
import type { ClipboardEvent, MutableRefObject } from 'react'
import { BookPageAnnotationLayer } from '@/components/students/book-page-annotation-layer'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { StampVariant } from '@/lib/books/annotation-command-types'
import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'

interface LessonPaperPanelProps {
  hasResolvedUnit: boolean
  isLessonPaperOpen: boolean
  setIsLessonPaperOpen: (v: boolean) => void
  lessonPaperMode: 'type' | 'draw' | 'select'
  setLessonPaperMode: (v: 'type' | 'draw' | 'select') => void
  scheduleLessonPaperEditorFocus: (placeCaretAtEnd?: boolean) => void
  lessonPaperDrawTool: 'pen' | 'highlighter'
  setLessonPaperDrawTool: (v: 'pen' | 'highlighter') => void
  applyLessonPaperCommand: (command: 'bold' | 'insertUnorderedList' | 'formatBlock') => void
  lessonPaperScrollRef: MutableRefObject<HTMLDivElement | null>
  lessonPaperLastPartContextKeyRef: MutableRefObject<string | null>
  selectedUnitTitle?: string
  lessonPaperHeader: { title: string; dateLabel: string; lessonPartLabel: string; pageLabel: string } | null
  lessonPaperBreadcrumb: string
  currentNotebookPageSpanKey: string
  lessonPaperOverlayHostRef: MutableRefObject<HTMLDivElement | null>
  lessonPaperEditorRef: MutableRefObject<HTMLDivElement | null>
  onLessonPaperInput: () => void
  onLessonPaperPaste: (e: ClipboardEvent<HTMLDivElement>) => void
  selectedBookId: string | null
  studentId: string
  selectedUnitId?: string
  lessonPaperOverlayPageNumber: number
  lessonPaperOverlaySize: { w: number; h: number }
  lessonPaperOverlayMode: BookAnnotationInteractionMode
  stampVariant: StampVariant
  lessonPaperOverlayImages: Array<{ id: string; src: string; xNorm: number; yNorm: number; widthNorm: number }>
  lessonPaperOverlayDragRef: MutableRefObject<{
    id: string
    startX: number
    startY: number
    initialXNorm: number
    initialYNorm: number
  } | null>
  lessonPaperScrollRunwayPx: number
}

export function LessonPaperPanel({
  hasResolvedUnit,
  isLessonPaperOpen,
  setIsLessonPaperOpen,
  lessonPaperMode,
  setLessonPaperMode,
  scheduleLessonPaperEditorFocus,
  lessonPaperDrawTool,
  setLessonPaperDrawTool,
  applyLessonPaperCommand,
  lessonPaperScrollRef,
  lessonPaperLastPartContextKeyRef,
  selectedUnitTitle,
  lessonPaperHeader,
  lessonPaperBreadcrumb,
  currentNotebookPageSpanKey,
  lessonPaperOverlayHostRef,
  lessonPaperEditorRef,
  onLessonPaperInput,
  onLessonPaperPaste,
  selectedBookId,
  studentId,
  selectedUnitId,
  lessonPaperOverlayPageNumber,
  lessonPaperOverlaySize,
  lessonPaperOverlayMode,
  stampVariant,
  lessonPaperOverlayImages,
  lessonPaperOverlayDragRef,
  lessonPaperScrollRunwayPx,
}: LessonPaperPanelProps) {
  if (!hasResolvedUnit) return null

  return (
    <aside
      className={cn(
        'absolute right-0 top-0 z-[70] flex h-full min-h-0 w-[25vw] min-w-[25vw] max-w-[25vw] flex-col border-l border-[#d9d9d9] bg-white shadow-[-8px_0_28px_rgba(0,0,0,0.14)] transition-[transform,opacity] duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
        isLessonPaperOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none',
      )}
      aria-label="Notebook mode"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#e6e6e6] bg-white px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap items-center rounded-md border border-[#dadada] bg-white p-0.5">
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs font-semibold ${lessonPaperMode === 'type' ? 'bg-[#f0f0f0] text-[#2f2f2f]' : 'text-[#6b6b6b]'}`}
              onClick={() => {
                setLessonPaperMode('type')
                scheduleLessonPaperEditorFocus(true)
              }}
              aria-pressed={lessonPaperMode === 'type'}
            >
              <span className="inline-flex items-center gap-1">
                <Type className="h-3.5 w-3.5" />
                Type
              </span>
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs font-semibold ${lessonPaperMode === 'draw' ? 'bg-[#f0f0f0] text-[#2f2f2f]' : 'text-[#6b6b6b]'}`}
              onClick={() => setLessonPaperMode('draw')}
              aria-pressed={lessonPaperMode === 'draw'}
            >
              <span className="inline-flex items-center gap-1">
                <PenTool className="h-3.5 w-3.5" />
                Draw
              </span>
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs font-semibold ${lessonPaperMode === 'select' ? 'bg-[#f0f0f0] text-[#2f2f2f]' : 'text-[#6b6b6b]'}`}
              onClick={() => setLessonPaperMode('select')}
              aria-pressed={lessonPaperMode === 'select'}
            >
              <span className="inline-flex items-center gap-1">
                <MousePointer2 className="h-3.5 w-3.5" />
                Select
              </span>
            </button>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          {lessonPaperMode === 'draw' ? (
            <div className="mr-1 inline-flex flex-wrap items-center rounded-md border border-[#dadada] bg-white p-0.5">
              <button
                type="button"
                className={`rounded px-2 py-1 text-xs font-semibold ${lessonPaperDrawTool === 'pen' ? 'bg-[#f0f0f0] text-[#2f2f2f]' : 'text-[#6b6b6b]'}`}
                onClick={() => setLessonPaperDrawTool('pen')}
                aria-pressed={lessonPaperDrawTool === 'pen'}
              >
                Pen
              </button>
              <button
                type="button"
                className={`rounded px-2 py-1 text-xs font-semibold ${lessonPaperDrawTool === 'highlighter' ? 'bg-[#f0f0f0] text-[#2f2f2f]' : 'text-[#6b6b6b]'}`}
                onClick={() => setLessonPaperDrawTool('highlighter')}
                aria-pressed={lessonPaperDrawTool === 'highlighter'}
              >
                Highlighter
              </button>
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-[#3d2918]"
            onClick={() => applyLessonPaperCommand('bold')}
            disabled={lessonPaperMode !== 'type'}
            aria-label="Bold"
          >
            <Bold className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-[#3d2918]"
            onClick={() => applyLessonPaperCommand('insertUnorderedList')}
            disabled={lessonPaperMode !== 'type'}
            aria-label="Bullet list"
          >
            <List className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-[#3d2918]"
            onClick={() => applyLessonPaperCommand('formatBlock')}
            disabled={lessonPaperMode !== 'type'}
            aria-label="Heading"
          >
            <Heading3 className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1 text-[#3d2918]"
            onClick={() => setIsLessonPaperOpen(false)}
            aria-label="Back to book"
          >
            <PanelRightClose className="h-4 w-4" aria-hidden />
            <span className="text-xs font-semibold">Back to book</span>
          </Button>
        </div>
      </header>
      <div ref={lessonPaperScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
        <div
          className="min-h-0 bg-white px-3 pt-4 pb-24"
          onPointerDown={(e) => {
            if (lessonPaperMode !== 'type') return
            const target = e.target as HTMLElement | null
            if (!target) return
            const markerEl = target.closest('[data-notebook-marker]') as HTMLElement | null
            if (markerEl) {
              const contextKey = markerEl.getAttribute('data-notebook-context')
              if (contextKey && contextKey.trim()) {
                lessonPaperLastPartContextKeyRef.current = contextKey.trim()
              }
              return
            }
            if (target.closest('[contenteditable="true"]')) return
            if (target.closest('button,select,input,textarea,a,label')) return
          }}
          style={{
            backgroundColor: '#ffffff',
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(92, 72, 48, 0.07) 28px)',
          }}
        >
          <div className="mb-3 flex items-start justify-between gap-3 text-[#4a3b2a]" aria-label="Lesson header">
            <p className="text-2xl font-semibold leading-tight text-[#4a3b2a]/70">
              {lessonPaperHeader?.title?.trim() || 'Untitled section'}
            </p>
            <div className="shrink-0 text-right text-xs font-medium text-[#6b553b]">
              <span>{lessonPaperHeader?.dateLabel?.trim() || ''}</span>
              {lessonPaperHeader?.pageLabel?.trim() ? <span> · {lessonPaperHeader.pageLabel}</span> : null}
            </div>
          </div>
          {(lessonPaperBreadcrumb || lessonPaperHeader?.lessonPartLabel) ? (
            <p className="mb-3 text-xs text-[#6b6b6b]">
              {lessonPaperBreadcrumb || [selectedUnitTitle, lessonPaperHeader?.lessonPartLabel, currentNotebookPageSpanKey]
                .filter(Boolean)
                .join(' > ')}
            </p>
          ) : null}
          <div className="mb-4 rounded-md border border-[#2f6fed]/20 bg-[#2f6fed]/8 px-2 py-1">
            <p className="text-xs text-[#1f4fb8]">
              New page spans append below as headings. Your earlier notes and drawings stay in this same stream.
            </p>
          </div>
          <div ref={lessonPaperOverlayHostRef} className="relative mt-8 min-h-full">
            <div
              ref={lessonPaperEditorRef}
              className={`min-h-full p-0 text-[1.5rem] font-semibold leading-[1.75] text-[#2f2f2f] outline-none ${
                lessonPaperMode === 'type' ? '' : 'pointer-events-none opacity-95'
              }`}
              contentEditable={lessonPaperMode === 'type'}
              suppressContentEditableWarning
              role="textbox"
              aria-label="Lesson paper editor"
              onInput={onLessonPaperInput}
              onPaste={onLessonPaperPaste}
              data-placeholder="Type notes here. Paste text or images directly."
              style={{
                fontFamily: '"Avenir Next Rounded", "Nunito", "Trebuchet MS", "Segoe UI", sans-serif',
              }}
            />
            {selectedBookId && selectedUnitId && lessonPaperOverlaySize.w > 0 && lessonPaperOverlaySize.h > 0 ? (
              <div
                className={`absolute inset-0 ${lessonPaperMode === 'draw' || lessonPaperMode === 'select' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-100'}`}
              >
                <BookPageAnnotationLayer
                  studentId={studentId}
                  bookId={selectedBookId}
                  unitId={selectedUnitId}
                  pageNumber={lessonPaperOverlayPageNumber}
                  storageChannel="whiteboard"
                  widthPx={lessonPaperOverlaySize.w}
                  heightPx={lessonPaperOverlaySize.h}
                  mode={lessonPaperOverlayMode}
                  stampVariant={stampVariant}
                  strokeWidthScale={lessonPaperDrawTool === 'highlighter' ? 1.35 : 1}
                  shapeStrokeWidthScale={1}
                  stampScale={1}
                  strokeColor={lessonPaperDrawTool === 'highlighter' ? '#f6d84a' : '#2f6fed'}
                  shapeColor={lessonPaperDrawTool === 'highlighter' ? '#f6d84a' : '#2f6fed'}
                  textFontSizeNorm={0.024}
                  stickyFontSizeNorm={0.024}
                  defaultStickyWNorm={0.22}
                  defaultStickyHNorm={0.14}
                />
                {lessonPaperOverlayImages.map((img) => (
                  <div
                    key={img.id}
                    className={`absolute ${lessonPaperMode === 'select' ? 'cursor-move' : 'pointer-events-none'} select-none`}
                    style={{
                      left: `${img.xNorm * 100}%`,
                      top: `${img.yNorm * 100}%`,
                      width: `${img.widthNorm * 100}%`,
                    }}
                    onPointerDown={(e) => {
                      if (lessonPaperMode !== 'select') return
                      e.preventDefault()
                      lessonPaperOverlayDragRef.current = {
                        id: img.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        initialXNorm: img.xNorm,
                        initialYNorm: img.yNorm,
                      }
                    }}
                  >
                    <img
                      src={img.src}
                      alt="Overlay pasted"
                      className="block h-auto w-full rounded border border-[#d0d0d0] bg-white shadow-sm"
                      draggable={false}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div aria-hidden style={{ height: `${lessonPaperScrollRunwayPx}px` }} />
        </div>
      </div>
    </aside>
  )
}
