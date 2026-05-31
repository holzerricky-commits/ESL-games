'use client'

import { useMemo, useSyncExternalStore } from 'react'
import {
  getPenSwatch,
  type PenSwatch,
} from '@/lib/books/annotation-palettes'
import type { AnnotationColorSource } from '@/lib/books/annotation-custom-color'
import {
  getStripRecentsSyncSnapshot,
  stripRecentsForDisplay,
  subscribeStripRecents,
  type StripRecentKind,
} from '@/lib/books/annotation-strip-recents'
import { penSwatchPreviewStyle } from '@/lib/books/pen-ink'
import {
  TopStripPaletteDropdown,
  type TopStripPaletteDropdownProps,
} from '@/components/students/annotation-top-strip-palette-dropdown'
import { cn } from '@/lib/utils'
import {
  filterPenSwatchesForProfile,
  type PenStrokeProfile,
} from '@/lib/books/pen-stroke-profile'

const compactSwatchClass =
  'h-6 w-6 shrink-0 rounded-full border-2 border-black/25 transition-transform hover:scale-105'

const activeSwatchClass =
  'h-7 w-7 shrink-0 rounded-full border-2 border-black/25 ring-2 ring-amber-400/70 transition-transform'

export type TopStripPaletteTarget = 'pen' | 'marker' | 'shapes' | 'text' | 'sticky' | 'stamp' | 'shape-fill'

export interface TopStripColorClusterProps {
  kind: StripRecentKind
  idPrefix: string
  /** Pen / shape stroke swatch id, or marker hex. */
  activeValue: string
  penStrokeProfile?: PenStrokeProfile
  colorSource?: AnnotationColorSource
  customHex?: string
  onPick: (value: string) => void
  paletteTarget: TopStripPaletteTarget
  paletteDropdown: Omit<TopStripPaletteDropdownProps, 'target' | 'idPrefix' | 'open' | 'onOpenChange'>
  paletteOpen: boolean
  onPaletteOpenChange: (open: boolean) => void
}

function PenInkChip({
  swatch,
  active,
  size,
  onClick,
  id,
  label,
}: {
  swatch: PenSwatch
  active: boolean
  size: 'active' | 'compact'
  onClick: () => void
  id: string
  label: string
}) {
  return (
    <button
      type="button"
      id={id}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(size === 'active' ? activeSwatchClass : compactSwatchClass, active && size === 'compact' && 'scale-110 ring-2 ring-amber-400/70 border-transparent')}
      style={penSwatchPreviewStyle(swatch.patternId, swatch.color)}
    />
  )
}

function MarkerHexChip({
  hex,
  active,
  size,
  onClick,
  id,
}: {
  hex: string
  active: boolean
  size: 'active' | 'compact'
  onClick: () => void
  id: string
}) {
  return (
    <button
      type="button"
      id={id}
      aria-label={`Color ${hex}`}
      aria-pressed={active}
      onClick={onClick}
      className={cn(size === 'active' ? activeSwatchClass : compactSwatchClass, active && size === 'compact' && 'scale-110 ring-2 ring-amber-400/70 border-transparent')}
      style={{ backgroundColor: hex }}
    />
  )
}

export function TopStripColorCluster({
  kind,
  idPrefix,
  activeValue,
  penStrokeProfile,
  colorSource = 'swatch',
  customHex,
  onPick,
  paletteTarget,
  paletteDropdown,
  paletteOpen,
  onPaletteOpenChange,
}: TopStripColorClusterProps) {
  const recentsRevision = useSyncExternalStore(
    subscribeStripRecents,
    () => getStripRecentsSyncSnapshot(kind),
    () => `default:${kind}`,
  )
  const recents = useMemo(() => {
    const ids = stripRecentsForDisplay(kind, activeValue)
    if (kind !== 'pen' || !penStrokeProfile) return ids
    const allowed = new Set(filterPenSwatchesForProfile(penStrokeProfile).map((s) => s.id))
    return ids.filter((id) => allowed.has(id))
  }, [kind, activeValue, penStrokeProfile, recentsRevision])

  const isHexKind = kind === 'marker' || kind === 'text' || kind === 'sticky'
  const isCustom = colorSource === 'custom' && customHex
  const openPalette = () => onPaletteOpenChange(true)

  return (
    <div className="flex shrink-0 items-center gap-2">
      {isHexKind ? (
        isCustom ? (
          <MarkerHexChip
            hex={customHex}
            active
            size="active"
            id={`${idPrefix}-active`}
            onClick={openPalette}
          />
        ) : (
          <MarkerHexChip
            hex={activeValue}
            active
            size="active"
            id={`${idPrefix}-active`}
            onClick={openPalette}
          />
        )
      ) : isCustom && customHex ? (
        <button
          type="button"
          id={`${idPrefix}-active`}
          aria-label={`Custom color ${customHex}`}
          aria-pressed
          onClick={openPalette}
          className={cn(activeSwatchClass, 'border-dashed border-white/35')}
          style={{ backgroundColor: customHex }}
        />
      ) : (
        <PenInkChip
          swatch={getPenSwatch(activeValue)}
          active
          size="active"
          id={`${idPrefix}-active`}
          label={getPenSwatch(activeValue).label}
          onClick={openPalette}
        />
      )}

      <div className="flex items-center gap-1.5" role="group" aria-label="Recent colors">
        {recents.map((value, i) =>
          isHexKind ? (
            <MarkerHexChip
              key={value}
              hex={value}
              active={false}
              size="compact"
              id={`${idPrefix}-recent-${i}`}
              onClick={() => onPick(value)}
            />
          ) : (
            <PenInkChip
              key={value}
              swatch={getPenSwatch(value)}
              active={false}
              size="compact"
              id={`${idPrefix}-recent-${i}`}
              label={getPenSwatch(value).label}
              onClick={() => onPick(value)}
            />
          ),
        )}
      </div>

      <TopStripPaletteDropdown
        target={paletteTarget}
        idPrefix={idPrefix}
        open={paletteOpen}
        onOpenChange={onPaletteOpenChange}
        {...paletteDropdown}
      />
    </div>
  )
}
