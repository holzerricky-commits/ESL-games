'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  ANNOTATION_MARKER_SWATCHES,
  ANNOTATION_STICKY_FILL_SWATCHES,
  ANNOTATION_TEXT_FILL_SWATCHES,
  ANNOTATION_TEXT_STROKE_SWATCHES,
} from '@/lib/books/annotation-palettes'
import type { AnnotationColorSource } from '@/lib/books/annotation-custom-color'
import { shapeFillModeHasFill } from '@/lib/books/annotation-command-types'
import type { ShapeFillMode } from '@/lib/books/annotation-command-types'
import { SpectrumColorPicker } from '@/components/students/annotation-spectrum-picker'
import { ColorSwatchRow, PenSwatchRow } from '@/components/students/annotation-swatch-picker'
import {
  TOP_STRIP_POPOVER_CLASS,
  TOP_STRIP_POPOVER_STACK,
} from '@/components/students/annotation-top-strip-controls'
import type { TopStripPaletteTarget } from '@/components/students/annotation-top-strip-color-cluster'
import type { PenSwatch } from '@/lib/books/annotation-palettes'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface TopStripPaletteDropdownProps {
  target: TopStripPaletteTarget
  idPrefix: string
  penSwatchId: string
  pickPenSwatch: (id: string) => void
  penSwatchesForProfile?: readonly PenSwatch[]
  penColorSource: AnnotationColorSource
  penCustomHex: string
  pickPenCustomColor: (hex: string) => void
  markerColor: string
  pickMarkerSwatchColor: (hex: string) => void
  markerColorSource: AnnotationColorSource
  markerCustomHex: string
  pickMarkerCustomColor: (hex: string) => void
  shapeStrokeSwatchId: string
  pickShapeStrokeSwatch: (id: string) => void
  textColor: string
  pickTextColor: (hex: string) => void
  textFillColor: string
  pickTextFillColor: (hex: string) => void
  textVisualStyle: 'plain' | 'filled'
  stickyFillColor: string
  pickStickyFillColor: (hex: string) => void
  shapeFillColor: string
  pickShapeFillColor?: (hex: string) => void
  shapeFillMode: ShapeFillMode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TopStripPaletteDropdown({
  target,
  idPrefix,
  penSwatchId,
  pickPenSwatch,
  penSwatchesForProfile,
  penColorSource,
  penCustomHex,
  pickPenCustomColor,
  markerColor,
  pickMarkerSwatchColor,
  markerColorSource,
  markerCustomHex,
  pickMarkerCustomColor,
  shapeStrokeSwatchId,
  pickShapeStrokeSwatch,
  textColor,
  pickTextColor,
  textFillColor,
  pickTextFillColor,
  textVisualStyle,
  stickyFillColor,
  pickStickyFillColor,
  shapeFillColor,
  pickShapeFillColor,
  shapeFillMode,
  open: openControlled,
  onOpenChange,
}: TopStripPaletteDropdownProps) {
  const [openUncontrolled, setOpenUncontrolled] = useState(false)
  const open = openControlled ?? openUncontrolled
  const [customSpectrumOpen, setCustomSpectrumOpen] = useState(false)

  function handleOpenChange(next: boolean) {
    if (openControlled === undefined) setOpenUncontrolled(next)
    if (!next) setCustomSpectrumOpen(false)
    onOpenChange?.(next)
  }

  function pickPenPresetSwatch(id: string) {
    pickPenSwatch(id)
    setCustomSpectrumOpen(false)
    handleOpenChange(false)
  }

  function openCustomSpectrum() {
    if (target === 'pen') pickPenCustomColor(penCustomHex)
    else if (target === 'marker') pickMarkerCustomColor(markerCustomHex)
    setCustomSpectrumOpen(true)
  }

  const chevronClass = cn(
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/55 hover:bg-white/10 hover:text-white/90',
    open && 'bg-white/10 text-white/90',
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={chevronClass}
          aria-label="More options"
          title="More options"
          aria-expanded={open}
        >
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className={TOP_STRIP_POPOVER_CLASS}>
        {target === 'pen' ? (
          <div className={TOP_STRIP_POPOVER_STACK}>
            <PenSwatchRow
              swatchId={penSwatchId}
              colorSource={penColorSource}
              customHex={penCustomHex}
              onPick={pickPenPresetSwatch}
              idPrefix={idPrefix}
              labelHidden
              swatchSize="compact"
              swatches={penSwatchesForProfile}
              customPickerOpen={customSpectrumOpen}
              onOpenCustomPicker={openCustomSpectrum}
            />
            {customSpectrumOpen ? (
              <SpectrumColorPicker customHex={penCustomHex} onPickCustom={pickPenCustomColor} variant="strip" />
            ) : null}
          </div>
        ) : null}
        {target === 'marker' ? (
          <HexPalettePanel
            idPrefix={idPrefix}
            colors={ANNOTATION_MARKER_SWATCHES}
            current={markerColor}
            colorSource={markerColorSource}
            customHex={markerCustomHex}
            customSpectrumOpen={customSpectrumOpen}
            onOpenCustomSpectrum={openCustomSpectrum}
            onPick={(hex) => {
              pickMarkerSwatchColor(hex)
              setCustomSpectrumOpen(false)
              handleOpenChange(false)
            }}
            onPickCustom={pickMarkerCustomColor}
            customLabel="Custom highlighter color"
          />
        ) : null}
        {target === 'shapes' || target === 'shape-fill' ? (
          <div className={TOP_STRIP_POPOVER_STACK}>
            <PenSwatchRow
              swatchId={shapeStrokeSwatchId}
              onPick={(id) => {
                pickShapeStrokeSwatch(id)
                handleOpenChange(false)
              }}
              idPrefix={`${idPrefix}-stroke`}
              label="Stroke color"
              swatchSize="compact"
            />
            {shapeFillModeHasFill(shapeFillMode) ? (
              <ColorSwatchRow
                colors={ANNOTATION_MARKER_SWATCHES}
                current={shapeFillColor}
                onPick={(hex) => {
                  pickShapeFillColor?.(hex)
                  handleOpenChange(false)
                }}
                idPrefix={`${idPrefix}-fill`}
                label="Fill color"
                swatchSize="compact"
              />
            ) : null}
          </div>
        ) : null}
        {target === 'text' ? (
          <div className={TOP_STRIP_POPOVER_STACK}>
            <ColorSwatchRow
              colors={ANNOTATION_TEXT_STROKE_SWATCHES}
              current={textColor}
              onPick={(hex) => {
                pickTextColor(hex)
                handleOpenChange(false)
              }}
              idPrefix={`${idPrefix}-text`}
              label="Text color"
              swatchSize="compact"
            />
            {textVisualStyle === 'filled' ? (
              <ColorSwatchRow
                colors={ANNOTATION_TEXT_FILL_SWATCHES}
                current={textFillColor}
                onPick={(hex) => {
                  pickTextFillColor(hex)
                  handleOpenChange(false)
                }}
                idPrefix={`${idPrefix}-text-fill`}
                label="Background color"
                swatchSize="compact"
              />
            ) : null}
          </div>
        ) : null}
        {target === 'sticky' ? (
          <div className={TOP_STRIP_POPOVER_STACK}>
            <ColorSwatchRow
              colors={ANNOTATION_STICKY_FILL_SWATCHES}
              current={stickyFillColor}
              onPick={(hex) => {
                pickStickyFillColor(hex)
                handleOpenChange(false)
              }}
              idPrefix={idPrefix}
              labelHidden
              swatchSize="compact"
            />
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function HexPalettePanel({
  idPrefix,
  colors,
  current,
  colorSource,
  customHex,
  customSpectrumOpen,
  onOpenCustomSpectrum,
  onPick,
  onPickCustom,
  customLabel,
}: {
  idPrefix: string
  colors: readonly string[]
  current: string
  colorSource: AnnotationColorSource
  customHex: string
  customSpectrumOpen: boolean
  onOpenCustomSpectrum: () => void
  onPick: (hex: string) => void
  onPickCustom: (hex: string) => void
  customLabel: string
}) {
  return (
    <div className={TOP_STRIP_POPOVER_STACK}>
      <div className="flex flex-wrap items-center gap-1.5">
        <ColorSwatchRow
          colors={colors}
          current={current}
          colorSource={colorSource}
          onPick={onPick}
          idPrefix={idPrefix}
          labelHidden
          swatchSize="compact"
        />
        <button
          type="button"
          aria-label={customLabel}
          aria-pressed={colorSource === 'custom'}
          onClick={onOpenCustomSpectrum}
          className={cn(
            'h-6 w-6 shrink-0 rounded-full border-2 transition-transform',
            colorSource === 'custom'
              ? 'scale-110 border-transparent ring-2 ring-amber-400/70'
              : 'border-dashed border-white/35 hover:scale-105',
          )}
          style={{
            backgroundColor: colorSource === 'custom' ? customHex : undefined,
            backgroundImage:
              colorSource === 'custom'
                ? undefined
                : 'conic-gradient(from 200deg, #ef4444, #f97316, #facc15, #22c55e, #06b6d4, #3b82f6, #a855f7, #ec4899, #ef4444)',
          }}
        />
      </div>
      {customSpectrumOpen ? (
        <SpectrumColorPicker customHex={customHex} onPickCustom={onPickCustom} variant="strip" />
      ) : null}
    </div>
  )
}
