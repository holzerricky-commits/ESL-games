'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clamp01, hexToHsl, hslToHex, type Hsl } from '@/lib/books/hsl-color'

const sectionLabelClass =
  'text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#c4b5a8]/85'

const spectrumFieldBackground =
  'linear-gradient(to bottom, #fff 0%, rgba(255,255,255,0) 50%, #000 100%), linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)'

function hslFromSpectrumPointer(clientX: number, clientY: number, rect: DOMRect): Hsl {
  const x = clamp01((clientX - rect.left) / rect.width)
  const y = clamp01((clientY - rect.top) / rect.height)
  return { h: x * 360, s: 1, l: 1 - y }
}

/** Compact full-spectrum picker with hex readout. */
export function SpectrumColorPicker({
  customHex,
  onPickCustom,
  label = 'Custom color',
}: {
  customHex: string
  onPickCustom: (hex: string) => void
  label?: string
}) {
  const spectrumRef = useRef<HTMLDivElement>(null)
  const [hsl, setHsl] = useState<Hsl>(() => hexToHsl(customHex) ?? { h: 220, s: 1, l: 0.45 })

  useEffect(() => {
    const parsed = hexToHsl(customHex)
    if (parsed) setHsl(parsed)
  }, [customHex])

  const commitHsl = useCallback(
    (next: Hsl) => {
      setHsl(next)
      onPickCustom(hslToHex(next))
    },
    [onPickCustom],
  )

  function bindSpectrumPointer(clientX: number, clientY: number) {
    const el = spectrumRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    commitHsl(hslFromSpectrumPointer(clientX, clientY, rect))
  }

  const displayHex = hslToHex(hsl)
  const spectrumMarkerLeft = `${(((hsl.h % 360) + 360) % 360) / 360 * 100}%`
  const spectrumMarkerTop = `${(1 - hsl.l) * 100}%`

  return (
    <div className="space-y-2">
      <p className={sectionLabelClass}>{label}</p>
      <p className="font-mono text-[0.7rem] text-[#c4b5a8]">{displayHex}</p>

      <div
        ref={spectrumRef}
        role="slider"
        aria-label="Color spectrum"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={displayHex}
        tabIndex={0}
        className="relative h-[7.5rem] w-full cursor-crosshair touch-none overflow-hidden rounded-md border border-white/14"
        style={{ background: spectrumFieldBackground }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          bindSpectrumPointer(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
          bindSpectrumPointer(e.clientX, e.clientY)
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
        }}
      >
        <span
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/40"
          style={{ left: spectrumMarkerLeft, top: spectrumMarkerTop, backgroundColor: displayHex }}
          aria-hidden
        />
      </div>
    </div>
  )
}
