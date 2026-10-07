'use client'

import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  ANNOTATION_MARKER_SWATCHES,
  ANNOTATION_PEN_SWATCHES,
  ANNOTATION_SHAPE_FILL_SWATCHES,
  ANNOTATION_SOLID_PEN_SWATCHES,
  ANNOTATION_STICKY_FILL_SWATCHES,
  ANNOTATION_TEXT_FILL_SWATCHES,
  ANNOTATION_TEXT_STROKE_SWATCHES,
  getPenSwatch,
  type PenSwatch,
} from '@/lib/books/annotation-palettes'
import {
  getStripRecentsSyncSnapshot,
  pushStripRecent,
  stripRecentsForDisplay,
  subscribeStripRecents,
  type StripRecentKind,
} from '@/lib/books/annotation-strip-recents'
import { penSwatchPreviewStyle } from '@/lib/books/pen-ink'
import { ColorSwatchRow, PenSwatchRow } from '@/components/students/annotation-swatch-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  SELECTION_CONTEXT_BAR_ACTION_BTN,
  SELECTION_CONTEXT_BAR_ACTION_BTN_ACTIVE,
  SELECTION_CONTEXT_POPOVER_CONTENT_CLASS,
  SELECTION_CONTEXT_POPOVER_SECTION_LABEL,
  SELECTION_CONTEXT_POPOVER_STACK,
} from '@/components/students/selection-context-bar/selection-context-bar-styles'

export type SelectionContextColorRole = 'ink' | 'fill' | 'stroke' | 'marker'

function ColorRolePreview({
  role,
  color,
  penSwatch,
}: {
  role: SelectionContextColorRole
  color: string
  /** When set for stroke, show effect-ink preview in the ring center. */
  penSwatch?: PenSwatch
}) {
  if (role === 'ink') {
    return (
      <span className="relative flex h-5 w-5 flex-col items-center justify-center" aria-hidden>
        <span className="text-[11px] font-semibold leading-none text-[#f4f4f5]">A</span>
        <span
          className="mt-0.5 h-[3px] w-3.5 rounded-sm"
          style={{ backgroundColor: color }}
        />
      </span>
    )
  }

  if (role === 'fill') {
    return (
      <span
        className="h-4 w-4 rounded-[4px] border border-black/35 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
    )
  }

  if (role === 'marker') {
    return (
      <span
        className="h-3.5 w-5 rounded-full border border-black/30 opacity-95"
        style={{ backgroundColor: color }}
        aria-hidden
      />
    )
  }

  // stroke
  return (
    <span
      className="relative flex h-4 w-4 items-center justify-center rounded-full border-[2.5px] bg-transparent"
      style={{ borderColor: color }}
      aria-hidden
    >
      {penSwatch && penSwatch.patternId !== 'solid' ? (
        <span
          className="h-2 w-2 rounded-full"
          style={penSwatchPreviewStyle(penSwatch.patternId, penSwatch.color)}
        />
      ) : null}
    </span>
  )
}

export function SelectionContextColorButton({
  role,
  color,
  penSwatch,
  ariaLabel,
  title,
  id,
  open,
  onOpenChange,
  children,
}: {
  role: SelectionContextColorRole
  color: string
  penSwatch?: PenSwatch
  ariaLabel: string
  title?: string
  id?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          className={cn(
            SELECTION_CONTEXT_BAR_ACTION_BTN,
            open && SELECTION_CONTEXT_BAR_ACTION_BTN_ACTIVE,
          )}
          aria-label={ariaLabel}
          aria-expanded={open}
          title={title ?? ariaLabel}
        >
          <ColorRolePreview role={role} color={color} penSwatch={penSwatch} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className={SELECTION_CONTEXT_POPOVER_CONTENT_CLASS}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className={SELECTION_CONTEXT_POPOVER_STACK}>{children}</div>
      </PopoverContent>
    </Popover>
  )
}

function RecentHexChips({
  kind,
  active,
  idPrefix,
  onPick,
}: {
  kind: StripRecentKind
  active: string
  idPrefix: string
  onPick: (hex: string) => void
}) {
  const revision = useSyncExternalStore(
    subscribeStripRecents,
    () => getStripRecentsSyncSnapshot(kind),
    () => `default:${kind}`,
  )
  const recents = useMemo(
    () => stripRecentsForDisplay(kind, active, 4),
    [kind, active, revision],
  )
  if (recents.length === 0) return null

  return (
    <div className="space-y-1.5">
      <p className={SELECTION_CONTEXT_POPOVER_SECTION_LABEL}>Recent</p>
      <div className="flex flex-wrap gap-1.5">
        {recents.map((hex, i) => (
          <button
            key={hex}
            type="button"
            id={`${idPrefix}-recent-${i}`}
            aria-label={`Recent color ${hex}`}
            onClick={() => onPick(hex)}
            className="h-6 w-6 shrink-0 rounded-full border-2 border-black/25 transition-transform hover:scale-105"
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </div>
  )
}

function RecentPenChips({
  kind,
  activeId,
  idPrefix,
  onPick,
}: {
  kind: StripRecentKind
  activeId: string
  idPrefix: string
  onPick: (id: string) => void
}) {
  const revision = useSyncExternalStore(
    subscribeStripRecents,
    () => getStripRecentsSyncSnapshot(kind),
    () => `default:${kind}`,
  )
  const recents = useMemo(
    () => stripRecentsForDisplay(kind, activeId, 4),
    [kind, activeId, revision],
  )
  if (recents.length === 0) return null

  return (
    <div className="space-y-1.5">
      <p className={SELECTION_CONTEXT_POPOVER_SECTION_LABEL}>Recent</p>
      <div className="flex flex-wrap gap-1.5">
        {recents.map((id, i) => {
          const swatch = getPenSwatch(id)
          return (
            <button
              key={id}
              type="button"
              id={`${idPrefix}-recent-${i}`}
              aria-label={`Recent ${swatch.label}`}
              onClick={() => onPick(id)}
              className="h-6 w-6 shrink-0 rounded-full border-2 border-black/25 transition-transform hover:scale-105"
              style={penSwatchPreviewStyle(swatch.patternId, swatch.color)}
            />
          )
        })}
      </div>
    </div>
  )
}

/** Hex palette control (text ink/fill, sticky, marker, shape fill). */
export function SelectionContextHexColorControl({
  role,
  color,
  colors,
  recentKind,
  ariaLabel,
  title,
  idPrefix,
  label,
  onPick,
}: {
  role: Extract<SelectionContextColorRole, 'ink' | 'fill' | 'marker'>
  color: string
  colors: readonly string[]
  recentKind?: StripRecentKind
  ariaLabel: string
  title?: string
  idPrefix: string
  label?: string
  onPick: (hex: string) => void
}) {
  const [open, setOpen] = useState(false)

  function pick(hex: string) {
    if (recentKind) pushStripRecent(recentKind, hex)
    onPick(hex)
    setOpen(false)
  }

  return (
    <SelectionContextColorButton
      role={role}
      color={color}
      ariaLabel={ariaLabel}
      title={title}
      id={`${idPrefix}-trigger`}
      open={open}
      onOpenChange={setOpen}
    >
      {recentKind ? (
        <RecentHexChips kind={recentKind} active={color} idPrefix={idPrefix} onPick={pick} />
      ) : null}
      <ColorSwatchRow
        colors={colors}
        current={color}
        onPick={pick}
        idPrefix={idPrefix}
        label={label ?? 'Color'}
        labelHidden={!label}
        swatchSize="compact"
        surface="dark"
      />
    </SelectionContextColorButton>
  )
}

/** Pen / shape stroke swatch-id control. */
export function SelectionContextPenColorControl({
  swatchId,
  swatches = ANNOTATION_SOLID_PEN_SWATCHES,
  recentKind,
  ariaLabel,
  title,
  idPrefix,
  label,
  onPick,
}: {
  swatchId: string
  swatches?: readonly PenSwatch[]
  recentKind?: StripRecentKind
  ariaLabel: string
  title?: string
  idPrefix: string
  label?: string
  onPick: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const swatch = getPenSwatch(swatchId)

  function pick(id: string) {
    if (recentKind) pushStripRecent(recentKind, id)
    onPick(id)
    setOpen(false)
  }

  return (
    <SelectionContextColorButton
      role="stroke"
      color={swatch.color}
      penSwatch={swatch}
      ariaLabel={ariaLabel}
      title={title}
      id={`${idPrefix}-trigger`}
      open={open}
      onOpenChange={setOpen}
    >
      {recentKind ? (
        <RecentPenChips kind={recentKind} activeId={swatchId} idPrefix={idPrefix} onPick={pick} />
      ) : null}
      <PenSwatchRow
        swatchId={swatchId}
        onPick={pick}
        idPrefix={idPrefix}
        label={label ?? 'Color'}
        labelHidden={!label}
        swatchSize="compact"
        swatches={swatches}
        surface="dark"
      />
    </SelectionContextColorButton>
  )
}

/** Convenience presets matching existing context-bar palettes. */
export const CONTEXT_TEXT_INK_COLORS = ANNOTATION_TEXT_STROKE_SWATCHES
export const CONTEXT_TEXT_FILL_COLORS = ANNOTATION_TEXT_FILL_SWATCHES
export const CONTEXT_STICKY_FILL_COLORS = ANNOTATION_STICKY_FILL_SWATCHES
export const CONTEXT_SHAPE_FILL_COLORS = ANNOTATION_SHAPE_FILL_SWATCHES
export const CONTEXT_MARKER_COLORS = ANNOTATION_MARKER_SWATCHES
export const CONTEXT_SOLID_PEN_SWATCHES = ANNOTATION_SOLID_PEN_SWATCHES
export const CONTEXT_PEN_SWATCHES = ANNOTATION_PEN_SWATCHES
