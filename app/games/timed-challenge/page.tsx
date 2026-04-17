'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Dashboard } from '@/components/dashboard'
import { CreateQuizModal } from '@/components/create-quiz-modal'
import { PlayChallengeIdentity } from '@/components/play-challenge-identity'
import { PlayDifficultySetup } from '@/components/play-difficulty-setup'
import { PlayMode } from '@/components/play-mode'
import { StudentResults } from '@/components/student-results'
import { getQuizzes } from '@/lib/storage'
import { normalizeStudentKey } from '@/lib/students/identity'
import { getStudentDefaultDifficultyTier } from '@/lib/students/selectors'
import { sanitizeTimedChallengeReturnTo } from '@/lib/students/challenge-launch'
import { resolveChallengePlayTier } from '@/lib/tier-challenge-progress'
import {
  DEFAULT_PLAY_TIER,
  getQuizQuestionsForTier,
  resolveInitialPlayTier,
} from '@/lib/quiz-difficulty'
import type { DifficultyTier, Quiz } from '@/lib/types'

type AppView = 'dashboard' | 'challenge-identity' | 'play-setup' | 'play' | 'students'
type PlayModeType = 'practice' | 'challenge'

function pickWeightedQuestionIndices(weights: number[], count: number): number[] {
  const pool = weights.map((weight, idx) => ({ idx, weight: Math.max(1, weight) }))
  const selected: number[] = []
  while (selected.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0)
    let roll = Math.random() * totalWeight
    let pickAt = 0
    for (let i = 0; i < pool.length; i += 1) {
      roll -= pool[i].weight
      if (roll <= 0) {
        pickAt = i
        break
      }
    }
    selected.push(pool[pickAt].idx)
    pool.splice(pickAt, 1)
  }
  return selected
}

function pickRandomQuestions(quiz: Quiz, tier: DifficultyTier): Quiz {
  const pool = getQuizQuestionsForTier(quiz, tier)
  if (pool.length === 0) {
    return { ...quiz, questions: [] }
  }
  const requested = Math.max(1, Math.min(quiz.challengeQuestionCount, pool.length))
  const weights = pool.map((q) => (q.isPriority ? 3 : 1))
  const pickedIndices = pickWeightedQuestionIndices(weights, requested)
  return { ...quiz, questions: pickedIndices.map((idx) => pool[idx]) }
}

export default function TimedChallengePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<AppView>('dashboard')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null)
  const [addPartFromQuiz, setAddPartFromQuiz] = useState<Quiz | null>(null)
  const [playingQuiz, setPlayingQuiz] = useState<Quiz | null>(null)
  const [playMode, setPlayMode] = useState<PlayModeType>('challenge')
  const [seededStudentName, setSeededStudentName] = useState<string | undefined>(undefined)
  const [seededStudentId, setSeededStudentId] = useState<string | undefined>(undefined)
  const [dashKey, setDashKey] = useState(0)

  const [pendingPlay, setPendingPlay] = useState<{ quiz: Quiz; mode: PlayModeType } | null>(null)
  const [playTier, setPlayTier] = useState<DifficultyTier>(DEFAULT_PLAY_TIER)
  /** Challenge-only: normalized key for tier unlocks / coin display. */
  const [challengeStudentKey, setChallengeStudentKey] = useState<string | null>(null)
  const [challengeDisplayName, setChallengeDisplayName] = useState<string | undefined>(undefined)
  /** Set from `returnTo` query when launching from student fullscreen map (safe path only). */
  const [challengeReturnTo, setChallengeReturnTo] = useState<string | null>(null)

  useEffect(() => {
    const mode = searchParams.get('mode')
    const quizId = searchParams.get('quizId')
    if (mode !== 'challenge' || !quizId) {
      setChallengeReturnTo(null)
      return
    }

    const quiz = getQuizzes().find((item) => item.id === quizId)
    if (!quiz) {
      setView('dashboard')
      setPlayingQuiz(null)
      setSeededStudentName(undefined)
      setSeededStudentId(undefined)
      setPendingPlay(null)
      setChallengeStudentKey(null)
      setChallengeDisplayName(undefined)
      setChallengeReturnTo(null)
      return
    }

    const rawStudentName = searchParams.get('studentName')?.trim() ?? ''
    const studentId = searchParams.get('studentId')?.trim() ?? ''
    const preferred = studentId ? getStudentDefaultDifficultyTier(studentId) : DEFAULT_PLAY_TIER
    const key = normalizeStudentKey(rawStudentName)
    const returnTo = sanitizeTimedChallengeReturnTo(searchParams.get('returnTo'))

    setSeededStudentName(rawStudentName || undefined)
    setSeededStudentId(studentId || undefined)
    setPlayMode('challenge')
    setPendingPlay({ quiz, mode: 'challenge' })
    setChallengeStudentKey(key || null)
    setChallengeDisplayName(rawStudentName || undefined)
    setPlayTier(resolveChallengePlayTier(quiz, preferred, key || null))
    setChallengeReturnTo(returnTo)
    setView('play-setup')
  }, [searchParams])

  const handleCreateQuiz = () => {
    setEditingQuiz(null)
    setAddPartFromQuiz(null)
    setShowCreateModal(true)
  }

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuiz(quiz)
    setAddPartFromQuiz(null)
    setShowCreateModal(true)
  }

  const handleAddPartFromQuiz = (quiz: Quiz) => {
    setEditingQuiz(null)
    setAddPartFromQuiz(quiz)
    setShowCreateModal(true)
  }

  const handlePlayQuiz = (quiz: Quiz, mode: PlayModeType) => {
    setSeededStudentName(undefined)
    setSeededStudentId(undefined)
    setChallengeStudentKey(null)
    setChallengeDisplayName(undefined)
    setChallengeReturnTo(null)
    setPlayMode(mode)
    setPendingPlay({ quiz, mode })
    setPlayTier(resolveInitialPlayTier(quiz, DEFAULT_PLAY_TIER))
    if (mode === 'challenge') {
      setView('challenge-identity')
    } else {
      setView('play-setup')
    }
  }

  const handleChallengeIdentityContinue = (name: string, quiz: Quiz) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const key = normalizeStudentKey(trimmed)
    setChallengeStudentKey(key)
    setChallengeDisplayName(trimmed)
    setPlayTier(resolveChallengePlayTier(quiz, DEFAULT_PLAY_TIER, key))
    setView('play-setup')
  }

  const handleBackFromChallengeIdentity = () => {
    const dest = challengeReturnTo
    setPendingPlay(null)
    setChallengeStudentKey(null)
    setChallengeDisplayName(undefined)
    setChallengeReturnTo(null)
    if (dest) {
      router.replace(dest)
    } else {
      setView('dashboard')
      router.replace('/games/timed-challenge')
    }
  }

  const handleStartFromSetup = () => {
    if (!pendingPlay) return
    const { quiz, mode } = pendingPlay
    setPlayMode(mode)
    if (mode === 'challenge') {
      setPlayingQuiz(pickRandomQuestions(quiz, playTier))
    } else {
      const pool = getQuizQuestionsForTier(quiz, playTier)
      setPlayingQuiz({ ...quiz, questions: pool })
    }
    setPendingPlay(null)
    setView('play')
  }

  const handleBackFromSetup = () => {
    const dest = challengeReturnTo
    setPendingPlay(null)
    setSeededStudentName(undefined)
    setSeededStudentId(undefined)
    setChallengeStudentKey(null)
    setChallengeDisplayName(undefined)
    setChallengeReturnTo(null)
    if (dest) {
      router.replace(dest)
    } else {
      setView('dashboard')
      router.replace('/games/timed-challenge')
    }
  }

  const handleModalSaved = (_quiz: Quiz) => {
    setShowCreateModal(false)
    setEditingQuiz(null)
    setAddPartFromQuiz(null)
    setDashKey((k) => k + 1)
  }

  const handleModalClose = () => {
    setShowCreateModal(false)
    setEditingQuiz(null)
    setAddPartFromQuiz(null)
  }

  const challengeLockedName = seededStudentName ?? challengeDisplayName

  const setupStudentHint =
    seededStudentId && seededStudentName
      ? `Suggested for ${seededStudentName} (profile default). You can still change tier.`
      : challengeDisplayName
        ? `Playing as ${challengeDisplayName}. Finish each tier to unlock the next.`
        : undefined

  return (
    <>
      {view === 'dashboard' && (
        <Dashboard
          key={dashKey}
          onCreateQuiz={handleCreateQuiz}
          onEditQuiz={handleEditQuiz}
          onAddPartFromQuiz={handleAddPartFromQuiz}
          onPlayQuiz={handlePlayQuiz}
          onStudents={() => setView('students')}
        />
      )}

      {view === 'challenge-identity' && pendingPlay && (
        <PlayChallengeIdentity
          quizName={pendingPlay.quiz.name}
          onContinue={(name) => handleChallengeIdentityContinue(name, pendingPlay.quiz)}
          onBack={handleBackFromChallengeIdentity}
        />
      )}

      {view === 'play-setup' && pendingPlay && (
        <PlayDifficultySetup
          quiz={pendingPlay.quiz}
          mode={pendingPlay.mode}
          selectedTier={playTier}
          onTierChange={setPlayTier}
          onStart={handleStartFromSetup}
          onBack={handleBackFromSetup}
          challengeStudentKey={pendingPlay.mode === 'challenge' ? challengeStudentKey : null}
          studentHint={setupStudentHint}
        />
      )}

      {view === 'play' && playingQuiz && (
        <PlayMode
          quiz={playingQuiz}
          mode={playMode}
          initialStudentName={playMode === 'challenge' ? challengeLockedName : undefined}
          skipNameEntry={playMode === 'challenge' && Boolean(challengeLockedName)}
          playDifficultyTier={playMode === 'challenge' ? playTier : undefined}
          onExit={() => {
            const dest = challengeReturnTo
            setPlayingQuiz(null)
            setSeededStudentName(undefined)
            setSeededStudentId(undefined)
            setChallengeStudentKey(null)
            setChallengeDisplayName(undefined)
            setChallengeReturnTo(null)
            if (dest) {
              router.replace(dest)
            } else {
              setView('dashboard')
              router.replace('/games/timed-challenge')
            }
          }}
        />
      )}

      {view === 'students' && (
        <StudentResults onBack={() => setView('dashboard')} />
      )}

      {showCreateModal && (
        <CreateQuizModal
          editingQuiz={editingQuiz}
          addPartFromQuiz={addPartFromQuiz}
          onClose={handleModalClose}
          onSaved={handleModalSaved}
        />
      )}
    </>
  )
}
