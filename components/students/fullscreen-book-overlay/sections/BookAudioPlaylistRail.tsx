'use client'

import { CircleMinus, CirclePlus, Pause, Play, SkipBack, SkipForward, Volume2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { BookAudioTrack } from '@/lib/books/book-audio'
import {
  BOOK_AUDIO_PLAYLIST_RAIL_WIDTH_PX,
  BOOK_WORKSPACE_LEFT_BAR_WIDTH,
  BOOK_WORKSPACE_RAIL_MOTION_TW,
} from '@/components/students/fullscreen-book-overlay/constants'
import { cn } from '@/lib/utils'

interface BookAudioPlaylistRailProps {
  open: boolean
  onClose: () => void
  tracks: BookAudioTrack[]
  loading: boolean
  currentTrackId: string | null
  isPlaying: boolean
  currentTime: number
  duration: number
  onPlayTrack: (trackId: string) => void
  onTogglePlayPause: () => void
  onPlayNext: () => void
  onPlayPrevious: () => void
  onSeek: (time: number) => void
  placementTrackId?: string | null
  /** How many speakers of each track are on the book. */
  placedCountByTrackId?: ReadonlyMap<string, number>
  onStartPinPlacement?: (trackId: string) => void
  onCancelPinPlacement?: () => void
  onRemovePlacedTrack?: (trackId: string) => void
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function BookAudioPlaylistRail({
  open,
  onClose,
  tracks,
  loading,
  currentTrackId,
  isPlaying,
  currentTime,
  duration,
  onPlayTrack,
  onTogglePlayPause,
  onPlayNext,
  onPlayPrevious,
  onSeek,
  placementTrackId = null,
  placedCountByTrackId,
  onStartPinPlacement,
  onCancelPinPlacement,
  onRemovePlacedTrack,
}: BookAudioPlaylistRailProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tracks
    return tracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.fileName.toLowerCase().includes(q),
    )
  }, [tracks, query])

  const current = tracks.find((t) => t.id === currentTrackId) ?? null
  const progressMax = duration > 0 ? duration : 0
  const progressValue = progressMax > 0 ? Math.min(currentTime, progressMax) : 0
  const canPlace = Boolean(onStartPinPlacement)

  return (
    <div
      className={cn(
        'absolute inset-y-0 z-50 flex min-h-0 flex-col overflow-hidden border-r border-white/10 bg-[#2a2a2e] text-[#a1a1aa] shadow-[4px_0_16px_rgba(0,0,0,0.35)] transition-transform',
        BOOK_WORKSPACE_RAIL_MOTION_TW,
        open ? 'translate-x-0' : '-translate-x-full pointer-events-none',
      )}
      style={{
        left: BOOK_WORKSPACE_LEFT_BAR_WIDTH,
        width: `min(${BOOK_AUDIO_PLAYLIST_RAIL_WIDTH_PX}px, calc(100vw - ${BOOK_WORKSPACE_LEFT_BAR_WIDTH} - 12px))`,
      }}
      aria-hidden={!open}
    >
      <header className="flex shrink-0 flex-col gap-2 border-b border-white/10 px-2 py-2">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5 shrink-0 text-white/80" aria-hidden />
            <p className="min-w-0 truncate text-[11px] font-semibold leading-tight text-white/90">
              Listening
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-md border-white/15 bg-white/5 p-0 text-[#a1a1aa] hover:bg-white/10 hover:text-white"
            onClick={() => {
              onCancelPinPlacement?.()
              onClose()
            }}
            aria-label="Close audio playlist"
          >
            <X size={14} />
          </Button>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tracks…"
          className="h-8 border-white/15 bg-black/25 text-xs text-white placeholder:text-white/40 focus-visible:ring-white/25"
        />
        {placementTrackId ? (
          <p className="px-0.5 text-[10px] leading-snug text-sky-300/90">
            Tap the book to place this track. Escape cancels.
          </p>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-1.5 py-2 [scrollbar-width:thin] [scrollbar-color:#52525b_transparent]">
        {loading ? (
          <p className="px-2 py-3 text-xs text-white/50">Loading tracks…</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-3 text-xs text-white/50">
            {tracks.length === 0 ? 'No audio attached to this book yet.' : 'No matches.'}
          </p>
        ) : (
          filtered.map((track) => {
            const active = track.id === currentTrackId
            const placing = track.id === placementTrackId
            const placedCount = placedCountByTrackId?.get(track.id) ?? 0
            return (
              <div
                key={track.id}
                className={cn(
                  'flex w-full items-start gap-1 rounded-md px-1 py-1 outline-none transition-colors',
                  placing
                    ? 'bg-sky-500/20 text-white ring-1 ring-sky-400/40'
                    : active
                      ? 'bg-white/15 text-white ring-1 ring-white/20'
                      : 'hover:bg-white/10 hover:text-white/90',
                )}
              >
                <button
                  type="button"
                  onClick={() => onPlayTrack(track.id)}
                  className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                >
                  <span className="mt-0.5 shrink-0 text-white/70">
                    {active && isPlaying ? (
                      <Pause className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Play className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[12px] font-medium leading-snug [overflow-wrap:anywhere]">
                      {track.title}
                    </span>
                    {placedCount > 0 ? (
                      <span className="mt-0.5 block text-[10px] tabular-nums text-white/40">
                        {placedCount === 1 ? '1 on book' : `${placedCount} on book`}
                      </span>
                    ) : null}
                  </span>
                </button>
                {canPlace ? (
                  <div className="mt-0.5 flex shrink-0 items-center">
                    {placedCount > 0 ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-white/55 hover:bg-white/10 hover:text-white"
                        title={
                          placedCount === 1
                            ? 'Remove from book'
                            : `Remove all ${placedCount} from book`
                        }
                        aria-label={
                          placedCount === 1
                            ? `Remove ${track.title} from book`
                            : `Remove all ${placedCount} ${track.title} speakers from book`
                        }
                        onClick={() => onRemovePlacedTrack?.(track.id)}
                      >
                        <CircleMinus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={cn(
                        'h-7 w-7 text-white/55 hover:bg-white/10 hover:text-white',
                        placing && 'bg-sky-500/30 text-sky-100 hover:bg-sky-500/40 hover:text-white',
                      )}
                      title={placing ? 'Done placing' : 'Place on book'}
                      aria-label={
                        placing ? `Done placing ${track.title}` : `Place ${track.title} on book`
                      }
                      aria-pressed={placing}
                      onClick={() => {
                        if (placing) onCancelPinPlacement?.()
                        else onStartPinPlacement?.(track.id)
                      }}
                    >
                      <CirclePlus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      <footer className="shrink-0 border-t border-white/10 px-2 py-2">
        <p className="mb-1.5 break-words text-[11px] font-medium leading-snug text-white/85 [overflow-wrap:anywhere]">
          {current?.title ?? 'Nothing playing'}
        </p>
        <input
          type="range"
          min={0}
          max={progressMax || 1}
          step={0.1}
          value={progressValue}
          disabled={!current || progressMax <= 0}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="mb-1.5 h-1.5 w-full cursor-pointer accent-white disabled:opacity-40"
          aria-label="Seek"
        />
        <div className="mb-2 flex justify-between text-[10px] tabular-nums text-white/45">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="flex items-center justify-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white/75 hover:bg-white/10 hover:text-white"
            onClick={onPlayPrevious}
            disabled={!tracks.length}
            aria-label="Previous track"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 text-white hover:bg-white/10"
            onClick={onTogglePlayPause}
            disabled={!tracks.length}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white/75 hover:bg-white/10 hover:text-white"
            onClick={onPlayNext}
            disabled={!tracks.length}
            aria-label="Next track"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      </footer>
    </div>
  )
}
