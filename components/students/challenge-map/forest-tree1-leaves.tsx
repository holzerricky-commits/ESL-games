'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

/**
 * Full-canvas PNGs (same pixel size as `Forest Biome BG.png`).
 * Must animate inside a tile box with the same aspect ratio as the art, or % pivots
 * do not match pixels and the whole leaf appears to slide.
 */
const TREE_1_ART_W = 2496
const TREE_1_ART_H = 3744

const TREE_1_LEAF_FILES = [
  'Forest-Biome_upscayl_3x_digital-art-4x-Recovered_0000_Layer-2.png',
  'Forest-Biome_upscayl_3x_digital-art-4x-Recovered_0001_Layer-3.png',
  'Forest-Biome_upscayl_3x_digital-art-4x-Recovered_0002_Layer-4.png',
  'Forest-Biome_upscayl_3x_digital-art-4x-Recovered_0003_Layer-5.png',
  'Forest-Biome_upscayl_3x_digital-art-4x-Recovered_0004_Layer-6.png',
  'Forest-Biome_upscayl_3x_digital-art-4x-Recovered_0005_Layer-7.png',
] as const

const TREE_1_BASE = '/Biomes/Forest/Tree%201'

/** Palm crown / trunk join in **image** coordinates (% of artboard width/height). Tune to match your PSD. */
const TREE_1_STEM_ORIGIN = { xPct: 17, yPct: 10.5 }

const TREE_1_WIND_PERIOD_S = 5.2

function leafSwayConfig(index: number, total: number): { deg: number; dur: number; delay: number } {
  const baseDeg = 0.38
  const wobble = (index % 3) * 0.04
  return {
    deg: baseDeg + wobble,
    dur: TREE_1_WIND_PERIOD_S,
    delay: (-TREE_1_WIND_PERIOD_S * index) / total,
  }
}

export type ForestTree1Layout = 'tiled' | 'cover'

function leafUrl(filename: (typeof TREE_1_LEAF_FILES)[number]) {
  return `${TREE_1_BASE}/${encodeURIComponent(filename)}`
}

interface ForestTree1LeavesProps {
  layout: ForestTree1Layout
}

function stemPivotStyle(): Pick<CSSProperties, 'transformOrigin'> {
  return {
    transformOrigin: `${TREE_1_STEM_ORIGIN.xPct}% ${TREE_1_STEM_ORIGIN.yPct}%`,
  }
}

interface LeafStackProps {
  layout: ForestTree1Layout
  /** Prefix React keys when the stack is repeated per vertical tile */
  keyPrefix?: string
}

function Tree1LeafStack({ layout, keyPrefix = '' }: LeafStackProps) {
  const tiledBg = {
    backgroundSize: '100% auto' as const,
    backgroundPosition: 'top center' as const,
    backgroundRepeat: 'no-repeat' as const,
  }
  const coverBg = {
    backgroundSize: 'cover' as const,
    backgroundPosition: 'center' as const,
    backgroundRepeat: 'no-repeat' as const,
  }
  const bg = layout === 'tiled' ? tiledBg : coverBg

  const pivot = stemPivotStyle()
  const n = TREE_1_LEAF_FILES.length

  return (
    <>
      {TREE_1_LEAF_FILES.map((file, i) => {
        const s = leafSwayConfig(i, n)
        const layerStyle = {
          ...bg,
          backgroundImage: `url("${leafUrl(file)}")`,
          ...pivot,
          ['--tree1-deg' as string]: `${s.deg}deg`,
          ['--tree1-dur' as string]: `${s.dur}s`,
          ['--tree1-delay' as string]: `${s.delay}s`,
        } as CSSProperties

        return (
          <div
            key={keyPrefix ? `${keyPrefix}-${file}` : file}
            className="tree1-leaf-layer absolute inset-0 [will-change:transform]"
            style={layerStyle}
          />
        )
      })}
    </>
  )
}

export function ForestTree1Leaves({ layout }: ForestTree1LeavesProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [{ w, h }, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const read = () => {
      const r = el.getBoundingClientRect()
      setSize({ w: r.width, h: r.height })
    }
    read()

    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (w < 1 || h < 1) {
    return <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[2]" aria-hidden />
  }

  const tileH = w * (TREE_1_ART_H / TREE_1_ART_W)

  if (layout === 'tiled') {
    const nTiles = Math.max(1, Math.ceil(h / tileH))
    return (
      <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[2]" aria-hidden>
        {Array.from({ length: nTiles }, (_, row) => (
          <div
            key={row}
            className="absolute left-0 right-0 overflow-hidden"
            style={{ top: row * tileH, height: tileH }}
          >
            <Tree1LeafStack layout="tiled" keyPrefix={`t${row}`} />
          </div>
        ))}
      </div>
    )
  }

  const scale = Math.max(w / TREE_1_ART_W, h / TREE_1_ART_H)
  const bw = TREE_1_ART_W * scale
  const bh = TREE_1_ART_H * scale
  const left = (w - bw) / 2
  const top = (h - bh) / 2

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[2]" aria-hidden>
      <div className="absolute overflow-hidden" style={{ left, top, width: bw, height: bh }}>
        <Tree1LeafStack layout="cover" />
      </div>
    </div>
  )
}
