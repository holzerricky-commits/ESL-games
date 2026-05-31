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
  stickyNoteChrome,
} from '@/lib/books/annotation-palettes'
import { textTopYFromCenterAnchor } from '@/lib/books/annotation-geometry'
import { cn } from '@/lib/utils'
import { CoachDictationSentenceChrome } from '@/components/lesson-coach/coach-dictation-sentence-chrome'
import {
  CoachSentenceGrammarPanel,
  shouldShowGrammarPanel,
} from '@/components/lesson-coach/coach-sentence-grammar-rail'
import { getSharedScreenHighlightIssues } from '@/lib/lesson-coach/issue-reveal'
import { useCoachTextFieldAssist } from '@/lib/lesson-coach/use-coach-text-field-assist'
import { useLessonCoachSyncData } from '@/lib/lesson-coach/lesson-coach-sync-context'
import { WritingAssistGhostHintBar } from '@/components/writing-assist/writing-assist-ghost-hint'

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
  onPatch: (partial: Partial<TextAnnotationCommand>) => void,
): void {
  if (cmd.yAnchor !== 'center' || !nextText.includes('\n') || previousText.includes('\n')) return
  const lineCount = Math.max(1, previousText.split('\n').length)
  onPatch({
    yAnchor: 'top',
    y: textTopYFromCenterAnchor(cmd.y, cmd.fontSizeNorm, lineCount),
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
function fitTextareaHeight(el: HTMLTextAreaElement | null): void {
  if (!el) return
  el.style.overflow = 'hidden'
  el.style.height = '0px'
  el.style.height = `${el.scrollHeight}px`
}

function plainTextMaxWidthPx(cmd: TextAnnotationCommand, overlayWidthPx: number): number {
  const roomFromAnchor = overlayWidthPx * (1 - cmd.x) - 4
  const cap =
    cmd.maxWidthNorm != null ? cmd.maxWidthNorm * overlayWidthPx : roomFromAnchor
  return Math.max(8, Math.min(roomFromAnchor, cap))
}

const PLAIN_TEXT_MEASURE_PAD_PX = 6

/** Widest line width without wrapping (avoids one-word-per-line when sizing). */
function measurePlainTextWidthPx(el: HTMLTextAreaElement, maxWidthPx: number): number {
  const mirror = getFilledTextMirror()
  const cs = getComputedStyle(el)
  mirror.style.font = cs.font
  mirror.style.fontSize = cs.fontSize
  mirror.style.fontFamily = cs.fontFamily
  mirror.style.fontWeight = cs.fontWeight
  mirror.style.letterSpacing = cs.letterSpacing
  mirror.style.whiteSpace = 'pre'

  const padX =
    (parseFloat(cs.paddingLeft) || 0) +
    (parseFloat(cs.paddingRight) || 0) +
    (parseFloat(cs.borderLeftWidth) || 0) +
    (parseFloat(cs.borderRightWidth) || 0)

  const lines = el.value.split('\n')
  let maxW = 8
  for (const line of lines) {
    mirror.textContent = line.length > 0 ? line : ' '
    maxW = Math.max(maxW, mirror.offsetWidth)
  }
  return Math.min(maxWidthPx, maxW + padX + PLAIN_TEXT_MEASURE_PAD_PX)
}

/** Shrink plain text box to content; cap width at remaining page space. */
function fitPlainTextareaSize(
  el: HTMLTextAreaElement | null,
  maxWidthPx: number,
  shell?: HTMLElement | null,
  opts?: { growOnly?: boolean },
): void {
  if (!el) return
  if (shell) {
    shell.style.width = 'auto'
    shell.style.maxWidth = 'none'
  }
  el.style.overflow = 'hidden'
  el.style.maxWidth = `${maxWidthPx}px`
  const measured = measurePlainTextWidthPx(el, maxWidthPx)
  const prevW = parseFloat(el.style.width) || 0
  const contentW =
    opts?.growOnly && measured >= prevW - 1 ? Math.max(measured, prevW) : measured
  el.style.width = `${contentW}px`
  el.style.height = '0px'
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

const FILLED_HORIZONTAL_PAD_PX = 8
const FILLED_EXTRA_PAD_PX = 4

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
  return measureRawLineWidth(lineText, cs) + FILLED_HORIZONTAL_PAD_PX + FILLED_EXTRA_PAD_PX
}

function filledInnerMaxPx(anchorXNorm: number, overlayWidthPx: number): number {
  return filledMaxWidthPx(anchorXNorm, overlayWidthPx) - FILLED_HORIZONTAL_PAD_PX - FILLED_EXTRA_PAD_PX
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
): void {
  const maxPx = filledMaxWidthPx(anchorXNorm, overlayWidthPx)
  if (!text) {
    ta.style.whiteSpace = 'pre-wrap'
    ta.style.width = '1ch'
    return
  }
  let maxSegW = 0
  for (const seg of segments) {
    maxSegW = Math.max(maxSegW, measureFilledLineTextWidth(seg, cs))
  }
  ta.style.width = `${Math.min(Math.max(maxSegW, 8), maxPx)}px`
  ta.style.whiteSpace = 'pre-wrap'
}

const FILLED_LINE_HEIGHT_RATIO = 1.3
const FILLED_LINE_GAP_PX = 4

function FilledTextUnifiedEditor({
  annotationId,
  text,
  onTextChange,
  onBlurCommit,
  anchorXNorm,
  overlayWidthPx,
  fillHex,
  fontSize,
  color,
  autoFocus,
  onAutoFocusConsumed,
  onFocus,
  readOnly = false,
  coachField = 'label',
  showPeerHoverHint = false,
}: {
  annotationId: string
  text: string
  onTextChange: (next: string) => void
  onBlurCommit: () => void
  anchorXNorm: number
  overlayWidthPx: number
  fillHex: string
  fontSize: number
  color: string
  autoFocus: boolean
  onAutoFocusConsumed?: () => void
  onFocus?: () => void
  readOnly?: boolean
  coachField?: 'label' | 'whiteboard'
  showPeerHoverHint?: boolean
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const [pillLayout, setPillLayout] = useState<{ segments: string[]; widths: number[] }>({
    segments: [''],
    widths: [8],
  })

  const rowMinPx = Math.ceil(fontSize * FILLED_LINE_HEIGHT_RATIO)
  const linePitchPx = rowMinPx + (text.length > 0 ? FILLED_LINE_GAP_PX : 0)
  const showBg = text.length > 0

  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    const cs = getComputedStyle(ta)
    const segments = computeVisualLineSegments(text, cs, anchorXNorm, overlayWidthPx)
    const widths = segments.map((seg) => measureFilledLineTextWidth(seg, cs))
    setPillLayout({ segments, widths })
    fitFilledUnifiedTextarea(ta, text, cs, anchorXNorm, overlayWidthPx, segments)
    ta.style.lineHeight = `${linePitchPx}px`
    fitTextareaHeight(ta)
  }, [text, anchorXNorm, overlayWidthPx, linePitchPx])

  useLayoutEffect(() => {
    if (!autoFocus) return
    const el = taRef.current
    if (!el) return
    el.focus()
    el.select()
    onAutoFocusConsumed?.()
  }, [autoFocus, onAutoFocusConsumed])

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

  const { assist, ghost, ghostPartial, onFieldFocus, onFieldBlur } = useCoachTextFieldAssist({
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
  const mirrorStyle: CSSProperties = {
    fontSize,
    color,
    minHeight: fontSize,
    lineHeight: text.length > 0 ? `${linePitchPx}px` : `${fontSize}px`,
    wordBreak: 'normal',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    padding: '0 4px',
  }

  return (
    <div className="inline-flex w-auto flex-col items-start">
      <CoachDictationSentenceChrome
        variant="overlay"
        text={chrome.text}
        issues={chrome.issues}
        mirrorHighlight={chrome.showMirror}
        mirrorClassName="px-1 py-0"
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
            className="box-border rounded-sm px-1 py-0"
            style={{
              width: `${pillLayout.widths[i] ?? 8}px`,
              minHeight: rowMinPx,
              minWidth: seg.length > 0 ? undefined : '1ch',
              backgroundColor: showBg && seg.length > 0 ? fillHex : 'transparent',
            }}
          />
        ))}
      </div>
      <textarea
        ref={taRef}
        value={text}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : undefined}
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
          'absolute inset-0 z-[1] box-border resize-none overflow-hidden border-0 bg-transparent px-1 py-0 shadow-none outline-none focus:outline-none focus-visible:outline-none rounded-sm',
          readOnly ? 'pointer-events-none cursor-default' : 'cursor-text',
        )}
        style={{
          fontSize,
          color,
          minHeight: fontSize,
          lineHeight: text.length > 0 ? `${linePitchPx}px` : `${fontSize}px`,
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
        aria-label="Annotation text"
      />
      {!readOnly ? <WritingAssistGhostHintBar ghost={ghost} partial={ghostPartial} /> : null}
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
  autoFocus,
  onAutoFocusConsumedRef,
  onPatch,
  onDeleteSticky,
  onDeleteText,
  selectMode,
  textToolActive,
  isEditing,
  editingZIndex,
  onEndEdit,
  coachField = 'label',
}: {
  cmd: TextSticky
  heightPx: number
  overlayWidthPx: number
  autoFocus: boolean
  onAutoFocusConsumedRef: MutableRefObject<(() => void) | undefined>
  onPatch: (partial: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => void
  onDeleteSticky?: () => void
  onDeleteText?: () => void
  selectMode?: boolean
  /** True when the text tool is active — allows click-to-edit on existing labels. */
  textToolActive?: boolean
  isEditing?: boolean
  editingZIndex?: number
  onEndEdit?: () => void
  coachField?: 'label' | 'whiteboard'
}) {
  const [local, setLocal] = useState(cmd.text)
  const [isFieldFocused, setIsFieldFocused] = useState(false)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const plainTextShellRef = useRef<HTMLDivElement | null>(null)
  const stickyShellRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isFieldFocused) return
    setLocal(cmd.text)
  }, [cmd.id, cmd.text, isFieldFocused])

  const stickyH = cmd.kind === 'sticky' ? cmd.h : null
  const textFilled = cmd.kind === 'text' && cmd.visualStyle === 'filled'

  useLayoutEffect(() => {
    const ta = taRef.current
    if (cmd.kind === 'text' && textFilled) return
    if (cmd.kind === 'text' && !textFilled) {
      fitPlainTextareaSize(ta, plainTextMaxWidthPx(cmd, overlayWidthPx), plainTextShellRef.current, {
        growOnly: isFieldFocused,
      })
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
  ])

  useLayoutEffect(() => {
    if (!autoFocus) return
    const el = taRef.current
    if (!el) return
    el.focus()
    if (textFilled) {
      const len = el.value.length
      el.setSelectionRange(len, len)
    } else {
      el.select()
    }
    onAutoFocusConsumedRef.current?.()
  }, [autoFocus, textFilled, onAutoFocusConsumedRef])

  useLayoutEffect(() => {
    if (!selectMode || !isEditing) return
    const el = taRef.current
    if (!el) return
    el.focus()
    const len = el.value.length
    el.setSelectionRange(len, len)
  }, [selectMode, isEditing, cmd.id])

  const canEdit =
    textToolActive === true || (selectMode === true && isEditing === true)
  const blockPointerEvents = canEdit ? 'pointer-events-auto' : 'pointer-events-none'
  const blockStackZ = canEdit && editingZIndex != null ? editingZIndex : undefined
  const textToolEditHint = textToolActive === true && !selectMode && cmd.kind === 'text'
  const textToolPeerHoverHint = textToolEditHint && !isFieldFocused

  useEffect(() => {
    if (!canEdit) {
      taRef.current?.blur()
      setIsFieldFocused(false)
    }
  }, [canEdit])

  const leftPct = cmd.x * 100
  const topPct = cmd.y * 100
  const fs = Math.max(10, Math.round(cmd.fontSizeNorm * heightPx))

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
        fitPlainTextareaSize(ta, plainTextMaxWidthPx(cmd, overlayWidthPx), plainTextShellRef.current)
      } else {
        fitTextareaHeight(ta)
      }
    })
    onEndEdit?.()
  }, [local, onPatch, onDeleteText, onEndEdit, cmd, overlayWidthPx])

  const blurSticky = useCallback(() => {
    if (cmd.kind !== 'sticky') return
    fitTextareaHeight(taRef.current)
    const shell = stickyShellRef.current
    const hNorm = shell
      ? clamp01(Math.max(0.03, shell.getBoundingClientRect().height / heightPx))
      : cmd.h
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

  const { assist, ghost, ghostPartial, onFieldFocus, onFieldBlur } = useCoachTextFieldAssist({
    value: local,
    setValue: setLocal,
    coachField,
    onAfterChange: () => {
      const ta = taRef.current
      if (!ta) return
      if (cmd.kind === 'text' && !textFilled) {
        fitPlainTextareaSize(ta, plainTextMaxWidthPx(cmd, overlayWidthPx), plainTextShellRef.current, {
          growOnly: true,
        })
      } else {
        fitTextareaHeight(ta)
      }
    },
    onChange: (e) => {
      if (!canEdit) return
      const value = e.target.value
      if (cmd.kind === 'text') {
        patchTextTopAnchorOnFirstNewline(cmd, local, value, onPatch)
      }
      setLocal(value)
      if (cmd.kind === 'text' && !textFilled) {
        fitPlainTextareaSize(e.target, plainTextMaxWidthPx(cmd, overlayWidthPx), plainTextShellRef.current, {
          growOnly: true,
        })
      } else {
        queueMicrotask(() => fitTextareaHeight(e.target))
      }
    },
    onKeyDown: onKeyDown as (e: React.KeyboardEvent<HTMLTextAreaElement>) => void,
  })

  const chrome = useDictationChromeForField(coachField, local)

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
        className={cn('absolute inline-block min-w-0', blockPointerEvents)}
        style={{
          ...textBlockPositionStyle(cmd, leftPct, topPct),
          ...(blockStackZ != null ? { zIndex: blockStackZ } : {}),
        }}
        onPointerDown={(e) => {
          if (canEdit) e.stopPropagation()
        }}
      >
        {filled && fillHex ? (
          <FilledTextUnifiedEditor
            annotationId={cmd.id}
            text={local}
            onTextChange={(value) => {
              patchTextTopAnchorOnFirstNewline(cmd, local, value, onPatch)
              setLocal(value)
            }}
            onBlurCommit={() => {
              onFieldBlur()
              setIsFieldFocused(false)
              blurText()
            }}
            onFocus={() => {
              onFieldFocus()
              setIsFieldFocused(true)
            }}
            anchorXNorm={cmd.x}
            overlayWidthPx={overlayWidthPx}
            fillHex={fillHex}
            fontSize={fs}
            color={cmd.color}
            autoFocus={autoFocus && canEdit}
            onAutoFocusConsumed={() => onAutoFocusConsumedRef.current?.()}
            readOnly={!canEdit}
            coachField={coachField}
            showPeerHoverHint={textToolPeerHoverHint}
          />
        ) : (
          <div className="inline-flex w-auto flex-col items-start">
            <CoachDictationSentenceChrome
              variant="overlay"
              className="w-auto"
              text={chrome.text}
              issues={chrome.issues}
              mirrorHighlight={chrome.showMirror}
              mirrorStyle={{
                fontSize: fs,
                color: cmd.color,
                minHeight: fs,
                lineHeight: 1.25,
                whiteSpace: 'pre-wrap',
                wordBreak: 'normal',
                overflowWrap: 'break-word',
              }}
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
              <textarea
                ref={taRef}
                value={local}
                readOnly={!canEdit}
                tabIndex={canEdit ? undefined : -1}
                onInput={canEdit ? assist.onInput : undefined}
                onFocus={() => {
                  onFieldFocus()
                  setIsFieldFocused(true)
                }}
                onBlur={() => {
                  onFieldBlur()
                  setIsFieldFocused(false)
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
                  'box-border inline-block resize-none overflow-hidden border-0 bg-transparent px-0 py-0 shadow-none outline-none focus:outline-none focus-visible:outline-none rounded-sm align-top',
                  textToolEditHint && 'cursor-text',
                )}
                style={{
                  fontSize: fs,
                  color: cmd.color,
                  minHeight: fs,
                  lineHeight: 1.25,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'normal',
                  overflowWrap: 'break-word',
                  maxWidth: plainTextMaxWidthPx(cmd, overlayWidthPx),
                }}
                aria-label="Annotation text"
              />
              {canEdit ? <WritingAssistGhostHintBar ghost={ghost} partial={ghostPartial} /> : null}
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
  const minHpx = Math.max(36, cmd.h * heightPx)
  const shellBorderPx = 2
  const textareaMinPx = Math.max(fs * 1.15, Math.max(0, minHpx - shellBorderPx))
  const stickyFill = cmd.fillColor ?? DEFAULT_STICKY_FILL_COLOR
  const stickyChrome = stickyNoteChrome(stickyFill)

  return (
    <div
      ref={stickyShellRef}
      className={cn(
        'absolute box-border overflow-hidden rounded-md border shadow-sm',
        blockPointerEvents,
      )}
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${wPct}%`,
        minWidth: 48,
        minHeight: minHpx,
        backgroundColor: stickyChrome.backgroundColor,
        borderColor: stickyChrome.borderColor,
        ...(blockStackZ != null ? { zIndex: blockStackZ } : {}),
      }}
      onPointerDown={(e) => {
        if (canEdit) e.stopPropagation()
      }}
    >
      {onDeleteSticky ? (
        <button
          type="button"
          className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded p-0 text-amber-950/70 transition-colors hover:bg-amber-200/80 hover:text-amber-950"
          aria-label="Delete sticky note"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onDeleteSticky()
          }}
        >
          <X className="h-3 w-3" strokeWidth={2.5} />
        </button>
      ) : null}
      <div className="relative w-full">
      <textarea
        ref={taRef}
        value={local}
        readOnly={!canEdit}
        tabIndex={canEdit ? undefined : -1}
        onInput={canEdit ? assist.onInput : undefined}
        onFocus={() => {
          onFieldFocus()
          setIsFieldFocused(true)
        }}
        onBlur={() => {
          onFieldBlur()
          setIsFieldFocused(false)
          blurSticky()
        }}
        onKeyDown={canEdit ? assist.onKeyDown : onKeyDown}
        spellCheck={assist.spellCheck}
        autoCorrect={assist.autoCorrect}
        autoCapitalize={assist.autoCapitalize}
        data-writing-assist={assist['data-writing-assist']}
        rows={1}
        className="box-border w-full resize-none overflow-hidden bg-transparent pl-2 pr-7 pt-1.5 pb-1.5 text-[#1a1512] outline-none focus-visible:ring-2 focus-visible:ring-amber-600/35 focus-visible:ring-inset"
        style={{
          fontSize: fs,
          lineHeight: 1.3,
          minHeight: textareaMinPx,
        }}
        aria-label="Sticky note"
      />
      {canEdit ? <WritingAssistGhostHintBar ghost={ghost} partial={ghostPartial} /> : null}
      </div>
    </div>
  )
}

export interface BookPageAnnotationDomLayerProps {
  widthPx: number
  heightPx: number
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
  textToolActive?: boolean
  editingId?: string | null
  onEditingIdChange?: (id: string | null) => void
  /** Sync target for coach session (book page vs whiteboard). */
  coachField?: 'label' | 'whiteboard'
}

export function BookPageAnnotationDomLayer({
  widthPx,
  heightPx,
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
  editingId = null,
  onEditingIdChange,
  coachField = 'label',
}: BookPageAnnotationDomLayerProps) {
  const consumedRef = useRef(onConsumedFocusNew)
  consumedRef.current = onConsumedFocusNew

  useEffect(() => {
    if (!selectMode && !textToolActive) onEditingIdChange?.(null)
  }, [selectMode, textToolActive, onEditingIdChange])

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
          isEditing={editingId === cmd.id}
          editingZIndex={editBoostZ}
          onEndEdit={() => onEditingIdChange?.(null)}
          coachField={coachField}
        />
      ))}
    </div>
  )
}
