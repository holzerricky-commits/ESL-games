/** How a select click or marquee should change the current selection. */
export type SelectionChangeMode = 'replace' | 'add' | 'subtract' | 'toggle' | 'shiftClick'

/** Alt → subtract, Shift → add/remove click, Ctrl/Meta → toggle; replace when none. */
export function selectionChangeModeFromPointerKeys(keys: {
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}): SelectionChangeMode {
  if (keys.altKey) return 'subtract'
  if (keys.shiftKey) return 'shiftClick'
  if (keys.ctrlKey || keys.metaKey) return 'toggle'
  return 'replace'
}

/** Shift+click: add target ids unless all are already selected, then remove them. */
export function applyShiftClickSelection(
  current: readonly string[],
  incoming: readonly string[],
): string[] {
  const cur = new Set(current)
  const inc = [...incoming]
  if (inc.length === 0) return [...cur]
  const allIn = inc.every((id) => cur.has(id))
  if (allIn) {
    for (const id of inc) cur.delete(id)
  } else {
    for (const id of inc) cur.add(id)
  }
  return [...cur]
}

export function applySelectionChange(
  current: readonly string[],
  incoming: readonly string[],
  mode: SelectionChangeMode,
): string[] {
  if (mode === 'replace') return [...incoming]
  const cur = new Set(current)
  const inc = new Set(incoming)
  if (mode === 'shiftClick') {
    return applyShiftClickSelection(current, incoming)
  }
  if (mode === 'add') {
    for (const id of inc) cur.add(id)
    return [...cur]
  }
  if (mode === 'subtract') {
    for (const id of inc) cur.delete(id)
    return [...cur]
  }
  for (const id of inc) {
    if (cur.has(id)) cur.delete(id)
    else cur.add(id)
  }
  return [...cur]
}

/** Command indices that are not erased-dead. */
export function liveCommandIndices(commands: readonly { id: string }[], deadIndices: ReadonlySet<number>): number[] {
  const out: number[] = []
  for (let i = 0; i < commands.length; i++) {
    if (!deadIndices.has(i)) out.push(i)
  }
  return out
}

/**
 * Next id when cycling the stack with Tab (+1) / Shift+Tab (-1).
 * Uses the topmost index among the current selection as the anchor.
 */
export function selectNextStackId(
  commands: readonly { id: string }[],
  selectedIds: readonly string[],
  direction: 1 | -1,
  deadIndices: ReadonlySet<number>,
): string | null {
  const live = liveCommandIndices(commands, deadIndices)
  if (live.length === 0) return null

  let anchor = -1
  for (const id of selectedIds) {
    const i = commands.findIndex((c) => c.id === id)
    if (i >= 0) anchor = Math.max(anchor, i)
  }

  if (anchor < 0) {
    const idx = direction === 1 ? live[0]! : live[live.length - 1]!
    return commands[idx]!.id
  }

  const pos = live.indexOf(anchor)
  const nextPos =
    pos < 0
      ? direction === 1
        ? 0
        : live.length - 1
      : (pos + direction + live.length) % live.length
  return commands[live[nextPos]!]!.id
}
