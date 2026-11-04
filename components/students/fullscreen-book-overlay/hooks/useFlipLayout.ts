'use client'

import { useCallback, useLayoutEffect, useEffect, useRef } from 'react'

/** Soft, slightly lingering ease — reads smoother than a snappy ease-out. */
const FLIP_MS = 560
const FLIP_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * FLIP-animates children marked with `data-flip-id` when their order or
 * container size changes (e.g. review word wall reflow).
 */
export function useFlipLayout<T extends HTMLElement>(orderKey: string) {
  const ref = useRef<T | null>(null)
  const prevRects = useRef(new Map<string, DOMRect>())
  const primed = useRef(false)

  const play = useCallback(() => {
    const root = ref.current
    if (!root) return

    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-flip-id]'))

    // Capture where each card looks now (includes in-flight transforms) before we cancel.
    const fromRects = new Map<string, DOMRect>()
    for (const el of nodes) {
      const id = el.dataset.flipId
      if (!id) continue
      const visual = el.getBoundingClientRect()
      const stored = prevRects.current.get(id)
      const animating = el.getAnimations().length > 0
      fromRects.set(id, animating || !stored ? visual : stored)
      el.getAnimations().forEach((animation) => animation.cancel())
      el.style.transform = ''
    }

    // Force layout so measurements below are the real resting positions.
    void root.offsetWidth

    const next = new Map<string, DOMRect>()
    for (const el of nodes) {
      const id = el.dataset.flipId
      if (id) next.set(id, el.getBoundingClientRect())
    }

    if (!primed.current) {
      prevRects.current = next
      primed.current = true
      return
    }

    if (prefersReducedMotion()) {
      prevRects.current = next
      return
    }

    for (const el of nodes) {
      const id = el.dataset.flipId
      if (!id) continue
      const from = fromRects.get(id)
      const curr = next.get(id)
      if (!from || !curr || curr.width < 1 || curr.height < 1) continue

      const dx = from.left - curr.left
      const dy = from.top - curr.top
      const sx = from.width / curr.width
      const sy = from.height / curr.height
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) {
        continue
      }

      el.animate(
        [
          { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})` },
          { transform: 'translate3d(0, 0, 0) scale(1, 1)' },
        ],
        {
          duration: FLIP_MS,
          easing: FLIP_EASE,
          fill: 'both',
          composite: 'replace',
        },
      )
    }

    prevRects.current = next
  }, [])

  useLayoutEffect(() => {
    play()
  }, [orderKey, play])

  useEffect(() => {
    const root = ref.current
    if (!root || typeof ResizeObserver === 'undefined') return

    let raf1 = 0
    let raf2 = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      // Double rAF: wait until the browser has committed the new layout.
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(play)
      })
    })
    ro.observe(root)
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      ro.disconnect()
    }
  }, [play])

  return ref
}
