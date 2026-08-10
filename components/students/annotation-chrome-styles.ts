import { cn } from '@/lib/utils'



/** Shared solid charcoal surface for annotation chrome (toolbox panels, selection bar, popovers). */

export const ANNOTATION_CHROME_SURFACE_BASE = cn(

  'border-[#3f3f46] bg-[#2a2a2e] text-[#a1a1aa]',

  'shadow-[0_4px_16px_rgba(0,0,0,0.35)]',

)



/** Drawboard-style tool settings panel opened from the vertical rail. */

export const ANNOTATION_TOOL_SETTINGS_PANEL = cn(

  ANNOTATION_CHROME_SURFACE_BASE,

  'z-[80] w-[min(22rem,calc(100vw-4rem))] min-w-0 overflow-x-hidden',

  'rounded-xl border p-3 text-[#d4d4d8]',

  'outline-hidden',

  'data-[state=open]:animate-in data-[state=closed]:animate-out',

  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',

  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',

  'data-[state=open]:duration-200 data-[state=closed]:duration-150',

  'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',

  'data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2',

)



/** Floating pill anchored near canvas selection. */

export const ANNOTATION_CHROME_SURFACE_PILL = cn(

  ANNOTATION_CHROME_SURFACE_BASE,

  'rounded-2xl border',

)



/** Popovers opened from annotation chrome controls. */

export const ANNOTATION_CHROME_POPOVER = cn(

  ANNOTATION_CHROME_SURFACE_BASE,

  'z-[80] w-auto min-w-[10rem] max-w-[min(20rem,calc(100vw-2rem))]',

  'rounded-xl border p-2.5 text-[#d4d4d8]',

  'outline-hidden',

  'data-[state=open]:animate-in data-[state=closed]:animate-out',

  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',

  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',

  'data-[state=open]:duration-200 data-[state=closed]:duration-150',

  'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',

  'data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2',

)



export const ANNOTATION_CHROME_CHIP = cn(

  'flex h-7 w-8 shrink-0 items-center justify-center rounded-lg',

  'text-[#a1a1aa] transition-colors',

  'hover:bg-[#3f3f46] hover:text-[#f4f4f5]',

  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a]',

)



export const ANNOTATION_CHROME_CHIP_ACTIVE = 'bg-[#52525b] text-[#f4f4f5] ring-1 ring-[#71717a]'



export const ANNOTATION_CHROME_ICON = 'h-[18px] w-[18px] shrink-0 text-[#f4f4f5]'



export const ANNOTATION_CHROME_SECTION_LABEL =

  'text-[10px] font-semibold uppercase tracking-wide text-[#71717a]'


