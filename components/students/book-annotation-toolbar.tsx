'use client'

import { useState } from 'react'
import {
  Circle,
  Eraser,
  Highlighter,
  MessageSquare,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Shapes,
  Square,
  Stamp,
  Type,
} from 'lucide-react'
import {
  ANNOTATION_PEN_SWATCHES,
  ANNOTATION_MARKER_SWATCHES,
} from '@/lib/books/annotation-palettes'
import {
  ANNOTATION_PEN_THICKNESS_PREVIEW_DOTS,
  type AnnotationStrokeThicknessStep,
  type BookAnnotationInteractionMode,
} from '@/lib/books/annotation-storage'
import type { StampVariant } from '@/lib/books/annotation-command-types'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

const THICKNESS_LABELS = ['1', '2', '3', '4', '5', '6', '7'] as const

function ThicknessRow({
  value,
  onChange,
  idPrefix,
  dotScale = 'default',
}: {
  value: AnnotationStrokeThicknessStep
  onChange: (s: AnnotationStrokeThicknessStep) => void
  idPrefix: string
  /** `pen` uses wider preview dots to match the real pen width curve. */
  dotScale?: 'default' | 'pen'
}) {
  return (
    <div className="space-y-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#c4b5a8]/85">Thickness</p>
      <div className="flex flex-wrap items-end justify-center gap-1.5">
        {THICKNESS_LABELS.map((label, i) => {
          const step = i as AnnotationStrokeThicknessStep
          const active = value === step
          const dot =
            dotScale === 'pen' ? ANNOTATION_PEN_THICKNESS_PREVIEW_DOTS[i] : 4 + i * 1.75
          return (
            <button
              key={label}
              type="button"
              id={`${idPrefix}-thick-${i}`}
              aria-label={`Stroke size ${label}`}
              aria-pressed={active}
              onClick={() => onChange(step)}
              className={cn(
                'flex h-11 w-9 flex-col items-center justify-end gap-1 rounded-lg border pb-1.5 transition-colors',
                active
                  ? 'border-amber-400/70 bg-amber-500/15 ring-1 ring-amber-400/35'
                  : 'border-[#3d2a1a]/35 bg-[#0f0c0a]/60 hover:border-[#5c4030]/45 hover:bg-[#16110e]/85',
              )}
            >
              <span
                className={cn('rounded-full', active ? 'bg-amber-200' : 'bg-[#9c8b7a]')}
                style={{ width: dot, height: dot }}
              />
              <span className="text-[0.6rem] font-medium tabular-nums text-[#d6cbb8]/90">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ColorSwatchRow({
  colors,
  current,
  onPick,
  idPrefix,
}: {
  colors: readonly string[]
  current: string
  onPick: (hex: string) => void
  idPrefix: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#c4b5a8]/85">Color</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((hex, i) => {
          const active = current.toLowerCase() === hex.toLowerCase()
          return (
            <button
              key={hex}
              type="button"
              id={`${idPrefix}-swatch-${i}`}
              aria-label={`Color ${hex}`}
              aria-pressed={active}
              onClick={() => onPick(hex)}
              className={cn(
                'h-8 w-8 shrink-0 rounded-full border-2 transition-transform',
                active ? 'scale-110 border-white ring-2 ring-amber-400/60' : 'border-black/25 hover:scale-105',
              )}
              style={{ backgroundColor: hex }}
            />
          )
        })}
      </div>
    </div>
  )
}

const STAMP_CHOICES: { variant: StampVariant; label: string }[] = [
  { variant: 'check', label: 'Check' },
  { variant: 'cross', label: 'Cross' },
  { variant: 'question', label: 'Question' },
  { variant: 'star', label: 'Star' },
]

export interface BookAnnotationToolbarProps {
  annotationMode: BookAnnotationInteractionMode
  setAnnotationMode: (m: BookAnnotationInteractionMode) => void
  stampVariant: StampVariant
  setStampVariant: (v: StampVariant) => void
  penColor: string
  setPenColor: (c: string) => void
  markerColor: string
  setMarkerColor: (c: string) => void
  penThicknessStep: AnnotationStrokeThicknessStep
  setPenThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  markerThicknessStep: AnnotationStrokeThicknessStep
  setMarkerThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  eraserPixelThicknessStep: AnnotationStrokeThicknessStep
  setEraserPixelThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  eraserLineThicknessStep: AnnotationStrokeThicknessStep
  setEraserLineThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  layout?: 'horizontal' | 'vertical'
}

const popoverContentClass =
  'w-[min(22rem,calc(100vw-2rem))] border-[#3d2a1a]/45 bg-[#1a1512] p-3.5 text-[#faf6ef] shadow-xl z-[80]'

export function BookAnnotationToolbar(props: BookAnnotationToolbarProps) {
  const {
    annotationMode,
    setAnnotationMode,
    stampVariant,
    setStampVariant,
    penColor,
    setPenColor,
    markerColor,
    setMarkerColor,
    penThicknessStep,
    setPenThicknessStep,
    markerThicknessStep,
    setMarkerThicknessStep,
    eraserPixelThicknessStep,
    setEraserPixelThicknessStep,
    eraserLineThicknessStep,
    setEraserLineThicknessStep,
    layout = 'horizontal',
  } = props

  const [penOpen, setPenOpen] = useState(false)
  const [markerOpen, setMarkerOpen] = useState(false)
  const [eraserOpen, setEraserOpen] = useState(false)
  const [shapesOpen, setShapesOpen] = useState(false)
  const [stampsOpen, setStampsOpen] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [stickyOpen, setStickyOpen] = useState(false)

  function closeAllExcept(
    which: 'pen' | 'marker' | 'eraser' | 'shapes' | 'stamps' | 'text' | 'sticky',
  ) {
    if (which !== 'pen') setPenOpen(false)
    if (which !== 'marker') setMarkerOpen(false)
    if (which !== 'eraser') setEraserOpen(false)
    if (which !== 'shapes') setShapesOpen(false)
    if (which !== 'stamps') setStampsOpen(false)
    if (which !== 'text') setTextOpen(false)
    if (which !== 'sticky') setStickyOpen(false)
  }

  function closeAllPopovers() {
    setPenOpen(false)
    setMarkerOpen(false)
    setEraserOpen(false)
    setShapesOpen(false)
    setStampsOpen(false)
    setTextOpen(false)
    setStickyOpen(false)
  }

  const penActive = annotationMode === 'pen'
  const markerActive = annotationMode === 'marker'
  const eraserActive = annotationMode === 'eraser' || annotationMode === 'eraser-line'
  const shapesActive = ['line', 'rect', 'ellipse', 'arrow'].includes(annotationMode)
  const stampsActive = annotationMode === 'stamp'
  const textActive = annotationMode === 'text'
  const stickyActive = annotationMode === 'sticky'
  const calloutActive = annotationMode === 'callout'
  const laserActive = annotationMode === 'laser'

  function pickShape(m: 'line' | 'rect' | 'ellipse' | 'arrow') {
    setAnnotationMode(m)
    setShapesOpen(false)
  }

  return (
    <div className={cn('flex shrink-0 items-center justify-center gap-1', layout === 'vertical' ? 'flex-col' : 'flex-nowrap')}>
      <Popover
        open={penOpen}
        onOpenChange={(o) => {
          setPenOpen(o)
          if (o) {
            closeAllExcept('pen')
            setAnnotationMode('pen')
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={penOpen}
            aria-haspopup="dialog"
            aria-label="Pen settings"
            title="Pen"
            className={cn(
              'h-9 w-9 shrink-0 rounded-full border border-white/14 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/65',
              (penOpen || penActive) && 'ring-2 ring-amber-400/55',
            )}
          >
            <Pencil className="h-4 w-4" strokeWidth={2} />
          </Button>
        </PopoverTrigger>
        <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={popoverContentClass}>
          <div className="space-y-4">
            <ColorSwatchRow colors={ANNOTATION_PEN_SWATCHES} current={penColor} onPick={setPenColor} idPrefix="pen" />
            <ThicknessRow
              value={penThicknessStep}
              onChange={setPenThicknessStep}
              idPrefix="pen"
              dotScale="pen"
            />
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={markerOpen}
        onOpenChange={(o) => {
          setMarkerOpen(o)
          if (o) {
            closeAllExcept('marker')
            setAnnotationMode('marker')
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={markerOpen}
            aria-haspopup="dialog"
            aria-label="Highlighter settings"
            title="Highlighter"
            className={cn(
              'h-9 w-9 shrink-0 rounded-full border border-white/14 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/65',
              (markerOpen || markerActive) && 'ring-2 ring-amber-400/55',
            )}
          >
            <Highlighter className="h-4 w-4" strokeWidth={2} />
          </Button>
        </PopoverTrigger>
        <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={popoverContentClass}>
          <div className="space-y-4">
            <ColorSwatchRow
              colors={ANNOTATION_MARKER_SWATCHES}
              current={markerColor}
              onPick={setMarkerColor}
              idPrefix="marker"
            />
            <ThicknessRow
              value={markerThicknessStep}
              onChange={setMarkerThicknessStep}
              idPrefix="marker"
            />
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={eraserOpen}
        onOpenChange={(o) => {
          setEraserOpen(o)
          if (o) {
            closeAllExcept('eraser')
            if (annotationMode !== 'eraser' && annotationMode !== 'eraser-line') {
              setAnnotationMode('eraser')
            }
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={eraserOpen}
            aria-haspopup="dialog"
            aria-label="Eraser settings"
            title="Eraser"
            className={cn(
              'h-9 w-9 shrink-0 rounded-full border border-white/14 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/65',
              (eraserOpen || eraserActive) && 'ring-2 ring-amber-400/55',
            )}
          >
            <Eraser className="h-4 w-4" strokeWidth={2} />
          </Button>
        </PopoverTrigger>
        <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={popoverContentClass}>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#c4b5a8]/85">Mode</p>
              <ToggleGroup
                type="single"
                value={annotationMode === 'eraser-line' ? 'line' : 'rubber'}
                onValueChange={(v) => {
                  if (v === 'line') setAnnotationMode('eraser-line')
                  if (v === 'rubber') setAnnotationMode('eraser')
                }}
                variant="outline"
                size="sm"
                className="w-full justify-stretch rounded-lg border border-[#3d2a1a]/40 bg-[#0f0c0a]/70 p-0.5"
              >
                <ToggleGroupItem
                  value="rubber"
                  className="flex-1 rounded-md border-0 text-xs font-medium text-[#e8dcc4] data-[state=on]:bg-amber-600/35 data-[state=on]:text-white"
                >
                  Rub
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="line"
                  className="flex-1 rounded-md border-0 text-xs font-medium text-[#e8dcc4] data-[state=on]:bg-amber-600/35 data-[state=on]:text-white"
                >
                  Stroke
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-[0.7rem] leading-snug text-[#a89888]">
                Rub smudges ink away. Stroke removes whole pen or highlighter lines you cross.
              </p>
            </div>
            {annotationMode === 'eraser-line' ? (
              <ThicknessRow
                value={eraserLineThicknessStep}
                onChange={setEraserLineThicknessStep}
                idPrefix="eraser-line"
              />
            ) : (
              <ThicknessRow
                value={eraserPixelThicknessStep}
                onChange={setEraserPixelThicknessStep}
                idPrefix="eraser-pixel"
              />
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={shapesOpen}
        onOpenChange={(o) => {
          setShapesOpen(o)
          if (o) closeAllExcept('shapes')
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={shapesOpen}
            aria-haspopup="dialog"
            aria-label="Shapes"
            title="Shapes"
            className={cn(
              'h-9 w-9 shrink-0 rounded-full border border-white/14 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/65',
              (shapesOpen || shapesActive) && 'ring-2 ring-amber-400/55',
            )}
          >
            <Shapes className="h-4 w-4" strokeWidth={2} />
          </Button>
        </PopoverTrigger>
        <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={cn(popoverContentClass, 'w-auto min-w-[10rem]')}>
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#c4b5a8]/85">Shapes</p>
          <div className="flex flex-col gap-1">
            <Button type="button" variant="ghost" size="sm" className="justify-start gap-2 text-[#faf6ef]" onClick={() => pickShape('line')}>
              <span className="inline-block h-px w-5 bg-current" aria-hidden />
              Line
            </Button>
            <Button type="button" variant="ghost" size="sm" className="justify-start gap-2 text-[#faf6ef]" onClick={() => pickShape('rect')}>
              <Square className="h-4 w-4" />
              Rectangle
            </Button>
            <Button type="button" variant="ghost" size="sm" className="justify-start gap-2 text-[#faf6ef]" onClick={() => pickShape('ellipse')}>
              <Circle className="h-4 w-4" />
              Ellipse
            </Button>
            <Button type="button" variant="ghost" size="sm" className="justify-start gap-2 text-[#faf6ef]" onClick={() => pickShape('arrow')}>
              <MoveUpRight className="h-4 w-4" />
              Arrow
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={stampsOpen}
        onOpenChange={(o) => {
          setStampsOpen(o)
          if (o) {
            closeAllExcept('stamps')
            setAnnotationMode('stamp')
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={stampsOpen}
            aria-haspopup="dialog"
            aria-label="Stamps"
            title="Stamps"
            className={cn(
              'h-9 w-9 shrink-0 rounded-full border border-white/14 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/65',
              (stampsOpen || stampsActive) && 'ring-2 ring-amber-400/55',
            )}
          >
            <Stamp className="h-4 w-4" strokeWidth={2} />
          </Button>
        </PopoverTrigger>
        <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={cn(popoverContentClass, 'w-auto min-w-[11rem]')}>
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#c4b5a8]/85">Stamp</p>
          <div className="flex flex-col gap-1">
            {STAMP_CHOICES.map(({ variant, label }) => (
              <Button
                key={variant}
                type="button"
                variant={stampVariant === variant ? 'secondary' : 'ghost'}
                size="sm"
                className="justify-start text-[#faf6ef]"
                onClick={() => {
                  setStampVariant(variant)
                  setAnnotationMode('stamp')
                  setStampsOpen(false)
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={textOpen}
        onOpenChange={(o) => {
          setTextOpen(o)
          if (o) {
            closeAllExcept('text')
            setAnnotationMode('text')
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={textOpen}
            aria-haspopup="dialog"
            aria-label="Text annotation"
            title="Text"
            className={cn(
              'h-9 w-9 shrink-0 rounded-full border border-white/14 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/65',
              (textOpen || textActive) && 'ring-2 ring-amber-400/55',
            )}
          >
            <Type className="h-4 w-4" strokeWidth={2} />
          </Button>
        </PopoverTrigger>
        <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={popoverContentClass}>
          <div className="space-y-4">
            <p className="text-[0.7rem] leading-snug text-[#a89888]">Tap the page to place a text box. Pen color and size apply.</p>
            <ColorSwatchRow colors={ANNOTATION_PEN_SWATCHES} current={penColor} onPick={setPenColor} idPrefix="text" />
            <ThicknessRow
              value={penThicknessStep}
              onChange={setPenThicknessStep}
              idPrefix="text"
              dotScale="pen"
            />
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={stickyOpen}
        onOpenChange={(o) => {
          setStickyOpen(o)
          if (o) {
            closeAllExcept('sticky')
            setAnnotationMode('sticky')
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={stickyOpen}
            aria-haspopup="dialog"
            aria-label="Sticky note"
            title="Sticky note"
            className={cn(
              'h-9 w-9 shrink-0 rounded-full border border-white/14 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/65',
              (stickyOpen || stickyActive) && 'ring-2 ring-amber-400/55',
            )}
          >
            <MessageSquare className="h-4 w-4" strokeWidth={2} />
          </Button>
        </PopoverTrigger>
        <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={popoverContentClass}>
          <div className="space-y-4">
            <p className="text-[0.7rem] leading-snug text-[#a89888]">Tap the page to place a note. Highlighter settings set note text size.</p>
            <ThicknessRow
              value={markerThicknessStep}
              onChange={setMarkerThicknessStep}
              idPrefix="sticky"
            />
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-pressed={calloutActive}
        aria-label="Numbered callout"
        title="Numbered callout"
        onClick={() => {
          closeAllPopovers()
          setAnnotationMode('callout')
        }}
        className={cn(
          'h-9 w-9 shrink-0 rounded-full border border-white/14 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/65',
          calloutActive && 'ring-2 ring-amber-400/55',
        )}
      >
        <Circle className="h-4 w-4" strokeWidth={2} />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-pressed={laserActive}
        aria-label="Laser pointer"
        title="Laser pointer"
        onClick={() => {
          closeAllPopovers()
          setAnnotationMode('laser')
        }}
        className={cn(
          'h-9 w-9 shrink-0 rounded-full border border-white/14 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/65',
          laserActive && 'ring-2 ring-rose-400/55',
        )}
      >
        <MousePointer2 className="h-4 w-4" strokeWidth={2} />
      </Button>
    </div>
  )
}
