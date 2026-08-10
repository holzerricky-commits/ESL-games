export const CLASS_TOOLBOX_TOOL_IDS = ['coin', 'dice', 'countdown', 'stopwatch'] as const

export type ClassToolboxToolId = (typeof CLASS_TOOLBOX_TOOL_IDS)[number]

export type ClassToolboxToolMeta = {
  id: ClassToolboxToolId
  label: string
  /** Short line for the menu grid. */
  blurb: string
}

/** v1 catalog — behavior ships in later phases; shell lists these now. */
export const CLASS_TOOLBOX_TOOLS: readonly ClassToolboxToolMeta[] = [
  { id: 'coin', label: 'Coin flip', blurb: 'Heads or tails' },
  { id: 'dice', label: 'Dice', blurb: 'Roll one or more dice' },
  { id: 'countdown', label: 'Timer', blurb: 'Set time & go' },
  { id: 'stopwatch', label: 'Stopwatch', blurb: 'Free timing' },
]

export function getClassToolboxToolMeta(id: ClassToolboxToolId): ClassToolboxToolMeta {
  const found = CLASS_TOOLBOX_TOOLS.find((tool) => tool.id === id)
  if (!found) {
    throw new Error(`Unknown class toolbox tool: ${id}`)
  }
  return found
}
