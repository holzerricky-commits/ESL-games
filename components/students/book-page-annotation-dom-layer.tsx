'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from 'react'
import { X } from 'lucide-react'
import type {
  AnnotationCommand,
  StickyAnnotationCommand,
  TextAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import {
  DEFAULT_STICKY_FILL_COLOR,
  DEFAULT_TEXT_FILL_COLOR,
} from '@/lib/books/annotation-palettes'
import { stickyWritableVariant } from '@/lib/books/sticker-tool'
import {
  writableStickerLayoutMetrics,
  writableStickerChrome,
} from '@/lib/books/writable-sticker-visuals'
import { WritableStickerShell } from '@/components/students/writable-sticker-shell'
import { textTopYFromCenterAnchor } from '@/lib/books/annotation-geometry'
import {
  commitBookOverlayTypingTarget,
  endBookOverlayAnnotationEditingFocus,
  focusBookOverlayAnnotationField,
  getBookOverlayAnnotationFocusGeneration,
  isAnnotationTextFieldFocused,
} from '@/lib/books/book-overlay-keyboard-guards'
import { cn } from '@/lib/utils'
import { CoachDictationSentenceChrome } from '@/components/lesson-coach/coach-dictation-sentence-chrome'
import {
  CoachSentenceGrammarPanel,
  shouldShowGrammarPanel,
} from '@/components/lesson-coach/coach-sentence-grammar-rail'
import { getSharedScreenHighlightIssues } from '@/lib/lesson-coach/issue-reveal'
import { useCoachTextFieldAssist } from '@/lib/lesson-coach/use-coach-text-field-assist'
import { useLessonCoachSyncData } from '@/lib/lesson-coach/lesson-coach-sync-context'
import { WritingAssistGhostUi } from '@/components/writing-assist/writing-assist-ghost-hint'
import { WritingAssistSpellMirror } from '@/components/writing-assist/writing-assist-spell-mirror'
import { useSpellMarkerSpans } from '@/lib/writing-assist/use-spell-marker-spans'
import {
  annotationTextFontFamily,
  type AnnotationTextFontId,
} from '@/lib/books/annotation-text-fonts'
import { plainTextMaxWidthPx } from '@/lib/books/text-label-measure'
import {
  annotationTextFieldNoScrollCSS,
  textLabelFieldPaddingCSS,
  textLabelHorizontalPadFromComputedStyle,
  textLabelLineHeightPx,
  textLabelEditableFieldChromeCSS,
  textLabelPlaceholderMirrorStyle,
  writableStickyBodyMirrorStyle,
  filledTextEmptyTrayColor,
  TEXT_LABEL_WIDTH_FIT_SLACK_PX,
  TEXT_LABEL_WIDTH_TYPING_SLACK_PX,
  FILLED_TEXT_MEASURE_PAD_PX,
} from '@/lib/books/text-label-layout'
import {
  BOOK_ANNOTATION_FOCUS_ACQUIRE_MS,
  TEXT_LABEL_PLACEHOLDER,
  WRITABLE_STICKY_PLACEHOLDER,
  shouldBookAnnotationLabelCapturePointer,
  shouldShowBookAnnotationTextarea,
} from '@/lib/books/text-tool-ux'

function useDictationChromeForField(coachField: 'label' | 'whiteboard', localText: string) {
  const { activeField, session } = useLessonCoachSyncData()
  const sessionId = session?.id ?? null
  const sessionOwnsField =
    session?.activeField === coachField ||
    activeField === coachField ||
    activeField == null
  const text =
    session?.sharedText?.trim() && sessionOwnsField ? session.sharedText : localText
  const issues = session?.issues ?? []
  const showMirror =
    sessionOwnsField && getSharedScreenHighlightIssues(issues).length > 0
  const grammarUiVisible =
    shouldShowGrammarPanel(
      coachField,
      localText,
      sessionId,
      activeField,
      session?.activeField,
    )
  return { text, issues, showMirror, grammarUiVisible }
}

type TextSticky = TextAnnotationCommand | StickyAnnotationCommand

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Center-anchored labels grow upward on Enter; pin the first line and grow downward. */
function patchTextTopAnchorOnFirstNewline(
  cmd: TextAnnotationCommand,
  previousText: string,
  nextText: string,
  heightPx: number,
  onPatch: (partial: Partial<TextAnnotationCommand>) => void,
): void {
  if (cmd.yAnchor !== 'center' || !nextText.includes('\n') || previousText.includes('\n')) return
  const lineCount = Math.max(1, previousText.split('\n').length)
  onPatch({
    yAnchor: 'top',
    y: textTopYFromCenterAnchor(cmd.y, cmd.fontSizeNorm, lineCount, heightPx),
  })
}

/** `y` is top-left or vertical center depending on `yAnchor`. */
function textBlockPositionStyle(
  cmd: TextAnnotationCommand,
  leftPct: number,
  topPct: number,
  extra?: CSSProperties,
): CSSProperties {
  return {
    left: `${leftPct}%`,
    top: `${topPct}%`,
    ...(cmd.yAnchor === 'center' ? { transform: 'translateY(-50%)' } : {}),
    ...extra,
  }
}

/** Grow textarea height to fit all lines; no inner scrollbar. */
function applyAnnotationTextFieldNoScroll(el: HTMLTextAreaElement): void {
  const noScroll = annotationTextFieldNoScrollCSS()
  el.style.overflowX = noScroll.overflowX ?? 'hidden'
  el.style.overflowY = noScroll.overflowY ?? 'hidden'
  el.style.scrollbarWidth = noScroll.scrollbarWidth ?? 'none'
}

function fitTextareaHeight(el: HTMLTextAreaElement | null): void {
  if (!el) return
  applyAnnotationTextFieldNoScroll(el)
  el.style.height = `${el.scrollHeight}px`
}

/** Sticky body: grow with content but never shrink below the note card minimum. */
function fitStickyTextareaHeight(el: HTMLTextAreaElement | null, minPx: number): void {
  if (!el) return
  applyAnnotationTextFieldNoScroll(el)
  el.style.height = `${Math.max(minPx, el.scrollHeight)}px`
}

function plainTextWhitespace(text: string): CSSProperties['whiteSpace'] {
  return text.includes('\n') ? 'pre-wrap' : 'pre'
}

function plainTextMirrorStyle(
  fontFamily: string,
  fontSize: number,
  color: string,
  text = '',
): CSSProperties {
  const lineHeightPx = textLabelLineHeightPx(fontSize)
  return {
    fontFamily,
    fontSize,
    color,
    ...textLabelFieldPaddingCSS('plain'),
    ...annotationTextFieldNoScrollCSS(),
    lineHeight: `${lineHeightPx}px`,
    minHeight: lineHeightPx,
    whiteSpace: plainTextWhitespace(text),
    wordBreak: 'normal',
    overflowWrap: 'break-word',
  }
}

function filledTextMirrorStyle(
  fontFamily: string,
  fontSize: number,
  color: string,
): CSSProperties {
  const lineHeightPx = textLabelLineHeightPx(fontSize)
  return {
    fontFamily,
    fontSize,
    color,
    ...textLabelFieldPaddingCSS('filled'),
    ...annotationTextFieldNoScrollCSS(),
    lineHeight: `${lineHeightPx}px`,
    minHeight: lineHeightPx,
    wordBreak: 'normal',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
  }
}

/** Ghost placeholder — one path for plain, filled, and sticky editors (no native `placeholder` attr). */
function TextLabelPlaceholderGhost({
  text,
  mirrorStyle,
  className,
}: {
  text: string
  mirrorStyle: CSSProperties
  className?: string
}) {
  return (
    <span
      className={cn(
        'pointer-events-none absolute left-0 top-0 z-[2] box-border select-none whitespace-pre',
        className,
      )}
      style={textLabelPlaceholderMirrorStyle(mirrorStyle)}
      aria-hidden
    >
      {text}
    </span>
  )
}

/** Widest line width without wrapping (avoids one-word-per-line when sizing). */
function measurePlainTextWidthPx(
  el: HTMLTextAreaElement,
  maxWidthPx: number,
  measureText?: string,
  opts?: { typing?: boolean },
): number {
  const mirror = getFilledTextMirror()
  const cs = getComputedStyle(el)
  mirror.style.font = cs.font
  mirror.style.fontSize = cs.fontSize
  mirror.style.fontFamily = cs.fontFamily
  mirror.style.fontWeight = cs.fontWeight
  mirror.style.letterSpacing = cs.letterSpacing
  mirror.style.whiteSpace = 'pre'

  const padX = textLabelHorizontalPadFromComputedStyle(cs)

  const source = measureText ?? el.value
  const lines = source.length > 0 ? source.split('\n') : ['']
  let maxW = 8
  for (const line of lines) {
    mirror.textContent = line.length > 0 ? line : ' '
    maxW = Math.max(maxW, mirror.offsetWidth)
  }
  return Math.min(
    maxWidthPx,
    maxW +
      padX +
      TEXT_LABEL_WIDTH_FIT_SLACK_PX +
      (opts?.typing ? TEXT_LABEL_WIDTH_TYPING_SLACK_PX : 0),
  )
}

/** Shrink plain text box to content; cap width at remaining page space. */
function fitPlainTextareaSize(
  el: HTMLTextAreaElement | null,
  maxWidthPx: number,
  shell?: HTMLElement | null,
  opts?: { growOnly?: boolean; measureText?: string },
): void {
  if (!el) return
  applyAnnotationTextFieldNoScroll(el)
  if (shell) {
    shell.style.width = 'auto'
    shell.style.maxWidth = 'none'
    shell.style.overflowX = 'hidden'
    shell.style.overflowY = 'hidden'
  }
  el.style.maxWidth = `${maxWidthPx}px`
  const measured = measurePlainTextWidthPx(el, maxWidthPx, opts?.measureText, {
    typing: opts?.growOnly,
  })
  const prevW = parseFloat(el.style.width) || 0
  const contentW = opts?.growOnly ? Math.max(measured, prevW) : measured
  el.style.width = `${contentW}px`
  el.style.height = `${el.scrollHeight}px`
}

let filledTextMirror: HTMLSpanElement | null = null

function getFilledTextMirror(): HTMLSpanElement {
  if (!filledTextMirror && typeof document !== 'undefined') {
    filledTextMirror = document.createElement('span')
    filledTextMirror.setAttribute('aria-hidden', 'true')
    Object.assign(filledTextMirror.style, {
      position: 'absolute',
      left: '-9999px',
      top: '0',
      visibility: 'hidden',
      whiteSpace: 'pre',
      pointerEvents: 'none',
    })
    document.body.appendChild(filledTextMirror)
  }
  return filledTextMirror!
}

const FILLED_LINE_GAP_PX = 4

function filledMaxWidthPx(anchorXNorm: number, overlayWidthPx: number): number {
  return Math.max(8, overlayWidthPx * (1 - anchorXNorm) - 4)
}

function measureRawLineWidth(lineText: string, cs: CSSStyleDeclaration): number {
  const mirror = getFilledTextMirror()
  mirror.style.font = cs.font
  mirror.style.letterSpacing = cs.letterSpacing
  mirror.textContent = lineText.length > 0 ? lineText : '\u00a0'
  return mirror.offsetWidth
}

/** One line’s total box width (mirror text + horizontal padding). */
function measureFilledLineTextWidth(lineText: string, cs: CSSStyleDeclaration): number {
  return measureRawLineWidth(lineText, cs) + textLabelHorizontalPadFromComputedStyle(cs)
}

function filledInnerMaxPx(anchorXNorm: number, overlayWidthPx: number): number {
  return filledMaxWidthPx(anchorXNorm, overlayWidthPx) - FILLED_TEXT_MEASURE_PAD_PX
}

/** Break one paragraph (no \\n) into visual rows that fit within max width. */
function wrapParagraphIntoSegments(
  paragraph: string,
  cs: CSSStyleDeclaration,
  innerMax: number,
): string[] {
  if (!paragraph) return ['']
  const segments: string[] = []
  let remaining = paragraph
  while (remaining.length > 0) {
    if (measureRawLineWidth(remaining, cs) <= innerMax) {
      segments.push(remaining)
      break
    }
    let fitEnd = 0
    for (let i = 1; i <= remaining.length; i++) {
      if (measureRawLineWidth(remaining.slice(0, i), cs) <= innerMax) fitEnd = i
      else break
    }
    if (fitEnd <= 0) fitEnd = 1

    let headEnd = fitEnd
    const lastSpace = remaining.slice(0, fitEnd).lastIndexOf(' ')
    if (lastSpace > 0) headEnd = lastSpace

    let head = remaining.slice(0, headEnd).trimEnd()
    let tail = remaining.slice(headEnd).trimStart()

    if (!head && tail) {
      headEnd = fitEnd
      head = remaining.slice(0, headEnd)
      tail = remaining.slice(headEnd)
    }

    segments.push(head)
    remaining = tail
  }
  return segments.length > 0 ? segments : ['']
}

/** Visual rows for highlight pills only — does not mutate stored text. */
function computeVisualLineSegments(
  text: string,
  cs: CSSStyleDeclaration,
  anchorXNorm: number,
  overlayWidthPx: number,
): string[] {
  const innerMax = filledInnerMaxPx(anchorXNorm, overlayWidthPx)
  const paragraphs = text.split('\n')
  const segments: string[] = []
  for (const para of paragraphs) {
    segments.push(...wrapParagraphIntoSegments(para, cs, innerMax))
  }
  return segments.length > 0 ? segments : ['']
}

function fitFilledUnifiedTextarea(
  ta: HTMLTextAreaElement,
  text: string,
  cs: CSSStyleDeclaration,
  anchorXNorm: number,
  overlayWidthPx: number,
  segments: string[],
  emptyPlaceholder?: string,
): void {
  const maxPx = filledMaxWidthPx(anchorXNorm, overlayWidthPx)
  if (!text) {
    ta.style.whiteSpace = 'pre-wrap'
    if (emptyPlaceholder) {
      const w = measureFilledLineTextWidth(emptyPlaceholder, cs)
      ta.style.width = `${Math.min(Math.max(w, 8), maxPx)}px`
    } else {
      ta.style.width = '1ch'
    }
    return
  }
  let maxSegW = 0
  for (const seg of segments) {
    maxSegW = Math.max(maxSegW, measureFilledLineTextWidth(seg, cs))
  }
  ta.style.width = `${Math.min(Math.max(maxSegW, 8), maxPx)}px`
  ta.style.whiteSpace = 'pre-wrap'
}

function FilledTextUnifiedEditor({
  annotationId,
  text,
  onTextChange,
  onBlurCommit,
  anchorXNorm,
  overlayWidthPx,
  fillHex,
  fontSize,
  fontFamily,
  color,
  autoFocus,
  acquiringFocus = false,
  onAutoFocusConsumed,
  onFocus,
  readOnly = false,
  fieldFocused = false,
  coachField = 'label',
  showPeerHoverHint = false,
  showTextarea = true,
}: {
  annotationId: string
  text: string
  onTextChange: (next: string) => void
  onBlurCommit: () => void
  anchorXNorm: number
  overlayWidthPx: number
  fillHex: string
  fontSize: number
  fontFamily: string
  color: string
  autoFocus: boolean
  acquiringFocus?: boolean
  onAutoFocusConsumed?: () => void
  onFocus?: () => void
  readOnly?: boolean
  fieldFocused?: boolean
  coachField?: 'label' | 'whiteboard'
  showPeerHoverHint?: boolean
  showTextarea?: boolean
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const [pillLayout, setPillLayout] = useState<{ segments: string[]; widths: number[] }>({
    segments: [''],
    widths: [8],
  })

  const rowMinPx = textLabelLineHeightPx(fontSize)
  const linePitchPx = rowMinPx + (text.length > 0 ? FILLED_LINE_GAP_PX : 0)
  const showBg = text.length > 0
  const showFieldPlaceholder = text.length === 0 && !readOnly
  const showEmptyTray = showFieldPlaceholder && showTextarea

  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta || !showTextarea) return
    const cs = getComputedStyle(ta)
    const segments = showFieldPlaceholder
      ? [TEXT_LABEL_PLACEHOLDER]
      : computeVisualLineSegments(text, cs, anchorXNorm, overlayWidthPx)
    const widths = segments.map((seg) => measureFilledLineTextWidth(seg, cs))
    setPillLayout({ segments, widths })
    fitFilledUnifiedTextarea(
      ta,
      text,
      cs,
      anchorXNorm,
      overlayWidthPx,
      segments,
      showFieldPlaceholder ? TEXT_LABEL_PLACEHOLDER : undefined,
    )
    ta.style.lineHeight = `${linePitchPx}px`
    fitTextareaHeight(ta)
  }, [text, anchorXNorm, overlayWidthPx, linePitchPx, showFieldPlaceholder, showTextarea])

  useLayoutEffect(() => {
    const wantsFocus =
      (autoFocus || acquiringFocus) &&
      showTextarea &&
      !fieldFocused
    if (!wantsFocus) return

    let cancelled = false
    let attempts = 0
    const focusGeneration = getBookOverlayAnnotationFocusGeneration()

    const tryFocus = () => {
      if (cancelled) return
      if (focusGeneration !== getBookOverlayAnnotationFocusGeneration()) return
      attempts += 1
      const el = taRef.current
      if (el) {
        el.focus({ preventScroll: true })
      }
      const focused =
        (el != null && document.activeElement === el) ||
        focusBookOverlayAnnotationField(annotationId, focusGeneration)

      if (focused) {
        onFocus?.()
        if (autoFocus) {
          if (el) {
            const len = el.value.length
            el.setSelectionRange(len, len)
          }
          onAutoFocusConsumed?.()
        }
        return
      }
      if (attempts < 12) {
        requestAnimationFrame(tryFocus)
      }
    }

    tryFocus()
    return () => {
      cancelled = true
    }
  }, [annotationId, autoFocus, acquiringFocus, fieldFocused, onAutoFocusConsumed, onFocus, showTextarea])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onBlurCommit()
        e.currentTarget.blur()
      }
    },
    [onBlurCommit],
  )

  const {
    assist,
    ghost,
    ghostPartial,
    ghostCandidates,
    ghostIndex,
    spellMirrorEnabled,
    onFieldFocus,
    onFieldBlur,
  } = useCoachTextFieldAssist({
    value: text,
    setValue: onTextChange,
    coachField,
    onAfterChange: () => fitTextareaHeight(taRef.current),
    onChange: (e) => {
      if (readOnly) return
      onTextChange(e.target.value)
      queueMicrotask(() => fitTextareaHeight(e.target))
    },
    onKeyDown,
  })

  const chrome = useDictationChromeForField(coachField, text)
  const showEditCursor = !readOnly
  const spellSpans = useSpellMarkerSpans(text, spellMirrorEnabled && !readOnly)
  const mirrorStyle = filledTextMirrorStyle(fontFamily, fontSize, color)
  const filledPad = textLabelFieldPaddingCSS('filled')
  const filledPillPad: CSSProperties = {
    paddingLeft: filledPad.paddingLeft,
    paddingRight: filledPad.paddingRight,
    paddingTop: '0px',
    paddingBottom: '0px',
  }

  return (
    <div className="inline-flex w-auto flex-col items-start">
      <CoachDictationSentenceChrome
        variant="overlay"
        text={chrome.text}
        issues={chrome.issues}
        mirrorHighlight={chrome.showMirror}
        mirrorClassName="box-border"
        className="w-auto"
        mirrorStyle={mirrorStyle}
      >
        <div
          className={cn(
            'relative inline-block',
            showEditCursor && 'cursor-text',
            showPeerHoverHint &&
              'hover:outline hover:outline-1 hover:outline-dashed hover:outline-slate-400/40',
          )}
          onPointerDown={(e) => {
            e.stopPropagation()
            if (!readOnly) taRef.current?.focus()
          }}
        >
      <div className="flex flex-col items-start gap-1 pointer-events-none" aria-hidden>
        {pillLayout.segments.map((seg, i) => (
          <div
            key={i}
            className="box-border rounded-sm"
            style={{
              width: `${pillLayout.widths[i] ?? 8}px`,
              minHeight: rowMinPx,
              minWidth: seg.length > 0 ? undefined : '1ch',
              backgroundColor:
                showBg && seg.length > 0
                  ? fillHex
                  : showEmptyTray
                    ? filledTextEmptyTrayColor(fillHex)
                    : 'transparent',
              ...filledPillPad,
            }}
          />
        ))}
      </div>
      {!readOnly ? (
        <WritingAssistSpellMirror text={text} spans={spellSpans} className="box-border" style={mirrorStyle} />
      ) : null}
      {showTextarea ? (
      <textarea
        ref={taRef}
        value={text}
        readOnly={readOnly}
        tabIndex={-1}
        onInput={readOnly ? undefined : assist.onInput}
        onFocus={
          readOnly
            ? undefined
            : () => {
                onFieldFocus()
                onFocus?.()
              }
        }
        onBlur={() => {
          onFieldBlur()
          onBlurCommit()
        }}
        spellCheck={assist.spellCheck}
        autoCorrect={assist.autoCorrect}
        autoCapitalize={assist.autoCapitalize}
        data-writing-assist={assist['data-writing-assist']}
        data-annotation-id={annotationId}
        onKeyDown={readOnly ? onKeyDown : assist.onKeyDown}
        rows={1}
        className={cn(
          'absolute inset-0 z-[1] box-border resize-none overflow-x-hidden overflow-y-hidden border-0 bg-transparent shadow-none outline-none focus:outline-none focus-visible:outline-none rounded-sm [scrollbar-width:none]',
          readOnly ? 'pointer-events-none cursor-default' : 'cursor-text',
        )}
        style={{
          ...mirrorStyle,
          lineHeight: `${linePitchPx}px`,
          ...textLabelEditableFieldChromeCSS(color, { hideCaret: readOnly || !fieldFocused }),
        }}
        aria-label={showFieldPlaceholder ? TEXT_LABEL_PLACEHOLDER : 'Annotation text'}
      />
      ) : (
        <span
          style={{ ...mirrorStyle, lineHeight: `${linePitchPx}px` }}
          className="absolute inset-0 z-[1] box-border whitespace-pre-wrap"
        >
          {text}
        </span>
      )}
      {showTextarea && showFieldPlaceholder ? (
        <TextLabelPlaceholderGhost
          text={TEXT_LABEL_PLACEHOLDER}
          mirrorStyle={{ ...mirrorStyle, lineHeight: `${linePitchPx}px` }}
        />
      ) : null}
      {!readOnly && showTextarea && !showFieldPlaceholder ? (
        <WritingAssistGhostUi
          text={text}
          ghost={ghost}
          partial={ghostPartial}
          candidates={ghostCandidates}
          candidateIndex={ghostIndex}
          mirrorClassName="box-border"
          mirrorStyle={{ ...mirrorStyle, lineHeight: `${linePitchPx}px` }}
        />
      ) : null}
        </div>
      </CoachDictationSentenceChrome>
      {chrome.grammarUiVisible ? (
        <CoachSentenceGrammarPanel text={text} coachField={coachField} variant="overlay" />
      ) : null}
    </div>
  )
}

function EditableBlock({
  cmd,
  heightPx,
  overlayWidthPx,
  defaultTextFontId,
  autoFocus,
  onAutoFocusConsumedRef,
  onPatch,
  onDeleteSticky,
  onDeleteText,
  selectMode,
  textToolActive,
  textInputEnabled = false,
  isEditing,
  editingZIndex,
  onEndEdit,
  onRequestEdit,
  onEditingTextDraftChange,
  coachField = 'label',
}: {
  cmd: TextSticky
  heightPx: number
  overlayWidthPx: number
  defaultTextFontId: AnnotationTextFontId
  autoFocus: boolean
  onAutoFocusConsumedRef: MutableRefObject<(() => void) | undefined>
  onPatch: (partial: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => void
  onDeleteSticky?: () => void
  onDeleteText?: () => void
  selectMode?: boolean
  /** True when the text or sticky tool is active — enables typing and click-to-edit on labels/notes. */
  textToolActive?: boolean
  /** When false on move/select, hide the textarea even if editingId is stale. */
  textInputEnabled?: boolean
  isEditing?: boolean
  editingZIndex?: number
  onEndEdit?: () => void
  onRequestEdit?: () => void
  onEditingTextDraftChange?: (text: string | null) => void
  coachField?: 'label' | 'whiteboard'
}) {
  const [local, setLocal] = useState(cmd.text)
  const [isFieldFocused, setIsFieldFocused] = useState(false)
  const [awaitingEditFocus, setAwaitingEditFocus] = useState(false)
  const prevIsEditingRef = useRef(isEditing)
  const pendingProgrammaticFocusRef = useRef(false)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const plainTextShellRef = useRef<HTMLDivElement | null>(null)
  const stickyShellRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isFieldFocused) return
    setLocal(cmd.text)
  }, [cmd.id, cmd.text, isFieldFocused])

  useEffect(() => {
    if (!onEditingTextDraftChange) return
    if (isEditing && textToolActive && cmd.kind === 'text') {
      onEditingTextDraftChange(local)
    }
  }, [local, isEditing, textToolActive, cmd.kind, onEditingTextDraftChange])

  const stickyH = cmd.kind === 'sticky' ? cmd.h : null
  const textFilled = cmd.kind === 'text' && cmd.visualStyle === 'filled'
  const editSessionActive = (isEditing === true || autoFocus) && textInputEnabled
  const showTextarea = shouldShowBookAnnotationTextarea({
    textInputEnabled,
    isEditing: isEditing === true,
    autoFocus,
    isFieldFocused,
    acquiringFocus: awaitingEditFocus,
  })
  const placeholderText =
    cmd.kind === 'text' && !textFilled
      ? TEXT_LABEL_PLACEHOLDER
      : cmd.kind === 'sticky'
        ? WRITABLE_STICKY_PLACEHOLDER
        : null
  const showFieldPlaceholder = editSessionActive && local.length === 0 && placeholderText != null

  useLayoutEffect(() => {
    const ta = taRef.current
    if (!showTextarea) return
    if (cmd.kind === 'text' && textFilled) return
    if (cmd.kind === 'text' && !textFilled) {
      fitPlainTextareaSize(ta, plainTextMaxWidthPx(cmd.x, cmd.maxWidthNorm, overlayWidthPx), plainTextShellRef.current, {
        growOnly: isFieldFocused,
        measureText: showFieldPlaceholder ? placeholderText ?? undefined : local,
      })
      return
    }
    if (cmd.kind === 'sticky') {
      const variant = stickyWritableVariant(cmd)
      const { bodyMinPx } = writableStickerLayoutMetrics(variant, cmd.h, heightPx)
      fitStickyTextareaHeight(ta, bodyMinPx)
      return
    }
    fitTextareaHeight(ta)
  }, [
    local,
    cmd.id,
    cmd.kind,
    cmd.x,
    stickyH,
    textFilled,
    overlayWidthPx,
    heightPx,
    cmd.fontSizeNorm,
    isFieldFocused,
    showFieldPlaceholder,
    placeholderText,
    editSessionActive,
    showTextarea,
  ])

  /** Writable while the edit session is open — focus gates caret visibility, not input handlers. */
  const canEdit = Boolean(
    showTextarea &&
    editSessionActive &&
    ((textToolActive && !selectMode) || (selectMode && isEditing === true)),
  )

  const isSticky = cmd.kind === 'sticky'
  const labelCapturePointer = shouldBookAnnotationLabelCapturePointer({
    isSticky,
    showTextarea,
    textToolActive: Boolean(textToolActive),
    selectMode: Boolean(selectMode),
  })
  const blockPointerEvents = labelCapturePointer ? 'pointer-events-auto' : 'pointer-events-none'
  const blockStackZ = editSessionActive && editingZIndex != null ? editingZIndex : undefined
  /** Text/sticky tool uses overlay chrome for hover + edit rings — keep DOM labels visually idle. */
  const textToolEditHint = false
  const textToolPeerHoverHint = false

  const openLabelEdit = useCallback(() => {
    if (selectMode) return
    if (textToolActive && isEditing !== true) {
      onRequestEdit?.()
    }
  }, [isEditing, onRequestEdit, selectMode, textToolActive])

  const onLabelClickToEdit = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (selectMode) return
      if (textToolActive && isEditing !== true) {
        e.stopPropagation()
        openLabelEdit()
      }
    },
    [isEditing, openLabelEdit, selectMode, textToolActive],
  )

  const onLabelPointerUpToEdit = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (selectMode || e.button !== 0) return
      if (textToolActive && isEditing !== true) {
        openLabelEdit()
      }
    },
    [isEditing, openLabelEdit, selectMode, textToolActive],
  )

  const onLabelPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (selectMode) return
      if (canEdit) {
        e.stopPropagation()
        taRef.current?.focus({ preventScroll: true })
      }
    },
    [canEdit, selectMode],
  )

  /** Only true while acquiring focus — not for the whole edit session (avoids stray caret). */
  useLayoutEffect(() => {
    const enteredEdit = Boolean(isEditing && !prevIsEditingRef.current)
    prevIsEditingRef.current = Boolean(isEditing)
    if (!isEditing && !autoFocus) {
      setAwaitingEditFocus(false)
      return
    }
    if (enteredEdit || autoFocus) {
      setAwaitingEditFocus(true)
    }
  }, [autoFocus, cmd.id, isEditing])

  const clearAwaitingEditFocus = useCallback(() => {
    setAwaitingEditFocus(false)
    pendingProgrammaticFocusRef.current = false
  }, [])

  useEffect(() => {
    if (!awaitingEditFocus) return
    const timer = window.setTimeout(() => {
      clearAwaitingEditFocus()
      // Only abandon never-mounted new-label autoFocus — not click-to-edit on committed text.
      if (!isEditing && autoFocus && !isAnnotationTextFieldFocused(cmd.id)) {
        onEndEdit?.()
      }
    }, BOOK_ANNOTATION_FOCUS_ACQUIRE_MS)
    return () => window.clearTimeout(timer)
  }, [autoFocus, awaitingEditFocus, clearAwaitingEditFocus, cmd.id, isEditing, onEndEdit])

  useEffect(() => {
    if (!showTextarea) return
    const ta = taRef.current
    if (!ta) return
    const syncFocusState = () => {
      queueMicrotask(() => {
        if (isAnnotationTextFieldFocused(cmd.id)) {
          setIsFieldFocused(true)
          clearAwaitingEditFocus()
          return
        }
        const active = document.activeElement
        if (
          active instanceof HTMLElement &&
          (active.closest('[data-writing-assist-ui]') ||
            active.closest('[data-slot="popover-content"]'))
        ) {
          return
        }
        setIsFieldFocused(false)
      })
    }
    ta.addEventListener('focusin', syncFocusState)
    ta.addEventListener('focusout', syncFocusState)
    return () => {
      ta.removeEventListener('focusin', syncFocusState)
      ta.removeEventListener('focusout', syncFocusState)
    }
  }, [clearAwaitingEditFocus, cmd.id, showTextarea])

  useEffect(() => {
    if (isEditing || autoFocus) {
      pendingProgrammaticFocusRef.current = true
    } else {
      pendingProgrammaticFocusRef.current = false
    }
  }, [isEditing, autoFocus, cmd.id])

  useEffect(() => {
    const ta = taRef.current
    if (ta && !canEdit && document.activeElement === ta) {
      ta.blur()
    }
  }, [canEdit])

  useEffect(() => {
    if (!showTextarea) {
      pendingProgrammaticFocusRef.current = false
      taRef.current?.blur()
      setIsFieldFocused(false)
      setAwaitingEditFocus(false)
      return
    }

    const ta = taRef.current
    const onWindowBlur = () => ta?.blur()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') ta?.blur()
    }

    window.addEventListener('blur', onWindowBlur)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('blur', onWindowBlur)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [showTextarea])

  const leftPct = cmd.x * 100
  const topPct = cmd.y * 100
  const fs = Math.max(10, Math.round(cmd.fontSizeNorm * heightPx))
  const fontFamily = annotationTextFontFamily(cmd.fontId ?? defaultTextFontId)

  const blurText = useCallback(() => {
    const trimmed = local.trim()
    if (trimmed.length === 0) {
      onDeleteText?.()
      onEndEdit?.()
      return
    }
    onPatch({ text: trimmed })
    queueMicrotask(() => {
      const ta = taRef.current
      if (cmd.kind === 'text' && cmd.visualStyle !== 'filled') {
        fitPlainTextareaSize(ta, plainTextMaxWidthPx(cmd.x, cmd.maxWidthNorm, overlayWidthPx), plainTextShellRef.current)
      } else {
        fitTextareaHeight(ta)
      }
    })
    onEndEdit?.()
  }, [local, onPatch, onDeleteText, onEndEdit, cmd, overlayWidthPx])

  const blurSticky = useCallback(() => {
    if (cmd.kind !== 'sticky') return
    const variant = stickyWritableVariant(cmd)
    const { bodyMinPx } = writableStickerLayoutMetrics(variant, cmd.h, heightPx)
    fitStickyTextareaHeight(taRef.current, bodyMinPx)
    const shell = stickyShellRef.current
    const baseHNorm = cmd.h
    const hNorm = shell
      ? clamp01(Math.max(baseHNorm, shell.getBoundingClientRect().height / heightPx))
      : baseHNorm
    onPatch({
      text: local.trimEnd(),
      h: hNorm,
    })
    onEndEdit?.()
  }, [local, onPatch, cmd, heightPx, onEndEdit])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (cmd.kind === 'text') {
          blurText()
        } else {
          blurSticky()
        }
        ;(e.target as HTMLTextAreaElement).blur()
      }
    },
    [cmd.kind, blurText, blurSticky],
  )

  const {
    assist,
    ghost,
    ghostPartial,
    ghostCandidates,
    ghostIndex,
    spellMirrorEnabled,
    onFieldFocus,
    onFieldBlur,
  } = useCoachTextFieldAssist({
    value: local,
    setValue: setLocal,
    coachField,
    onAfterChange: () => {
      const ta = taRef.current
      if (!ta) return
      if (cmd.kind === 'text' && !textFilled) {
        fitPlainTextareaSize(ta, plainTextMaxWidthPx(cmd.x, cmd.maxWidthNorm, overlayWidthPx), plainTextShellRef.current, {
          growOnly: true,
          measureText: local,
        })
      } else if (cmd.kind === 'sticky') {
        const variant = stickyWritableVariant(cmd)
        const { bodyMinPx } = writableStickerLayoutMetrics(variant, cmd.h, heightPx)
        fitStickyTextareaHeight(ta, bodyMinPx)
      } else {
        fitTextareaHeight(ta)
      }
    },
    onChange: (e) => {
      if (!canEdit) return
      const value = e.target.value
      if (cmd.kind === 'text') {
        patchTextTopAnchorOnFirstNewline(cmd, local, value, heightPx, onPatch)
      }
      setLocal(value)
      if (cmd.kind === 'text' && !textFilled) {
        fitPlainTextareaSize(e.target, plainTextMaxWidthPx(cmd.x, cmd.maxWidthNorm, overlayWidthPx), plainTextShellRef.current, {
          growOnly: true,
          measureText: value,
        })
      } else if (cmd.kind === 'sticky') {
        const variant = stickyWritableVariant(cmd)
        const { bodyMinPx } = writableStickerLayoutMetrics(variant, cmd.h, heightPx)
        queueMicrotask(() => fitStickyTextareaHeight(e.target, bodyMinPx))
      } else {
        queueMicrotask(() => fitTextareaHeight(e.target))
      }
    },
    onKeyDown: onKeyDown as (e: React.KeyboardEvent<HTMLTextAreaElement>) => void,
  })

  useLayoutEffect(() => {
    if (cmd.kind === 'text' && textFilled) return
    const wantsFocus =
      (autoFocus || awaitingEditFocus) &&
      showTextarea &&
      !isFieldFocused
    if (!wantsFocus) return

    let cancelled = false
    let attempts = 0
    const focusGeneration = getBookOverlayAnnotationFocusGeneration()

    const tryFocus = () => {
      if (cancelled) return
      if (focusGeneration !== getBookOverlayAnnotationFocusGeneration()) return
      attempts += 1
      const el = taRef.current
      if (el) {
        el.focus({ preventScroll: true })
      }
      const focused =
        (el != null && document.activeElement === el) ||
        focusBookOverlayAnnotationField(cmd.id, focusGeneration)

      if (focused) {
        pendingProgrammaticFocusRef.current = false
        setAwaitingEditFocus(false)
        setIsFieldFocused(true)
        onFieldFocus()
        if (autoFocus) {
          if (textFilled && el) {
            const len = el.value.length
            el.setSelectionRange(len, len)
          } else if (el) {
            el.select()
          }
          onAutoFocusConsumedRef.current?.()
        }
        return
      }
      if (attempts < 12) {
        requestAnimationFrame(tryFocus)
      } else {
        clearAwaitingEditFocus()
      }
    }

    tryFocus()
    return () => {
      cancelled = true
    }
  }, [
    autoFocus,
    awaitingEditFocus,
    cmd.id,
    showTextarea,
    isFieldFocused,
    onAutoFocusConsumedRef,
    onFieldFocus,
    textFilled,
    clearAwaitingEditFocus,
  ])

  const chrome = useDictationChromeForField(coachField, local)
  const spellSpans = useSpellMarkerSpans(local, spellMirrorEnabled && canEdit)

  if (cmd.kind === 'text') {
    const filled = cmd.visualStyle === 'filled'
    const fillHex =
      filled && typeof cmd.fillColor === 'string' && /^#[0-9A-Fa-f]{6}$/i.test(cmd.fillColor)
        ? cmd.fillColor
        : filled
          ? DEFAULT_TEXT_FILL_COLOR
          : null

    return (
      <div
        data-annotation-label={cmd.id}
        className={cn('absolute inline-block min-w-0', blockPointerEvents)}
        style={{
          ...textBlockPositionStyle(cmd, leftPct, topPct),
          ...(blockStackZ != null ? { zIndex: blockStackZ } : {}),
        }}
        onClick={onLabelClickToEdit}
        onPointerUp={onLabelPointerUpToEdit}
        onPointerDown={(e) => {
          const onTextarea =
            e.target instanceof Element &&
            e.target.closest(`textarea[data-annotation-id="${cmd.id}"]`)
          if (onTextarea && canEdit) {
            e.stopPropagation()
            return
          }
          onLabelPointerDown(e)
        }}
      >
        {filled && fillHex ? (
          editSessionActive ? (
          <FilledTextUnifiedEditor
            annotationId={cmd.id}
            text={local}
            onTextChange={(value) => {
              patchTextTopAnchorOnFirstNewline(cmd, local, value, heightPx, onPatch)
              setLocal(value)
            }}
            onBlurCommit={() => {
              clearAwaitingEditFocus()
              onFieldBlur()
              setIsFieldFocused(false)
              blurText()
            }}
            onFocus={() => {
              clearAwaitingEditFocus()
              onFieldFocus()
              setIsFieldFocused(true)
            }}
            anchorXNorm={cmd.x}
            overlayWidthPx={overlayWidthPx}
            fillHex={fillHex}
            fontSize={fs}
            fontFamily={fontFamily}
            color={cmd.color}
            autoFocus={autoFocus}
            acquiringFocus={awaitingEditFocus}
            onAutoFocusConsumed={() => onAutoFocusConsumedRef.current?.()}
            readOnly={!canEdit}
            fieldFocused={isFieldFocused}
            coachField={coachField}
            showPeerHoverHint={textToolPeerHoverHint}
            showTextarea={showTextarea}
          />
          ) : (
            <span
              style={filledTextMirrorStyle(fontFamily, fs, cmd.color)}
              className="inline-block whitespace-pre-wrap"
            >
              {cmd.text}
            </span>
          )
        ) : (
          <div className="inline-flex w-auto flex-col items-start">
            <CoachDictationSentenceChrome
              variant="overlay"
              className="w-auto"
              text={chrome.text}
              issues={chrome.issues}
              mirrorHighlight={chrome.showMirror}
              mirrorStyle={plainTextMirrorStyle(fontFamily, fs, cmd.color, local)}
            >
              <div
                ref={plainTextShellRef}
                className={cn(
                  'relative inline-block max-w-none',
                  textToolEditHint && 'cursor-text',
                  textToolPeerHoverHint &&
                    'hover:outline hover:outline-1 hover:outline-dashed hover:outline-slate-400/40',
                )}
              >
              {canEdit ? (
                <WritingAssistSpellMirror
                  text={local}
                  spans={spellSpans}
                  style={plainTextMirrorStyle(fontFamily, fs, cmd.color, local)}
                />
              ) : null}
              {showTextarea ? (
              <textarea
                ref={taRef}
                value={local}
                readOnly={!canEdit}
                tabIndex={-1}
                onInput={canEdit ? assist.onInput : undefined}
                onFocus={() => {
                  clearAwaitingEditFocus()
                  onFieldFocus()
                  setIsFieldFocused(true)
                }}
                onBlur={() => {
                  clearAwaitingEditFocus()
                  onFieldBlur()
                  setIsFieldFocused(false)
                  if (!editSessionActive && !showTextarea) return
                  blurText()
                }}
                onKeyDown={canEdit ? assist.onKeyDown : onKeyDown}
                spellCheck={assist.spellCheck}
                autoCorrect={assist.autoCorrect}
                autoCapitalize={assist.autoCapitalize}
                data-writing-assist={assist['data-writing-assist']}
                data-annotation-id={cmd.id}
                rows={1}
                className={cn(
                  'relative z-[1] box-border inline-block resize-none overflow-x-hidden overflow-y-hidden border-0 bg-transparent shadow-none outline-none focus:outline-none focus-visible:outline-none rounded-sm align-top [scrollbar-width:none]',
                  textToolEditHint && 'cursor-text',
                )}
                style={{
                  ...plainTextMirrorStyle(fontFamily, fs, cmd.color, local),
                  maxWidth: plainTextMaxWidthPx(cmd.x, cmd.maxWidthNorm, overlayWidthPx),
                  ...textLabelEditableFieldChromeCSS(cmd.color, {
                    hideCaret: !isFieldFocused || !canEdit,
                  }),
                }}
                aria-label={showFieldPlaceholder ? placeholderText ?? 'Annotation text' : 'Annotation text'}
              />
              ) : (
                <span
                  style={{
                    ...plainTextMirrorStyle(fontFamily, fs, cmd.color, cmd.text),
                    maxWidth: plainTextMaxWidthPx(cmd.x, cmd.maxWidthNorm, overlayWidthPx),
                  }}
                  className="relative z-[1] inline-block whitespace-pre"
                >
                  {cmd.text}
                </span>
              )}
              {showTextarea && showFieldPlaceholder && placeholderText ? (
                <TextLabelPlaceholderGhost
                  text={placeholderText}
                  mirrorStyle={plainTextMirrorStyle(fontFamily, fs, cmd.color, placeholderText)}
                />
              ) : null}
              {canEdit && !showFieldPlaceholder ? (
                <WritingAssistGhostUi
                  text={local}
                  ghost={ghost}
                  partial={ghostPartial}
                  candidates={ghostCandidates}
                  candidateIndex={ghostIndex}
                  mirrorStyle={plainTextMirrorStyle(fontFamily, fs, cmd.color, local)}
                />
              ) : null}
              </div>
            </CoachDictationSentenceChrome>
            {chrome.grammarUiVisible ? (
              <CoachSentenceGrammarPanel text={local} coachField={coachField} variant="overlay" />
            ) : null}
          </div>
        )}
      </div>
    )
  }

  const wPct = cmd.w * 100
  const writableVariant = stickyWritableVariant(cmd)
  const stickyFill = cmd.fillColor ?? DEFAULT_STICKY_FILL_COLOR
  const stickyChrome = writableStickerChrome(writableVariant, stickyFill)
  const { shellMinPx, bodyMinPx } = writableStickerLayoutMetrics(writableVariant, cmd.h, heightPx)
  const stickyBodyMirrorStyle = writableStickyBodyMirrorStyle(
    fontFamily,
    fs,
    stickyChrome.textColor,
    writableVariant,
    bodyMinPx,
  )
  const showStickyEditChrome = canEdit && !textToolActive

  const deleteButton = onDeleteSticky ? (
    <button
      type="button"
      className={cn(
        'pointer-events-auto flex h-5 w-5 items-center justify-center rounded-md p-0',
        'text-stone-700/75 opacity-0 transition-all duration-150',
        'hover:bg-black/10 hover:text-stone-900',
        'group-hover/sticky:opacity-100 focus:opacity-100',
        showStickyEditChrome && 'opacity-100',
        writableVariant !== 'note' && 'bg-white/80 shadow-sm backdrop-blur-[1px]',
      )}
      aria-label="Delete sticker"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onDeleteSticky()
      }}
    >
      <X className="h-3.5 w-3.5" strokeWidth={2.25} />
    </button>
  ) : null

  return (
    <WritableStickerShell
      variant={writableVariant}
      fillColor={stickyFill}
      leftPct={leftPct}
      topPct={topPct}
      widthPct={wPct}
      shellMinPx={shellMinPx}
      bodyMinPx={bodyMinPx}
      shellRef={stickyShellRef}
      annotationLabelId={cmd.id}
      showEditChrome={showStickyEditChrome}
      blockPointerEvents={blockPointerEvents}
      stackZ={blockStackZ}
      deleteButton={deleteButton}
      onShellPointerDown={onLabelPointerDown}
      onShellPointerUp={onLabelPointerUpToEdit}
      onShellClick={onLabelClickToEdit}
    >
      <div className="relative min-h-0 flex-1">
        {canEdit ? (
          <WritingAssistSpellMirror
            text={local}
            spans={spellSpans}
            style={stickyBodyMirrorStyle}
          />
        ) : null}
      {showTextarea ? (
      <textarea
        ref={taRef}
        value={local}
        readOnly={!canEdit}
        tabIndex={-1}
        onInput={canEdit ? assist.onInput : undefined}
        onFocus={() => {
          clearAwaitingEditFocus()
          onFieldFocus()
          setIsFieldFocused(true)
        }}
        onBlur={() => {
          clearAwaitingEditFocus()
          onFieldBlur()
          setIsFieldFocused(false)
          if (!editSessionActive && !showTextarea) return
          blurSticky()
        }}
        onKeyDown={canEdit ? assist.onKeyDown : onKeyDown}
        spellCheck={assist.spellCheck}
        autoCorrect={assist.autoCorrect}
        autoCapitalize={assist.autoCapitalize}
        data-writing-assist={assist['data-writing-assist']}
        data-annotation-id={cmd.id}
        rows={1}
        className={cn(
          'relative z-[1] box-border w-full resize-none overflow-hidden bg-transparent outline-none focus:outline-none focus-visible:outline-none',
          writableVariant === 'caption' && 'text-center font-medium tracking-wide',
          writableVariant === 'thought' && 'italic',
        )}
        style={{
          ...stickyBodyMirrorStyle,
          ...textLabelEditableFieldChromeCSS(stickyChrome.textColor, {
            hideCaret: !isFieldFocused || !canEdit,
          }),
        }}
        aria-label={
          showFieldPlaceholder && placeholderText
            ? placeholderText
            : writableVariant === 'speech'
              ? 'Speech bubble'
              : writableVariant === 'thought'
                ? 'Thought bubble'
                : writableVariant === 'caption'
                  ? 'Caption'
                  : 'Sticky note'
        }
      />
      ) : (
        <span
          className={cn(
            'relative z-[1] block w-full',
            writableVariant === 'caption' && 'text-center font-medium tracking-wide',
            writableVariant === 'thought' && 'italic',
          )}
          style={stickyBodyMirrorStyle}
        >
          {cmd.text}
        </span>
      )}
        {showTextarea && showFieldPlaceholder && placeholderText ? (
          <TextLabelPlaceholderGhost
            text={placeholderText}
            mirrorStyle={stickyBodyMirrorStyle}
            className="whitespace-pre-wrap"
          />
        ) : null}
      {canEdit && !showFieldPlaceholder ? (
        <WritingAssistGhostUi
          text={local}
          ghost={ghost}
          partial={ghostPartial}
          candidates={ghostCandidates}
          candidateIndex={ghostIndex}
          mirrorStyle={stickyBodyMirrorStyle}
          stripClassName="-top-7"
        />
      ) : null}
      </div>
    </WritableStickerShell>
  )
}

export interface BookPageAnnotationDomLayerProps {
  widthPx: number
  heightPx: number
  defaultTextFontId: AnnotationTextFontId
  /** Stack order within the annotation layer (matches command paint index). */
  zIndex?: number
  /** Raised while a block is editable so it sits above the pointer overlay. */
  editingZIndex?: number
  commands: AnnotationCommand[]
  onUpdateCommand: (id: string, next: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => void
  onDeleteSticky?: (id: string) => void
  onDeleteText?: (id: string) => void
  focusNewId?: string | null
  onConsumedFocusNew?: () => void
  selectMode?: boolean
  /** True when the text or sticky tool is active — enables typing and click-to-edit on labels/notes. */
  textToolActive?: boolean
  /** When false on move/select, committed text is shown instead of a textarea. */
  textInputEnabled?: boolean
  editingId?: string | null
  onEditingIdChange?: (id: string | null) => void
  /** Live label text while editing — resizes text-tool chrome. */
  onEditingTextDraftChange?: (text: string | null) => void
  /** Sync target for coach session (book page vs whiteboard). */
  coachField?: 'label' | 'whiteboard'
}

export function BookPageAnnotationDomLayer({
  widthPx,
  heightPx,
  defaultTextFontId,
  zIndex = 5,
  editingZIndex,
  commands,
  onUpdateCommand,
  onDeleteSticky,
  onDeleteText,
  focusNewId,
  onConsumedFocusNew,
  selectMode = false,
  textToolActive = false,
  textInputEnabled = false,
  editingId = null,
  onEditingIdChange,
  onEditingTextDraftChange,
  coachField = 'label',
}: BookPageAnnotationDomLayerProps) {
  const consumedRef = useRef(onConsumedFocusNew)
  consumedRef.current = onConsumedFocusNew

  const prevSelectModeRef = useRef(selectMode)
  const prevTextToolActiveRef = useRef(textToolActive)
  const prevEditingIdRef = useRef<string | null>(editingId)
  useEffect(() => {
    const switchedToSelect = selectMode && !prevSelectModeRef.current
    const leftTextTool = prevTextToolActiveRef.current && !textToolActive && !selectMode
    const leftTextAndSelect = !selectMode && !textToolActive
    if (switchedToSelect || leftTextTool || leftTextAndSelect) {
      endBookOverlayAnnotationEditingFocus()
      consumedRef.current?.()
      onEditingIdChange?.(null)
    }
    prevSelectModeRef.current = selectMode
    prevTextToolActiveRef.current = textToolActive
  }, [selectMode, textToolActive, onEditingIdChange])

  useEffect(() => {
    const prev = prevEditingIdRef.current
    prevEditingIdRef.current = editingId
    if (prev != null && editingId == null) {
      endBookOverlayAnnotationEditingFocus()
    }
  }, [editingId])

  useEffect(() => {
    if (!editingId) {
      return
    }

    const dismissIfNotFocused = () => {
      queueMicrotask(() => {
        if (isAnnotationTextFieldFocused(editingId)) return
        commitBookOverlayTypingTarget()
        consumedRef.current?.()
        onEditingIdChange?.(null)
      })
    }

    window.addEventListener('blur', dismissIfNotFocused)
    document.addEventListener('visibilitychange', dismissIfNotFocused)

    return () => {
      window.removeEventListener('blur', dismissIfNotFocused)
      document.removeEventListener('visibilitychange', dismissIfNotFocused)
    }
  }, [editingId, onEditingIdChange])

  if (widthPx <= 0 || heightPx <= 0) return null

  const textSticky = commands.filter((c): c is TextSticky => c.kind === 'text' || c.kind === 'sticky')

  const editBoostZ = editingZIndex ?? zIndex + 1000

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ width: `${widthPx}px`, height: `${heightPx}px`, zIndex }}
    >
      {textSticky.map((cmd) => (
        <EditableBlock
          key={cmd.id}
          cmd={cmd}
          heightPx={heightPx}
          overlayWidthPx={widthPx}
          defaultTextFontId={defaultTextFontId}
          autoFocus={textToolActive && !selectMode && focusNewId != null && cmd.id === focusNewId}
          onAutoFocusConsumedRef={consumedRef}
          onPatch={(partial) => onUpdateCommand(cmd.id, partial)}
          onDeleteSticky={
            cmd.kind === 'sticky' && onDeleteSticky ? () => onDeleteSticky(cmd.id) : undefined
          }
          onDeleteText={
            cmd.kind === 'text' && onDeleteText ? () => onDeleteText(cmd.id) : undefined
          }
          selectMode={selectMode}
          textToolActive={textToolActive}
          textInputEnabled={textInputEnabled}
          isEditing={editingId === cmd.id}
          editingZIndex={editBoostZ}
          onEndEdit={() => {
            consumedRef.current?.()
            onEditingIdChange?.(null)
          }}
          onRequestEdit={() => onEditingIdChange?.(cmd.id)}
          onEditingTextDraftChange={
            editingId === cmd.id && textToolActive && cmd.kind === 'text'
              ? onEditingTextDraftChange
              : undefined
          }
          coachField={coachField}
        />
      ))}
    </div>
  )
}
