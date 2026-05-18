'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import { X } from 'lucide-react'
import type {
  AnnotationCommand,
  StickyAnnotationCommand,
  TextAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import { DEFAULT_STICKY_FILL_COLOR, stickyNoteChrome } from '@/lib/books/annotation-palettes'
import { cn } from '@/lib/utils'

type TextSticky = TextAnnotationCommand | StickyAnnotationCommand

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Grow textarea height to fit all lines; no inner scrollbar. */
function fitTextareaHeight(el: HTMLTextAreaElement | null): void {
  if (!el) return
  el.style.overflow = 'hidden'
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
}: {
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
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const [pillLayout, setPillLayout] = useState<{ segments: string[]; widths: number[] }>({
    segments: [''],
    widths: [8],
  })

  const rowMinPx = Math.ceil(fontSize * FILLED_LINE_HEIGHT_RATIO) + 4
  const linePitchPx = rowMinPx + FILLED_LINE_GAP_PX
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

  return (
    <div
      className="relative inline-block"
      onPointerDown={(e) => {
        e.stopPropagation()
        taRef.current?.focus()
      }}
    >
      <div className="flex flex-col items-start gap-1 pointer-events-none" aria-hidden>
        {pillLayout.segments.map((seg, i) => (
          <div
            key={i}
            className="box-border rounded-sm px-1 py-0.5"
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
        onChange={(e) => {
          onTextChange(e.target.value)
          queueMicrotask(() => fitTextareaHeight(e.target))
        }}
        onBlur={onBlurCommit}
        onKeyDown={onKeyDown}
        spellCheck
        rows={1}
        className="absolute inset-0 z-[1] box-border resize-none overflow-hidden border-0 bg-transparent px-1 py-0.5 shadow-none outline-none focus:outline-none rounded-sm"
        style={{
          fontSize,
          color,
          minHeight: rowMinPx,
          lineHeight: `${linePitchPx}px`,
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
        aria-label="Annotation text"
      />
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
}: {
  cmd: TextSticky
  heightPx: number
  overlayWidthPx: number
  autoFocus: boolean
  onAutoFocusConsumedRef: MutableRefObject<(() => void) | undefined>
  onPatch: (partial: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => void
  /** Sticky notes only: remove this command from the page. */
  onDeleteSticky?: () => void
}) {
  const [local, setLocal] = useState(cmd.text)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const stickyShellRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setLocal(cmd.text)
  }, [cmd.id, cmd.text])

  const stickyH = cmd.kind === 'sticky' ? cmd.h : null
  const textFilled = cmd.kind === 'text' && cmd.visualStyle === 'filled'

  useLayoutEffect(() => {
    const ta = taRef.current
    if (cmd.kind === 'text' && textFilled) return
    if (cmd.kind === 'text' && !textFilled) {
      ta?.style.removeProperty('width')
    }
    fitTextareaHeight(ta)
  }, [local, cmd.id, cmd.kind, cmd.x, stickyH, textFilled, overlayWidthPx, heightPx, cmd.fontSizeNorm])

  useLayoutEffect(() => {
    if (!autoFocus || textFilled) return
    const el = taRef.current
    if (!el) return
    el.focus()
    el.select()
    onAutoFocusConsumedRef.current?.()
  }, [autoFocus, textFilled, onAutoFocusConsumedRef])

  const leftPct = cmd.x * 100
  const topPct = cmd.y * 100
  const fs = Math.max(10, Math.round(cmd.fontSizeNorm * heightPx))

  const blurText = useCallback(() => {
    onPatch({ text: local.trimEnd() })
    queueMicrotask(() => fitTextareaHeight(taRef.current))
  }, [local, onPatch])

  const blurSticky = useCallback(() => {
    if (cmd.kind !== 'sticky') return
    fitTextareaHeight(taRef.current)
    const shell = stickyShellRef.current
    /** Measured shell height so the box can grow or shrink with content (floor ~3% of page). */
    const hNorm = shell
      ? clamp01(Math.max(0.03, shell.getBoundingClientRect().height / heightPx))
      : cmd.h
    onPatch({
      text: local.trimEnd(),
      h: hNorm,
    })
  }, [local, onPatch, cmd, heightPx])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && cmd.kind === 'text') {
        e.preventDefault()
        blurText()
        ;(e.target as HTMLTextAreaElement).blur()
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        if (textFilled) return
        e.preventDefault()
        if (cmd.kind === 'text') {
          blurText()
        } else {
          blurSticky()
        }
        ;(e.target as HTMLTextAreaElement).blur()
      }
    },
    [cmd.kind, textFilled, blurText, blurSticky],
  )

  if (cmd.kind === 'text') {
    const filled = cmd.visualStyle === 'filled'
    const fillHex =
      filled && typeof cmd.fillColor === 'string' && /^#[0-9A-Fa-f]{6}$/i.test(cmd.fillColor)
        ? cmd.fillColor
        : filled
          ? '#fef9c3'
          : null
    const textarea = (
      <textarea
        ref={taRef}
        value={local}
        onChange={(e) => {
          setLocal(e.target.value)
          queueMicrotask(() => fitTextareaHeight(e.target))
        }}
        onBlur={blurText}
        onKeyDown={onKeyDown}
        spellCheck
        rows={1}
        className="box-border w-full resize-none overflow-hidden border-0 bg-transparent px-1 py-0.5 shadow-none outline-none focus:outline-none rounded-sm"
        style={{
          fontSize: fs,
          color: cmd.color,
          minHeight: fs * 1.25,
          lineHeight: 1.3,
          wordBreak: 'normal',
          overflowWrap: 'normal',
        }}
        aria-label="Annotation text"
      />
    )

    return (
      <div
        className={cn(
          'pointer-events-auto absolute',
          filled ? 'inline-block' : 'min-w-[3rem]',
        )}
        style={
          filled
            ? {
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: 'max-content',
                maxWidth: `${100 - leftPct}%`,
              }
            : { left: `${leftPct}%`, top: `${topPct}%`, right: 0 }
        }
        onPointerDown={(e) => e.stopPropagation()}
      >
        {filled && fillHex ? (
          <FilledTextUnifiedEditor
            text={local}
            onTextChange={setLocal}
            onBlurCommit={blurText}
            anchorXNorm={cmd.x}
            overlayWidthPx={overlayWidthPx}
            fillHex={fillHex}
            fontSize={fs}
            color={cmd.color}
            autoFocus={autoFocus}
            onAutoFocusConsumed={() => onAutoFocusConsumedRef.current?.()}
          />
        ) : (
          textarea
        )}
      </div>
    )
  }

  const wPct = cmd.w * 100
  const minHpx = Math.max(36, cmd.h * heightPx)
  /** Toolbar row removed — close control floats over the note. */
  const shellBorderPx = 2
  const textareaMinPx = Math.max(fs * 1.15, Math.max(0, minHpx - shellBorderPx))
  const stickyFill = cmd.fillColor ?? DEFAULT_STICKY_FILL_COLOR
  const stickyChrome = stickyNoteChrome(stickyFill)

  return (
    <div
      ref={stickyShellRef}
      className="pointer-events-auto absolute box-border overflow-hidden rounded-md border shadow-sm"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${wPct}%`,
        minWidth: 48,
        minHeight: minHpx,
        backgroundColor: stickyChrome.backgroundColor,
        borderColor: stickyChrome.borderColor,
      }}
      onPointerDown={(e) => e.stopPropagation()}
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
      <textarea
        ref={taRef}
        value={local}
        onChange={(e) => {
          setLocal(e.target.value)
          queueMicrotask(() => fitTextareaHeight(e.target))
        }}
        onBlur={blurSticky}
        onKeyDown={onKeyDown}
        spellCheck
        rows={1}
        className="box-border w-full resize-none overflow-hidden bg-transparent pl-2 pr-7 pt-1.5 pb-1.5 text-[#1a1512] outline-none focus-visible:ring-2 focus-visible:ring-amber-600/35 focus-visible:ring-inset"
        style={{
          fontSize: fs,
          lineHeight: 1.3,
          minHeight: textareaMinPx,
        }}
        aria-label="Sticky note"
      />
    </div>
  )
}

export interface BookPageAnnotationDomLayerProps {
  widthPx: number
  heightPx: number
  commands: AnnotationCommand[]
  /** Called when user finishes editing (blur or Enter). */
  onUpdateCommand: (id: string, next: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => void
  /** Remove a sticky note by id (text boxes unchanged). */
  onDeleteSticky?: (id: string) => void
  focusNewId?: string | null
  onConsumedFocusNew?: () => void
}

export function BookPageAnnotationDomLayer({
  widthPx,
  heightPx,
  commands,
  onUpdateCommand,
  onDeleteSticky,
  focusNewId,
  onConsumedFocusNew,
}: BookPageAnnotationDomLayerProps) {
  const consumedRef = useRef(onConsumedFocusNew)
  consumedRef.current = onConsumedFocusNew

  if (widthPx <= 0 || heightPx <= 0) return null

  const textSticky = commands.filter((c): c is TextSticky => c.kind === 'text' || c.kind === 'sticky')

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[3]"
      style={{ width: `${widthPx}px`, height: `${heightPx}px` }}
    >
      {textSticky.map((cmd) => (
        <EditableBlock
          key={cmd.id}
          cmd={cmd}
          heightPx={heightPx}
          overlayWidthPx={widthPx}
          autoFocus={focusNewId != null && cmd.id === focusNewId}
          onAutoFocusConsumedRef={consumedRef}
          onPatch={(partial) => onUpdateCommand(cmd.id, partial)}
          onDeleteSticky={
            cmd.kind === 'sticky' && onDeleteSticky ? () => onDeleteSticky(cmd.id) : undefined
          }
        />
      ))}
    </div>
  )
}
