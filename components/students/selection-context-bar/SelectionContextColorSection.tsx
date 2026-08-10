'use client'

import { useMemo, useState } from 'react'
import {
  DEFAULT_PEN_SWATCH_ID,
  DEFAULT_STICKY_FILL_COLOR,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FILL_COLOR,
} from '@/lib/books/annotation-palettes'
import type { AnnotationColorSource } from '@/lib/books/annotation-custom-color'
import type { ShapeFillMode, TextAnnotationVisualStyle } from '@/lib/books/annotation-command-types'
import {
  TopStripColorCluster,
  type TopStripPaletteTarget,
} from '@/components/students/annotation-top-strip-color-cluster'
import type { TopStripPaletteDropdownProps } from '@/components/students/annotation-top-strip-palette-dropdown'
import type { StripRecentKind } from '@/lib/books/annotation-strip-recents'
import { pushStripRecent } from '@/lib/books/annotation-strip-recents'

type PaletteDropdownBase = Omit<
  TopStripPaletteDropdownProps,
  'target' | 'idPrefix' | 'open' | 'onOpenChange'
>

function noopPick() {}

function buildPaletteDropdown(overrides: Partial<PaletteDropdownBase>): PaletteDropdownBase {
  return {
    penSwatchId: DEFAULT_PEN_SWATCH_ID,
    pickPenSwatch: noopPick,
    penColorSource: 'swatch' as AnnotationColorSource,
    penCustomHex: '#111827',
    pickPenCustomColor: noopPick,
    markerColor: '#ffff00',
    pickMarkerSwatchColor: noopPick,
    markerColorSource: 'swatch' as AnnotationColorSource,
    markerCustomHex: '#ffff00',
    pickMarkerCustomColor: noopPick,
    shapeStrokeSwatchId: DEFAULT_PEN_SWATCH_ID,
    pickShapeStrokeSwatch: noopPick,
    textColor: DEFAULT_TEXT_COLOR,
    pickTextColor: noopPick,
    textFillColor: DEFAULT_TEXT_FILL_COLOR,
    pickTextFillColor: noopPick,
    textVisualStyle: 'plain' as TextAnnotationVisualStyle,
    stickyFillColor: DEFAULT_STICKY_FILL_COLOR,
    pickStickyFillColor: noopPick,
    shapeFillColor: '#ffff00',
    pickShapeFillColor: noopPick,
    shapeFillMode: 'none' as ShapeFillMode,
    ...overrides,
  }
}

export function SelectionContextColorSection({
  kind,
  idPrefix,
  activeValue,
  paletteTarget,
  onPick,
  paletteExtras,
  penStrokeProfile,
  colorSource = 'swatch',
  customHex,
}: {
  kind: StripRecentKind
  idPrefix: string
  activeValue: string
  paletteTarget: TopStripPaletteTarget
  onPick: (value: string) => void
  paletteExtras?: Partial<PaletteDropdownBase>
  penStrokeProfile?: Parameters<typeof TopStripColorCluster>[0]['penStrokeProfile']
  colorSource?: AnnotationColorSource
  customHex?: string
}) {
  const [paletteOpen, setPaletteOpen] = useState(false)

  const paletteDropdown = useMemo(
    () => buildPaletteDropdown(paletteExtras ?? {}),
    [paletteExtras],
  )

  return (
    <TopStripColorCluster
      kind={kind}
      idPrefix={idPrefix}
      activeValue={activeValue}
      penStrokeProfile={penStrokeProfile}
      colorSource={colorSource}
      customHex={customHex}
      paletteTarget={paletteTarget}
      paletteDropdown={paletteDropdown}
      paletteOpen={paletteOpen}
      onPaletteOpenChange={setPaletteOpen}
      compact
      maxRecents={2}
      onPick={(value) => {
        pushStripRecent(kind, value)
        onPick(value)
      }}
    />
  )
}
