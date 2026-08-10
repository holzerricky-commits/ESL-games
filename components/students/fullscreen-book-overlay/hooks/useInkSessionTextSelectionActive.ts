'use client'

import { useSyncExternalStore } from 'react'
import type { MutableRefObject } from 'react'
import type { InkSessionState } from '@/lib/books/ink-session-store'
import {
  isMarkerStrokeOnlySelection,
  isPenStrokeOnlySelection,
  isShapeOnlySelection,
  isStickyOnlySelection,
  isTextOnlySelection,
  type SelectionContextKind,
} from '@/lib/books/selection-context'

type SubscribableStore = {
  subscribe: (listener: () => void) => () => void
  getState: () => Pick<InkSessionState, 'doc' | 'selectedIds'>
}

function isKindOnlySelection(
  commands: InkSessionState['doc']['commands'],
  selectedIds: readonly string[],
  kind: Extract<SelectionContextKind, 'text' | 'sticky' | 'shape'>,
): boolean {
  if (kind === 'text') return isTextOnlySelection(commands, selectedIds)
  if (kind === 'sticky') return isStickyOnlySelection(commands, selectedIds)
  return isShapeOnlySelection(commands, selectedIds)
}

/** True while the active ink session has only text labels selected (for top-bar handoff). */
export function useInkSessionTextSelectionActive(
  storeRef: MutableRefObject<SubscribableStore | null> | undefined,
  enabled: boolean,
): boolean {
  return useInkSessionKindSelectionActive(storeRef, enabled, 'text')
}

/** True while the active ink session has only stickies selected (for top-bar handoff). */
export function useInkSessionStickySelectionActive(
  storeRef: MutableRefObject<SubscribableStore | null> | undefined,
  enabled: boolean,
): boolean {
  return useInkSessionKindSelectionActive(storeRef, enabled, 'sticky')
}

/** True while the active ink session has only shapes selected (for top-bar handoff). */
export function useInkSessionShapeSelectionActive(
  storeRef: MutableRefObject<SubscribableStore | null> | undefined,
  enabled: boolean,
): boolean {
  return useInkSessionKindSelectionActive(storeRef, enabled, 'shape')
}

/** True while only pen strokes are selected (pen top-bar handoff). */
export function useInkSessionPenStrokeSelectionActive(
  storeRef: MutableRefObject<SubscribableStore | null> | undefined,
  enabled: boolean,
): boolean {
  return useInkSessionStrokeSelectionActive(storeRef, enabled, isPenStrokeOnlySelection)
}

/** True while only marker strokes are selected (marker top-bar handoff). */
export function useInkSessionMarkerStrokeSelectionActive(
  storeRef: MutableRefObject<SubscribableStore | null> | undefined,
  enabled: boolean,
): boolean {
  return useInkSessionStrokeSelectionActive(storeRef, enabled, isMarkerStrokeOnlySelection)
}

function useInkSessionStrokeSelectionActive(
  storeRef: MutableRefObject<SubscribableStore | null> | undefined,
  enabled: boolean,
  predicate: (
    commands: InkSessionState['doc']['commands'],
    selectedIds: readonly string[],
  ) => boolean,
): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const store = storeRef?.current
      if (!store || !enabled) return () => {}
      return store.subscribe(onStoreChange)
    },
    () => {
      const store = storeRef?.current
      if (!store || !enabled) return false
      const { doc, selectedIds } = store.getState()
      return predicate(doc.commands, selectedIds)
    },
    () => false,
  )
}

export function useInkSessionKindSelectionActive(
  storeRef: MutableRefObject<SubscribableStore | null> | undefined,
  enabled: boolean,
  kind: Extract<SelectionContextKind, 'text' | 'sticky' | 'shape'>,
): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const store = storeRef?.current
      if (!store || !enabled) return () => {}
      return store.subscribe(onStoreChange)
    },
    () => {
      const store = storeRef?.current
      if (!store || !enabled) return false
      const { doc, selectedIds } = store.getState()
      return isKindOnlySelection(doc.commands, selectedIds, kind)
    },
    () => false,
  )
}
