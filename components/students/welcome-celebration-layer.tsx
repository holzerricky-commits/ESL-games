'use client'

import { useMemo, type CSSProperties } from 'react'

const CELEBRATION_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#c084fc', '#f472b6', '#2dd4bf']

const CONFETTI_SPECS = Array.from({ length: 52 }, (_, index) => ({
  left: ((index * 19 + 7) % 97) + 1.5,
  sway: ((index % 9) - 4) * 14,
  duration: 2.8 + (index % 6) * 0.55,
  delay: (index / 52) * 4.2,
  rotate: (index * 53) % 720,
  size: 5 + (index % 5),
  round: index % 3 !== 0,
  color: CELEBRATION_COLORS[index % CELEBRATION_COLORS.length],
}))

const BALLOON_SPECS = [
  { left: 6, color: '#f87171', duration: 16, delay: 0, drift: -18 },
  { left: 18, color: '#60a5fa', duration: 19, delay: 4, drift: 22 },
  { left: 82, color: '#facc15', duration: 17, delay: 1.5, drift: -26 },
  { left: 91, color: '#4ade80', duration: 20, delay: 6, drift: 16 },
  { left: 12, color: '#c084fc', duration: 18, delay: 9, drift: 20 },
  { left: 88, color: '#fb923c', duration: 15, delay: 11, drift: -14 },
  { left: 4, color: '#f472b6', duration: 21, delay: 13, drift: 12 },
  { left: 94, color: '#2dd4bf', duration: 18, delay: 7.5, drift: -20 },
] as const

function usePrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface WelcomeCelebrationLayerProps {
  active?: boolean
}

/** Looping confetti + balloons behind the first-class welcome screen. */
export function WelcomeCelebrationLayer({ active = false }: WelcomeCelebrationLayerProps) {
  const reducedMotion = usePrefersReducedMotion()

  const confetti = useMemo(
    () =>
      CONFETTI_SPECS.map((spec, index) => (
        <div
          key={`welcome-confetti-${index}`}
          className="welcome-celebration__confetti perfect-fx-confetti absolute pointer-events-none"
          style={{
            left: `${spec.left}%`,
            top: '-8%',
            width: `${spec.size}px`,
            height: `${spec.size}px`,
            backgroundColor: spec.color,
            borderRadius: spec.round ? '50%' : '2px',
            opacity: 0.9,
            animation: `confetti-fall ${spec.duration}s linear infinite`,
            animationDelay: `${spec.delay}s`,
            '--confetti-sway': `${spec.sway}px`,
            '--confetti-rotate': `${spec.rotate}deg`,
          } as CSSProperties}
        />
      )),
    [],
  )

  const balloons = useMemo(
    () =>
      BALLOON_SPECS.map((spec, index) => (
        <div
          key={`welcome-balloon-${index}`}
          className="welcome-celebration__balloon pointer-events-none"
          style={{
            left: `${spec.left}%`,
            animationDuration: `${spec.duration}s`,
            animationDelay: `${spec.delay}s`,
            '--balloon-drift-start': `${spec.drift * -0.35}px`,
            '--balloon-drift-end': `${spec.drift}px`,
          } as CSSProperties}
          aria-hidden
        >
          <span className="welcome-celebration__balloon-body" style={{ backgroundColor: spec.color }} />
          <span className="welcome-celebration__balloon-shine" />
          <span className="welcome-celebration__balloon-knot" style={{ backgroundColor: spec.color }} />
          <span className="welcome-celebration__balloon-string" />
        </div>
      )),
    [],
  )

  if (!active || reducedMotion) return null

  return (
    <div className="welcome-celebration-layer absolute inset-0 z-[5] overflow-hidden pointer-events-none" aria-hidden>
      {confetti}
      {balloons}
    </div>
  )
}
