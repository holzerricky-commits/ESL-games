'use client'

import { useState } from 'react'
import { Camera, Copy, Crop, FileStack, ImageDown } from 'lucide-react'
import type { BookCaptureFormat } from '@/lib/books/book-capture'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

const popoverContentClass =
  'w-[min(22rem,calc(100vw-2rem))] border-[#3d2a1a]/45 bg-[#1a1512] p-3.5 text-[#faf6ef] shadow-xl z-[80]'

export interface BookCaptureMenuProps {
  disabled?: boolean
  busy?: boolean
  captureFormat: BookCaptureFormat
  onCaptureFormatChange: (f: BookCaptureFormat) => void
  jpegQuality: number
  onJpegQualityChange: (q: number) => void
  hideChromeForCapture: boolean
  onHideChromeForCaptureChange: (v: boolean) => void
  watermarkEnabled: boolean
  onWatermarkEnabledChange: (v: boolean) => void
  studentDisplayName?: string
  onSaveFullStage: () => void | Promise<void>
  onSaveCurrentPage: () => void | Promise<void>
  onSelectRegion: () => void
  onCopyLastCapture?: () => void | Promise<void>
  canCopyLast?: boolean
  onExportPdfPacket: () => void
}

export function BookCaptureMenu(props: BookCaptureMenuProps) {
  const {
    disabled,
    busy,
    captureFormat,
    onCaptureFormatChange,
    jpegQuality,
    onJpegQualityChange,
    hideChromeForCapture,
    onHideChromeForCaptureChange,
    watermarkEnabled,
    onWatermarkEnabledChange,
    studentDisplayName,
    onSaveFullStage,
    onSaveCurrentPage,
    onSelectRegion,
    onCopyLastCapture,
    canCopyLast,
    onExportPdfPacket,
  } = props

  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || busy}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="Capture and export"
          className={cn(
            'h-9 w-9 shrink-0 rounded-full border border-white/14 bg-black/50 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/65',
            open && 'ring-2 ring-amber-400/55',
          )}
        >
          <Camera className="h-4 w-4" strokeWidth={2} />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className={popoverContentClass}>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#c4b5a8]/85">Format</p>
            <ToggleGroup
              type="single"
              value={captureFormat}
              onValueChange={(v) => {
                if (v === 'png' || v === 'jpeg' || v === 'webp') onCaptureFormatChange(v)
              }}
              variant="outline"
              size="sm"
              className="w-full justify-stretch rounded-lg border border-[#3d2a1a]/40 bg-[#0f0c0a]/70 p-0.5"
            >
              <ToggleGroupItem value="png" className="flex-1 text-xs font-medium text-[#e8dcc4] data-[state=on]:bg-amber-600/35 data-[state=on]:text-white">
                PNG
              </ToggleGroupItem>
              <ToggleGroupItem value="jpeg" className="flex-1 text-xs font-medium text-[#e8dcc4] data-[state=on]:bg-amber-600/35 data-[state=on]:text-white">
                JPEG
              </ToggleGroupItem>
              <ToggleGroupItem value="webp" className="flex-1 text-xs font-medium text-[#e8dcc4] data-[state=on]:bg-amber-600/35 data-[state=on]:text-white">
                WebP
              </ToggleGroupItem>
            </ToggleGroup>
            {captureFormat === 'jpeg' ? (
              <div className="space-y-1.5 pt-1">
                <Label className="text-[0.7rem] text-[#a89888]">JPEG quality</Label>
                <Slider
                  value={[jpegQuality]}
                  min={0.5}
                  max={1}
                  step={0.02}
                  onValueChange={(v) => onJpegQualityChange(v[0] ?? 0.88)}
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="hide-chrome-cap" className="text-[0.8rem] text-[#e8dcc4]">
              Hide toolbars in shot
            </Label>
            <Switch
              id="hide-chrome-cap"
              checked={hideChromeForCapture}
              onCheckedChange={onHideChromeForCaptureChange}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="wm-cap" className="text-[0.8rem] text-[#e8dcc4]">
              Watermark {studentDisplayName ? `(${studentDisplayName})` : ''}
            </Label>
            <Switch id="wm-cap" checked={watermarkEnabled} onCheckedChange={onWatermarkEnabledChange} />
          </div>

          <div className="space-y-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#c4b5a8]/85">Save to student-work</p>
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full justify-start gap-2 bg-[#2a221c] text-[#faf6ef] hover:bg-[#362a22]"
                disabled={busy}
                onClick={() => {
                  void onSaveFullStage()
                }}
              >
                <ImageDown className="h-4 w-4 shrink-0" />
                Full book stage
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full justify-start gap-2 bg-[#2a221c] text-[#faf6ef] hover:bg-[#362a22]"
                disabled={busy}
                onClick={() => {
                  void onSaveCurrentPage()
                }}
              >
                <ImageDown className="h-4 w-4 shrink-0" />
                Current page only
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full justify-start gap-2 bg-[#2a221c] text-[#faf6ef] hover:bg-[#362a22]"
                disabled={busy}
                onClick={() => {
                  setOpen(false)
                  onSelectRegion()
                }}
              >
                <Crop className="h-4 w-4 shrink-0" />
                Select region…
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full justify-start gap-2 bg-[#2a221c] text-[#faf6ef] hover:bg-[#362a22]"
                disabled={busy}
                onClick={() => {
                  setOpen(false)
                  onExportPdfPacket()
                }}
              >
                <FileStack className="h-4 w-4 shrink-0" />
                Multi-page PDF…
              </Button>
              {onCopyLastCapture ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 border-[#5c4030]/45 text-[#faf6ef]"
                  disabled={busy || !canCopyLast}
                  onClick={() => {
                    void onCopyLastCapture()
                  }}
                >
                  <Copy className="h-4 w-4 shrink-0" />
                  Copy last capture
                </Button>
              ) : null}
            </div>
          </div>
          <p className="text-[0.65rem] leading-snug text-[#8a7a6c]">
            Files are written under <code className="text-[#d6cbb8]">student-work/&lt;student&gt;/exports/…</code> on your machine when the dev server runs locally.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
