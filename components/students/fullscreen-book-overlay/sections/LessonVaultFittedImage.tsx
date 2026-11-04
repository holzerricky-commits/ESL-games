'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** A CSS colour for pictures with a plain border, `'blur'` for busy photos. */
type PictureFill = string | 'blur'

/**
 * How a picture sits on a paper card: `cutout` (transparent edges), `white` (plain white border,
 * multiplied into the paper so the white disappears), `photo` (fills the area), `unknown` (pixels unreadable).
 */
type PaperKind = 'cutout' | 'white' | 'photo' | 'unknown'

const WHITE = '#ffffff'
const SAMPLE = 32
const fillCache = new Map<string, PictureFill>()
const paperKindCache = new Map<string, PaperKind>()

type EdgeSample = { transparent: true } | { transparent: false; r: number; g: number; b: number; spread: number }

/** Edge pixels of the picture, or null when they can't be read (pictures from other sites). */
function sampleEdges(img: HTMLImageElement): EdgeSample | null {
  if (!img.naturalWidth || !img.naturalHeight) return null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE
    canvas.height = SAMPLE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE)
    const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data

    const border: number[] = []
    for (let i = 0; i < SAMPLE; i++) {
      border.push(i, (SAMPLE - 1) * SAMPLE + i)
      if (i > 0 && i < SAMPLE - 1) border.push(i * SAMPLE, i * SAMPLE + SAMPLE - 1)
    }

    let r = 0
    let g = 0
    let b = 0
    for (const p of border) {
      if (data[p * 4 + 3]! < 200) return { transparent: true }
      r += data[p * 4]!
      g += data[p * 4 + 1]!
      b += data[p * 4 + 2]!
    }
    r /= border.length
    g /= border.length
    b /= border.length

    let spread = 0
    for (const p of border) {
      spread += Math.abs(data[p * 4]! - r) + Math.abs(data[p * 4 + 1]! - g) + Math.abs(data[p * 4 + 2]! - b)
    }
    spread /= border.length * 3
    return { transparent: false, r, g, b, spread }
  } catch {
    return null
  }
}

/**
 * Transparent or unreadable pictures get white, a near-uniform border gets its own colour,
 * anything else gets the blurred backdrop.
 */
function measureFill(img: HTMLImageElement): PictureFill {
  const edges = sampleEdges(img)
  if (!edges || edges.transparent) return WHITE
  if (edges.spread > 14) return 'blur'
  return `rgb(${Math.round(edges.r)}, ${Math.round(edges.g)}, ${Math.round(edges.b)})`
}

function measurePaperKind(img: HTMLImageElement): PaperKind {
  const edges = sampleEdges(img)
  if (!edges) return 'unknown'
  if (edges.transparent) return 'cutout'
  return edges.spread <= 8 && Math.min(edges.r, edges.g, edges.b) >= 240 ? 'white' : 'photo'
}

const PAPER_IMG: Record<PaperKind, string> = {
  cutout: 'object-contain',
  white: 'object-contain mix-blend-multiply',
  unknown: 'object-contain mix-blend-multiply',
  /** Photos sit on the ivory card with no framed panel. */
  photo: 'object-contain',
}

/**
 * Whole picture, never cropped, on a background that matches the picture's own edges.
 * `plain` drops the background so the picture sits straight on a white paper card.
 */
export function LessonVaultFittedImage({
  src,
  alt,
  className,
  plain = false,
  backdrop,
  onError,
}: {
  src: string
  alt: string
  className?: string
  plain?: boolean
  /** With `plain`: drawn behind pictures that are not photos. */
  backdrop?: ReactNode
  onError?: () => void
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [measured, setMeasured] = useState<{ src: string; fill: PictureFill } | null>(null)
  const [measuredKind, setMeasuredKind] = useState<{ src: string; kind: PaperKind } | null>(null)
  const fill = fillCache.get(src) ?? (measured?.src === src ? measured.fill : undefined)
  const paperKind = paperKindCache.get(src) ?? (measuredKind?.src === src ? measuredKind.kind : undefined)

  const measure = (img: HTMLImageElement) => {
    if (plain) {
      if (paperKindCache.has(src)) return
      const kind = measurePaperKind(img)
      paperKindCache.set(src, kind)
      setMeasuredKind({ src, kind })
      return
    }
    if (fillCache.has(src)) return
    const next = measureFill(img)
    fillCache.set(src, next)
    setMeasured({ src, fill: next })
  }

  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth) measure(img)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-check when the picture changes
  }, [src, plain])

  if (plain) {
    const kind = paperKind ?? 'unknown'
    return (
      <span className={cn('relative flex items-center justify-center', className)}>
        {kind !== 'photo' ? backdrop : null}
        {/* eslint-disable-next-line @next/next/no-img-element -- remote search results and local vault files */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          draggable={false}
          className={cn('relative z-10 h-full w-full', PAPER_IMG[kind])}
          onLoad={(e) => measure(e.currentTarget)}
          onError={onError}
        />
      </span>
    )
  }

  return (
    <span
      className={cn('relative block overflow-hidden', fill === undefined && 'bg-white/5', className)}
      style={fill && fill !== 'blur' ? { backgroundColor: fill } : undefined}
    >
      {fill === 'blur' ? (
        // eslint-disable-next-line @next/next/no-img-element -- blurred fill behind a busy photo
        <img
          src={src}
          alt=""
          aria-hidden
          referrerPolicy="no-referrer"
          draggable={false}
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl"
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- remote search results and local vault files */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        draggable={false}
        className="relative h-full w-full object-contain"
        onLoad={(e) => measure(e.currentTarget)}
        onError={onError}
      />
    </span>
  )
}
