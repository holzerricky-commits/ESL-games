'use client'

import type { LucideIcon } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import {
  Download,
  Hand,
  ScanSearch,
  X,
} from 'lucide-react'
import {
  focusZoomSpotlightClipPath,
  focusZoomTheaterClipPath,
  holeRectToClientRect,
} from '@/lib/books/focus-zoom-transform'
import { cn } from '@/lib/utils'

/** Hole rect in pageArea coordinates (w/h, not width/height). */
export type FocusChromeRect = { x: number; y: number; w: number; h: number }

/** Opaque theater surround while zoomed (presentation mode). */
export const FOCUS_ZOOM_THEATER = 'bg-[#0a0a0a]'

/** Legacy page-area dim — draw preview only; active zoom uses theater scrim. */
export const FOCUS_ZOOM_DIM =
  'bg-[#0a0a0a] transition-[background-color] duration-150'

export const FOCUS_ZOOM_DRAW_VEIL = 'bg-[#0a0a0a]/[0.22]'

export const FOCUS_ZOOM_CONTROL_BAR =
  'flex items-center gap-0.5 rounded-2xl border border-white/12 bg-black/60 p-1 text-white shadow-[0_10px_40px_rgba(0,0,0,0.42)] backdrop-blur-md'

const HOLE_RADIUS_PX = 10
const BACKDROP_CLICK_SLOP_PX = 8

function useAreaSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return size
}

function useTheaterHoleClipPath(
  pageAreaRef: React.RefObject<HTMLElement | null>,
  overlayRef: React.RefObject<HTMLElement | null>,
  hole: FocusChromeRect | null | undefined,
) {
  const [clipPath, setClipPath] = useState<string | undefined>()

  useLayoutEffect(() => {
    const update = () => {
      const pageEl = pageAreaRef.current
      const overlayEl = overlayRef.current
      if (!pageEl || !overlayEl || !hole || hole.w <= 0 || hole.h <= 0) {
        setClipPath(undefined)
        return
      }
      const clientHole = holeRectToClientRect(hole, pageEl.getBoundingClientRect())
      setClipPath(focusZoomTheaterClipPath(clientHole, overlayEl.getBoundingClientRect()))
    }
    update()
    const pageEl = pageAreaRef.current
    const overlayEl = overlayRef.current
    const ro = new ResizeObserver(update)
    if (pageEl) ro.observe(pageEl)
    if (overlayEl) ro.observe(overlayEl)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [hole, overlayRef, pageAreaRef])

  return clipPath
}

/** Full-screen opaque scrim with a focus hole (presentation mode). */
export function FocusZoomTheaterScrim({
  pageAreaRef,
  overlayRef,
  hole,
  onBackdropClick,
  pointerEventsDisabled = false,
  className,
}: {
  pageAreaRef: React.RefObject<HTMLElement | null>
  overlayRef: React.RefObject<HTMLElement | null>
  hole: FocusChromeRect
  onBackdropClick?: () => void
  pointerEventsDisabled?: boolean
  className?: string
}) {
  const backdropDownRef = useRef<{ x: number; y: number } | null>(null)
  const clipPath = useTheaterHoleClipPath(pageAreaRef, overlayRef, hole)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onBackdropClick || e.button !== 0) return
      backdropDownRef.current = { x: e.clientX, y: e.clientY }
    },
    [onBackdropClick],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!onBackdropClick) return
      const start = backdropDownRef.current
      backdropDownRef.current = null
      if (!start || e.button !== 0) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (dx * dx + dy * dy <= BACKDROP_CLICK_SLOP_PX * BACKDROP_CLICK_SLOP_PX) {
        onBackdropClick()
      }
    },
    [onBackdropClick],
  )

  const backdropHandlers = onBackdropClick
    ? {
        onPointerDown,
        onPointerUp,
        onPointerCancel: onPointerUp,
      }
    : {}

  const interactive = Boolean(onBackdropClick) && !pointerEventsDisabled

  return (
    <div
      className={cn(
        FOCUS_ZOOM_THEATER,
        interactive && 'pointer-events-auto cursor-pointer',
        !interactive && 'pointer-events-none',
        className,
      )}
      style={clipPath ? { clipPath } : undefined}
      aria-hidden
      {...backdropHandlers}
    />
  )
}

/** Single dim layer with a hole cut via clip-path — draw preview inside pageArea. */
export function FocusZoomSpotlightBackdrop({
  areaRef,
  hole,
  dimClassName = FOCUS_ZOOM_DIM,
  onBackdropClick,
  pointerEventsDisabled = false,
  className,
}: {
  areaRef: React.RefObject<HTMLElement | null>
  hole?: FocusChromeRect | null
  dimClassName?: string
  /** Tap the dimmed backdrop (without dragging) — e.g. exit zoom. */
  onBackdropClick?: () => void
  /** When true (e.g. Space+pan), clicks pass through to layers below. */
  pointerEventsDisabled?: boolean
  className?: string
}) {
  const backdropDownRef = useRef<{ x: number; y: number } | null>(null)
  const { w: pageW, h: pageH } = useAreaSize(areaRef)
  const clipPath = focusZoomSpotlightClipPath(hole ?? null, pageW, pageH)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onBackdropClick || e.button !== 0) return
      backdropDownRef.current = { x: e.clientX, y: e.clientY }
    },
    [onBackdropClick],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!onBackdropClick) return
      const start = backdropDownRef.current
      backdropDownRef.current = null
      if (!start || e.button !== 0) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (dx * dx + dy * dy <= BACKDROP_CLICK_SLOP_PX * BACKDROP_CLICK_SLOP_PX) {
        onBackdropClick()
      }
    },
    [onBackdropClick],
  )

  const backdropHandlers = onBackdropClick
    ? {
        onPointerDown,
        onPointerUp,
        onPointerCancel: onPointerUp,
      }
    : {}

  const interactive = Boolean(onBackdropClick) && !pointerEventsDisabled

  return (
    <div
      className={cn(
        'absolute inset-0',
        dimClassName,
        interactive && 'pointer-events-auto cursor-pointer',
        !interactive && 'pointer-events-none',
        className,
      )}
      style={clipPath ? { clipPath } : undefined}
      aria-hidden
      {...backdropHandlers}
    />
  )
}

/** Snagit-style corner brackets, or a minimal hairline in presentation mode. */
export function FocusZoomSelectionFrame({
  rect,
  className,
  style,
  variant = 'default',
}: {
  rect: { x: number; y: number; w?: number; h?: number; width?: number; height?: number }
  className?: string
  style?: React.CSSProperties
  variant?: 'default' | 'presentation'
}) {
  const w = rect.w ?? rect.width ?? 0
  const h = rect.h ?? rect.height ?? 0
  if (w < 2 || h < 2) return null

  if (variant === 'presentation') {
    return (
      <div
        className={cn('pointer-events-none absolute border border-white/55', className)}
        style={{
          left: rect.x,
          top: rect.y,
          width: w,
          height: h,
          borderRadius: 6,
          ...style,
        }}
      />
    )
  }

  const bracket = 'absolute h-3 w-3 border-sky-300'
  return (
    <div
      className={cn('pointer-events-none absolute', className)}
      style={{
        left: rect.x,
        top: rect.y,
        width: w,
        height: h,
        borderRadius: HOLE_RADIUS_PX,
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.45), 0 0 0 2px rgba(56,189,248,0.4)',
        ...style,
      }}
    >
      <span className={cn(bracket, 'left-0 top-0 border-l-2 border-t-2')} />
      <span className={cn(bracket, 'right-0 top-0 border-r-2 border-t-2')} />
      <span className={cn(bracket, 'bottom-0 left-0 border-b-2 border-l-2')} />
      <span className={cn(bracket, 'bottom-0 right-0 border-b-2 border-r-2')} />
    </div>
  )
}

function ControlBarButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  iconOnly = false,
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
  disabled?: boolean
  iconOnly?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-colors',
        iconOnly ? 'min-w-9 px-2' : 'min-w-9 px-2.5',
        'hover:bg-white/12 disabled:opacity-45',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!iconOnly ? <span className="hidden sm:inline">{label}</span> : null}
    </button>
  )
}

function ControlBarHint({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <span
      className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-white/55"
      title={label}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}

export function FocusZoomControlBar({
  onExit,
  onNewArea,
  onSaveImage,
  saveBusy,
  panHint = 'Click outside to exit · hold Space and drag to pan',
  className,
  presentation = false,
}: {
  onExit: () => void
  onNewArea?: () => void
  onSaveImage?: () => void
  saveBusy?: boolean
  panHint?: string
  className?: string
  /** Trimmed bar for presentation mode: Exit + New area + icon save only. */
  presentation?: boolean
}) {
  const showHint = !presentation ? Boolean(panHint) : Boolean(panHint?.includes('Panning'))

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-4 z-[64] flex flex-col items-center gap-2 px-3',
        className,
      )}
    >
      {showHint ? (
        <p className="pointer-events-none max-w-md text-center text-[11px] leading-snug text-white/70">
          {panHint}
        </p>
      ) : null}
      <div className={cn(FOCUS_ZOOM_CONTROL_BAR, 'pointer-events-auto')}>
        <ControlBarButton label="Exit (Esc)" icon={X} onClick={onExit} iconOnly={presentation} />
        {onNewArea ? (
          <ControlBarButton
            label="New area"
            icon={ScanSearch}
            onClick={onNewArea}
            iconOnly={presentation}
          />
        ) : null}
        {!presentation ? <ControlBarHint label="Space+drag" icon={Hand} /> : null}
        {onSaveImage ? (
          <ControlBarButton
            label={saveBusy ? 'Saving…' : 'Save image'}
            icon={Download}
            onClick={onSaveImage}
            disabled={saveBusy}
            iconOnly={presentation}
          />
        ) : null}
      </div>
    </div>
  )
}

export function FocusZoomDrawHint() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[4.75rem] z-[69] flex justify-center px-4">
      <p
        className={cn(
          'max-w-sm rounded-xl border border-white/10 bg-black/55 px-4 py-2 text-center text-xs leading-relaxed text-white/90',
          'shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md',
        )}
      >
        Drag around what students should see. Release to zoom in.
      </p>
    </div>
  )
}

export function FocusZoomDrawCancelBar({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[69] flex justify-center">
      <div className={cn(FOCUS_ZOOM_CONTROL_BAR, 'pointer-events-auto')}>
        <ControlBarButton label="Cancel (Esc)" icon={X} onClick={onCancel} />
      </div>
    </div>
  )
}
