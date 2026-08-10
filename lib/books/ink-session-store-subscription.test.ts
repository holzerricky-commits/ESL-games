import { describe, expect, it } from 'vitest'
import { createInkSessionStore } from '@/lib/books/ink-session-store'
import type { InkSessionDocument } from '@/lib/books/ink-session-types'
import {
  pickInkSessionStoreUiSnapshot,
  subscribeInkSessionStoreUi,
  whiteboardSessionStructureKey,
} from '@/lib/books/ink-session-store-subscription'

function emptyDoc(): InkSessionDocument {
  return {
    docId: 'test',
    commands: [],
    meta: { revision: 0, dirty: false, updatedAt: 0 },
  }
}

describe('pickInkSessionStoreUiSnapshot', () => {
  it('reads revision from doc meta', () => {
    const store = createInkSessionStore({
      loadInitialDoc: () => emptyDoc(),
      saveCheckpoint: () => {},
      persistEnabled: false,
    })
    expect(pickInkSessionStoreUiSnapshot(store.getState()).revision).toBe(0)
  })
})

describe('subscribeInkSessionStoreUi', () => {
  it('fires when revision changes', () => {
    const store = createInkSessionStore({
      loadInitialDoc: () => emptyDoc(),
      saveCheckpoint: () => {},
      persistEnabled: false,
    })
    const docRef = { current: null as InkSessionDocument | null }
    const revisions: number[] = []
    const unsub = subscribeInkSessionStoreUi(store, docRef, (snap) => {
      revisions.push(snap.revision)
    })
    store.appendCommand({
      kind: 'stroke',
      id: 's1',
      tool: 'pen',
      points: [
        [0, 0],
        [0.1, 0.1],
      ],
    })
    unsub()
    expect(revisions).toEqual([1])
    expect(docRef.current?.commands).toHaveLength(1)
  })

  it('does not fire when selection unchanged', () => {
    const store = createInkSessionStore({
      loadInitialDoc: () => emptyDoc(),
      saveCheckpoint: () => {},
      persistEnabled: false,
    })
    store.appendCommand({
      kind: 'stroke',
      id: 's1',
      tool: 'pen',
      points: [
        [0, 0],
        [0.1, 0.1],
      ],
    })
    const docRef = { current: null as InkSessionDocument | null }
    let calls = 0
    const unsub = subscribeInkSessionStoreUi(store, docRef, () => {
      calls++
    })
    const afterAppend = calls
    store.setSelectedIds(['s1'])
    expect(calls).toBe(afterAppend + 1)
    store.setSelectedIds(['s1'])
    unsub()
    expect(calls).toBe(afterAppend + 1)
  })
})

describe('whiteboardSessionStructureKey', () => {
  it('changes when active page changes', () => {
    const a = whiteboardSessionStructureKey({
      activePageId: 'p1',
      pages: [{ id: 'p1' }],
    })
    const b = whiteboardSessionStructureKey({
      activePageId: 'p2',
      pages: [{ id: 'p1' }, { id: 'p2' }],
    })
    expect(a).not.toBe(b)
  })
})
