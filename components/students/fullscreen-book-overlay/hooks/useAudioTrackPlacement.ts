'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  listVisibleBookAudioPinsForUnit,
  type AudioPinUnitRef,
  type BookAudioPin,
} from '@/lib/books/book-audio'

export type UseAudioTrackPlacementArgs = {
  bookId: string | null | undefined
  unitId: string | null | undefined
  unitFilePath?: string | null
  bookUnits?: readonly AudioPinUnitRef[]
}

export function useAudioTrackPlacement({
  bookId,
  unitId,
  unitFilePath = null,
  bookUnits = [],
}: UseAudioTrackPlacementArgs) {
  const [placementTrackId, setPlacementTrackId] = useState<string | null>(null)
  /** All pins for the book (any unit). */
  const [allPins, setAllPins] = useState<BookAudioPin[]>([])
  const [loading, setLoading] = useState(false)
  const [pinsRevision, setPinsRevision] = useState(0)

  const refreshPins = useCallback(() => {
    setPinsRevision((n) => n + 1)
  }, [])

  useEffect(() => {
    setPlacementTrackId(null)
  }, [bookId, unitId])

  useEffect(() => {
    if (!bookId) {
      setAllPins([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/books/audio/pins?bookId=${encodeURIComponent(bookId)}`)
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          items?: BookAudioPin[]
        }
        if (cancelled) return
        if (res.ok && body.ok && Array.isArray(body.items)) {
          setAllPins(body.items)
        } else {
          setAllPins([])
        }
      } catch {
        if (!cancelled) setAllPins([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bookId, pinsRevision])

  const audioPins = useMemo(
    () =>
      listVisibleBookAudioPinsForUnit(allPins, {
        unitId,
        unitFilePath,
        bookUnits,
      }),
    [allPins, bookUnits, unitFilePath, unitId],
  )

  const placedCountByTrackId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const pin of allPins) {
      counts.set(pin.trackId, (counts.get(pin.trackId) ?? 0) + 1)
    }
    return counts
  }, [allPins])

  const startAudioPinPlacement = useCallback(
    (trackId: string) => {
      if (!bookId || !unitId) {
        toast.error('Open a book unit before placing a track.')
        return
      }
      setPlacementTrackId(trackId)
    },
    [bookId, unitId],
  )

  const cancelAudioPinPlacement = useCallback(() => {
    setPlacementTrackId(null)
  }, [])

  const placeAudioPinAt = useCallback(
    async (pdfPage: number, center: [number, number]) => {
      if (!bookId || !unitId || !placementTrackId) {
        setPlacementTrackId(null)
        return false
      }
      try {
        const res = await fetch('/api/books/audio/pins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId,
            unitId,
            trackId: placementTrackId,
            pdfPage,
            center,
          }),
        })
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          item?: BookAudioPin
        }
        if (!res.ok || !body.ok || !body.item) {
          toast.error(body.error ?? 'Could not place the speaker.')
          return false
        }
        setAllPins((prev) => [...prev, body.item!])
        setPlacementTrackId(null)
        return true
      } catch {
        toast.error('Could not place the speaker.')
        return false
      }
    },
    [bookId, unitId, placementTrackId],
  )

  const moveAudioPin = useCallback(
    async (pinId: string, pdfPage: number, center: [number, number]) => {
      if (!bookId || !unitId) return false
      // Optimistic update
      setAllPins((prev) =>
        prev.map((pin) =>
          pin.id === pinId ? { ...pin, unitId, pdfPage, center } : pin,
        ),
      )
      try {
        const res = await fetch('/api/books/audio/pins', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId,
            pinId,
            unitId,
            pdfPage,
            center,
          }),
        })
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          item?: BookAudioPin
        }
        if (!res.ok || !body.ok || !body.item) {
          toast.error(body.error ?? 'Could not move the speaker.')
          refreshPins()
          return false
        }
        setAllPins((prev) => prev.map((pin) => (pin.id === pinId ? body.item! : pin)))
        return true
      } catch {
        toast.error('Could not move the speaker.')
        refreshPins()
        return false
      }
    },
    [bookId, unitId, refreshPins],
  )

  const removeAudioPin = useCallback(
    async (pinId: string) => {
      if (!bookId) return false
      try {
        const res = await fetch(
          `/api/books/audio/pins?bookId=${encodeURIComponent(bookId)}&pinId=${encodeURIComponent(pinId)}`,
          { method: 'DELETE' },
        )
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok || !body.ok) {
          toast.error(body.error ?? 'Could not remove speaker.')
          return false
        }
        setAllPins((prev) => prev.filter((pin) => pin.id !== pinId))
        toast.success('Speaker removed')
        return true
      } catch {
        toast.error('Could not remove speaker.')
        return false
      }
    },
    [bookId],
  )

  const removeAudioPinsByTrackId = useCallback(
    async (trackId: string) => {
      if (!bookId) return false
      const count = allPins.filter((item) => item.trackId === trackId).length
      if (count === 0) {
        toast.message('That track is not on the book.')
        return false
      }
      try {
        const res = await fetch(
          `/api/books/audio/pins?bookId=${encodeURIComponent(bookId)}&trackId=${encodeURIComponent(trackId)}`,
          { method: 'DELETE' },
        )
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok || !body.ok) {
          toast.error(body.error ?? 'Could not remove speakers.')
          return false
        }
        setAllPins((prev) => prev.filter((pin) => pin.trackId !== trackId))
        toast.success(count === 1 ? 'Speaker removed' : `Removed ${count} speakers`)
        return true
      } catch {
        toast.error('Could not remove speakers.')
        return false
      }
    },
    [allPins, bookId],
  )

  return {
    audioPinPlacementActive: placementTrackId != null,
    placementTrackId,
    audioPins,
    placedCountByTrackId,
    audioPinsLoading: loading,
    startAudioPinPlacement,
    cancelAudioPinPlacement,
    placeAudioPinAt,
    moveAudioPin,
    removeAudioPin,
    removeAudioPinsByTrackId,
    refreshAudioPins: refreshPins,
  }
}
