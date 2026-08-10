'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import type { GhostSuggestion } from '@/lib/writing-assist/ghost-complete'
import { cn } from '@/lib/utils'

type GhostMirrorStyle = CSSProperties

const STRIP_Z_INDEX = 10050

function useAnchorRect(
  anchorRef: RefObject<HTMLElement | null>,
  active: boolean,
  revisionKey: string,
): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useLayoutEffect(() => {
    if (!active) {
      setRect(null)
      return
    }

    const el = anchorRef.current
    if (!el) {
      setRect(null)
      return
    }

    const update = () => {
      const next = anchorRef.current
      setRect(next ? next.getBoundingClientRect() : null)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)

    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [anchorRef, active, revisionKey])

  return rect
}

/** Faded completion inline after the typed text (Gmail / iOS style). */
export function WritingAssistInlineGhost({
  text,
  ghost,
  className,
  style,
}: {
  text: string
  ghost: GhostSuggestion | null
  className?: string
  style?: GhostMirrorStyle
}) {
  if (!ghost?.suffix) return null

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-[3] box-border overflow-x-hidden overflow-y-hidden whitespace-pre-wrap break-words',
        className,
      )}
      style={style}
      aria-hidden
    >
      <span className="text-transparent">{text}</span>
      <span className="text-slate-400/55">{ghost.suffix}</span>
    </div>
  )
}

function PredictionChip({
  candidate,
  partial,
  active,
}: {
  candidate: GhostSuggestion
  partial: string
  active: boolean
}) {
  const word = candidate.word
  const partLower = partial.toLowerCase()
  const showSplit = partLower.length > 0 && word.startsWith(partLower)

  return (
    <span
      title={word}
      className={cn(
        'inline-flex shrink-0 items-baseline whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium leading-tight',
        active ? 'bg-slate-100 text-slate-800 ring-1 ring-slate-200' : 'text-slate-500',
      )}
    >
      {showSplit ? (
        <>
          <span className="text-slate-400">{partial}</span>
          <span>{word.slice(partLower.length)}</span>
        </>
      ) : (
        word
      )}
    </span>
  )
}

/** Light prediction chips when several next-word options exist (mobile keyboard style). */
export function WritingAssistPredictionStrip({
  candidates,
  activeIndex,
  partial = '',
  className,
  style,
  minCandidates = 2,
}: {
  candidates: GhostSuggestion[]
  activeIndex: number
  partial?: string
  className?: string
  style?: CSSProperties
  /** Show strip when candidate count reaches this (use 1 for strip-only fields). */
  minCandidates?: number
}) {
  if (candidates.length < minCandidates) return null

  const visible = candidates.slice(0, 5)

  return (
    <div
      className={cn('pointer-events-none flex w-max max-w-full items-center gap-1', className)}
      style={style}
      data-writing-assist-ui
      aria-hidden
    >
      <div className="inline-flex w-max max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-slate-200/90 bg-white/95 px-1.5 py-1 shadow-sm backdrop-blur-sm [scrollbar-width:thin]">
        {visible.map((candidate, i) => (
          <PredictionChip
            key={`${candidate.word}-${i}`}
            candidate={candidate}
            partial={partial}
            active={i === activeIndex}
          />
        ))}
      </div>
    </div>
  )
}

function WritingAssistPredictionStripPortal({
  anchorRef,
  candidates,
  activeIndex,
  partial,
  anchorRevision = '',
  stripOffsetPx = 6,
  minCandidates = 2,
}: {
  anchorRef: RefObject<HTMLElement | null>
  candidates: GhostSuggestion[]
  activeIndex: number
  partial?: string
  anchorRevision?: string
  stripOffsetPx?: number
  minCandidates?: number
}) {
  const active = candidates.length >= minCandidates
  const revisionKey = `${anchorRevision}:${activeIndex}:${partial}:${candidates.map((c) => c.word).join('\0')}`
  const rect = useAnchorRect(anchorRef, active, revisionKey)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !active || !rect) return null

  const viewportPad = 12
  const maxWidth = Math.max(160, Math.min(448, window.innerWidth - rect.left - viewportPad))

  const style: CSSProperties = {
    position: 'fixed',
    left: Math.max(viewportPad, rect.left),
    top: rect.top - stripOffsetPx,
    transform: 'translateY(-100%)',
    maxWidth,
    zIndex: STRIP_Z_INDEX,
  }

  return createPortal(
    <WritingAssistPredictionStrip
      candidates={candidates}
      activeIndex={activeIndex}
      partial={partial}
      style={style}
      minCandidates={minCandidates}
    />,
    document.body,
  )
}

/** Inline ghost + optional multi-candidate strip. */
export function WritingAssistGhostUi({
  text,
  ghost,
  partial = '',
  candidates = [],
  candidateIndex = 0,
  mirrorClassName,
  mirrorStyle,
  stripOffsetPx = 6,
  showInlineGhost = true,
  minCandidatesForStrip = 2,
}: {
  text: string
  ghost: GhostSuggestion | null
  partial?: string
  candidates?: GhostSuggestion[]
  candidateIndex?: number
  mirrorClassName?: string
  mirrorStyle?: GhostMirrorStyle
  /** @deprecated Strip is portaled; offset is controlled by stripOffsetPx. */
  stripClassName?: string
  stripOffsetPx?: number
  /** Filled labels: strip above only — no faded suffix after the caret. */
  showInlineGhost?: boolean
  /** Use 1 for strip-only mode so a single suggestion still shows as a chip above. */
  minCandidatesForStrip?: number
}) {
  const anchorRef = useRef<HTMLDivElement>(null)

  if (text.length === 0) return null
  const hasStrip = candidates.length >= minCandidatesForStrip
  if (showInlineGhost) {
    if (!ghost?.suffix) return null
  } else if (!hasStrip && !ghost?.suffix) {
    return null
  }

  const stripCandidates =
    candidates.length >= minCandidatesForStrip
      ? candidates
      : ghost?.suffix
        ? [ghost]
        : []

  return (
    <>
      <div ref={anchorRef} className="pointer-events-none absolute inset-0 z-[2]" aria-hidden />
      {showInlineGhost ? (
        <WritingAssistInlineGhost
          text={text}
          ghost={ghost}
          className={mirrorClassName}
          style={mirrorStyle}
        />
      ) : null}
      <WritingAssistPredictionStripPortal
        anchorRef={anchorRef}
        candidates={stripCandidates}
        activeIndex={candidateIndex}
        partial={partial}
        anchorRevision={text}
        stripOffsetPx={stripOffsetPx}
        minCandidates={minCandidatesForStrip}
      />
    </>
  )
}
