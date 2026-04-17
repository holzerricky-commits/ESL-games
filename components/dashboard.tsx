'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Play, Pencil, Trash2, BookOpen, Users, Zap, Settings, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Quiz } from '@/lib/types'
import { getQuizzes, deleteQuiz } from '@/lib/storage'
import { getQuizCardCoverUrl } from '@/lib/helpers'
import { getFirstQuizQuestionPreview, getTotalQuestionCountAcrossTiers } from '@/lib/quiz-difficulty'
import { SettingsModal } from './settings-modal'

interface QuizCardProps {
  quiz: Quiz
  onPlay: (quiz: Quiz, mode: 'practice' | 'challenge') => void
  onEdit: (quiz: Quiz) => void
  onAddPart: (quiz: Quiz) => void
  onDelete: (id: string) => void
}

export function QuizCard({ quiz, onPlay, onEdit, onAddPart, onDelete }: QuizCardProps) {
  const firstQuestion = getFirstQuizQuestionPreview(quiz)
  const coverUrl = getQuizCardCoverUrl({
    quizId: quiz.id,
    quizName: quiz.name,
    coverImageMode: quiz.coverImageMode,
    manualCoverImageUrl: quiz.coverImageUrl,
    fallbackImageUrl: firstQuestion?.imageUrl,
    imageSearchQuery: firstQuestion?.imageSearchQuery,
    imageStyle: firstQuestion?.imageStyle,
  })

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all duration-300 hover:border-[var(--brand-blue)] hover:shadow-[0_0_24px_rgba(59,130,246,0.15)]">
      <div className="relative aspect-[16/9] overflow-hidden border-b border-[var(--border)] bg-[var(--surface-3)]">
        <img
          src={coverUrl}
          alt={`${quiz.name} cover`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--surface-1)]/70 via-transparent to-transparent" />
        <Badge
          className="absolute right-3 top-3 shrink-0 bg-[var(--surface-4)]/90 text-[var(--brand-blue-bright)] border-[var(--brand-blue)] text-xs font-mono"
          variant="outline"
        >
          {getTotalQuestionCountAcrossTiers(quiz)} Q
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-foreground leading-tight truncate">{quiz.name}</h3>
            {quiz.description && (
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed line-clamp-2">{quiz.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
            <Button
              onClick={() => onAddPart(quiz)}
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-[var(--border)] text-foreground hover:bg-[var(--surface-3)] hover:border-[var(--brand-green)]"
              title="Create next part"
              aria-label={`Create next part from ${quiz.name}`}
            >
              <Plus size={14} />
            </Button>
            <Button
              onClick={() => onEdit(quiz)}
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-[var(--border)] text-foreground hover:bg-[var(--surface-3)] hover:border-[var(--brand-blue)]"
              title="Edit quiz"
              aria-label={`Edit ${quiz.name}`}
            >
              <Pencil size={14} />
            </Button>
            <Button
              onClick={() => onDelete(quiz.id)}
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-[var(--border)] text-[var(--brand-red)] hover:bg-[var(--brand-red)]/10 hover:border-[var(--brand-red)]"
              title="Delete quiz"
              aria-label={`Delete ${quiz.name}`}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpen size={13} />
          <span>
            Pass: {quiz.passThreshold === 0 ? 'All correct' : `${quiz.passThreshold} / ${quiz.challengeQuestionCount}`}
          </span>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-1">
          <Button
            onClick={() => onPlay(quiz, 'practice')}
            variant="outline"
            className="flex-1 border-[var(--border)] text-foreground hover:bg-[var(--surface-3)] hover:border-[var(--brand-green)] font-semibold gap-2 transition-all duration-200"
            size="sm"
          >
            Practice
          </Button>
          <Button
            onClick={() => onPlay(quiz, 'challenge')}
            className="flex-1 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-bright)] text-white font-bold gap-2 transition-all duration-200"
            size="sm"
          >
            <Play size={14} fill="currentColor" />
            Challenge
          </Button>
        </div>
      </div>
    </div>
  )
}

interface DashboardProps {
  onCreateQuiz: () => void
  onEditQuiz: (quiz: Quiz) => void
  onAddPartFromQuiz: (quiz: Quiz) => void
  onPlayQuiz: (quiz: Quiz, mode: 'practice' | 'challenge') => void
  onStudents: () => void
}

export function Dashboard({ onCreateQuiz, onEditQuiz, onAddPartFromQuiz, onPlayQuiz, onStudents }: DashboardProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    setQuizzes(getQuizzes())
  }, [])

  const handleDelete = (id: string) => {
    if (!confirm('Delete this quiz? This cannot be undone.')) return
    deleteQuiz(id)
    setQuizzes(getQuizzes())
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface-2)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="shrink-0 border-[var(--border)] text-foreground hover:bg-[var(--surface-3)] hover:border-[var(--brand-blue)] gap-1.5 px-2.5 sm:px-3"
            >
              <Link href="/games" title="Back to all games">
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Games</span>
              </Link>
            </Button>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-blue)] shadow-[0_0_16px_rgba(59,130,246,0.4)]">
                <Zap size={18} className="text-white" fill="currentColor" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold leading-none text-foreground tracking-tight truncate">Timed Challenge</h1>
                <p className="text-xs text-muted-foreground leading-none mt-0.5 truncate">Quiz library · Teacher Ricky</p>
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex items-center justify-center w-10 h-10 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-muted-foreground hover:bg-[var(--surface-3)] hover:text-foreground hover:border-[var(--brand-blue)] transition-all"
              title="Settings"
            >
              <Settings size={18} />
            </button>
            <Button
              onClick={onStudents}
              variant="outline"
              className="border-[var(--border)] text-foreground hover:bg-[var(--surface-3)] hover:border-[var(--brand-green)] gap-2"
            >
              <Users size={15} />
              Students
            </Button>
            <Button
              onClick={onCreateQuiz}
              className="bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-bright)] text-white font-bold gap-2 shadow-[0_0_16px_rgba(59,130,246,0.3)] hover:shadow-[0_0_24px_rgba(59,130,246,0.5)] transition-all duration-200"
            >
              <Plus size={16} />
              Create New Quiz
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        {quizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 py-24">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)]">
              <BookOpen size={32} className="text-muted-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">No quizzes yet</h2>
              <p className="mt-2 text-muted-foreground">Create your first quiz to get started</p>
            </div>
            <Button
              onClick={onCreateQuiz}
              className="bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-bright)] text-white font-bold gap-2 px-8 py-6 text-base shadow-[0_0_24px_rgba(59,130,246,0.3)]"
            >
              <Plus size={18} />
              Create New Quiz
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Your Quizzes</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''} saved
                </p>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {quizzes.map((quiz) => (
                <QuizCard
                  key={quiz.id}
                  quiz={quiz}
                  onPlay={onPlayQuiz}
                  onEdit={onEditQuiz}
                  onAddPart={onAddPartFromQuiz}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
