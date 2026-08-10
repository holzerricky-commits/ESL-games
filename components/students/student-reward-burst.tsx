'use client'

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  DEFAULT_STUDENT_REWARD_STYLE,
  type StudentRewardStyle,
} from '@/lib/students/student-reward-style'

const STICKER_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff8fab', '#ff9f43']
const SPOTLIGHT_COLORS = ['#fff6c2', '#ffe566', '#ffffff', '#ffd27a', '#fef3c7']
const RIBBON_COLORS = ['#93c5fd', '#fcd34d', '#fda4af', '#c4b5fd', '#86efac']

/** Per-style motion — no shared enter/exit across all three looks. */
const REWARD_KEYFRAMES_CSS = `
@keyframes esl-sticker-peel-in {
  0% { opacity: 0; transform: rotate(-14deg) translateY(12px); }
  100% { opacity: 1; transform: rotate(-2.5deg) translateY(0); }
}
@keyframes esl-sticker-peel-out {
  0% { opacity: 1; transform: rotate(-2.5deg) translateY(0); }
  100% { opacity: 0; transform: rotate(8deg) translateY(10px); }
}
@keyframes esl-spotlight-rise-in {
  0% { opacity: 0; transform: translateY(48px); filter: brightness(0.7); }
  100% { opacity: 1; transform: translateY(0); filter: brightness(1); }
}
@keyframes esl-spotlight-sink-out {
  0% { opacity: 1; transform: translateY(0); filter: brightness(1) blur(0); }
  55% { opacity: 0.55; transform: translateY(-10px); filter: brightness(1.25) blur(1.5px); }
  100% { opacity: 0; transform: translateY(-22px); filter: brightness(1.55) blur(7px); }
}
@keyframes esl-ribbon-unfurl-in {
  0% { opacity: 0; clip-path: inset(0 48% 0 48%); }
  100% { opacity: 1; clip-path: inset(0 0 0 0); }
}
@keyframes esl-ribbon-fold-out {
  0% { opacity: 1; clip-path: inset(0 0 0 0); }
  100% { opacity: 0; clip-path: inset(0 42% 0 42%); }
}
@keyframes esl-sticker-flash {
  0% { opacity: 0.9; }
  100% { opacity: 0; }
}
@keyframes esl-spotlight-veil-in {
  0% { opacity: 0; }
  40% { opacity: 1; }
  100% { opacity: 0.72; }
}
@keyframes esl-spotlight-veil-out {
  0% { opacity: 0.72; }
  100% { opacity: 0; }
}
@keyframes esl-spotlight-cone-in {
  0% { opacity: 0; transform: scaleY(0.4); }
  100% { opacity: 1; transform: scaleY(1); }
}
@keyframes esl-spotlight-cone-out {
  0% { opacity: 1; transform: scaleY(1); }
  100% { opacity: 0; transform: scaleY(1.08); }
}
@keyframes esl-ribbon-wash {
  0% { opacity: 0; }
  35% { opacity: 0.85; }
  100% { opacity: 0; }
}
@keyframes esl-burst-out {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% {
    transform: translate(calc(-50% + var(--burst-end-x, 0px)), calc(-50% + var(--burst-end-y, 0px))) scale(0.2);
    opacity: 0;
  }
}
@keyframes esl-sparkle-rise {
  0% { transform: translateY(0) translateX(0) scale(0.6); opacity: 0; }
  15% { opacity: 0.95; }
  100% {
    transform: translateY(var(--sparkle-rise, -70vh)) translateX(var(--sparkle-sway, 0px)) scale(1);
    opacity: 0;
  }
}
@keyframes esl-petal-float {
  0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
  12% { opacity: 0.9; }
  100% {
    transform: translateY(var(--petal-rise, -65vh)) translateX(var(--petal-sway, 0px)) rotate(var(--petal-spin, 240deg));
    opacity: 0;
  }
}
`

const STYLE_TAG_ID = 'esl-student-reward-keyframes'

const REWARD_FONT_LOADS = [
  '400 1em "Happy Friday"',
  '500 1em "Cre ChocoCookie Medium"',
] as const

/** Inject praise @keyframes once; safe to call from render or idle warmup. */
export function ensureRewardKeyframes(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_TAG_ID)) return
  const tag = document.createElement('style')
  tag.id = STYLE_TAG_ID
  tag.textContent = REWARD_KEYFRAMES_CSS
  document.head.appendChild(tag)
}

/** Prefetch praise fonts so the first G does not wait on font swap. */
export function preloadRewardFonts(): void {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  for (const spec of REWARD_FONT_LOADS) {
    void document.fonts.load(spec).catch(() => {})
  }
}

/** Idle-friendly warmup for keyframes + fonts (audio is warmed separately). */
export function warmStudentRewardBurstAssets(): void {
  ensureRewardKeyframes()
  preloadRewardFonts()
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function buildStickerParticles(): ReactNode[] {
  const particles: ReactNode[] = []
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2
    const distance = 28 + Math.random() * 52
    const endX = 50 + Math.cos(angle) * distance
    const endY = 42 + Math.sin(angle) * distance
    particles.push(
      <div
        key={`sticker-burst-${i}`}
        className="absolute rounded-full pointer-events-none"
        style={{
          left: '50%',
          top: '42%',
          width: `${5 + Math.random() * 7}px`,
          height: `${5 + Math.random() * 7}px`,
          backgroundColor: STICKER_COLORS[Math.floor(Math.random() * STICKER_COLORS.length)],
          boxShadow: `0 0 ${8 + Math.random() * 8}px currentColor`,
          transform: 'translate(-50%, -50%)',
          animation: 'esl-burst-out 1.15s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
          '--burst-end-x': `${(endX - 50) * 3}vw`,
          '--burst-end-y': `${(endY - 42) * 3}vh`,
        } as CSSProperties}
      />,
    )
  }
  return particles
}

function buildSpotlightParticles(): ReactNode[] {
  const particles: ReactNode[] = []
  for (let i = 0; i < 28; i++) {
    const startX = 20 + Math.random() * 60
    const sway = (Math.random() - 0.5) * 50
    const rise = -(45 + Math.random() * 40)
    const duration = 1.2 + Math.random() * 0.7
    const delay = (i / 28) * 0.35
    const size = 3 + Math.random() * 5
    particles.push(
      <div
        key={`sparkle-${i}`}
        className="absolute pointer-events-none"
        style={{
          left: `${startX}%`,
          bottom: '8%',
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: Math.random() > 0.45 ? '50%' : '1px',
          backgroundColor: SPOTLIGHT_COLORS[Math.floor(Math.random() * SPOTLIGHT_COLORS.length)],
          boxShadow: '0 0 10px rgba(255, 230, 140, 0.85)',
          opacity: 0,
          animation: `esl-sparkle-rise ${duration}s ease-out forwards`,
          animationDelay: `${delay}s`,
          '--sparkle-rise': `${rise}vh`,
          '--sparkle-sway': `${sway}px`,
        } as CSSProperties}
      />,
    )
  }
  return particles
}

function buildRibbonParticles(): ReactNode[] {
  const particles: ReactNode[] = []
  for (let i = 0; i < 22; i++) {
    const startX = Math.random() * 100
    const sway = (Math.random() - 0.5) * 80
    const rise = -(40 + Math.random() * 45)
    const duration = 1.35 + Math.random() * 0.6
    const delay = (i / 22) * 0.3
    const w = 8 + Math.random() * 10
    const h = 6 + Math.random() * 8
    const isHeart = Math.random() > 0.55
    particles.push(
      <div
        key={`petal-${i}`}
        className="absolute pointer-events-none"
        style={{
          left: `${startX}%`,
          bottom: '-2%',
          width: `${w}px`,
          height: `${h}px`,
          borderRadius: isHeart ? '50% 50% 50% 0' : '60% 40%',
          backgroundColor: RIBBON_COLORS[Math.floor(Math.random() * RIBBON_COLORS.length)],
          transform: isHeart ? 'rotate(-45deg)' : undefined,
          opacity: 0,
          animation: `esl-petal-float ${duration}s ease-out forwards`,
          animationDelay: `${delay}s`,
          '--petal-rise': `${rise}vh`,
          '--petal-sway': `${sway}px`,
          '--petal-spin': `${120 + Math.random() * 280}deg`,
        } as CSSProperties}
      />,
    )
  }
  return particles
}

function buildParticles(style: StudentRewardStyle): ReactNode[] {
  switch (style) {
    case 'sticker':
      return buildStickerParticles()
    case 'billboard':
      return buildSpotlightParticles()
    case 'warm-card':
      return buildRibbonParticles()
  }
}

function FlashLayers({ style, phase }: { style: StudentRewardStyle; phase: 'in' | 'out' }) {
  if (style === 'sticker') {
    return (
      <>
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, rgba(255, 217, 61, 0.72) 0%, transparent 58%)',
            animation: 'esl-sticker-flash 0.95s ease-out forwards',
          }}
        />
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              'radial-gradient(circle at 48% 44%, rgba(255, 107, 107, 0.42) 0%, transparent 54%)',
            animation: 'esl-sticker-flash 1.05s ease-out forwards',
            animationDelay: '0.12s',
          }}
        />
      </>
    )
  }

  if (style === 'billboard') {
    return (
      <>
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            background: 'rgba(8, 10, 18, 0.55)',
            animation:
              phase === 'out'
                ? 'esl-spotlight-veil-out 0.5s ease-out forwards'
                : 'esl-spotlight-veil-in 1.2s ease-out forwards',
          }}
        />
        <div
          className="pointer-events-none fixed inset-0 origin-top"
          style={{
            background:
              'radial-gradient(ellipse 55% 70% at 50% 18%, rgba(255, 236, 160, 0.55) 0%, rgba(255, 220, 100, 0.18) 42%, transparent 70%)',
            animation:
              phase === 'out'
                ? 'esl-spotlight-cone-out 0.48s ease-out forwards'
                : 'esl-spotlight-cone-in 0.7s ease-out forwards',
          }}
        />
      </>
    )
  }

  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{
        background:
          'radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.42) 0%, rgba(59, 130, 246, 0.18) 45%, transparent 70%)',
        animation: 'esl-ribbon-wash 1.15s ease-out forwards',
      }}
    />
  )
}

function motionForStyle(style: StudentRewardStyle, phase: 'in' | 'out'): CSSProperties {
  if (style === 'sticker') {
    return {
      animation:
        phase === 'out'
          ? 'esl-sticker-peel-out 0.4s ease-in forwards'
          : 'esl-sticker-peel-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) forwards',
    }
  }
  if (style === 'billboard') {
    return {
      animation:
        phase === 'out'
          ? 'esl-spotlight-sink-out 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) forwards'
          : 'esl-spotlight-rise-in 0.48s cubic-bezier(0.22, 1, 0.36, 1) forwards',
    }
  }
  return {
    animation:
      phase === 'out'
        ? 'esl-ribbon-fold-out 0.42s ease-in forwards'
        : 'esl-ribbon-unfurl-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards',
  }
}

function StickerPhrase({ phrase, phase }: { phrase: string; phase: 'in' | 'out' }) {
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        maxWidth: 'min(92vw, 52rem)',
        padding: 'clamp(1.1rem, 2.8vw, 1.85rem) clamp(1.75rem, 5vw, 3.25rem)',
        borderRadius: '1.15rem',
        background: 'linear-gradient(135deg, #ff4d6d 0%, #ff8fab 38%, #ffd93d 100%)',
        border: '5px solid #fff',
        boxShadow:
          '0 0 0 4px rgba(255, 77, 109, 0.55), 0 14px 0 rgba(201, 24, 74, 0.55), 0 22px 40px rgba(0,0,0,0.28)',
        ...motionForStyle('sticker', phase),
      }}
    >
      <p
        style={{
          margin: 0,
          textAlign: 'center',
          textWrap: 'balance' as CSSProperties['textWrap'],
          fontFamily: "'Happy Friday', cursive",
          fontWeight: 400,
          letterSpacing: '0.02em',
          fontSize: 'clamp(3rem, 11vw, 6.25rem)',
          lineHeight: 1.05,
          color: '#fff',
          textShadow: '0 3px 0 rgba(140, 20, 55, 0.45), 0 8px 18px rgba(0,0,0,0.25)',
        }}
      >
        {phrase}
      </p>
    </div>
  )
}

function SpotlightPhrase({ phrase, phase }: { phrase: string; phase: 'in' | 'out' }) {
  return (
    <p
      style={{
        position: 'relative',
        zIndex: 2,
        margin: 0,
        maxWidth: 'min(96vw, 58rem)',
        padding: '0 1rem',
        textAlign: 'center',
        textWrap: 'balance' as CSSProperties['textWrap'],
        fontFamily: 'var(--font-nunito), system-ui, sans-serif',
        fontWeight: 800,
        letterSpacing: '-0.02em',
        fontSize: 'clamp(3.5rem, 12vw, 7.25rem)',
        lineHeight: 0.98,
        color: '#fff8e7',
        WebkitTextStroke: '0.04em rgba(40, 30, 10, 0.35)',
        paintOrder: 'stroke fill',
        textShadow:
          '0 0 40px rgba(255, 230, 140, 0.85), 0 0 18px rgba(255, 255, 255, 0.55), 0 6px 0 rgba(80, 55, 10, 0.35)',
        ...motionForStyle('billboard', phase),
      }}
    >
      {phrase}
    </p>
  )
}

function RibbonPhrase({ phrase, phase }: { phrase: string; phase: 'in' | 'out' }) {
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        width: 'min(96vw, 56rem)',
        padding: 'clamp(1rem, 2.4vw, 1.6rem) clamp(1.5rem, 5vw, 3.25rem)',
        background: 'linear-gradient(90deg, #2563eb 0%, #3b82f6 28%, #f59e0b 72%, #fbbf24 100%)',
        borderTop: '4px solid rgba(255,255,255,0.85)',
        borderBottom: '4px solid rgba(255,255,255,0.85)',
        boxShadow:
          '0 10px 0 rgba(30, 64, 175, 0.35), 0 18px 40px rgba(0,0,0,0.28), inset 0 2px 0 rgba(255,255,255,0.35)',
        ...motionForStyle('warm-card', phase),
      }}
    >
      {/* Ribbon notches */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          width: 0,
          height: 0,
          transform: 'translate(-100%, -50%)',
          borderTop: '28px solid transparent',
          borderBottom: '28px solid transparent',
          borderRight: '22px solid #2563eb',
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: 0,
          top: '50%',
          width: 0,
          height: 0,
          transform: 'translate(100%, -50%)',
          borderTop: '28px solid transparent',
          borderBottom: '28px solid transparent',
          borderLeft: '22px solid #fbbf24',
        }}
      />
      <p
        style={{
          margin: 0,
          textAlign: 'center',
          textWrap: 'balance' as CSSProperties['textWrap'],
          fontFamily: "'Cre ChocoCookie Medium', cursive",
          fontWeight: 500,
          letterSpacing: '0.01em',
          fontSize: 'clamp(2.85rem, 10vw, 5.75rem)',
          lineHeight: 1.08,
          color: '#fff',
          textShadow: '0 3px 0 rgba(30, 64, 175, 0.45), 0 8px 18px rgba(0,0,0,0.25)',
        }}
      >
        {phrase}
      </p>
    </div>
  )
}

export function StudentRewardBurst({
  phrase,
  phase,
  style = DEFAULT_STUDENT_REWARD_STYLE,
  portalToBody = true,
  zIndex = 500,
}: {
  phrase: string
  phase: 'in' | 'out'
  style?: StudentRewardStyle
  /** When false, render in place (settings preview under the options card). */
  portalToBody?: boolean
  zIndex?: number
}) {
  const reducedMotion = usePrefersReducedMotion()
  const particles = useMemo(
    () => (reducedMotion ? [] : buildParticles(style)),
    [reducedMotion, style],
  )

  // Client-only mount (G / preview); inject styles sync so the first paint is not skipped.
  ensureRewardKeyframes()

  let body: ReactNode
  if (style === 'billboard') {
    body = <SpotlightPhrase phrase={phrase} phase={phase} />
  } else if (style === 'sticker') {
    body = <StickerPhrase phrase={phrase} phase={phase} />
  } else {
    body = <RibbonPhrase phrase={phrase} phase={phase} />
  }

  const node = (
    <div
      className="pointer-events-none fixed inset-0 flex items-center justify-center"
      style={{ zIndex }}
      aria-live="polite"
      role="status"
      data-reward-style={style}
    >
      {!reducedMotion ? (
        <>
          <FlashLayers style={style} phase={phase} />
          <div className="absolute inset-0 overflow-hidden">{particles}</div>
        </>
      ) : null}
      {body}
    </div>
  )

  if (!portalToBody) {
    return (
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-live="polite"
        role="status"
        data-reward-style={style}
      >
        {!reducedMotion ? (
          <>
            <FlashLayers style={style} phase={phase} />
            <div className="absolute inset-0 overflow-hidden">{particles}</div>
          </>
        ) : null}
        {body}
      </div>
    )
  }

  return createPortal(node, document.body)
}
