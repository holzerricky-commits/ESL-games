'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import { X } from 'lucide-react'
import type {
  AnnotationCommand,
  StickyAnnotationCommand,
  TextAnnotationCommand,
} from '@/lib/books/annotation-command-types'
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

function EditableBlock({
  cmd,
  heightPx,
  autoFocus,
  onAutoFocusConsumedRef,
  onPatch,
  onDeleteSticky,
}: {
  cmd: TextSticky
  heightPx: number
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
  useLayoutEffect(() => {
    fitTextareaHeight(taRef.current)
  }, [local, cmd.id, cmd.kind, stickyH])

  useLayoutEffect(() => {
    if (!autoFocus) return
    const el = taRef.current
    if (!el) return
    el.focus()
    el.select()
    onAutoFocusConsumedRef.current?.()
  }, [autoFocus, onAutoFocusConsumedRef])

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
      if (e.key === 'Enter' && !e.shiftKey) {
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

  if (cmd.kind === 'text') {
    const maxW = cmd.maxWidthNorm != null ? `${cmd.maxWidthNorm * 100}%` : '85%'
    return (
      <div
        className="pointer-events-auto absolute min-w-[3rem]"
        style={{ left: `${leftPct}%`, top: `${topPct}%`, maxWidth: maxW }}
        onPointerDown={(e) => e.stopPropagation()}
      >
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
          className={cn(
            'box-border w-full resize-none overflow-hidden rounded border border-black/20 bg-white/95 px-1.5 py-1 text-[#1a1512] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
          )}
          style={{
            fontSize: fs,
            color: cmd.color,
            minHeight: fs * 1.35,
            lineHeight: 1.25,
          }}
          aria-label="Annotation text"
        />
      </div>
    )
  }

  const wPct = cmd.w * 100
  const minHpx = Math.max(40, cmd.h * heightPx)
  /** Toolbar row height (px); must match `h-8` below so shell minHeight matches textarea + chrome. */
  const stickyHeaderPx = 32
  const shellBorderPx = 2
  const textareaMinPx = Math.max(
    fs * 1.35,
    Math.max(0, minHpx - stickyHeaderPx - shellBorderPx),
  )

  return (
    <div
      ref={stickyShellRef}
      className="pointer-events-auto absolute box-border flex flex-col overflow-hidden rounded-md border border-amber-800/35 bg-amber-100/95 shadow-md"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${wPct}%`,
        minWidth: 48,
        minHeight: minHpx,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="box-border flex h-8 shrink-0 items-center justify-end border-b border-amber-800/25 px-1">
        {onDeleteSticky ? (
          <button
            type="button"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-900/20 bg-amber-50/95 text-amber-950/75 shadow-sm transition-colors hover:bg-amber-200/95 hover:text-amber-950"
            aria-label="Delete sticky note"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onDeleteSticky()
            }}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        ) : null}
      </div>
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
        className="box-border w-full shrink-0 resize-none overflow-hidden bg-transparent px-2 py-2 text-[#1a1512] outline-none focus-visible:ring-2 focus-visible:ring-amber-600/40 focus-visible:ring-inset"
        style={{
          fontSize: fs,
          lineHeight: 1.25,
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
