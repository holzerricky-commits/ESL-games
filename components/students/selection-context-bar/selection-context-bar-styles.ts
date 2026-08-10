import { cn } from '@/lib/utils'
import {
  ANNOTATION_CHROME_CHIP,
  ANNOTATION_CHROME_CHIP_ACTIVE,
  ANNOTATION_CHROME_ICON,
  ANNOTATION_CHROME_POPOVER,
  ANNOTATION_CHROME_SECTION_LABEL,
  ANNOTATION_CHROME_SURFACE_PILL,
} from '@/components/students/annotation-chrome-styles'

/** Solid charcoal pill — matches the right-side annotation dock. */
export const SELECTION_CONTEXT_BAR_SURFACE = ANNOTATION_CHROME_SURFACE_PILL

export const SELECTION_CONTEXT_BAR_LAYOUT =
  'flex min-h-10 w-max max-w-[calc(100%-1rem)] flex-nowrap items-center gap-0 overflow-visible px-2 py-1.5'

/** Flat tool cluster — no nested box, spacing only. */
export const SELECTION_CONTEXT_BAR_GROUP =
  'flex shrink-0 items-center gap-1.5 px-1 first:pl-0.5 last:pr-0.5'

/** Duplicate / delete (and group) sit in a solid inset capsule. */
export const SELECTION_CONTEXT_BAR_ACTIONS_GROUP = cn(
  'flex shrink-0 items-center gap-0.5 rounded-xl border border-[#3f3f46] bg-[#353539] px-1 py-0.5',
)

export const SELECTION_CONTEXT_BAR_DIVIDER =
  'mx-1.5 h-6 w-px shrink-0 self-center bg-[#3f3f46]'

export const SELECTION_CONTEXT_BAR_ACTION_BTN = cn(
  ANNOTATION_CHROME_CHIP,
  'h-8 w-8 rounded-lg text-[#a1a1aa]',
  'hover:text-[#f4f4f5]',
)

export const SELECTION_CONTEXT_BAR_ACTION_BTN_ACTIVE = ANNOTATION_CHROME_CHIP_ACTIVE

export const SELECTION_CONTEXT_BAR_DELETE_BTN = cn(
  SELECTION_CONTEXT_BAR_ACTION_BTN,
  'hover:bg-red-500/20 hover:text-red-300 hover:shadow-none',
)

/** Palette chevron on the selection context bar. */
export const CONTEXT_PALETTE_CHEVRON_CLASS = cn(
  ANNOTATION_CHROME_CHIP,
  'h-7 w-7 text-[#a1a1aa]',
)

export const CONTEXT_PALETTE_CHEVRON_OPEN_CLASS = 'bg-[#3f3f46] text-[#f4f4f5]'

/** Floating panel for context bar color / size pickers. */
export const SELECTION_CONTEXT_POPOVER_CONTENT_CLASS = ANNOTATION_CHROME_POPOVER

export const SELECTION_CONTEXT_POPOVER_STACK = 'space-y-2.5'

export const SELECTION_CONTEXT_POPOVER_SECTION_LABEL = ANNOTATION_CHROME_SECTION_LABEL

/** Chip trigger for context bar icon menus. */
export const SELECTION_CONTEXT_CHIP_TRIGGER = ANNOTATION_CHROME_CHIP

/** Lucide icons on the selection context bar. */
export const SELECTION_CONTEXT_ICON_CLASS = ANNOTATION_CHROME_ICON
