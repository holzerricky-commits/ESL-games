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
import { getSpellEngine, type SpellEngine } from '@/lib/writing-assist/spell-engine'
import {
  buildSessionBigrams,
  getPartialWordAtCaret,
  getPreviousWord,
  getSecondPreviousWord,
  suggestNextWords,
  type GhostSuggestion,
} from '@/lib/writing-assist/ghost-complete'
import { loadNgramIndex } from '@/lib/writing-assist/ngram-index'
import { loadWritingAssistEnabled } from '@/lib/writing-assist/writing-assist-prefs'

const GHOST_DEBOUNCE_MS = 60

type WritingAssistContextValue = {
  ready: boolean
  enabled: boolean
  engine: SpellEngine | null
  lessonWords: Set<string>
  sessionBigrams: Map<string, string[]>
  registerSessionTokens: (text: string) => void
  preload: () => void
  ghostCandidates: GhostSuggestion[]
  ghostIndex: number
  ghostPartial: string
  activeGhost: GhostSuggestion | null
  updateGhostFromText: (text: string, caret: number) => void
  cycleGhost: (delta: 1 | -1) => void
  clearGhost: () => void
}

const WritingAssistContext = createContext<WritingAssistContextValue | null>(null)

export function WritingAssistProvider({
  lessonWords: lessonWordList,
  active = true,
  children,
}: {
  lessonWords: string[]
  /** When true, begin loading the dictionary (e.g. overlay open). */
  active?: boolean
  children: ReactNode
}) {
  const [ready, setReady] = useState(false)
  const [engine, setEngine] = useState<SpellEngine | null>(null)
  const [enabled] = useState(() => loadWritingAssistEnabled())
  const sessionTokensRef = useRef<string[]>([])
  const [sessionBigrams, setSessionBigrams] = useState<Map<string, string[]>>(() => new Map())
  const [ngramIndex, setNgramIndex] = useState<Map<string, { word: string; count: number }[]> | null>(
    null,
  )
  const [ghostCandidates, setGhostCandidates] = useState<GhostSuggestion[]>([])
  const [ghostIndex, setGhostIndex] = useState(0)
  const [ghostPartial, setGhostPartial] = useState('')
  const ghostDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lessonWords = useMemo(() => new Set(lessonWordList.map((w) => w.toLowerCase())), [lessonWordList])

  const preload = useCallback(() => {
    if (!enabled) return
    void Promise.all([getSpellEngine(), loadNgramIndex()])
      .then(([e, ngrams]) => {
        e.setLessonWords(lessonWords)
        setEngine(e)
        setNgramIndex(ngrams)
        setReady(true)
      })
      .catch((err) => {
        console.warn('[WritingAssist] Dictionary load failed', err)
      })
  }, [enabled, lessonWords])

  useEffect(() => {
    if (active) preload()
  }, [active, preload])

  useEffect(() => {
    if (engine) engine.setLessonWords(lessonWords)
  }, [engine, lessonWords])

  useEffect(() => {
    return () => {
      if (ghostDebounceRef.current) clearTimeout(ghostDebounceRef.current)
    }
  }, [])

  const registerSessionTokens = useCallback((text: string) => {
    const tokens = text
      .toLowerCase()
      .split(/[^a-z']+/i)
      .filter((t) => t.length > 1)
    sessionTokensRef.current.push(...tokens)
    if (sessionTokensRef.current.length > 2000) {
      sessionTokensRef.current = sessionTokensRef.current.slice(-1500)
    }
    setSessionBigrams(buildSessionBigrams(sessionTokensRef.current))
  }, [])

  const applyGhostUpdate = useCallback(
    (text: string, caret: number) => {
      if (!enabled) {
        setGhostCandidates([])
        setGhostIndex(0)
        setGhostPartial('')
        return
      }

      const partial = getPartialWordAtCaret(text, caret)
      const prev = getPreviousWord(text, caret)
      const prev2 = getSecondPreviousWord(text, caret)
      setGhostPartial(partial)

      if (!prev && !partial) {
        setGhostCandidates([])
        setGhostIndex(0)
        return
      }

      const hits = suggestNextWords(prev, partial, sessionBigrams, lessonWords, ready ? engine : null, {
        prev2Word: prev2,
        ngramIndex,
        text,
        caret,
      })
      const withSuffix = hits.filter((h) => h.suffix.length > 0)
      setGhostCandidates(withSuffix)
      setGhostIndex(0)
    },
    [enabled, ready, sessionBigrams, lessonWords, engine, ngramIndex],
  )

  const updateGhostFromText = useCallback(
    (text: string, caret: number) => {
      if (ghostDebounceRef.current) clearTimeout(ghostDebounceRef.current)
      ghostDebounceRef.current = setTimeout(() => {
        ghostDebounceRef.current = null
        applyGhostUpdate(text, caret)
      }, GHOST_DEBOUNCE_MS)
    },
    [applyGhostUpdate],
  )

  const clearGhost = useCallback(() => {
    if (ghostDebounceRef.current) clearTimeout(ghostDebounceRef.current)
    setGhostCandidates([])
    setGhostIndex(0)
    setGhostPartial('')
  }, [])

  const cycleGhost = useCallback((delta: 1 | -1) => {
    setGhostIndex((i) => {
      if (ghostCandidates.length <= 1) return 0
      const next = i + delta
      if (next < 0) return ghostCandidates.length - 1
      if (next >= ghostCandidates.length) return 0
      return next
    })
  }, [ghostCandidates.length])

  const activeGhost = ghostCandidates[ghostIndex] ?? null

  const value = useMemo(
    () => ({
      ready,
      enabled,
      engine,
      lessonWords,
      sessionBigrams,
      registerSessionTokens,
      preload,
      ghostCandidates,
      ghostIndex,
      ghostPartial,
      activeGhost,
      updateGhostFromText,
      cycleGhost,
      clearGhost,
    }),
    [
      ready,
      enabled,
      engine,
      lessonWords,
      sessionBigrams,
      registerSessionTokens,
      preload,
      ghostCandidates,
      ghostIndex,
      ghostPartial,
      activeGhost,
      updateGhostFromText,
      cycleGhost,
      clearGhost,
    ],
  )

  return <WritingAssistContext.Provider value={value}>{children}</WritingAssistContext.Provider>
}

export function useWritingAssistContext(): WritingAssistContextValue {
  const ctx = useContext(WritingAssistContext)
  if (!ctx) {
    return {
      ready: false,
      enabled: false,
      engine: null,
      lessonWords: new Set(),
      sessionBigrams: new Map(),
      registerSessionTokens: () => {},
      preload: () => {},
      ghostCandidates: [],
      ghostIndex: 0,
      ghostPartial: '',
      activeGhost: null,
      updateGhostFromText: () => {},
      cycleGhost: () => {},
      clearGhost: () => {},
    }
  }
  return ctx
}
