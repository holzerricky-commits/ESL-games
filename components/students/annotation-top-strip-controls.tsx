'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  ChevronDown,
  Eraser,
  GitBranch,
  Minus,
  MoveUpRight,
  MoveHorizontal,
  Pipette,
  Scan,
  Sparkles,
  Square,
  Circle,
  Triangle,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react'
import type { MarqueeSelectRule } from '@/lib/books/annotation-select'
import { nextMarqueeSelectRule } from '@/lib/books/annotation-select'
import { StraightHVStrokeIcon } from '@/components/students/annotation-popover-controls'
import type { AnnotationLineDashStyle, ShapeFillMode, StampVariant } from '@/lib/books/annotation-command-types'
import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import {
  LineDashStyleIcon,
  NoBorderLineIcon,
  ShapeFillNoneIcon,
  ShapeFillSolidIcon,
  ShapeFillTransparentIcon,
} from '@/components/students/annotation-popover-controls'
import { TOOLBAR_ICON_CLASS } from '@/components/students/annotation-toolbar-icon'
import type { EyedropperVariant } from '@/lib/books/eyedropper-variant'
import type { TextAnnotationAlign, TextAnnotationVisualStyle } from '@/lib/books/annotation-command-types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SelectionContextValueMenu } from '@/components/students/selection-context-bar/SelectionContextIconMenu'
import { SELECTION_CONTEXT_ICON_CLASS } from '@/components/students/selection-context-bar/selection-context-bar-styles'
import {
  ANNOTATION_TEXT_FONTS_FOR_PICKER,
  getAnnotationTextFont,
  type AnnotationTextFontId,
} from '@/lib/books/annotation-text-fonts'
import { cn } from '@/lib/utils'

const LINE_CYCLE: AnnotationLineDashStyle[] = ['solid', 'dashed', 'dotted']
const SHAPE_MODES = ['line', 'rect', 'ellipse', 'triangle', 'arrow'] as const
type ShapeMode = (typeof SHAPE_MODES)[number]
const FILL_CYCLE: ShapeFillMode[] = ['solid', 'transparent', 'none']

export type TopStripTone = 'dark'
export type TopStripChipVariant = 'strip' | 'panel'

export const stripChipClass =
  'flex h-6 w-8 shrink-0 items-center justify-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/55'

export function topStripChipButtonClass(active: boolean, variant: TopStripChipVariant = 'strip') {
  if (variant === 'panel') {
    return cn(
      'flex h-7 w-9 shrink-0 items-center justify-center rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a]',
      active
        ? 'bg-[#52525b] text-[#f4f4f5] ring-1 ring-[#71717a]'
        : 'text-[#a1a1aa] hover:bg-[#3f3f46] hover:text-[#f4f4f5]',
    )
  }
  return cn(stripChipClass, active && 'bg-white/20 text-white ring-1 ring-amber-400/45')
}

export function stripChipClassForTone(_tone: TopStripTone = 'dark'): string {
  return stripChipClass
}

export function stripChipActiveClassForTone(_tone: TopStripTone = 'dark'): string {
  return 'bg-white/20 text-white ring-1 ring-amber-400/45'
}

export function stripChipMutedClassForTone(_tone: TopStripTone = 'dark'): string {
  return 'text-white/45'
}

const iconCls = TOOLBAR_ICON_CLASS

function nextInCycle<T>(current: T, options: readonly T[]): T {
  const i = options.indexOf(current)
  return options[(i + 1) % options.length]
}

/** Generic single-icon cycle chip for top strip. */
export function TopStripCycleChip<T extends string>({
  value,
  options,
  onChange,
  idPrefix,
}: {
  value: T
  options: readonly { value: T; label: string; icon: ReactNode }[]
  onChange: (v: T) => void
  idPrefix: string
}) {
  const active = options.find((o) => o.value === value) ?? options[0]
  return (
    <button
      type="button"
      id={`${idPrefix}-cycle`}
      className={stripChipClass}
      aria-label={`${active.label}. Click for next.`}
      title={active.label}
      onClick={() => onChange(nextInCycle(value, options.map((o) => o.value)))}
    >
      {active.icon}
    </button>
  )
}

function nextLineStyle(current: AnnotationLineDashStyle): AnnotationLineDashStyle {
  return nextInCycle(current, LINE_CYCLE)
}

export function TopStripLineStyleChip({
  value,
  onChange,
  idPrefix,
  tone = 'dark',
}: {
  value: AnnotationLineDashStyle
  onChange: (v: AnnotationLineDashStyle) => void
  idPrefix: string
  tone?: TopStripTone
}) {
  const label = value === 'solid' ? 'Solid line' : value === 'dashed' ? 'Dashed line' : 'Dotted line'
  return (
    <button
      type="button"
      id={`${idPrefix}-line-style`}
      className={stripChipClassForTone(tone)}
      aria-label={`${label}. Click for next style.`}
      title={label}
      onClick={() => onChange(nextLineStyle(value))}
    >
      <LineDashStyleIcon style={value} />
    </button>
  )
}

function ShapeRoundedCornersIcon({ rounded }: { rounded: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={iconCls} aria-hidden>
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx={rounded ? 3 : 0}
        ry={rounded ? 3 : 0}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  )
}

export function TopStripShapeRoundedCornersChip({
  active,
  onChange,
  idPrefix,
  variant = 'strip',
}: {
  active: boolean
  onChange: (v: boolean) => void
  idPrefix: string
  variant?: TopStripChipVariant
}) {
  return (
    <button
      type="button"
      id={`${idPrefix}-rounded-corners`}
      className={topStripChipButtonClass(active, variant)}
      aria-pressed={active}
      aria-label={
        active
          ? 'Rounded corners on. Click for sharp corners.'
          : 'Sharp corners on. Click for rounded corners.'
      }
      title={active ? 'Rounded corners' : 'Sharp corners'}
      onClick={() => onChange(!active)}
    >
      <ShapeRoundedCornersIcon rounded={active} />
    </button>
  )
}

export function TopStripShapeLineStyleChip({
  strokeEnabled,
  lineDashStyle,
  onStrokeEnabledChange,
  onLineDashStyleChange,
  fillMode,
  onFillModeChange,
  idPrefix,
  tone = 'dark',
}: {
  strokeEnabled: boolean
  lineDashStyle: AnnotationLineDashStyle
  onStrokeEnabledChange: (enabled: boolean) => void
  onLineDashStyleChange: (style: AnnotationLineDashStyle) => void
  fillMode?: ShapeFillMode
  onFillModeChange?: (mode: ShapeFillMode) => void
  idPrefix: string
  tone?: TopStripTone
}) {
  const label = !strokeEnabled
    ? 'No border'
    : lineDashStyle === 'solid'
      ? 'Solid border'
      : lineDashStyle === 'dashed'
        ? 'Dashed border'
        : 'Dotted border'

  function cycle() {
    if (!strokeEnabled) {
      onStrokeEnabledChange(true)
      onLineDashStyleChange('solid')
      return
    }
    if (lineDashStyle === 'solid') {
      onLineDashStyleChange('dashed')
      return
    }
    if (lineDashStyle === 'dashed') {
      onLineDashStyleChange('dotted')
      return
    }
    onStrokeEnabledChange(false)
    if (fillMode === 'none') onFillModeChange?.('transparent')
  }

  return (
    <button
      type="button"
      id={`${idPrefix}-line-style`}
      className={cn(
        stripChipClassForTone(tone),
        !strokeEnabled && stripChipMutedClassForTone(tone),
      )}
      aria-label={`${label}. Click for next style.`}
      title={label}
      onClick={cycle}
    >
      {!strokeEnabled ? <NoBorderLineIcon /> : <LineDashStyleIcon style={lineDashStyle} />}
    </button>
  )
}

function shapeIcon(mode: ShapeMode) {
  if (mode === 'line') return <Minus className={iconCls} strokeWidth={1.75} aria-hidden />
  if (mode === 'rect') return <Square className={iconCls} strokeWidth={1.75} aria-hidden />
  if (mode === 'ellipse') return <Circle className={iconCls} strokeWidth={1.75} aria-hidden />
  if (mode === 'triangle') return <Triangle className={iconCls} strokeWidth={1.75} aria-hidden />
  return <MoveUpRight className={iconCls} strokeWidth={1.75} aria-hidden />
}

const SHAPE_LABEL: Record<ShapeMode, string> = {
  line: 'Line',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  arrow: 'Arrow',
}

export function TopStripShapeKindChip({
  mode,
  onChange,
  idPrefix,
}: {
  mode: ShapeMode
  onChange: (m: BookAnnotationInteractionMode) => void
  idPrefix: string
}) {
  const label = SHAPE_LABEL[mode]
  return (
    <button
      type="button"
      id={`${idPrefix}-shape-kind`}
      className={stripChipClass}
      aria-label={`${label}. Click for next shape.`}
      title={label}
      onClick={() => onChange(nextInCycle(mode, SHAPE_MODES))}
    >
      {shapeIcon(mode)}
    </button>
  )
}

export function TopStripFillModeChip({
  fillMode,
  onChange,
  idPrefix,
  tone = 'dark',
}: {
  fillMode: ShapeFillMode
  onChange: (m: ShapeFillMode) => void
  idPrefix: string
  tone?: TopStripTone
}) {
  const icons: Record<ShapeFillMode, ReactNode> = {
    solid: <ShapeFillSolidIcon />,
    transparent: <ShapeFillTransparentIcon />,
    none: <ShapeFillNoneIcon />,
  }
  const labels: Record<ShapeFillMode, string> = {
    solid: 'Solid fill',
    transparent: 'Transparent fill',
    none: 'No fill',
  }
  return (
    <button
      type="button"
      id={`${idPrefix}-fill-mode`}
      className={stripChipClassForTone(tone)}
      aria-label={`${labels[fillMode]}. Click for next fill.`}
      title={labels[fillMode]}
      onClick={() => onChange(nextInCycle(fillMode, FILL_CYCLE))}
    >
      {icons[fillMode]}
    </button>
  )
}

function PenEraserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="text-[#e8dcc4]">
      <path
        d="M5.5 14.5 L12.5 7.5 L14 9 L7 16 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="5" cy="14.5" r="2.25" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

export function TopStripEraserModeChip({
  mode,
  onChange,
  idPrefix,
}: {
  mode: 'eraser' | 'eraser-line'
  onChange: (m: 'eraser' | 'eraser-line') => void
  idPrefix: string
}) {
  const isLine = mode === 'eraser-line'
  const label = isLine ? 'Stroke eraser' : 'Rub eraser'
  return (
    <button
      type="button"
      id={`${idPrefix}-eraser-mode`}
      className={stripChipClass}
      aria-label={`${label}. Click to switch eraser type.`}
      title={label}
      onClick={() => onChange(isLine ? 'eraser' : 'eraser-line')}
    >
      {isLine ? <Eraser className={iconCls} strokeWidth={1.75} aria-hidden /> : <PenEraserIcon />}
    </button>
  )
}

function TextWithBackgroundIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="text-[#e8dcc4]">
      <rect x="2" y="5" width="14" height="9" rx="1" fill="currentColor" opacity="0.4" />
      <text x="9" y="12.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">
        T
      </text>
    </svg>
  )
}

export function TopStripTextStyleChip({
  style,
  onChange,
  idPrefix,
  tone = 'dark',
}: {
  style: TextAnnotationVisualStyle
  onChange: (s: TextAnnotationVisualStyle) => void
  idPrefix: string
  tone?: TopStripTone
}) {
  const isFilled = style === 'filled'
  return (
    <button
      type="button"
      id={`${idPrefix}-text-style`}
      className={stripChipClassForTone(tone)}
      aria-label={isFilled ? 'Text with background. Click to switch style.' : 'Plain text. Click to switch style.'}
      title={isFilled ? 'Text with background' : 'Plain text'}
      onClick={() => onChange(isFilled ? 'plain' : 'filled')}
    >
      {isFilled ? <TextWithBackgroundIcon /> : <Type className={iconCls} strokeWidth={1.75} aria-hidden />}
    </button>
  )
}

const TEXT_ALIGN_OPTIONS: {
  id: TextAnnotationAlign
  label: string
  Icon: typeof AlignLeft
}[] = [
  { id: 'left', label: 'Align left', Icon: AlignLeft },
  { id: 'center', label: 'Align center', Icon: AlignCenter },
  { id: 'right', label: 'Align right', Icon: AlignRight },
]

export function TopStripTextAlignChip({
  value,
  onChange,
  idPrefix,
  tone = 'dark',
  layout = 'inline',
}: {
  value: TextAnnotationAlign
  onChange: (align: TextAnnotationAlign) => void
  idPrefix: string
  tone?: TopStripTone
  layout?: 'inline' | 'dropdown'
}) {
  if (layout === 'dropdown') {
    return (
      <SelectionContextValueMenu
        value={value}
        onChange={onChange}
        options={TEXT_ALIGN_OPTIONS.map(({ id, label, Icon }) => ({
          id,
          label,
          icon: <Icon className={SELECTION_CONTEXT_ICON_CLASS} strokeWidth={1.75} aria-hidden />,
        }))}
        idPrefix={`${idPrefix}-text-align`}
        ariaLabel="Text alignment"
        popoverLayout="icons"
      />
    )
  }

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Text alignment">
      {TEXT_ALIGN_OPTIONS.map(({ id, label, Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            id={`${idPrefix}-text-align-${id}`}
            className={cn(
              stripChipClassForTone(tone),
              active && stripChipActiveClassForTone(tone),
            )}
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={() => onChange(id)}
          >
            <Icon className={iconCls} strokeWidth={1.75} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

/** Straight highlighter underline toggle. */
export function TopStripStraightStrokeChip({
  active,
  onChange,
  idPrefix,
  variant = 'strip',
}: {
  active: boolean
  onChange: (v: boolean) => void
  idPrefix: string
  variant?: TopStripChipVariant
}) {
  return (
    <button
      type="button"
      id={`${idPrefix}-straight-stroke`}
      className={topStripChipButtonClass(active, variant)}
      aria-pressed={active}
      aria-label={
        active
          ? 'Straight horizontal underline on. Click to draw freehand.'
          : 'Straight horizontal underline off. Click to draw freehand highlights.'
      }
      title={
        active
          ? 'Straight horizontal (on)'
          : 'Straight horizontal underline'
      }
      onClick={() => onChange(!active)}
    >
      <StraightHVStrokeIcon />
    </button>
  )
}

/** Themed ornaments along the upper edge of highlighter strokes (flames, waves, leaves, etc.). */
export function TopStripMarkerDecoratedEdgeChip({
  active,
  onChange,
  idPrefix,
  tone = 'dark',
  variant = 'strip',
}: {
  active: boolean
  onChange: (v: boolean) => void
  idPrefix: string
  tone?: TopStripTone
  variant?: TopStripChipVariant
}) {
  return (
    <button
      type="button"
      id={`${idPrefix}-decorated-edge`}
      className={
        variant === 'panel'
          ? topStripChipButtonClass(active, 'panel')
          : cn(stripChipClassForTone(tone), active && stripChipActiveClassForTone(tone))
      }
      aria-pressed={active}
      aria-label={
        active
          ? 'Decorated highlighter edge on. Click for plain highlighter.'
          : 'Decorated highlighter edge off. Click for themed upper-edge ornaments.'
      }
      title={active ? 'Decorated edge (on)' : 'Decorated edge — flames, waves, leaves by color'}
      onClick={() => onChange(!active)}
    >
      <Sparkles className={iconCls} strokeWidth={1.75} aria-hidden />
    </button>
  )
}

/** Select tool: how marquee chooses window vs crossing. */
export function TopStripMarqueeRuleChip({
  rule,
  onChange,
  idPrefix,
  variant = 'strip',
}: {
  rule: MarqueeSelectRule
  onChange: (r: MarqueeSelectRule) => void
  idPrefix: string
  variant?: TopStripChipVariant
}) {
  const label =
    rule === 'follow-drag'
      ? 'Marquee: follow drag (L→R inside, R→L touch)'
      : rule === 'crossing'
        ? 'Marquee: always touch'
        : 'Marquee: fully inside only'
  const icon =
    rule === 'follow-drag' ? (
      <MoveHorizontal className={iconCls} strokeWidth={1.75} aria-hidden />
    ) : rule === 'crossing' ? (
      <Scan className={iconCls} strokeWidth={1.75} aria-hidden />
    ) : (
      <Square className={iconCls} strokeWidth={1.75} aria-hidden />
    )

  const active = rule !== 'follow-drag'

  return (
    <button
      type="button"
      id={`${idPrefix}-marquee-rule`}
      className={topStripChipButtonClass(active, variant)}
      aria-label={`${label}. Click for next rule.`}
      title={label}
      onClick={() => onChange(nextMarqueeSelectRule(rule))}
    >
      {icon}
    </button>
  )
}

/** Pen tool: auto-group touching pen strokes into one figure while drawing. */
export function TopStripPenAutoGroupChip({
  active,
  onChange,
  idPrefix,
  variant = 'strip',
}: {
  active: boolean
  onChange: (v: boolean) => void
  idPrefix: string
  variant?: TopStripChipVariant
}) {
  return (
    <button
      type="button"
      id={`${idPrefix}-auto-group`}
      className={topStripChipButtonClass(active, variant)}
      aria-pressed={active}
      aria-label={
        active
          ? 'Auto-group connected shapes on. Touching pen strokes join within 5 seconds; leaving pen locks the figure.'
          : 'Auto-group connected shapes off. Each pen stroke stays separate until grouped.'
      }
      title={
        active
          ? 'Auto-group shapes (on) — touching strokes within 5s; switch tools to finish'
          : 'Auto-group shapes (off)'
      }
      onClick={() => onChange(!active)}
    >
      <GitBranch className={iconCls} strokeWidth={1.75} aria-hidden />
    </button>
  )
}

export function TopStripEyedropperVariantChip({
  variant,
  onChange,
  idPrefix,
}: {
  variant: EyedropperVariant
  onChange: (v: EyedropperVariant) => void
  idPrefix: string
}) {
  const isSmart = variant === 'smart'
  return (
    <button
      type="button"
      id={`${idPrefix}-eyedropper-variant`}
      className={stripChipClass}
      aria-label={isSmart ? 'Smart ink. Click to switch.' : 'Sample color. Click to switch.'}
      title={isSmart ? 'Smart ink' : 'Sample color'}
      onClick={() => onChange(isSmart ? 'sample' : 'smart')}
    >
      {isSmart ? (
        <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center">
          <Pipette className={iconCls} strokeWidth={1.75} aria-hidden />
          <Sparkles className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-amber-400" aria-hidden />
        </span>
      ) : (
        <Pipette className={iconCls} strokeWidth={1.75} aria-hidden />
      )}
    </button>
  )
}

export const TOP_STRIP_POPOVER_CLASS =
  'w-[min(20rem,calc(100vw-2rem))] rounded-b-xl border border-white/10 border-t-0 bg-black/24 p-2.5 text-white/75 shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[1.5px] z-[80]'

export const TOP_STRIP_POPOVER_STACK = 'space-y-2.5'

/** Sample word shown in the font chip trigger so the active typeface is readable at a glance. */
export const TEXT_FONT_CHIP_PREVIEW_WORD = 'Header'

export function TopStripTextFontChip({
  value,
  onChange,
  idPrefix,
  tone = 'dark',
  compact = false,
  previewWord = TEXT_FONT_CHIP_PREVIEW_WORD,
}: {
  value: AnnotationTextFontId
  onChange: (id: AnnotationTextFontId) => void
  idPrefix: string
  tone?: TopStripTone
  compact?: boolean
  previewWord?: string
}) {
  const [open, setOpen] = useState(false)
  const active = getAnnotationTextFont(value)
  const chipClass = stripChipClassForTone(tone)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={`${idPrefix}-text-font`}
          className={cn(
            chipClass,
            'h-8 min-h-8',
            compact
              ? 'inline-flex w-auto min-w-[4.75rem] max-w-[7.5rem] gap-0.5 px-2'
              : 'inline-flex w-auto min-w-[5.5rem] max-w-[9.5rem] gap-0.5 px-2',
          )}
          aria-label={`Text font: ${active.label}. Click to choose another font.`}
          title={`Font: ${active.label}`}
        >
          <span
            className={cn(
              'truncate font-medium leading-none text-sm text-white/85',
            )}
            style={{ fontFamily: active.cssFamily }}
          >
            {previewWord}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className={cn(TOP_STRIP_POPOVER_CLASS, 'w-[min(15rem,calc(100vw-2rem))] space-y-0.5 p-1.5')}
      >
        <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-white/45">
          Text font
        </p>
        <div className="space-y-0.5">
        {ANNOTATION_TEXT_FONTS_FOR_PICKER.map((font) => {
          const selected = font.id === value
          return (
            <button
              key={font.id}
              type="button"
              className={cn(
                'flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-white/85 transition-colors hover:bg-white/10',
                selected && 'bg-white/12 ring-1 ring-amber-400/40',
              )}
              style={{ fontFamily: font.cssFamily }}
              onClick={() => {
                onChange(font.id)
                setOpen(false)
              }}
            >
              {font.label}
            </button>
          )
        })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export type { ShapeMode, StampVariant }
