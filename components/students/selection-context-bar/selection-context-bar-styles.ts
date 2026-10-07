import { cn } from '@/lib/utils'
import {
  ANNOTATION_CHROME_CHIP,
  ANNOTATION_CHROME_CHIP_ACTIVE,
  ANNOTATION_CHROME_ICON,
  ANNOTATION_CHROME_POPOVER,
  ANNOTATION_CHROME_SECTION_LABEL,
  ANNOTATION_CHROME_SURFACE_PILL,
} from '@/components/students/annotation-chrome-styles'

/** Solid charcoal pill — same surface as the annotation rail / dock. */
export const SELECTION_CONTEXT_BAR_SURFACE = ANNOTATION_CHROME_SURFACE_PILL

export const SELECTION_CONTEXT_BAR_LAYOUT =
  'flex min-h-9 w-max max-w-[calc(100%-1rem)] flex-nowrap items-center gap-0 overflow-visible px-1.5 py-1'

/** Flat tool cluster — spacing only, no nested chrome. */
export const SELECTION_CONTEXT_BAR_GROUP =
  'flex shrink-0 items-center gap-1 px-0.5 first:pl-0 last:pr-0'

/** Duplicate / delete stay flat like other clusters (no inset capsule). */
export const SELECTION_CONTEXT_BAR_ACTIONS_GROUP = SELECTION_CONTEXT_BAR_GROUP

export const SELECTION_CONTEXT_BAR_DIVIDER =
  'mx-1 h-5 w-px shrink-0 self-center bg-[#3f3f46]'

/** Rail-sized hit target (2rem) with shared chip hover/active language. */
export const SELECTION_CONTEXT_BAR_ACTION_BTN = cn(
  ANNOTATION_CHROME_CHIP,
  'h-8 w-8 rounded-md text-[#a1a1aa]',
  'hover:bg-[#3f3f46] hover:text-[#f4f4f5]',
)

export const SELECTION_CONTEXT_BAR_ACTION_BTN_ACTIVE = ANNOTATION_CHROME_CHIP_ACTIVE

export const SELECTION_CONTEXT_BAR_DELETE_BTN = cn(
  SELECTION_CONTEXT_BAR_ACTION_BTN,
  'hover:bg-red-500/15 hover:text-red-300',
)

/** Palette chevron on the selection context bar. */
export const CONTEXT_PALETTE_CHEVRON_CLASS = cn(
  ANNOTATION_CHROME_CHIP,
  'h-8 w-8 rounded-md text-[#a1a1aa]',
)

export const CONTEXT_PALETTE_CHEVRON_OPEN_CLASS = ANNOTATION_CHROME_CHIP_ACTIVE

/** Floating panel for context bar color / size pickers. */
export const SELECTION_CONTEXT_POPOVER_CONTENT_CLASS = ANNOTATION_CHROME_POPOVER

export const SELECTION_CONTEXT_POPOVER_STACK = 'space-y-2.5'

export const SELECTION_CONTEXT_POPOVER_SECTION_LABEL = ANNOTATION_CHROME_SECTION_LABEL

/** Chip trigger for context bar icon menus — same footprint as action buttons. */
export const SELECTION_CONTEXT_CHIP_TRIGGER = cn(
  ANNOTATION_CHROME_CHIP,
  'h-8 w-8 rounded-md',
)

/** Lucide icons on the selection context bar. */
export const SELECTION_CONTEXT_ICON_CLASS = ANNOTATION_CHROME_ICON
