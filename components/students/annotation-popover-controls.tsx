'use client'

import type { ReactNode } from 'react'
import type { AnnotationLineDashStyle, ShapeFillMode } from '@/lib/books/annotation-command-types'
import { ANNOTATION_CHROME_SECTION_LABEL } from '@/components/students/annotation-chrome-styles'
import { cn } from '@/lib/utils'

export const popoverSectionLabelClass =
  'text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#c4b5a8]/85'

export const railSectionLabelClass = ANNOTATION_CHROME_SECTION_LABEL

export const popoverStackClass = 'min-w-0 space-y-3.5'

export type PopoverControlSurface = 'default' | 'rail'

function sectionLabelClass(surface: PopoverControlSurface) {
  return surface === 'rail' ? railSectionLabelClass : popoverSectionLabelClass
}

function segmentGroupClass(surface: PopoverControlSurface) {
  return surface === 'rail'
    ? 'inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-[#3f3f46] bg-[#353539] p-0.5'
    : 'inline-flex gap-0.5 rounded-md border border-[#3d2a1a]/45 bg-[#0f0c0a]/70 p-0.5'
}

function segmentButtonClass(active: boolean, surface: PopoverControlSurface, compact?: boolean) {
  return cn(
    'flex items-center justify-center rounded text-xs font-medium transition-colors',
    compact ? 'h-7 w-9' : 'h-7 min-w-0 flex-1 px-2',
    surface === 'rail'
      ? active
        ? 'bg-[#52525b] text-[#f4f4f5]'
        : 'text-[#a1a1aa] hover:bg-[#3f3f46] hover:text-[#f4f4f5]'
      : active
        ? 'bg-amber-600/35 text-white'
        : 'text-[#c4b5a8]/90 hover:bg-[#1f1a16]/90',
  )
}

export function LineDashStyleIcon({ style }: { style: AnnotationLineDashStyle }) {
  const stroke = 'currentColor'
  const sw = 2
  if (style === 'solid') {
    return (
      <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden className="text-current">
        <line x1="1" y1="4" x2="21" y2="4" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    )
  }
  if (style === 'dashed') {
    return (
      <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden className="text-current">
        <line
          x1="1"
          y1="4"
          x2="21"
          y2="4"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray="5 3"
        />
      </svg>
    )
  }
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden className="text-current">
      <line
        x1="1"
        y1="4"
        x2="21"
        y2="4"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray="1.5 3.5"
      />
    </svg>
  )
}

export const LINE_DASH_OPTIONS: { value: AnnotationLineDashStyle; label: string }[] = [
  { value: 'solid', label: 'Solid line' },
  { value: 'dashed', label: 'Dashed line' },
  { value: 'dotted', label: 'Dotted line' },
]

/** Horizontal underline snap (highlighter straight stroke). */
export function StraightHVStrokeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="text-current">
      <path
        d="M4 12.5h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="square"
      />
    </svg>
  )
}

export function NoBorderLineIcon() {
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden className="text-current">
      <line x1="2" y1="6.5" x2="20" y2="1.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export function ShapeFillSolidIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="text-current">
      <rect x="3" y="3" width="12" height="12" rx="1" fill="currentColor" />
    </svg>
  )
}

export function ShapeFillTransparentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="text-current">
      <rect x="3" y="3" width="6" height="6" fill="#6b5d52" />
      <rect x="9" y="3" width="6" height="6" fill="#9a8b7e" />
      <rect x="3" y="9" width="6" height="6" fill="#9a8b7e" />
      <rect x="9" y="9" width="6" height="6" fill="#6b5d52" />
      <rect x="3" y="3" width="12" height="12" rx="1" fill="currentColor" opacity="0.45" />
    </svg>
  )
}

export function ShapeFillNoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="text-current">
      <rect x="3" y="3" width="12" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

/** Line dash + no-border (4th option) for filled shapes. */
export function ShapeLineStyleIconRow({
  strokeEnabled,
  lineDashStyle,
  onStrokeEnabledChange,
  onLineDashStyleChange,
  fillMode,
  onFillModeChange,
  idPrefix,
  surface = 'default',
  labelHidden = false,
}: {
  strokeEnabled: boolean
  lineDashStyle: AnnotationLineDashStyle
  onStrokeEnabledChange: (enabled: boolean) => void
  onLineDashStyleChange: (style: AnnotationLineDashStyle) => void
  fillMode: ShapeFillMode
  onFillModeChange: (mode: ShapeFillMode) => void
  idPrefix: string
  surface?: PopoverControlSurface
  labelHidden?: boolean
}) {
  const rowLabel = surface === 'rail' ? 'Outline' : 'Line style and border'
  const group = (
    <div className={segmentGroupClass(surface)} role="group" aria-label={rowLabel}>
      {LINE_DASH_OPTIONS.map(({ value: opt, label }) => {
        const active = strokeEnabled && lineDashStyle === opt
        return (
          <button
            key={opt}
            type="button"
            id={`${idPrefix}-dash-${opt}`}
            aria-label={label}
            aria-pressed={active}
            onClick={() => {
              onLineDashStyleChange(opt)
              onStrokeEnabledChange(true)
            }}
            className={segmentButtonClass(active, surface, true)}
          >
            <LineDashStyleIcon style={opt} />
          </button>
        )
      })}
      <button
        type="button"
        id={`${idPrefix}-dash-none`}
        aria-label="No border"
        aria-pressed={!strokeEnabled}
        onClick={() => {
          onStrokeEnabledChange(false)
          if (fillMode === 'none') onFillModeChange('transparent')
        }}
        className={segmentButtonClass(!strokeEnabled, surface, true)}
      >
        <NoBorderLineIcon />
      </button>
    </div>
  )

  if (labelHidden) return group

  return (
    <div className="space-y-1.5">
      <p className={surface === 'rail' ? railSectionLabelClass : 'sr-only'}>{rowLabel}</p>
      {group}
    </div>
  )
}

const SHAPE_FILL_OPTIONS: { value: ShapeFillMode; ariaLabel: string; icon: ReactNode }[] = [
  { value: 'solid', ariaLabel: 'Solid fill', icon: <ShapeFillSolidIcon /> },
  { value: 'transparent', ariaLabel: 'Transparent fill', icon: <ShapeFillTransparentIcon /> },
  { value: 'none', ariaLabel: 'No fill', icon: <ShapeFillNoneIcon /> },
]

/** Solid / transparent / no fill for shapes (segment row under line style). */
export function ShapeFillIconRow({
  fillMode,
  onFillModeChange,
  strokeEnabled,
  onStrokeEnabledChange,
  idPrefix,
  surface = 'default',
  labelHidden = false,
}: {
  fillMode: ShapeFillMode
  onFillModeChange: (mode: ShapeFillMode) => void
  strokeEnabled: boolean
  onStrokeEnabledChange: (enabled: boolean) => void
  idPrefix: string
  surface?: PopoverControlSurface
  labelHidden?: boolean
}) {
  const group = (
    <div className={segmentGroupClass(surface)} role="group" aria-label="Fill">
      {SHAPE_FILL_OPTIONS.map(({ value, ariaLabel, icon }) => (
        <button
          key={value}
          type="button"
          id={`${idPrefix}-fill-${value}`}
          aria-label={ariaLabel}
          aria-pressed={fillMode === value}
          onClick={() => {
            if (value === 'none' && !strokeEnabled) onStrokeEnabledChange(true)
            onFillModeChange(value)
          }}
          className={segmentButtonClass(fillMode === value, surface, true)}
        >
          {icon}
        </button>
      ))}
    </div>
  )

  if (labelHidden) return group

  return (
    <div className="space-y-1.5">
      <p className={surface === 'rail' ? railSectionLabelClass : 'sr-only'}>Fill</p>
      {group}
    </div>
  )
}

/** Compact icon-only line style picker (pen template). */
export function LineDashStyleIconRow({
  value,
  onChange,
  idPrefix,
  surface = 'default',
  labelHidden = false,
  label = 'Line style',
}: {
  value: AnnotationLineDashStyle
  onChange: (v: AnnotationLineDashStyle) => void
  idPrefix: string
  surface?: PopoverControlSurface
  labelHidden?: boolean
  label?: string
}) {
  const group = (
    <div className={segmentGroupClass(surface)} role="group" aria-label={label}>
      {LINE_DASH_OPTIONS.map(({ value: opt, label: optLabel }) => {
        const active = value === opt
        return (
          <button
            key={opt}
            type="button"
            id={`${idPrefix}-dash-${opt}`}
            aria-label={optLabel}
            aria-pressed={active}
            onClick={() => onChange(opt)}
            className={segmentButtonClass(active, surface, true)}
          >
            <LineDashStyleIcon style={opt} />
          </button>
        )
      })}
    </div>
  )

  if (labelHidden) return group

  return (
    <div className="space-y-1.5">
      <p className={sectionLabelClass(surface)}>{label}</p>
      {group}
    </div>
  )
}

/** Labeled segmented control (mode, on/off, text style, etc.). */
export function PopoverSegmentRow<T extends string>({
  label,
  value,
  onChange,
  idPrefix,
  options,
  fullWidth = true,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  idPrefix: string
  options: readonly { value: T; label: string }[]
  fullWidth?: boolean
}) {
  return (
    <div className="space-y-2">
      <p className={popoverSectionLabelClass}>{label}</p>
      <div
        className={cn(segmentGroupClass('default'), fullWidth && 'flex w-full')}
        role="group"
        aria-label={label}
      >
        {options.map(({ value: opt, label: optLabel }) => {
          const active = value === opt
          return (
            <button
              key={opt}
              type="button"
              id={`${idPrefix}-${opt}`}
              aria-label={optLabel}
              aria-pressed={active}
              onClick={() => onChange(opt)}
              className={segmentButtonClass(active, 'default', false)}
            >
              {optLabel}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Compact icon-only segment (eraser mode, text style, etc.). */
export function PopoverIconSegmentRow<T extends string>({
  label,
  labelHidden = false,
  value,
  onChange,
  idPrefix,
  options,
  surface = 'default',
}: {
  label: string
  labelHidden?: boolean
  value: T
  onChange: (v: T) => void
  idPrefix: string
  options: readonly { value: T; ariaLabel: string; icon: ReactNode }[]
  surface?: PopoverControlSurface
}) {
  const group = (
    <div className={segmentGroupClass(surface)} role="group" aria-label={label}>
      {options.map(({ value: opt, ariaLabel, icon }) => {
        const active = value === opt
        return (
          <button
            key={opt}
            type="button"
            id={`${idPrefix}-${opt}`}
            aria-label={ariaLabel}
            aria-pressed={active}
            onClick={() => onChange(opt)}
            className={segmentButtonClass(active, surface, true)}
          >
            {icon}
          </button>
        )
      })}
    </div>
  )

  if (labelHidden) return group

  return (
    <div>
      <p className={cn(sectionLabelClass(surface), 'mb-2')}>{label}</p>
      {group}
    </div>
  )
}

/** Single-select icon grid (shapes, stamps). */
export function PopoverIconGridRow<T extends string>({
  label,
  labelHidden = false,
  value,
  onChange,
  idPrefix,
  options,
  surface = 'default',
}: {
  label: string
  labelHidden?: boolean
  value: T
  onChange: (v: T) => void
  idPrefix: string
  options: readonly { value: T; ariaLabel: string; icon: ReactNode }[]
  surface?: PopoverControlSurface
}) {
  const group = (
    <div className={segmentGroupClass(surface)} role="group" aria-label={label}>
      {options.map(({ value: opt, ariaLabel, icon }) => {
        const active = value === opt
        return (
          <button
            key={opt}
            type="button"
            id={`${idPrefix}-${opt}`}
            aria-label={ariaLabel}
            aria-pressed={active}
            onClick={() => onChange(opt)}
            className={segmentButtonClass(active, surface, true)}
          >
            {icon}
          </button>
        )
      })}
    </div>
  )

  if (labelHidden) return group

  return (
    <div>
      <p className={cn(sectionLabelClass(surface), 'mb-2')}>{label}</p>
      {group}
    </div>
  )
}

/** Optional helper text below controls (muted, pen-popover tone). */
export function PopoverHint({ children }: { children: ReactNode }) {
  return <p className="text-[0.7rem] leading-snug text-[#a1a1aa]">{children}</p>
}
