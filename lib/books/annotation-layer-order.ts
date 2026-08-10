import type { AnnotationCommand } from '@/lib/books/annotation-command-types'

/** Move selected commands one step in paint order (later index = on top). */
export function moveCommandsInStack(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  direction: 1 | -1,
): AnnotationCommand[] {
  if (selectedIds.length === 0) return [...commands]
  const selectedSet = new Set(selectedIds)
  const list = [...commands]

  const selectedIndices: number[] = []
  for (let i = 0; i < list.length; i++) {
    if (selectedSet.has(list[i]!.id)) selectedIndices.push(i)
  }
  if (selectedIndices.length === 0) return list

  const block = selectedIndices.map((i) => list[i]!)
  const withoutBlock = list.filter((c) => !selectedSet.has(c.id))

  if (direction === 1) {
    const lastIdx = selectedIndices[selectedIndices.length - 1]!
    let neighborIdx = lastIdx + 1
    while (neighborIdx < list.length && selectedSet.has(list[neighborIdx]!.id)) {
      neighborIdx++
    }
    if (neighborIdx >= list.length) return list
    const above = list[neighborIdx]!
    const aboveIdxInRemaining = withoutBlock.findIndex((c) => c.id === above.id)
    if (aboveIdxInRemaining < 0) return list
    return [
      ...withoutBlock.slice(0, aboveIdxInRemaining + 1),
      ...block,
      ...withoutBlock.slice(aboveIdxInRemaining + 1),
    ]
  }

  const firstIdx = selectedIndices[0]!
  let neighborIdx = firstIdx - 1
  while (neighborIdx >= 0 && selectedSet.has(list[neighborIdx]!.id)) {
    neighborIdx--
  }
  if (neighborIdx < 0) return list
  const below = list[neighborIdx]!
  const belowIdxInRemaining = withoutBlock.findIndex((c) => c.id === below.id)
  if (belowIdxInRemaining < 0) return list
  return [
    ...withoutBlock.slice(0, belowIdxInRemaining),
    ...block,
    ...withoutBlock.slice(belowIdxInRemaining),
  ]
}
