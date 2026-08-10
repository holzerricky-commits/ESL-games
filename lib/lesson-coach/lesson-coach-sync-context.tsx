'use client'



import {

  createContext,

  useCallback,

  useContext,

  useEffect,

  useMemo,

  useRef,

  useState,

  type ReactNode,

} from 'react'

import type { GrammarIssue, LessonCoachSession, LessonCoachSessionPatch } from '@/lib/lesson-coach/types'

import { toGrammarCheckPatch } from '@/lib/lesson-coach/grammar-check'

import { fetchGrammarCheck } from '@/lib/lesson-coach/fetch-grammar-check'

import { getActiveRevealIssue } from '@/lib/lesson-coach/issue-reveal'

import {

  setCoachAnnotationGestureActive,

  setCoachTextFieldFocused,

} from '@/lib/lesson-coach/overlay-busy'

import { shouldApplyRemoteSharedText } from '@/lib/lesson-coach/should-apply-remote-text'

import { useLessonCoachSession } from '@/lib/lesson-coach/use-lesson-coach-session'



const SHARED_TEXT_DEBOUNCE_MS = 400



export type CoachActiveField = 'lesson-board' | 'label' | 'whiteboard'



type ActiveTextSink = {

  getValue: () => string

  setValue: (text: string) => void

  field: CoachActiveField

}



/** Stable callbacks — annotation typing hooks this so poll updates do not re-render the canvas. */

export type LessonCoachSyncActionsValue = {

  sessionId: string | null

  dictationMode: boolean

  setDictationMode: (on: boolean) => void

  syncSharedText: (text: string, field?: CoachActiveField) => void

  registerActiveTextSink: (sink: ActiveTextSink | null) => void

  setTextFieldFocused: (focused: boolean) => void

  setAnnotationGestureActive: (active: boolean) => void

  runGrammarCheck: () => Promise<string | undefined>

  patchSession: (body: LessonCoachSessionPatch) => Promise<void>

}



/** Session payload from poll — coach UI and dictation chrome subscribe here. */

export type LessonCoachSyncDataValue = {

  session: LessonCoachSession | null

  connected: boolean

  issueCount: number

  activeRevealIssue: GrammarIssue | null

  activeField: CoachActiveField | null

  checkBusy: boolean

}



type LessonCoachSyncContextValue = LessonCoachSyncActionsValue & LessonCoachSyncDataValue



const LessonCoachSyncActionsContext = createContext<LessonCoachSyncActionsValue | null>(null)

const LessonCoachSyncDataContext = createContext<LessonCoachSyncDataValue | null>(null)



export function LessonCoachSyncProvider({

  sessionId,

  children,

}: {

  sessionId: string | null

  children: ReactNode

}) {

  const { session, patch, connectionStatus } = useLessonCoachSession(sessionId, 'overlay')

  const [localDictationMode, setLocalDictationMode] = useState(false)

  const [localIssueCount, setLocalIssueCount] = useState(0)

  const [checkBusy, setCheckBusy] = useState(false)

  const sharedTextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lastSharedTextRef = useRef('')

  const lastSyncedTextRef = useRef('')

  const lastActiveFieldRef = useRef<CoachActiveField>('label')

  const activeTextSinkRef = useRef<ActiveTextSink | null>(null)

  const textFieldFocusedRef = useRef(false)



  const dictationMode = sessionId ? (session?.dictationMode ?? false) : localDictationMode



  const setDictationMode = useCallback(

    (on: boolean) => {

      if (sessionId && patch) {

        void patch({

          dictationMode: on,

          activeField: on ? lastActiveFieldRef.current : null,

        })

      } else {

        setLocalDictationMode(on)

      }

    },

    [patch, sessionId],

  )



  const syncSharedText = useCallback(

    (text: string, field: CoachActiveField = 'label') => {

      if (!dictationMode) return

      lastActiveFieldRef.current = field

      lastSharedTextRef.current = text

      if (!sessionId || !patch) return

      if (text === lastSyncedTextRef.current) return

      lastSyncedTextRef.current = text

      if (sharedTextTimerRef.current) clearTimeout(sharedTextTimerRef.current)

      sharedTextTimerRef.current = setTimeout(() => {

        sharedTextTimerRef.current = null

        void patch({

          sharedText: text,

          activeField: field,

        })

      }, SHARED_TEXT_DEBOUNCE_MS)

    },

    [dictationMode, patch, sessionId],

  )



  const runGrammarCheck = useCallback(async () => {

    const text = session?.sharedText?.trim() ? session.sharedText : lastSharedTextRef.current

    if (!text.trim()) return undefined



    setCheckBusy(true)

    try {

      const result = await fetchGrammarCheck(text)

      const body: LessonCoachSessionPatch = toGrammarCheckPatch(result)

      if (sessionId && patch) {

        await patch(body)

      } else {

        setLocalIssueCount(body.issueCount ?? 0)

      }

      return result.warning

    } finally {

      setCheckBusy(false)

    }

  }, [patch, session?.sharedText, sessionId])



  const patchSession = useCallback(

    async (body: LessonCoachSessionPatch) => {

      if (!sessionId || !patch) return

      await patch(body)

    },

    [patch, sessionId],

  )



  const registerActiveTextSink = useCallback((sink: ActiveTextSink | null) => {

    activeTextSinkRef.current = sink

    if (sink) lastActiveFieldRef.current = sink.field

  }, [])



  const setTextFieldFocused = useCallback((focused: boolean) => {

    if (textFieldFocusedRef.current === focused) return

    textFieldFocusedRef.current = focused

    setCoachTextFieldFocused(focused)

  }, [])



  const setAnnotationGestureActive = useCallback((active: boolean) => {

    setCoachAnnotationGestureActive(active)

  }, [])



  useEffect(() => {

    if (!dictationMode) return

    const remote = session?.sharedText

    if (!remote) return



    const sink = activeTextSinkRef.current

    if (!sink) return



    const local = sink.getValue()

    if (!shouldApplyRemoteSharedText(remote, local, lastSyncedTextRef.current)) {

      return

    }



    sink.setValue(remote)

    lastSharedTextRef.current = remote

    lastSyncedTextRef.current = remote

  }, [dictationMode, session?.sharedText, session?.updatedAt])



  const issueCount = sessionId ? (session?.issueCount ?? 0) : localIssueCount

  const activeRevealIssue = session?.issues ? getActiveRevealIssue(session.issues) : null

  const activeField = session?.activeField ?? null



  const actionsValue = useMemo(

    (): LessonCoachSyncActionsValue => ({

      sessionId,

      dictationMode,

      setDictationMode,

      syncSharedText,

      registerActiveTextSink,

      setTextFieldFocused,

      setAnnotationGestureActive,

      runGrammarCheck,

      patchSession,

    }),

    [

      sessionId,

      dictationMode,

      setDictationMode,

      syncSharedText,

      registerActiveTextSink,

      setTextFieldFocused,

      setAnnotationGestureActive,

      runGrammarCheck,

      patchSession,

    ],

  )



  const dataValue = useMemo(

    (): LessonCoachSyncDataValue => ({

      session,

      connected: connectionStatus === 'connected',

      issueCount,

      activeRevealIssue,

      activeField,

      checkBusy,

    }),

    [session, connectionStatus, issueCount, activeRevealIssue, activeField, checkBusy],

  )



  const mergedValue = useMemo(

    (): LessonCoachSyncContextValue => ({

      ...actionsValue,

      ...dataValue,

    }),

    [actionsValue, dataValue],

  )



  return (

    <LessonCoachSyncActionsContext.Provider value={actionsValue}>

      <LessonCoachSyncDataContext.Provider value={dataValue}>

        {children}

      </LessonCoachSyncDataContext.Provider>

    </LessonCoachSyncActionsContext.Provider>

  )

}



const noopActions: LessonCoachSyncActionsValue = {

  sessionId: null,

  dictationMode: false,

  setDictationMode: () => {},

  syncSharedText: () => {},

  registerActiveTextSink: () => {},

  setTextFieldFocused: () => {},

  setAnnotationGestureActive: () => {},

  runGrammarCheck: async () => undefined,

  patchSession: async () => {},

}



const noopData: LessonCoachSyncDataValue = {

  session: null,

  connected: false,

  issueCount: 0,

  activeRevealIssue: null,

  activeField: null,

  checkBusy: false,

}



/** Stable actions for annotation text fields (no re-render on session poll). */

export function useLessonCoachSyncActions(): LessonCoachSyncActionsValue {

  return useContext(LessonCoachSyncActionsContext) ?? noopActions

}



/** Session data for coach / dictation chrome (re-renders on poll). */

export function useLessonCoachSyncData(): LessonCoachSyncDataValue {

  return useContext(LessonCoachSyncDataContext) ?? noopData

}



/** Full coach sync (actions + data). Prefer narrow hooks in hot paths. */

export function useLessonCoachSync(): LessonCoachSyncContextValue {

  const actions = useLessonCoachSyncActions()

  const data = useLessonCoachSyncData()

  return useMemo(() => ({ ...actions, ...data }), [actions, data])

}


