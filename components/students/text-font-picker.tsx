'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ANNOTATION_CHROME_POPOVER } from '@/components/students/annotation-chrome-styles'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  ANNOTATION_TEXT_FONTS_FOR_PICKER,
  getAnnotationTextFont,
  type AnnotationTextFontId,
} from '@/lib/books/annotation-text-fonts'
import { cn } from '@/lib/utils'

export function TextFontPicker({
  value,
  onChange,
  idPrefix,
  surface = 'default',
}: {
  value: AnnotationTextFontId
  onChange: (id: AnnotationTextFontId) => void
  idPrefix: string
  surface?: 'rail' | 'default'
}) {
  const [open, setOpen] = useState(false)
  const active = getAnnotationTextFont(value)
  const isRail = surface === 'rail'

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          id={`${idPrefix}-text-font`}
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2',
            isRail
              ? 'border border-[#52525b] bg-[#3f3f46] text-[#f4f4f5] hover:bg-[#52525b] focus-visible:ring-[#71717a]'
              : 'border border-[#3d2a1a]/45 bg-[#2a221c] text-[#faf6ef] hover:bg-[#352c24] focus-visible:ring-amber-400/40',
          )}
          aria-label={`Text font: ${active.label}. Click to choose another font.`}
          title={`Font: ${active.label}`}
        >
          <span className="truncate font-medium" style={{ fontFamily: active.cssFamily }}>
            {active.label}
          </span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 opacity-60 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        data-annotation-tool-settings-nested=""
        className={cn(
          isRail
            ? cn(ANNOTATION_CHROME_POPOVER, 'z-[90]')
            : 'z-[90] w-[min(15rem,calc(100vw-2rem))] rounded-xl border border-[#3d2a1a]/45 bg-[#1a1512] p-1.5 text-[#faf6ef] shadow-xl',
          'w-[min(15rem,calc(100vw-2rem))] space-y-0.5 p-1.5',
        )}
      >
        <div role="listbox" aria-label="Text font" className="space-y-0.5">
          {ANNOTATION_TEXT_FONTS_FOR_PICKER.map((font) => {
            const selected = font.id === value
            return (
              <button
                key={font.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  'flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  isRail
                    ? selected
                      ? 'bg-[#52525b] text-[#f4f4f5] ring-1 ring-[#71717a]'
                      : 'text-[#a1a1aa] hover:bg-[#3f3f46] hover:text-[#f4f4f5]'
                    : selected
                      ? 'bg-white/12 text-[#faf6ef] ring-1 ring-amber-400/40'
                      : 'text-[#faf6ef]/85 hover:bg-white/10',
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
