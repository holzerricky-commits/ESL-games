import { describe, expect, it } from 'vitest'
import {
  applySelectionChange,
  applyShiftClickSelection,
  selectNextStackId,
  selectionChangeModeFromPointerKeys,
} from '@/lib/books/annotation-selection-ops'

describe('annotation-selection-ops', () => {
  it('resolves pointer modifier priority alt > shift > ctrl', () => {
    expect(
      selectionChangeModeFromPointerKeys({
        altKey: true,
        shiftKey: true,
        ctrlKey: true,
        metaKey: false,
      }),
    ).toBe('subtract')
    expect(
      selectionChangeModeFromPointerKeys({
        altKey: false,
        shiftKey: true,
        ctrlKey: true,
        metaKey: false,
      }),
    ).toBe('shiftClick')
    expect(
      selectionChangeModeFromPointerKeys({
        altKey: false,
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
      }),
    ).toBe('toggle')
    expect(
      selectionChangeModeFromPointerKeys({
        altKey: false,
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      }),
    ).toBe('replace')
  })

  it('shift click adds then removes the same targets', () => {
    expect(applyShiftClickSelection([], ['a'])).toEqual(['a'])
    expect(applyShiftClickSelection(['a', 'b'], ['a'])).toEqual(['b'])
    expect(applyShiftClickSelection(['a'], ['a', 'b'])).toEqual(['a', 'b'])
    expect(applyShiftClickSelection(['a', 'b'], ['a', 'b'])).toEqual([])
  })

  it('applySelectionChange unions, subtracts, and toggles', () => {
    expect(applySelectionChange(['a'], ['b'], 'replace')).toEqual(['b'])
    expect(applySelectionChange(['a'], ['b'], 'add')).toEqual(['a', 'b'])
    expect(applySelectionChange(['a', 'b'], ['b'], 'subtract')).toEqual(['a'])
    expect(applySelectionChange(['a'], ['a', 'b'], 'toggle')).toEqual(['b'])
  })

  it('selectNextStackId cycles live commands', () => {
    const commands = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const dead = new Set<number>()
    expect(selectNextStackId(commands, [], 1, dead)).toBe('a')
    expect(selectNextStackId(commands, ['a'], 1, dead)).toBe('b')
    expect(selectNextStackId(commands, ['c'], 1, dead)).toBe('a')
    expect(selectNextStackId(commands, ['b'], -1, dead)).toBe('a')
  })
})
