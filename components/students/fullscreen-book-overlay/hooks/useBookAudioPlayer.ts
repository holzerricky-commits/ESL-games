'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { BookAudioTrack } from '@/lib/books/book-audio'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'

export type BookAudioPlayerState = {
  tracks: BookAudioTrack[]
  loading: boolean
  hasTracks: boolean
  currentTrackId: string | null
  currentTrack: BookAudioTrack | null
  isPlaying: boolean
  currentTime: number
  duration: number
  playTrack: (trackId: string) => void
  togglePlayPause: () => void
  restart: () => void
  playNext: () => void
  playPrevious: () => void
  seek: (time: number) => void
  stop: () => void
  audioRef: RefObject<HTMLAudioElement | null>
}

function trackUrl(track: BookAudioTrack): string {
  return makeUnitFileUrl(track.filePath)
}

export function useBookAudioPlayer(bookId: string | null | undefined): BookAudioPlayerState {
  const [tracks, setTracks] = useState<BookAudioTrack[]>([])
  const [loading, setLoading] = useState(false)
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const loadRevRef = useRef(0)

  useEffect(() => {
    const rev = ++loadRevRef.current
    setTracks([])
    setCurrentTrackId(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    const el = audioRef.current
    if (el) {
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
    if (!bookId) {
      setLoading(false)
      return
    }
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/books/audio?bookId=${encodeURIComponent(bookId)}`)
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: BookAudioTrack[] }
        if (rev !== loadRevRef.current) return
        if (res.ok && body.ok && Array.isArray(body.items)) {
          setTracks(body.items)
        } else {
          setTracks([])
        }
      } catch {
        if (rev !== loadRevRef.current) return
        setTracks([])
      } finally {
        if (rev === loadRevRef.current) setLoading(false)
      }
    })()
  }, [bookId])

  const currentTrack = useMemo(
    () => tracks.find((t) => t.id === currentTrackId) ?? null,
    [tracks, currentTrackId],
  )

  const playTrack = useCallback(
    (trackId: string) => {
      const track = tracks.find((t) => t.id === trackId)
      const el = audioRef.current
      if (!track || !el) return
      if (currentTrackId === trackId) {
        if (el.paused) {
          if (el.ended || (el.duration > 0 && el.currentTime >= el.duration - 0.05)) {
            el.currentTime = 0
            setCurrentTime(0)
          }
          void el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
        } else {
          el.pause()
          setIsPlaying(false)
        }
        return
      }
      setCurrentTrackId(trackId)
      setCurrentTime(0)
      setDuration(0)
      el.src = trackUrl(track)
      el.load()
      void el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    },
    [tracks, currentTrackId],
  )

  const togglePlayPause = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (!currentTrackId) {
      if (tracks[0]) playTrack(tracks[0].id)
      return
    }
    if (el.paused) {
      if (el.ended || (el.duration > 0 && el.currentTime >= el.duration - 0.05)) {
        el.currentTime = 0
        setCurrentTime(0)
      }
      void el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    } else {
      el.pause()
      setIsPlaying(false)
    }
  }, [currentTrackId, tracks, playTrack])

  const restart = useCallback(() => {
    const el = audioRef.current
    if (!el || !currentTrackId) return
    el.currentTime = 0
    setCurrentTime(0)
    void el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
  }, [currentTrackId])

  const playNext = useCallback(() => {
    if (!tracks.length) return
    const idx = tracks.findIndex((t) => t.id === currentTrackId)
    const next = tracks[idx < 0 ? 0 : Math.min(tracks.length - 1, idx + 1)]
    if (!next) return
    if (idx >= 0 && idx < tracks.length - 1) {
      playTrack(next.id)
    } else if (idx < 0) {
      playTrack(tracks[0]!.id)
    }
  }, [tracks, currentTrackId, playTrack])

  const playPrevious = useCallback(() => {
    if (!tracks.length) return
    const el = audioRef.current
    const idx = tracks.findIndex((t) => t.id === currentTrackId)
    if (el && el.currentTime > 3) {
      el.currentTime = 0
      setCurrentTime(0)
      return
    }
    if (idx > 0) {
      playTrack(tracks[idx - 1]!.id)
    } else if (tracks[0]) {
      playTrack(tracks[0].id)
    }
  }, [tracks, currentTrackId, playTrack])

  const seek = useCallback((time: number) => {
    const el = audioRef.current
    if (!el || !Number.isFinite(time)) return
    el.currentTime = Math.max(0, time)
    setCurrentTime(el.currentTime)
  }, [])

  const stop = useCallback(() => {
    const el = audioRef.current
    if (el) {
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
    setIsPlaying(false)
    setCurrentTrackId(null)
    setCurrentTime(0)
    setDuration(0)
  }, [])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onTime = () => setCurrentTime(el.currentTime || 0)
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      const idx = tracks.findIndex((t) => t.id === currentTrackId)
      if (idx >= 0 && idx < tracks.length - 1) {
        playTrack(tracks[idx + 1]!.id)
      } else {
        setIsPlaying(false)
      }
    }

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('durationchange', onMeta)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('durationchange', onMeta)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
    }
  }, [tracks, currentTrackId, playTrack])

  return {
    tracks,
    loading,
    hasTracks: tracks.length > 0,
    currentTrackId,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    playTrack,
    togglePlayPause,
    restart,
    playNext,
    playPrevious,
    seek,
    stop,
    audioRef,
  }
}
