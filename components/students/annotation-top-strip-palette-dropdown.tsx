'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  ANNOTATION_MARKER_SWATCHES,
  ANNOTATION_SHAPE_FILL_SWATCHES,
  ANNOTATION_SOLID_PEN_SWATCHES,
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
import {
  CONTEXT_PALETTE_CHEVRON_CLASS,
  CONTEXT_PALETTE_CHEVRON_OPEN_CLASS,
} from '@/components/students/selection-context-bar/selection-context-bar-styles'

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

type PaletteSurface = 'dark'

export function PaletteChevronButton({
  open,
  className,
  onClick,
}: {
  open: boolean
  className?: string
  onClick?: () => void
}) {
  const chevronClass = cn(
    CONTEXT_PALETTE_CHEVRON_CLASS,
    open && CONTEXT_PALETTE_CHEVRON_OPEN_CLASS,
    className,
  )

  return (
    <button
      type="button"
      className={chevronClass}
      aria-label="More colors"
      title="More colors"
      aria-expanded={open}
      onClick={onClick}
    >
      <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
    </button>
  )
}

export function TopStripPalettePanel({
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
  onClose,
}: Omit<TopStripPaletteDropdownProps, 'open' | 'onOpenChange'> & {
  onClose?: () => void
}) {
  const [customSpectrumOpen, setCustomSpectrumOpen] = useState(false)
  const stackClass = TOP_STRIP_POPOVER_STACK
  const swatchSurface: PaletteSurface = 'dark'

  function closePanel() {
    setCustomSpectrumOpen(false)
    onClose?.()
  }

  function pickPenPresetSwatch(id: string) {
    pickPenSwatch(id)
    closePanel()
  }

  function openCustomSpectrum() {
    if (target === 'pen') pickPenCustomColor(penCustomHex)
    else if (target === 'marker') pickMarkerCustomColor(markerCustomHex)
    setCustomSpectrumOpen(true)
  }

  return (
    <>
      {target === 'pen' ? (
        <div className={stackClass}>
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
            surface={swatchSurface}
          />
          {customSpectrumOpen ? (
            <SpectrumColorPicker
              customHex={penCustomHex}
              onPickCustom={pickPenCustomColor}
              variant="strip"
              surface={swatchSurface}
            />
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
            closePanel()
          }}
          onPickCustom={pickMarkerCustomColor}
          customLabel="Custom highlighter color"
          surface={swatchSurface}
          stackClass={stackClass}
        />
      ) : null}
      {target === 'shapes' || target === 'shape-fill' ? (
        <div className={stackClass}>
          <PenSwatchRow
            swatchId={shapeStrokeSwatchId}
            onPick={(id) => {
              pickShapeStrokeSwatch(id)
              closePanel()
            }}
            idPrefix={`${idPrefix}-stroke`}
            label="Stroke color"
            swatchSize="compact"
            surface={swatchSurface}
            swatches={ANNOTATION_SOLID_PEN_SWATCHES}
          />
          {shapeFillModeHasFill(shapeFillMode) ? (
            <ColorSwatchRow
              colors={ANNOTATION_SHAPE_FILL_SWATCHES}
              current={shapeFillColor}
              onPick={(hex) => {
                pickShapeFillColor?.(hex)
                closePanel()
              }}
              idPrefix={`${idPrefix}-fill`}
              label="Fill color"
              swatchSize="compact"
              surface={swatchSurface}
            />
          ) : null}
        </div>
      ) : null}
      {target === 'text' ? (
        <div className={stackClass}>
          <ColorSwatchRow
            colors={ANNOTATION_TEXT_STROKE_SWATCHES}
            current={textColor}
            onPick={(hex) => {
              pickTextColor(hex)
              closePanel()
            }}
            idPrefix={`${idPrefix}-text`}
            label="Text color"
            swatchSize="compact"
            surface={swatchSurface}
          />
          {textVisualStyle === 'filled' ? (
            <ColorSwatchRow
              colors={ANNOTATION_TEXT_FILL_SWATCHES}
              current={textFillColor}
              onPick={(hex) => {
                pickTextFillColor(hex)
                closePanel()
              }}
              idPrefix={`${idPrefix}-text-fill`}
              label="Background color"
              swatchSize="compact"
              surface={swatchSurface}
            />
          ) : null}
        </div>
      ) : null}
      {target === 'sticky' ? (
        <div className={stackClass}>
          <ColorSwatchRow
            colors={ANNOTATION_STICKY_FILL_SWATCHES}
            current={stickyFillColor}
            onPick={(hex) => {
              pickStickyFillColor(hex)
              closePanel()
            }}
            idPrefix={idPrefix}
            labelHidden
            swatchSize="compact"
            surface={swatchSurface}
          />
        </div>
      ) : null}
    </>
  )
}

export function TopStripPalettePopoverContent({
  open: _open,
  onOpenChange: _onOpenChange,
  onClose,
  ...panelProps
}: TopStripPaletteDropdownProps & {
  onClose?: () => void
}) {
  return (
    <PopoverContent
      side="bottom"
      align="center"
      sideOffset={10}
      collisionPadding={12}
      avoidCollisions
      className={cn(TOP_STRIP_POPOVER_CLASS, 'align-start')}
    >
      <TopStripPalettePanel onClose={onClose} {...panelProps} />
    </PopoverContent>
  )
}

/** Chevron trigger + palette popover. */
export function TopStripPaletteDropdown({
  open: openControlled,
  onOpenChange,
  ...panelProps
}: TopStripPaletteDropdownProps) {
  const [openUncontrolled, setOpenUncontrolled] = useState(false)
  const open = openControlled ?? openUncontrolled

  function handleOpenChange(next: boolean) {
    if (openControlled === undefined) setOpenUncontrolled(next)
    onOpenChange?.(next)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <PaletteChevronButton open={open} />
      </PopoverTrigger>
      <TopStripPalettePopoverContent
        {...panelProps}
        open={open}
        onOpenChange={handleOpenChange}
        onClose={() => handleOpenChange(false)}
      />
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
  surface,
  stackClass,
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
  surface: PaletteSurface
  stackClass: string
}) {
  return (
    <div className={stackClass}>
      <div className="flex flex-wrap items-center gap-1.5">
        <ColorSwatchRow
          colors={colors}
          current={current}
          colorSource={colorSource}
          onPick={onPick}
          idPrefix={idPrefix}
          labelHidden
          swatchSize="compact"
          surface={surface}
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
        <SpectrumColorPicker
          customHex={customHex}
          onPickCustom={onPickCustom}
          variant="strip"
          surface={surface}
        />
      ) : null}
    </div>
  )
}
