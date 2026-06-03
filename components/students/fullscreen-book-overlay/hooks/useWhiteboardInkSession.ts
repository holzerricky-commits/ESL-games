'use client'

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useWhiteboardSessionPersistGuards } from '@/components/students/fullscreen-book-overlay/hooks/useWhiteboardSessionPersistGuards'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { getAnnotationsForStorageKey } from '@/lib/books/annotation-storage'
import { WHITEBOARD_SESSION_FLUSH_EVENT } from '@/lib/books/whiteboard-session-events'
import {
  flushWhiteboardSessionDocumentToLegacyStorage,
  resolveWhiteboardSessionCommandsOnMount,
} from '@/lib/books/whiteboard-session-persist'
import { INK_SESSION_AUTOSAVE_MS } from '@/lib/books/ink-session-persist-config'
import type { WhiteboardSessionDocument } from '@/lib/books/whiteboard-session-types'
import {
  createWhiteboardSessionStore,
  type WhiteboardSessionStore,
} from '@/lib/books/whiteboard-session-store'

export type UseWhiteboardInkSessionArgs = {
  enabled: boolean
  studentId: string
  bookId: string | null
  unitId: string | null
  storagePageKey: string | null
  whiteboardSessionStoreRef: MutableRefObject<WhiteboardSessionStore | null>
  onOverlayCaps?: (caps: { canUndo: boolean; canRedo: boolean }) => void
}

export function useWhiteboardInkSession({
  enabled,
  studentId,
  bookId,
  unitId,
  storagePageKey,
  whiteboardSessionStoreRef,
  onOverlayCaps,
}: UseWhiteboardInkSessionArgs) {
  const [whiteboardSessionDoc, setWhiteboardSessionDoc] = useState<WhiteboardSessionDocument | null>(null)
  const whiteboardSessionDocRef = useRef<WhiteboardSessionDocument | null>(null)
  const sessionKeyRef = useRef<string | null>(null)

  const flushWhiteboardSessionToLegacy = useCallback(() => {
    const doc = whiteboardSessionDocRef.current
    const key = sessionKeyRef.current
    if (!doc || !key || !bookId || !unitId) return
    flushWhiteboardSessionDocumentToLegacyStorage({
      doc,
      studentId,
      bookId,
      unitId,
      storagePageKey: key,
    })
    whiteboardSessionStoreRef.current?.markClean()
    whiteboardSessionStoreRef.current?.checkpointNow()
  }, [bookId, studentId, unitId, whiteboardSessionStoreRef])

  const checkpointWhiteboardSession = useCallback(() => {
    whiteboardSessionStoreRef.current?.checkpointNow()
  }, [whiteboardSessionStoreRef])

  useWhiteboardSessionPersistGuards({
    enabled,
    checkpointWhiteboardSession,
    flushWhiteboardSessionToLegacy,
  })

  useEffect(() => {
    if (!enabled) return
    const onFlush = () => flushWhiteboardSessionToLegacy()
    window.addEventListener(WHITEBOARD_SESSION_FLUSH_EVENT, onFlush)
    return () => window.removeEventListener(WHITEBOARD_SESSION_FLUSH_EVENT, onFlush)
  }, [enabled, flushWhiteboardSessionToLegacy])

  useEffect(() => {
    if (!enabled || !bookId || !unitId) {
      setWhiteboardSessionDoc(null)
      whiteboardSessionDocRef.current = null
      sessionKeyRef.current = null
      return
    }

    const trimmedKey = storagePageKey?.trim() ?? ''
    if (!trimmedKey) {
      setWhiteboardSessionDoc(null)
      whiteboardSessionDocRef.current = null
      sessionKeyRef.current = null
      return
    }

    sessionKeyRef.current = trimmedKey
    const sessionKey = { studentId, bookId, unitId, storagePageKey: trimmedKey }
    const store = createWhiteboardSessionStore(sessionKey, { autosaveMs: INK_SESSION_AUTOSAVE_MS })
    whiteboardSessionStoreRef.current = store

    const legacy = getAnnotationsForStorageKey(studentId, bookId, unitId, trimmedKey)
    const commands = resolveWhiteboardSessionCommandsOnMount(store.getState().doc.commands, legacy)
    store.syncCommands(commands)
    store.markClean()
    store.checkpointNow()

    const initialState = store.getState()
    setWhiteboardSessionDoc(initialState.doc)
    whiteboardSessionDocRef.current = initialState.doc
    onOverlayCaps?.({
      canUndo: initialState.canUndo,
      canRedo: initialState.canRedo,
    })

    const unsub = store.subscribe((state) => {
      setWhiteboardSessionDoc(state.doc)
      whiteboardSessionDocRef.current = state.doc
      onOverlayCaps?.({
        canUndo: state.canUndo,
        canRedo: state.canRedo,
      })
    })

    return () => {
      unsub()
      const doc = whiteboardSessionDocRef.current
      if (doc) {
        store.checkpointNow()
        flushWhiteboardSessionDocumentToLegacyStorage({
          doc,
          studentId,
          bookId,
          unitId,
          storagePageKey: trimmedKey,
        })
      }
      store.destroy()
      if (whiteboardSessionStoreRef.current === store) {
        whiteboardSessionStoreRef.current = null
      }
      whiteboardSessionDocRef.current = null
      sessionKeyRef.current = null
      setWhiteboardSessionDoc(null)
    }
  }, [
    bookId,
    enabled,
    onOverlayCaps,
    storagePageKey,
    studentId,
    unitId,
    whiteboardSessionStoreRef,
  ])

  const appendWhiteboardSessionCommand = useCallback(
    (cmd: AnnotationCommand) => {
      whiteboardSessionStoreRef.current?.appendCommand(cmd)
    },
    [whiteboardSessionStoreRef],
  )

  const whiteboardSessionUndo = useCallback(
    () => whiteboardSessionStoreRef.current?.undo() ?? false,
    [whiteboardSessionStoreRef],
  )

  const whiteboardSessionRedo = useCallback(
    () => whiteboardSessionStoreRef.current?.redo() ?? false,
    [whiteboardSessionStoreRef],
  )

  const whiteboardSessionClear = useCallback(() => {
    whiteboardSessionStoreRef.current?.clearCommands()
  }, [whiteboardSessionStoreRef])

  return {
    whiteboardSessionDoc,
    flushWhiteboardSessionToLegacy,
    appendWhiteboardSessionCommand,
    whiteboardSessionUndo,
    whiteboardSessionRedo,
    whiteboardSessionClear,
  }
}
