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
import { playRewardChime, warmRewardAudio } from '@/lib/audio/play-reward-chime'
import { pickStudentRewardPhrase } from '@/lib/students/student-reward-phrases'
import {
  DEFAULT_STUDENT_REWARD_STYLE,
  getStudentRewardStyle,
  saveStudentRewardStyle,
  STUDENT_REWARD_STYLE_CHANGED_EVENT,
  type StudentRewardStyle,
} from '@/lib/students/student-reward-style'
import {
  StudentRewardBurst,
  warmStudentRewardBurstAssets,
} from '@/components/students/student-reward-burst'

const HOLD_MS = 1200
/** Long enough for Spotlight’s soft fade (and the other exits) to finish. */
const EXIT_MS = 520
const TOTAL_MS = HOLD_MS + EXIT_MS

type BurstState = {
  id: number
  phrase: string
  phase: 'in' | 'out'
  style: StudentRewardStyle
}

type StudentRewardBurstContextValue = {
  triggerReward: () => void
}

const StudentRewardBurstContext = createContext<StudentRewardBurstContextValue | null>(null)

export function StudentRewardBurstProvider({ children }: { children: ReactNode }) {
  const [burst, setBurst] = useState<BurstState | null>(null)
  const lastPhraseRef = useRef<string | null>(null)
  const activeRef = useRef(false)
  const timersRef = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id)
    }
    timersRef.current = []
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  // Warm keyframes, fonts, and audio so the first G is as smooth as later ones.
  useEffect(() => {
    const run = () => {
      warmStudentRewardBurstAssets()
      warmRewardAudio()
    }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 1500 })
      return () => window.cancelIdleCallback(id)
    }
    const t = window.setTimeout(run, 0)
    return () => window.clearTimeout(t)
  }, [])

  const triggerReward = useCallback(() => {
    if (activeRef.current) return
    activeRef.current = true
    clearTimers()

    const phrase = pickStudentRewardPhrase(lastPhraseRef.current)
    lastPhraseRef.current = phrase
    const style = getStudentRewardStyle()
    const id = Date.now()
    // Ensure keyframes exist before the burst mounts (covers race before idle warmup).
    warmStudentRewardBurstAssets()
    setBurst({ id, phrase, phase: 'in', style })
    playRewardChime()

    timersRef.current.push(
      window.setTimeout(() => {
        setBurst((prev) => (prev?.id === id ? { ...prev, phase: 'out' } : prev))
      }, HOLD_MS),
      window.setTimeout(() => {
        setBurst((prev) => (prev?.id === id ? null : prev))
        activeRef.current = false
      }, TOTAL_MS),
    )
  }, [clearTimers])

  const contextValue = useMemo(() => ({ triggerReward }), [triggerReward])

  return (
    <StudentRewardBurstContext.Provider value={contextValue}>
      {children}
      {burst ? (
        <StudentRewardBurst
          key={burst.id}
          phrase={burst.phrase}
          phase={burst.phase}
          style={burst.style}
        />
      ) : null}
    </StudentRewardBurstContext.Provider>
  )
}

export function useStudentRewardBurst(): StudentRewardBurstContextValue {
  const ctx = useContext(StudentRewardBurstContext)
  if (!ctx) {
    throw new Error('useStudentRewardBurst must be used within StudentRewardBurstProvider')
  }
  return ctx
}

export function useStudentRewardBurstOptional(): StudentRewardBurstContextValue | null {
  return useContext(StudentRewardBurstContext)
}

/** Holds/exit timing for standalone previews (e.g. sidebar try button). */
export const STUDENT_REWARD_PREVIEW_TOTAL_MS = TOTAL_MS
export { HOLD_MS as STUDENT_REWARD_HOLD_MS, EXIT_MS as STUDENT_REWARD_EXIT_MS }

/** Subscribe to style preference changes (sidebar ↔ live class). */
export function useStudentRewardStylePreference(): [
  StudentRewardStyle,
  (style: StudentRewardStyle) => void,
] {
  const [style, setStyle] = useState<StudentRewardStyle>(DEFAULT_STUDENT_REWARD_STYLE)

  useEffect(() => {
    setStyle(getStudentRewardStyle())
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<StudentRewardStyle>).detail
      if (detail) setStyle(detail)
      else setStyle(getStudentRewardStyle())
    }
    window.addEventListener(STUDENT_REWARD_STYLE_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(STUDENT_REWARD_STYLE_CHANGED_EVENT, onChange)
  }, [])

  const setAndSave = useCallback((next: StudentRewardStyle) => {
    // Update UI first so a storage failure never leaves the highlight stuck.
    setStyle(next)
    saveStudentRewardStyle(next)
  }, [])

  return [style, setAndSave]
}
