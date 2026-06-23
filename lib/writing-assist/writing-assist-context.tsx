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
  isSentenceStart,
  suggestNextWords,
  type GhostSuggestion,
} from '@/lib/writing-assist/ghost-complete'
import { loadNgramIndex } from '@/lib/writing-assist/ngram-index'
import { loadLearnedWords, rememberLearnedWord } from '@/lib/writing-assist/learned-words'
import { loadWritingAssistEnabled } from '@/lib/writing-assist/writing-assist-prefs'

const GHOST_DEBOUNCE_MS = 60

type WritingAssistContextValue = {
  ready: boolean
  enabled: boolean
  engine: SpellEngine | null
  lessonWords: Set<string>
  learnedWords: Set<string>
  sessionBigrams: Map<string, string[]>
  registerSessionTokens: (text: string) => void
  rememberWord: (word: string) => void
  preload: () => void
  ghostCandidates: GhostSuggestion[]
  ghostIndex: number
  ghostPartial: string
  activeGhost: GhostSuggestion | null
  updateGhostFromText: (text: string, caret: number) => void
  /** Refresh ghost immediately (e.g. right after space or sentence punctuation). */
  flushGhostFromText: (text: string, caret: number) => void
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
  const [learnedWords, setLearnedWords] = useState<Set<string>>(() => loadLearnedWords())
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
        e.setLearnedWords(learnedWords)
        setEngine(e)
        setNgramIndex(ngrams)
        setReady(true)
      })
      .catch((err) => {
        console.warn('[WritingAssist] Dictionary load failed', err)
      })
  }, [enabled, lessonWords, learnedWords])

  useEffect(() => {
    if (active) preload()
  }, [active, preload])

  useEffect(() => {
    if (engine) {
      engine.setLessonWords(lessonWords)
      engine.setLearnedWords(learnedWords)
    }
  }, [engine, lessonWords, learnedWords])

  useEffect(() => {
    return () => {
      if (ghostDebounceRef.current) clearTimeout(ghostDebounceRef.current)
    }
  }, [])

  const rememberWord = useCallback(
    (word: string) => {
      rememberLearnedWord(word)
      setLearnedWords((prev) => {
        const token = word.trim().toLowerCase()
        if (!token || prev.has(token)) return prev
        const next = new Set(prev)
        next.add(token)
        if (engine) engine.setLearnedWords(next)
        return next
      })
    },
    [engine],
  )

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

      // Empty field shows placeholder hint — no inline ghost or prediction strip.
      if (text.length === 0) {
        setGhostCandidates([])
        setGhostIndex(0)
        setGhostPartial('')
        return
      }

      const partial = getPartialWordAtCaret(text, caret)
      const prev = getPreviousWord(text, caret)
      const prev2 = getSecondPreviousWord(text, caret)
      setGhostPartial(partial)

      if (!prev && !partial && !isSentenceStart(text, caret, partial)) {
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

  const flushGhostFromText = useCallback(
    (text: string, caret: number) => {
      if (ghostDebounceRef.current) {
        clearTimeout(ghostDebounceRef.current)
        ghostDebounceRef.current = null
      }
      applyGhostUpdate(text, caret)
    },
    [applyGhostUpdate],
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
      learnedWords,
      sessionBigrams,
      registerSessionTokens,
      rememberWord,
      preload,
      ghostCandidates,
      ghostIndex,
      ghostPartial,
      activeGhost,
      updateGhostFromText,
      flushGhostFromText,
      cycleGhost,
      clearGhost,
    }),
    [
      ready,
      enabled,
      engine,
      lessonWords,
      learnedWords,
      sessionBigrams,
      registerSessionTokens,
      rememberWord,
      preload,
      ghostCandidates,
      ghostIndex,
      ghostPartial,
      activeGhost,
      updateGhostFromText,
      flushGhostFromText,
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
      learnedWords: new Set(),
      sessionBigrams: new Map(),
      registerSessionTokens: () => {},
      rememberWord: () => {},
      preload: () => {},
      ghostCandidates: [],
      ghostIndex: 0,
      ghostPartial: '',
      activeGhost: null,
      updateGhostFromText: () => {},
      flushGhostFromText: () => {},
      cycleGhost: () => {},
      clearGhost: () => {},
    }
  }
  return ctx
}
