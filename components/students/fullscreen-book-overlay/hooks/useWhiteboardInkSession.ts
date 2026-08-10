'use client'

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useWhiteboardSessionPersistGuards } from '@/components/students/fullscreen-book-overlay/hooks/useWhiteboardSessionPersistGuards'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  getAnnotationsForStorageKey,
  setAnnotationsForStorageKey,
} from '@/lib/books/annotation-storage'
import { legacyStorageCommandsWithoutDelegatedInk } from '@/lib/books/whiteboard-session-hydrate'
import { lessonBoardPageStorageKey } from '@/lib/books/lesson-board-session-ops'
import { WHITEBOARD_SESSION_FLUSH_EVENT } from '@/lib/books/whiteboard-session-events'
import {
  flushWhiteboardSessionDocumentToLegacyStorage,
  lessonBoardSessionInkChanged,
  mergeLegacyInkIntoLessonBoardSession,
} from '@/lib/books/whiteboard-session-persist'
import { INK_SESSION_AUTOSAVE_MS } from '@/lib/books/ink-session-persist-config'
import { inkSessionReactBoundaryEnabled } from '@/lib/books/feature-flags'
import {
  whiteboardSessionStructureKey,
} from '@/lib/books/ink-session-store-subscription'
import type { WhiteboardSessionDocument } from '@/lib/books/whiteboard-session-types'
import type { SelectionMoveClampContext } from '@/lib/books/annotation-scale'
import {
  createWhiteboardSessionStore,
  type WhiteboardSessionStore,
} from '@/lib/books/whiteboard-session-store'
import { invalidateWhiteboardSessionRootCache } from '@/lib/books/whiteboard-session-storage'
import {
  BOOK_ANNOTATIONS_HYDRATED_EVENT,
  ensureBookAnnotationsHydrated,
  isBookAnnotationsDiskActive,
} from '@/lib/local-data/book-annotations-disk-client'

export type UseWhiteboardInkSessionArgs = {
  enabled: boolean
  studentId: string
  bookId: string | null
  unitId: string | null
  storagePageKey: string | null
  /** Local + legacy class keys tried on reload so older session boards can migrate in. */
  storagePageKeyCandidates?: readonly string[]
  whiteboardSessionStoreRef: MutableRefObject<WhiteboardSessionStore | null>
  selectionMoveClampRef?: MutableRefObject<SelectionMoveClampContext | null>
  onOverlayCaps?: (caps: { canUndo: boolean; canRedo: boolean }) => void
}

export function useWhiteboardInkSession({
  enabled,
  studentId,
  bookId,
  unitId,
  storagePageKey,
  storagePageKeyCandidates,
  whiteboardSessionStoreRef,
  selectionMoveClampRef,
  onOverlayCaps,
}: UseWhiteboardInkSessionArgs) {
  const [whiteboardSessionDoc, setWhiteboardSessionDoc] = useState<WhiteboardSessionDocument | null>(null)
  const whiteboardSessionDocRef = useRef<WhiteboardSessionDocument | null>(null)
  const [whiteboardInkRevision, setWhiteboardInkRevision] = useState(0)
  const sessionKeyRef = useRef<string | null>(null)
  const [annotationsStorageReady, setAnnotationsStorageReady] = useState(() =>
    typeof window === 'undefined' ? false : isBookAnnotationsDiskActive(),
  )
  const [annotationsStorageEpoch, setAnnotationsStorageEpoch] = useState(0)

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
    let cancelled = false

    const markReady = () => {
      if (cancelled) return
      invalidateWhiteboardSessionRootCache()
      setAnnotationsStorageReady(true)
      setAnnotationsStorageEpoch((n) => n + 1)
    }

    if (isBookAnnotationsDiskActive()) {
      setAnnotationsStorageReady(true)
    } else {
      void ensureBookAnnotationsHydrated().then((ok) => {
        if (cancelled || ok) return
        // Hydrate failed — allow browser fallback without waiting forever.
        invalidateWhiteboardSessionRootCache()
        setAnnotationsStorageReady(true)
        setAnnotationsStorageEpoch((n) => n + 1)
      })
    }

    window.addEventListener(BOOK_ANNOTATIONS_HYDRATED_EVENT, markReady)
    return () => {
      cancelled = true
      window.removeEventListener(BOOK_ANNOTATIONS_HYDRATED_EVENT, markReady)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !annotationsStorageReady || !bookId || !unitId) {
      setWhiteboardSessionDoc(null)
      setWhiteboardInkRevision(0)
      whiteboardSessionDocRef.current = null
      sessionKeyRef.current = null
      return
    }

    const trimmedKey = storagePageKey?.trim() ?? ''
    if (!trimmedKey) {
      setWhiteboardSessionDoc(null)
      setWhiteboardInkRevision(0)
      whiteboardSessionDocRef.current = null
      sessionKeyRef.current = null
      return
    }

    sessionKeyRef.current = trimmedKey
    const sessionKey = { studentId, bookId, unitId, storagePageKey: trimmedKey }
    const candidates =
      storagePageKeyCandidates?.length
        ? storagePageKeyCandidates
        : [trimmedKey]
    const store = createWhiteboardSessionStore(sessionKey, {
      autosaveMs: INK_SESSION_AUTOSAVE_MS,
      storageKeyCandidates: candidates,
      getSelectionMoveClamp: () => selectionMoveClampRef?.current ?? null,
    })
    whiteboardSessionStoreRef.current = store

    const legacy = getAnnotationsForStorageKey(studentId, bookId, unitId, trimmedKey)
    const docBeforeMerge = store.getState().doc
    const mergedDoc = mergeLegacyInkIntoLessonBoardSession(docBeforeMerge, legacy)
    store.replaceDoc(mergedDoc)
    store.markClean()
    if (lessonBoardSessionInkChanged(docBeforeMerge, mergedDoc)) {
      store.checkpointNow()
    }

    const docAfterInk = store.getState().doc
    const firstPage = docAfterInk.pages[0]
    if (firstPage) {
      const pageKey = lessonBoardPageStorageKey(trimmedKey, firstPage.id)
      if (pageKey !== trimmedKey) {
        const legacyPageLayer = getAnnotationsForStorageKey(studentId, bookId, unitId, trimmedKey)
        const pageLayer = getAnnotationsForStorageKey(studentId, bookId, unitId, pageKey)
        const legacyDom = legacyStorageCommandsWithoutDelegatedInk(legacyPageLayer)
        if (legacyDom.length > 0 && pageLayer.length === 0) {
          setAnnotationsForStorageKey(studentId, bookId, unitId, pageKey, legacyDom)
        }
      }
    }

    const initialState = store.getState()
    if (inkSessionReactBoundaryEnabled) {
      whiteboardSessionDocRef.current = initialState.doc
      setWhiteboardSessionDoc(initialState.doc)
      setWhiteboardInkRevision(initialState.doc.meta.revision)
    } else {
      setWhiteboardSessionDoc(initialState.doc)
      whiteboardSessionDocRef.current = initialState.doc
    }
    onOverlayCaps?.({
      canUndo: initialState.canUndo,
      canRedo: initialState.canRedo,
    })

    let lastOverlayCaps = {
      canUndo: initialState.canUndo,
      canRedo: initialState.canRedo,
    }
    let lastStructureKey = whiteboardSessionStructureKey(initialState.doc)
    let lastInkRevision = initialState.doc.meta.revision
    const unsub = inkSessionReactBoundaryEnabled
      ? store.subscribe((state) => {
          whiteboardSessionDocRef.current = state.doc
          const nextStructureKey = whiteboardSessionStructureKey(state.doc)
          if (nextStructureKey !== lastStructureKey) {
            lastStructureKey = nextStructureKey
            setWhiteboardSessionDoc(state.doc)
          }
          if (state.doc.meta.revision !== lastInkRevision) {
            lastInkRevision = state.doc.meta.revision
            setWhiteboardInkRevision(lastInkRevision)
          }
          if (
            state.canUndo !== lastOverlayCaps.canUndo ||
            state.canRedo !== lastOverlayCaps.canRedo
          ) {
            lastOverlayCaps = { canUndo: state.canUndo, canRedo: state.canRedo }
            onOverlayCaps?.(lastOverlayCaps)
          }
        })
      : store.subscribe((state) => {
          setWhiteboardSessionDoc(state.doc)
          whiteboardSessionDocRef.current = state.doc
          if (
            state.canUndo !== lastOverlayCaps.canUndo ||
            state.canRedo !== lastOverlayCaps.canRedo
          ) {
            lastOverlayCaps = { canUndo: state.canUndo, canRedo: state.canRedo }
            onOverlayCaps?.(lastOverlayCaps)
          }
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
      setWhiteboardInkRevision(0)
    }
  }, [
    annotationsStorageEpoch,
    annotationsStorageReady,
    bookId,
    enabled,
    onOverlayCaps,
    storagePageKey,
    storagePageKeyCandidates,
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

  const appendLessonBoardPage = useCallback(
    (options?: {
      orientation?: import('@/lib/books/lesson-board-types').LessonBoardPageOrientation
      viewportHeightPx?: number
      slotWidthPx?: number
      spreadWidthPx?: number
      bookPageHint?: number
    }) => {
      whiteboardSessionStoreRef.current?.appendLessonBoardPage(options)
    },
    [whiteboardSessionStoreRef],
  )

  const setActiveLessonBoardPage = useCallback(
    (pageId: string) => whiteboardSessionStoreRef.current?.setActiveLessonBoardPage(pageId) ?? false,
    [whiteboardSessionStoreRef],
  )

  const goToAdjacentLessonBoardPage = useCallback(
    (delta: -1 | 1) => whiteboardSessionStoreRef.current?.goToAdjacentLessonBoardPage(delta) ?? false,
    [whiteboardSessionStoreRef],
  )

  const setActiveLessonBoardContentHeightPx = useCallback(
    (heightPx: number) => {
      whiteboardSessionStoreRef.current?.setActiveLessonBoardContentHeightPx(heightPx)
    },
    [whiteboardSessionStoreRef],
  )

  const extendActiveLessonBoardRunway = useCallback(
    (viewportHeightPx: number) => {
      whiteboardSessionStoreRef.current?.extendActiveLessonBoardRunway(viewportHeightPx)
    },
    [whiteboardSessionStoreRef],
  )

  const setLessonBoardPageTitle = useCallback(
    (pageId: string, title: string | undefined) =>
      whiteboardSessionStoreRef.current?.setLessonBoardPageTitle(pageId, title) ?? false,
    [whiteboardSessionStoreRef],
  )

  const deleteLessonBoardPage = useCallback(
    (pageId: string) => whiteboardSessionStoreRef.current?.deleteLessonBoardPage(pageId) ?? false,
    [whiteboardSessionStoreRef],
  )

  const setLessonBoardPageBookPageHint = useCallback(
    (pageId: string, bookPageHint: number) =>
      whiteboardSessionStoreRef.current?.setLessonBoardPageBookPageHint(pageId, bookPageHint) ?? false,
    [whiteboardSessionStoreRef],
  )

  return {
    whiteboardSessionDoc,
    whiteboardInkRevision,
    flushWhiteboardSessionToLegacy,
    appendWhiteboardSessionCommand,
    whiteboardSessionUndo,
    whiteboardSessionRedo,
    whiteboardSessionClear,
    appendLessonBoardPage,
    setActiveLessonBoardPage,
    goToAdjacentLessonBoardPage,
    setActiveLessonBoardContentHeightPx,
    extendActiveLessonBoardRunway,
    setLessonBoardPageTitle,
    deleteLessonBoardPage,
    setLessonBoardPageBookPageHint,
  }
}
