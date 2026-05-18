'use client'

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { Loader2, Plus } from 'lucide-react'
import type { AnnotationColorSource } from '@/lib/books/annotation-custom-color'
import { parseCustomHexInput } from '@/lib/books/annotation-custom-color'
import { ANNOTATION_PEN_SWATCHES } from '@/lib/books/annotation-palettes'
import { isAssetBrushPattern } from '@/lib/books/brush-pattern-manifest'
import { isBrushPatternTileReady } from '@/lib/books/brush-pattern-loader'
import { penSwatchPreviewStyle } from '@/lib/books/pen-ink'
import { useBrushPatternPreload } from '@/lib/books/use-brush-pattern-preload'
import { cn } from '@/lib/utils'

const sectionLabelClass =
  'text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#c4b5a8]/85'

function swatchButtonClass(active: boolean) {
  return cn(
    'h-8 w-8 shrink-0 rounded-full border-2 transition-transform',
    active ? 'scale-110 border-transparent ring-2 ring-amber-400/70' : 'border-black/25 hover:scale-105',
  )
}

/** Spectrum picker chip when no custom color is active — vivid rainbow wheel. */
const customPickerSwatchStyle: CSSProperties = {
  backgroundColor: '#ef4444',
  backgroundImage: [
    'radial-gradient(circle at 30% 22%, rgba(255,255,255,0.45) 0%, transparent 48%)',
    'conic-gradient(from 200deg, #ef4444, #f97316, #facc15, #22c55e, #06b6d4, #3b82f6, #a855f7, #ec4899, #ef4444)',
  ].join(', '),
}

function SwatchSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className={sectionLabelClass}>{label}</p>
      {children}
    </div>
  )
}

function SwatchList({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function CustomColorPickerSwatch({
  active,
  open,
  customHex,
  onClick,
  idPrefix,
}: {
  active: boolean
  open: boolean
  customHex: string
  onClick: () => void
  idPrefix: string
}) {
  return (
    <button
      type="button"
      id={`${idPrefix}-custom-picker-swatch`}
      aria-label={active ? `Custom color ${customHex}` : 'Open custom color picker'}
      aria-pressed={active}
      aria-expanded={open}
      onClick={onClick}
      className={cn(
        'relative h-8 w-8 shrink-0 overflow-hidden rounded-full p-0 transition-transform',
        active
          ? 'scale-110 ring-2 ring-amber-400/70'
          : 'hover:scale-105 ring-1 ring-white/20',
      )}
    >
      {/* Oversized layer: conic gradients are square; bleed past clip to avoid flat edges */}
      <span
        className={cn('pointer-events-none absolute rounded-full', active ? 'inset-0' : '-inset-[22%]')}
        style={active ? { backgroundColor: customHex } : customPickerSwatchStyle}
        aria-hidden
      />
      <span
        className={cn(
          'pointer-events-none absolute inset-0 flex items-center justify-center',
          active && 'bg-black/15',
        )}
        aria-hidden
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white shadow-md ring-1 ring-white/60">
          <Plus className="h-3 w-3" strokeWidth={2.5} />
        </span>
      </span>
    </button>
  )
}

/** Round color chips (highlighter / text / sticky / shape fill). */
export function ColorSwatchRow({
  colors,
  current,
  onPick,
  idPrefix,
  label = 'Color',
  colorSource = 'swatch',
}: {
  colors: readonly string[]
  current: string
  onPick: (hex: string) => void
  idPrefix: string
  label?: string
  /** When `custom`, preset chips are not shown as selected. */
  colorSource?: AnnotationColorSource
}) {
  return (
    <SwatchSection label={label}>
      <SwatchList>
        {colors.map((hex, i) => {
          const active = colorSource === 'swatch' && current.toLowerCase() === hex.toLowerCase()
          return (
            <button
              key={hex}
              type="button"
              id={`${idPrefix}-swatch-${i}`}
              aria-label={`Color ${hex}`}
              aria-pressed={active}
              onClick={() => onPick(hex)}
              className={swatchButtonClass(active)}
              style={{ backgroundColor: hex }}
            />
          )
        })}
      </SwatchList>
    </SwatchSection>
  )
}

/** Custom solid color — chip, native picker, and hex field (pen / highlighter). */
export function CustomColorRow({
  colorSource,
  customHex,
  onPickCustom,
  idPrefix,
  label = 'Custom color',
}: {
  colorSource: AnnotationColorSource
  customHex: string
  onPickCustom: (hex: string) => void
  idPrefix: string
  label?: string
}) {
  const nativeInputId = useId()
  const [hexDraft, setHexDraft] = useState(customHex)
  const active = colorSource === 'custom'

  useEffect(() => {
    setHexDraft(customHex)
  }, [customHex])

  function commitHexDraft() {
    const parsed = parseCustomHexInput(hexDraft)
    if (parsed) onPickCustom(parsed)
    else setHexDraft(customHex)
  }

  return (
    <SwatchSection label={label}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          id={`${idPrefix}-custom-swatch`}
          aria-label="Custom color"
          aria-pressed={active}
          onClick={() => onPickCustom(customHex)}
          className={cn(
            swatchButtonClass(active),
            !active && 'border-dashed border-white/35',
          )}
          style={{ backgroundColor: customHex }}
        />
        <label
          htmlFor={nativeInputId}
          className="cursor-pointer rounded-md border border-white/14 bg-black/35 px-2 py-1 text-[0.7rem] font-medium text-[#f0ebe3] hover:bg-black/50"
        >
          Pick…
        </label>
        <input
          id={nativeInputId}
          type="color"
          className="sr-only"
          value={customHex}
          onChange={(e) => onPickCustom(e.target.value)}
        />
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          aria-label="Custom color hex"
          className="h-8 w-[5.5rem] rounded-md border border-white/14 bg-black/35 px-2 font-mono text-[0.7rem] text-[#faf6ef] outline-none focus-visible:ring-2 focus-visible:ring-amber-400/55"
          value={hexDraft}
          onChange={(e) => setHexDraft(e.target.value)}
          onFocus={() => setHexDraft(customHex)}
          onBlur={commitHexDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitHexDraft()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
      </div>
    </SwatchSection>
  )
}

/** Pen / shape stroke swatches — same round chip layout, with effect-ink previews. */
export function PenSwatchRow({
  swatchId,
  onPick,
  idPrefix,
  label = 'Color',
  preloadEnabled = true,
  colorSource = 'swatch',
  customHex,
  customPickerOpen = false,
  onOpenCustomPicker,
}: {
  swatchId: string
  onPick: (id: string) => void
  idPrefix: string
  label?: string
  preloadEnabled?: boolean
  colorSource?: AnnotationColorSource
  customHex?: string
  customPickerOpen?: boolean
  onOpenCustomPicker?: () => void
}) {
  const { manifestTilesLoading } = useBrushPatternPreload(preloadEnabled)

  const activeSwatch = ANNOTATION_PEN_SWATCHES.find((s) => s.id === swatchId)
  const activePatternId = activeSwatch?.patternId
  const activeAssetLoading =
    manifestTilesLoading ||
    (activePatternId != null &&
      activePatternId !== 'solid' &&
      isAssetBrushPattern(activePatternId) &&
      !isBrushPatternTileReady(activePatternId))

  return (
    <SwatchSection label={label}>
      {manifestTilesLoading ? (
        <p className="flex items-center gap-1.5 text-[0.65rem] text-[#c4b5a8]/90" aria-live="polite">
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
          Loading brush textures…
        </p>
      ) : null}
      <SwatchList>
        {ANNOTATION_PEN_SWATCHES.map((swatch, i) => {
          const active = colorSource === 'swatch' && swatchId === swatch.id
          return (
            <button
              key={swatch.id}
              type="button"
              id={`${idPrefix}-swatch-${i}`}
              aria-label={swatch.label}
              aria-pressed={active}
              onClick={() => onPick(swatch.id)}
              className={swatchButtonClass(active)}
              style={penSwatchPreviewStyle(swatch.patternId, swatch.color)}
            />
          )
        })}
        {onOpenCustomPicker && customHex ? (
          <CustomColorPickerSwatch
            active={colorSource === 'custom'}
            open={customPickerOpen}
            customHex={customHex}
            onClick={onOpenCustomPicker}
            idPrefix={idPrefix}
          />
        ) : null}
      </SwatchList>
      {activeAssetLoading && !manifestTilesLoading ? (
        <p className="flex items-center gap-1.5 text-[0.65rem] text-amber-200/90" aria-live="polite">
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
          Preparing selected brush…
        </p>
      ) : null}
    </SwatchSection>
  )
}
