'use client'

import { useState } from 'react'
import { Dashboard } from '@/components/dashboard'
import { CreateQuizModal } from '@/components/create-quiz-modal'
import { PlayMode } from '@/components/play-mode'
import { StudentResults } from '@/components/student-results'
import type { Quiz } from '@/lib/types'

type AppView = 'dashboard' | 'play' | 'students'
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

function pickRandomQuestions(quiz: Quiz): Quiz {
  const requested = Math.max(1, Math.min(quiz.challengeQuestionCount, quiz.questions.length))
  const weights = quiz.questions.map((q) => (q.isPriority ? 3 : 1))
  const pickedIndices = pickWeightedQuestionIndices(weights, requested)
  return { ...quiz, questions: pickedIndices.map((idx) => quiz.questions[idx]) }
}

export default function TimedChallengePage() {
  const [view, setView] = useState<AppView>('dashboard')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null)
  const [playingQuiz, setPlayingQuiz] = useState<Quiz | null>(null)
  const [playMode, setPlayMode] = useState<PlayModeType>('challenge')
  const [dashKey, setDashKey] = useState(0)

  const handleCreateQuiz = () => {
    setEditingQuiz(null)
    setShowCreateModal(true)
  }

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuiz(quiz)
    setShowCreateModal(true)
  }

  const handlePlayQuiz = (quiz: Quiz, mode: PlayModeType) => {
    setPlayMode(mode)
    setPlayingQuiz(mode === 'challenge' ? pickRandomQuestions(quiz) : quiz)
    setView('play')
  }

  const handleModalSaved = (_quiz: Quiz) => {
    setShowCreateModal(false)
    setEditingQuiz(null)
    setDashKey((k) => k + 1)
  }

  const handleModalClose = () => {
    setShowCreateModal(false)
    setEditingQuiz(null)
  }

  return (
    <>
      {view === 'dashboard' && (
        <Dashboard
          key={dashKey}
          onCreateQuiz={handleCreateQuiz}
          onEditQuiz={handleEditQuiz}
          onPlayQuiz={handlePlayQuiz}
          onStudents={() => setView('students')}
        />
      )}

      {view === 'play' && playingQuiz && (
        <PlayMode
          quiz={playingQuiz}
          mode={playMode}
          onExit={() => {
            setPlayingQuiz(null)
            setView('dashboard')
          }}
        />
      )}

      {view === 'students' && (
        <StudentResults onBack={() => setView('dashboard')} />
      )}

      {showCreateModal && (
        <CreateQuizModal
          editingQuiz={editingQuiz}
          onClose={handleModalClose}
          onSaved={handleModalSaved}
        />
      )}
    </>
  )
}
