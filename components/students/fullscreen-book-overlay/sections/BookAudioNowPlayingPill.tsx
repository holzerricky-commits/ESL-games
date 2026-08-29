'use client'

import { Pause, Play, RotateCcw, X } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  BOOK_BOTTOM_CHROME_HEIGHT,
  BOOK_OVERLAY_GLASS_CHROME,
} from '@/components/students/fullscreen-book-overlay/constants'
import { cn } from '@/lib/utils'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function PillIconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/85 transition-colors duration-150 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function BookAudioNowPlayingPill({
  title,
  isPlaying,
  currentTime,
  duration,
  deskLeft,
  floatingChrome,
  hidden,
  onTogglePlayPause,
  onRestart,
  onSeek,
  onStop,
}: {
  title: string
  isPlaying: boolean
  currentTime: number
  duration: number
  deskLeft: string
  floatingChrome: boolean
  hidden?: boolean
  onTogglePlayPause: () => void
  onRestart: () => void
  onSeek: (time: number) => void
  onStop: () => void
}) {
  const progressMax = duration > 0 ? duration : 0
  const progressValue = progressMax > 0 ? Math.min(currentTime, progressMax) : 0

  return (
    <div
      className={cn(
        'pointer-events-auto fixed z-[56] w-[min(22rem,calc(100vw-6rem))] -translate-x-1/2 rounded-2xl px-2 py-1.5 text-white',
        BOOK_OVERLAY_GLASS_CHROME,
        hidden && 'pointer-events-none invisible opacity-0',
      )}
      style={{
        left: `calc(${deskLeft} + (100% - ${deskLeft}) / 2)`,
        bottom: floatingChrome ? '3.75rem' : `calc(${BOOK_BOTTOM_CHROME_HEIGHT} + 0.5rem)`,
      }}
      role="region"
      aria-label="Now playing"
      aria-hidden={hidden}
    >
      <div className="flex items-center gap-0.5">
        <PillIconButton label={isPlaying ? 'Pause' : 'Play'} onClick={onTogglePlayPause}>
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          ) : (
            <Play className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          )}
        </PillIconButton>
        <PillIconButton label="Restart from start" onClick={onRestart}>
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </PillIconButton>
        <p className="min-w-0 flex-1 truncate px-1.5 text-[11px] font-medium tracking-tight text-white/90">
          {title}
        </p>
        <PillIconButton label="Stop" onClick={onStop}>
          <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </PillIconButton>
      </div>
      <div className="flex items-center gap-1.5 px-1.5 pb-0.5 pt-1">
        <span className="w-8 shrink-0 text-[10px] tabular-nums text-white/45">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={progressMax || 1}
          step={0.1}
          value={progressValue}
          disabled={progressMax <= 0}
          aria-label="Seek"
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-white disabled:opacity-40"
        />
        <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-white/45">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  )
}
