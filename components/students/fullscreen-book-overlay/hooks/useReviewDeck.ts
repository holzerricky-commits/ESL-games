'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export type ReviewDeckMode = 'grid' | 'deck' | 'done'

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * Review flow shared by word and grammar cards: grid of all cards, one big card at a time, done.
 * `pinnedId` stays first when shuffling (e.g. the grammar rule card).
 */
export function useReviewDeck<T extends { id: string }>(items: readonly T[], resetKey: unknown, pinnedId?: string) {
  const [mode, setMode] = useState<ReviewDeckMode>('grid')
  const [order, setOrder] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    setMode('grid')
    setIndex(0)
    setFlipped(false)
  }, [resetKey])

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const deck = useMemo(() => order.map((id) => byId.get(id)).filter((item): item is T => item != null), [order, byId])
  const current = deck[Math.min(index, deck.length - 1)] ?? null

  const start = useCallback(
    (opts: { shuffle?: boolean; atId?: string } = {}) => {
      const ids = items.map((item) => item.id)
      let nextOrder = ids
      if (opts.shuffle) {
        const pinned = pinnedId && ids.includes(pinnedId) ? [pinnedId] : []
        nextOrder = [...pinned, ...shuffled(ids.filter((id) => id !== pinnedId))]
      }
      setOrder(nextOrder)
      setIndex(opts.atId ? Math.max(0, nextOrder.indexOf(opts.atId)) : 0)
      setFlipped(false)
      setMode('deck')
    },
    [items, pinnedId],
  )

  const goNext = useCallback(() => {
    setFlipped(false)
    if (index >= deck.length - 1) setMode('done')
    else setIndex((i) => i + 1)
  }, [index, deck.length])

  const goPrevious = useCallback(() => {
    setFlipped(false)
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  const toggleFlipped = useCallback(() => setFlipped((f) => !f), [])

  /** Jump to a card already in the current deck without reshuffling. */
  const goTo = useCallback(
    (id: string) => {
      const next = order.indexOf(id)
      if (next < 0) return
      setIndex(next)
      setFlipped(false)
      setMode('deck')
    },
    [order],
  )

  return { mode, setMode, deck, index, current, flipped, toggleFlipped, start, goNext, goPrevious, goTo }
}
