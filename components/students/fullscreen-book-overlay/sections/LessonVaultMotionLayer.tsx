'use client'

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Vault } from 'lucide-react'
import {
  getVaultDrag,
  LESSON_VAULT_RAIL_ATTR,
  subscribeVaultDrag,
  subscribeVaultFlyIn,
  type VaultDragState,
  type VaultFlyIn,
} from '@/lib/lesson-vault/vault-drag'
import { cn } from '@/lib/utils'

const FLY_MS = 560
const CHIP_FADE_MS = 160

const CHIP_BASE =
  'pointer-events-none fixed left-0 top-0 flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold shadow-lg'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function DragChip() {
  const drag = useSyncExternalStore(subscribeVaultDrag, getVaultDrag, () => null)
  const [last, setLast] = useState<VaultDragState | null>(null)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (drag) {
      setLast(drag)
      setLeaving(false)
      return
    }
    setLeaving(true)
    const t = window.setTimeout(() => setLast(null), CHIP_FADE_MS)
    return () => window.clearTimeout(t)
  }, [drag])

  const shown = drag ?? last
  if (!shown) return null
  return (
    <div
      className={cn(
        CHIP_BASE,
        'transition-[background-color,border-color,color,opacity,scale] duration-150 motion-reduce:transition-none',
        shown.overVault
          ? 'border-sky-400 bg-sky-500 text-white scale-105'
          : 'border-[#3f3f46] bg-[#27272a] text-[#f4f4f5]',
        leaving && !drag ? 'opacity-0' : 'opacity-95',
      )}
      style={{ transform: `translate(${shown.x + 14}px, ${shown.y + 14}px)` }}
      aria-hidden
    >
      <Vault className="h-4 w-4 shrink-0" aria-hidden />
      <span>{shown.word}</span>
      {shown.overVault ? <span className="text-xs font-medium text-sky-50">Drop to save</span> : null}
    </div>
  )
}

function FlightChip({ flight, onDone }: { flight: VaultFlyIn; onDone: (id: number) => void }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const target = document.querySelector(`[${LESSON_VAULT_RAIL_ATTR}]`)
    if (!el || !target || typeof el.animate !== 'function') {
      onDone(flight.id)
      return
    }
    const r = target.getBoundingClientRect()
    const to = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    const { from } = flight
    const lift = Math.min(120, Math.max(40, Math.abs(to.x - from.x) * 0.15))
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift }
    const at = (p: { x: number; y: number }, scale: number) =>
      `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${scale})`
    const animation = el.animate(
      [
        { transform: at(from, 1), opacity: 1 },
        { transform: at(mid, 0.8), opacity: 1, offset: 0.5 },
        { transform: at(to, 0.25), opacity: 0 },
      ],
      { duration: FLY_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
    )
    animation.onfinish = () => onDone(flight.id)
    return () => animation.cancel()
  }, [flight, onDone])

  return (
    <div
      ref={ref}
      className={cn(CHIP_BASE, 'border-sky-400 bg-sky-500 text-white')}
      style={{ transform: `translate(${flight.from.x}px, ${flight.from.y}px) translate(-50%, -50%)` }}
      aria-hidden
    >
      <Vault className="h-4 w-4 shrink-0" aria-hidden />
      <span>{flight.word}</span>
    </div>
  )
}

/** Drag chip and "word flies into the vault" animation, shown above the book. */
export function LessonVaultMotionLayer() {
  const [flights, setFlights] = useState<VaultFlyIn[]>([])
  const [mounted, setMounted] = useState(false)
  const doneRef = useRef((id: number) => setFlights((list) => list.filter((f) => f.id !== id)))

  useEffect(() => {
    setMounted(true)
    return subscribeVaultFlyIn((flight) => {
      if (prefersReducedMotion()) return
      setFlights((list) => [...list, flight])
    })
  }, [])

  if (!mounted) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[130]">
      <DragChip />
      {flights.map((flight) => (
        <FlightChip key={flight.id} flight={flight} onDone={doneRef.current} />
      ))}
    </div>,
    document.body,
  )
}
