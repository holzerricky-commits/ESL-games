'use client'

import { Bold, BookMarked, Heading3, Languages, List, PanelRightClose, PenLine } from 'lucide-react'
import { useEffect, useState, type ClipboardEvent, type MutableRefObject } from 'react'
import { CoachDictationLessonPaperChip } from '@/components/lesson-coach/coach-dictation-lesson-paper-chip'
import {
  CoachSentenceGrammarPanel,
  shouldShowGrammarPanel,
} from '@/components/lesson-coach/coach-sentence-grammar-rail'
import { useLessonCoachSync } from '@/lib/lesson-coach/lesson-coach-sync-context'
import { getContentEditablePlainText } from '@/lib/writing-assist/caret-text'
import { useWritingAssist } from '@/lib/writing-assist/use-writing-assist'
import { useSpellMarkerSpans } from '@/lib/writing-assist/use-spell-marker-spans'
import { WritingAssistGhostUi } from '@/components/writing-assist/writing-assist-ghost-hint'
import { WritingAssistSpellMirror } from '@/components/writing-assist/writing-assist-spell-mirror'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isNotebookDocEmpty } from '@/lib/books/notebook-doc-empty'
import { LessonPaperDockTab } from './LessonPaperDockTab'
import { NotebookSourceNav } from './NotebookSourceNav'

const LESSON_PAPER_PANEL_ID = 'lesson-paper-panel'

type LessonPaperSaveState = 'idle' | 'typing' | 'saving' | 'saved' | 'error'

function lessonPaperSaveLabel(state: LessonPaperSaveState): string {
  switch (state) {
    case 'typing':
      return 'Unsaved'
    case 'saving':
      return 'Saving…'
    case 'saved':
      return 'Saved'
    case 'error':
      return 'Save failed'
    default:
      return ''
  }
}

interface LessonPaperPanelProps {
  hasResolvedUnit: boolean
  isLessonPaperOpen: boolean
  setIsLessonPaperOpen: (v: boolean) => void
  lessonPaperSaveState: LessonPaperSaveState
  notebookEditable: boolean
  lessonPaperEditVersion: number
  lessonPaperHtml: string
  pageNumber: number
  notebookReturnPage: number | null
  onGoToNotebookSourcePage: (page: number) => void
  onReturnToNotebookCurrentPage: () => void
  onStartNotebookNote: () => void
  onOpenWhiteboardForCapture: () => void
  onOpenTranslateDock: () => void
  ANIMATION_MS: number
  applyLessonPaperCommand: (command: 'bold' | 'insertUnorderedList' | 'formatBlock') => void
  lessonPaperScrollRef: MutableRefObject<HTMLDivElement | null>
  lessonPaperLastPartContextKeyRef: MutableRefObject<string | null>
  selectedUnitTitle?: string
  lessonPaperHeader: { title: string; dateLabel: string; lessonPartLabel: string; pageLabel: string } | null
  lessonPaperBreadcrumb: string
  currentNotebookPageSpanKey: string
  lessonPaperEditorRef: MutableRefObject<HTMLDivElement | null>
  onLessonPaperInput: () => void
  onLessonPaperPaste: (e: ClipboardEvent<HTMLDivElement>) => void
  lessonPaperScrollRunwayPx: number
}

export function LessonPaperPanel({
  hasResolvedUnit,
  isLessonPaperOpen,
  setIsLessonPaperOpen,
  lessonPaperSaveState,
  notebookEditable,
  lessonPaperEditVersion,
  lessonPaperHtml,
  pageNumber,
  notebookReturnPage,
  onGoToNotebookSourcePage,
  onReturnToNotebookCurrentPage,
  onStartNotebookNote,
  onOpenWhiteboardForCapture,
  onOpenTranslateDock,
  ANIMATION_MS,
  applyLessonPaperCommand,
  lessonPaperScrollRef,
  lessonPaperLastPartContextKeyRef,
  selectedUnitTitle,
  lessonPaperHeader,
  lessonPaperBreadcrumb,
  currentNotebookPageSpanKey,
  lessonPaperEditorRef,
  onLessonPaperInput,
  onLessonPaperPaste,
  lessonPaperScrollRunwayPx,
}: LessonPaperPanelProps) {
  const coach = useLessonCoachSync()

  const {
    bindContentEditable,
    ghost,
    ghostPartial,
    ghostCandidates,
    ghostIndex,
  } = useWritingAssist()

  const [lessonPaperPlainForAssist, setLessonPaperPlainForAssist] = useState('')

  const lessonPaperAssist = bindContentEditable({
    editorRef: lessonPaperEditorRef,
    onSync: onLessonPaperInput,
    dictationMode: coach.dictationMode,
  })

  useEffect(() => {
    if (!lessonPaperEditorRef.current) return
    setLessonPaperPlainForAssist(getContentEditablePlainText(lessonPaperEditorRef.current))
  }, [lessonPaperEditVersion, lessonPaperEditorRef, lessonPaperHtml])

  const spellSpans = useSpellMarkerSpans(
    lessonPaperPlainForAssist,
    notebookEditable && !coach.dictationMode,
  )

  const handleLessonPaperEditorInput = () => {
    onLessonPaperInput()
    lessonPaperAssist.onInput?.()
    if (lessonPaperEditorRef.current) {
      setLessonPaperPlainForAssist(getContentEditablePlainText(lessonPaperEditorRef.current))
    }
    if (coach.sessionId && lessonPaperEditorRef.current) {
      coach.syncSharedText(
        getContentEditablePlainText(lessonPaperEditorRef.current),
        'lesson-paper',
      )
    }
  }

  const lessonPaperText = lessonPaperEditorRef.current
    ? getContentEditablePlainText(lessonPaperEditorRef.current)
    : ''
  void lessonPaperEditVersion
  const lessonPaperGrammarVisible = shouldShowGrammarPanel(
    'lesson-paper',
    lessonPaperText,
    coach.sessionId,
    coach.activeField,
    coach.session?.activeField,
  )

  if (!hasResolvedUnit) return null

  const saveLabel = lessonPaperSaveLabel(lessonPaperSaveState)
  const canType = notebookEditable
  const showEmptyState = notebookEditable && isNotebookDocEmpty(lessonPaperHtml)

  return (
    <div
      className="pointer-events-auto absolute right-0 top-0 z-[70] flex h-full min-h-0 flex-row items-stretch will-change-transform motion-reduce:transition-none"
      style={{
        transform: isLessonPaperOpen ? 'translateX(0)' : 'translateX(25vw)',
        transition: `transform ${ANIMATION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
      }}
    >
      <LessonPaperDockTab
        isOpen={isLessonPaperOpen}
        onToggle={() => setIsLessonPaperOpen(!isLessonPaperOpen)}
        panelId={LESSON_PAPER_PANEL_ID}
      />
      <aside
        id={LESSON_PAPER_PANEL_ID}
        inert={!isLessonPaperOpen ? true : undefined}
        className={cn(
          'flex h-full min-h-0 w-[25vw] min-w-[25vw] max-w-[25vw] flex-col border-l border-[#d9d9d9] bg-white shadow-[-8px_0_28px_rgba(0,0,0,0.14)]',
          !isLessonPaperOpen && 'pointer-events-none',
        )}
        aria-label="Class log"
      >
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#e6e6e6] bg-white px-3 py-2">
          <p className="min-w-0 flex-1 text-xs font-semibold text-[#4a3b2a]">Class log</p>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
            {saveLabel ? (
              <span
                className={cn(
                  'mr-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  lessonPaperSaveState === 'error' && 'bg-red-100 text-red-700',
                  lessonPaperSaveState === 'saved' && 'bg-emerald-100 text-emerald-800',
                  lessonPaperSaveState === 'saving' && 'bg-amber-100 text-amber-800',
                  (lessonPaperSaveState === 'typing' || lessonPaperSaveState === 'idle') &&
                    'bg-[#f0f0f0] text-[#6b6b6b]',
                )}
                aria-live="polite"
              >
                {saveLabel}
              </span>
            ) : null}
            <CoachDictationLessonPaperChip />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-[#3d2918]"
              onClick={() => applyLessonPaperCommand('bold')}
              disabled={!canType}
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
              disabled={!canType}
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
              disabled={!canType}
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
                {lessonPaperBreadcrumb ||
                  [selectedUnitTitle, lessonPaperHeader?.lessonPartLabel, currentNotebookPageSpanKey]
                    .filter(Boolean)
                    .join(' > ')}
              </p>
            ) : null}
            {!notebookEditable ? (
              <div className="mb-4 rounded-md border border-amber-300/60 bg-amber-50 px-2 py-1.5">
                <p className="text-xs text-amber-900">
                  Start a live class (from Classes → Start class) to enable notebook typing and saving.
                </p>
              </div>
            ) : showEmptyState ? (
              <div className="mb-4 rounded-md border border-dashed border-[#5c4030]/25 bg-[#faf8f5] px-3 py-3">
                <p className="mb-2 text-sm font-semibold text-[#4a3b2a]">Start this lesson part</p>
                <p className="mb-3 text-xs text-[#6b6b6b]">
                  Nothing is written here yet. Choose an action — browsing pages alone will not create notes.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1 bg-[#5c4030] text-xs text-white hover:bg-[#5c4030]/90"
                    onClick={onStartNotebookNote}
                  >
                    <PenLine className="h-3.5 w-3.5" aria-hidden />
                    Start note
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 border-[#2f6fed]/30 text-xs text-[#1f4fb8]"
                    onClick={onOpenWhiteboardForCapture}
                  >
                    <BookMarked className="h-3.5 w-3.5" aria-hidden />
                    Capture whiteboard
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 border-[#5c4030]/25 text-xs text-[#3d2918]"
                    onClick={onOpenTranslateDock}
                  >
                    <Languages className="h-3.5 w-3.5" aria-hidden />
                    Add vocab
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-md border border-[#2f6fed]/20 bg-[#2f6fed]/8 px-2 py-1">
                <p className="text-xs text-[#1f4fb8]">
                  Notes save automatically while you type. Use the whiteboard for drawings; paste images inline here.
                </p>
              </div>
            )}
            <NotebookSourceNav
              lessonPaperHtml={lessonPaperHtml}
              lessonPaperEditVersion={lessonPaperEditVersion}
              currentPageNumber={pageNumber}
              notebookReturnPage={notebookReturnPage}
              onGoToSourcePage={onGoToNotebookSourcePage}
              onReturnToCurrentPage={onReturnToNotebookCurrentPage}
            />
            <div className="relative mt-8 min-h-full">
              <div className="flex w-full flex-col items-stretch gap-0">
                <div className="relative min-w-0 w-full">
                  {notebookEditable && !coach.dictationMode ? (
                    <WritingAssistSpellMirror
                      text={lessonPaperPlainForAssist}
                      spans={spellSpans}
                      className="px-0 py-0"
                      style={{
                        fontFamily:
                          '"Avenir Next Rounded", "Nunito", "Trebuchet MS", "Segoe UI", sans-serif',
                        fontSize: '1.5rem',
                        fontWeight: 600,
                        lineHeight: 1.75,
                        color: '#2f2f2f',
                        minHeight: '8rem',
                      }}
                    />
                  ) : null}
                  <div
                    ref={lessonPaperEditorRef}
                    className={`relative z-[1] min-h-[8rem] w-full p-0 text-[1.5rem] font-semibold leading-[1.75] text-[#2f2f2f] outline-none caret-[#2f2f2f] empty:before:pointer-events-none empty:before:text-[#9ca3af] empty:before:content-[attr(data-placeholder)] ${
                      canType ? 'cursor-text' : 'pointer-events-none opacity-95'
                    }`}
                    contentEditable={canType}
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="Lesson paper editor"
                    spellCheck={lessonPaperAssist.spellCheck}
                    autoCorrect={lessonPaperAssist.autoCorrect}
                    autoCapitalize={lessonPaperAssist.autoCapitalize}
                    data-writing-assist={lessonPaperAssist['data-writing-assist']}
                    onInput={handleLessonPaperEditorInput}
                    onFocus={() => {
                      if (!lessonPaperEditorRef.current) return
                      coach.registerActiveTextSink({
                        getValue: () => getContentEditablePlainText(lessonPaperEditorRef.current!),
                        setValue: (next) => {
                          if (lessonPaperEditorRef.current) {
                            lessonPaperEditorRef.current.textContent = next
                          }
                        },
                        field: 'lesson-paper',
                      })
                    }}
                    onBlur={() => coach.registerActiveTextSink(null)}
                    onPaste={onLessonPaperPaste}
                    onKeyDown={lessonPaperAssist.onKeyDown}
                    data-placeholder="Type notes here. Paste text or images directly."
                    style={{
                      fontFamily:
                        '"Avenir Next Rounded", "Nunito", "Trebuchet MS", "Segoe UI", sans-serif',
                    }}
                  />
                  {canType && !coach.dictationMode && lessonPaperPlainForAssist.length > 0 ? (
                    <WritingAssistGhostUi
                      text={lessonPaperPlainForAssist}
                      ghost={ghost}
                      partial={ghostPartial}
                      candidates={ghostCandidates}
                      candidateIndex={ghostIndex}
                      mirrorStyle={{
                        fontFamily:
                          '"Avenir Next Rounded", "Nunito", "Trebuchet MS", "Segoe UI", sans-serif',
                        fontSize: '1.5rem',
                        fontWeight: 600,
                        lineHeight: 1.75,
                        minHeight: '8rem',
                      }}
                      stripClassName="-top-10"
                    />
                  ) : null}
                </div>
                {lessonPaperGrammarVisible ? (
                  <CoachSentenceGrammarPanel
                    text={lessonPaperText}
                    coachField="lesson-paper"
                    variant="paper"
                  />
                ) : null}
              </div>
            </div>
            <div aria-hidden style={{ height: `${lessonPaperScrollRunwayPx}px` }} />
          </div>
        </div>
      </aside>
    </div>
  )
}
