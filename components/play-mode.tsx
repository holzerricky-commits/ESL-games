'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { X, CheckCircle2, XCircle, RotateCcw, Trophy, Star, ChevronRight, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DifficultyTier, KnownStudentSummary, Quiz } from '@/lib/types'
import { computePassThresholdForQuiz } from '@/lib/tier-challenge-progress'
import { saveStudentResult, getAnimationSettings, getKnownStudentSummaries, getStudentProgressMap, saveStudentProgressMap } from '@/lib/storage'
import {
  applyChallengeAttempt,
  createInitialProgressRecord,
  ensureProgressAlignsWithCatalog,
} from '@/lib/students/progression'
import { getChallengeCatalogForStudentKey } from '@/lib/students/selectors'
import { normalizeStudentKey } from '@/lib/students/identity'

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function studentInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  const single = parts[0] || '?'
  return single.slice(0, Math.min(2, single.length)).toUpperCase()
}

type PlayPhase =
  | 'enter-name'
  | 'countdown'
  | 'question'
  | 'results'

interface Answer {
  questionId: string
  correct: boolean
}

interface PlayModeProps {
  quiz: Quiz
  mode: 'practice' | 'challenge'
  onExit: () => void
  initialStudentName?: string
  skipNameEntry?: boolean
  /** Challenge bank used for this run (saved on results). */
  playDifficultyTier?: DifficultyTier
}

export function PlayMode({
  quiz,
  mode,
  onExit,
  initialStudentName,
  skipNameEntry = false,
  playDifficultyTier,
}: PlayModeProps) {
  const fixedStudentName = initialStudentName?.trim() ?? ''
  const [phase, setPhase] = useState<PlayPhase>('enter-name')
  const [studentName, setStudentName] = useState(fixedStudentName)
  const [knownStudents, setKnownStudents] = useState<KnownStudentSummary[]>([])
  const [addingNewStudent, setAddingNewStudent] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [elapsed, setElapsed] = useState(0) // ms
  const [timerRunning, setTimerRunning] = useState(false)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [imgError, setImgError] = useState(false)
  const [enterTitleVisible, setEnterTitleVisible] = useState(true)
  const [showReview, setShowReview] = useState(false)
  const [showAllAnswers, setShowAllAnswers] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startQuizAfterTitleHideRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoStartedRef = useRef(false)

  const playQuestions = quiz.questions ?? []
  const question = playQuestions[currentIndex]
  const totalQuestions = playQuestions.length
  const passThreshold = quiz.passThreshold === 0 ? totalQuestions : quiz.passThreshold

  // Format timer MM:SS
  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000)
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0')
    const s = (totalSec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const startTimer = useCallback(() => {
    setElapsed(0)
    setTimerRunning(true)
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 100)
    }, 100)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerRunning(false)
  }, [])

  const beginCountdownTicks = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          countdownRef.current = null
          setPhase('question')
          setImgError(false)
          startTimer()
          return 0
        }
        return prev - 1
      })
    }, 900)
  }, [startTimer])

  const startCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }

    setCountdown(3)
    setPhase('countdown')
    beginCountdownTicks()
  }, [beginCountdownTicks])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
      if (startQuizAfterTitleHideRef.current) clearTimeout(startQuizAfterTitleHideRef.current)
    }
  }, [])

  useEffect(() => {
    setKnownStudents(getKnownStudentSummaries())
  }, [])

  useEffect(() => {
    if (!fixedStudentName) return
    setStudentName(fixedStudentName)
    setAddingNewStudent(false)
  }, [fixedStudentName])

  useEffect(() => {
    if (!skipNameEntry || autoStartedRef.current) return
    const seededName = initialStudentName?.trim() ?? ''
    if (!seededName) return
    autoStartedRef.current = true
    setStudentName(seededName)
    setEnterTitleVisible(false)
    setAnswers([])
    setCurrentIndex(0)
    startCountdown()
  }, [initialStudentName, skipNameEntry, startCountdown])

  const handleStartQuiz = () => {
    if (!studentName.trim()) return
    if (startQuizAfterTitleHideRef.current != null) return
    setEnterTitleVisible(false)
    startQuizAfterTitleHideRef.current = setTimeout(() => {
      startQuizAfterTitleHideRef.current = null
      setAnswers([])
      setCurrentIndex(0)
      startCountdown()
    }, 280)
  }

  const handleMarkSelf = (wasCorrect: boolean) => {
    if (phase !== 'question') return

    const idx = currentIndex
    const qId = playQuestions[idx].id
    const newAnswers = [...answers, { questionId: qId, correct: wasCorrect }]
    setAnswers(newAnswers)

    if (idx === totalQuestions - 1) {
      stopTimer()
      if (mode === 'challenge') {
        const nextScore = newAnswers.filter((a) => a.correct).length
        const attemptedAt = new Date().toISOString()
        const needPass = computePassThresholdForQuiz(quiz, totalQuestions)
        const passedChallenge = nextScore >= needPass
        saveStudentResult({
          id: generateId(),
          studentName: studentName.trim(),
          quizId: quiz.id,
          quizName: quiz.name,
          score: nextScore,
          totalQuestions,
          answers: newAnswers,
          completedAt: attemptedAt,
          difficultyTier: playDifficultyTier,
          passedChallenge,
        })

        const challengeCatalog = getChallengeCatalogForStudentKey(normalizeStudentKey(studentName))
        const challengeForQuiz = challengeCatalog.find((challenge) => challenge.quizId === quiz.id)
        if (challengeForQuiz) {
          const studentKey = normalizeStudentKey(studentName)
          const progressMap = getStudentProgressMap()
          const rawRecord = progressMap[studentKey] ?? createInitialProgressRecord(studentKey, challengeCatalog)
          const currentRecord = ensureProgressAlignsWithCatalog(rawRecord, challengeCatalog)
          const scorePct = (nextScore / Math.max(1, totalQuestions)) * 100
          const updated = applyChallengeAttempt(currentRecord, challengeCatalog, {
            challengeId: challengeForQuiz.id,
            scorePct,
            attemptedAt,
          })
          progressMap[studentKey] = updated
          saveStudentProgressMap(progressMap)
        }
      }
      setPhase('results')
      return
    }

    setCurrentIndex((i) => i + 1)
    setImgError(false)
    setPhase('question')
  }

  const handleRetry = () => {
    setAnswers([])
    setCurrentIndex(0)
    startCountdown()
  }

  const score = answers.filter((a) => a.correct).length
  const passed = score >= passThreshold
  const isPerfect = score === totalQuestions
  const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a.correct]))

  useEffect(() => {
    if (phase !== 'results') return
    // Keep the celebration hierarchy stable: collapse review for perfect/pass, open for failed.
    setShowReview(mode === 'challenge' ? !passed : false)
    setShowAllAnswers(false)
  }, [mode, passed, phase])

  /* ── ENTER NAME SCREEN ── */
  if (phase === 'enter-name') {
    const hasLockedStudent = !!fixedStudentName
    const hasKnown = hasLockedStudent || knownStudents.length > 0
    const knownChoices: KnownStudentSummary[] = hasLockedStudent
      ? [{ name: fixedStudentName, lastDate: '', totalQuizzes: 0 }]
      : knownStudents
    const splashTitleFont = 'var(--font-space-mono), ui-monospace, monospace'
    const splashTitleSize = 'clamp(3.5rem, min(15vw, 11vh), 11rem)'

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--surface-1)] p-6 overflow-y-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={onExit}
          className="absolute right-6 top-6 text-muted-foreground hover:text-foreground h-10 w-10"
        >
          <X size={20} />
        </Button>

        <div className={`w-full flex flex-col items-center gap-8 py-8 max-w-2xl`}>
          <p className="text-sm font-mono text-[var(--brand-blue)] uppercase tracking-widest text-center animate-slide-up">
            Ready to play
          </p>

          <div
            className={`w-full transition-all duration-300 ease-out ${
              enterTitleVisible
                ? 'opacity-100 translate-y-0'
                : 'pointer-events-none opacity-0 -translate-y-2 scale-[0.97]'
            }`}
          >
            <div className="relative flex w-full justify-center px-2">
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[min(70vw,520px)] w-[min(95vw,760px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.65] blur-3xl"
                style={{
                  background:
                    'radial-gradient(circle, rgba(96,165,250,0.5) 0%, rgba(59,130,246,0.22) 42%, transparent 68%)',
                }}
                aria-hidden
              />
              <div className="animate-countdown-in relative z-[1] w-full max-w-[min(95vw,52rem)]">
                <div className="relative mx-auto w-fit max-w-full text-center">
                  <span
                    className="pointer-events-none absolute left-0 top-0 z-0 block w-full text-balance font-black leading-[0.95] tracking-tight select-none"
                    style={{
                      fontFamily: splashTitleFont,
                      fontSize: splashTitleSize,
                      color: '#3f0f12',
                      transform: 'translate(10px, 10px)',
                      WebkitTextStroke: '1px rgba(69, 26, 26, 0.9)',
                    }}
                    aria-hidden
                  >
                    {quiz.name}
                  </span>
                  <span
                    className="pointer-events-none absolute left-0 top-0 z-0 block w-full text-balance font-black leading-[0.95] tracking-tight select-none"
                    style={{
                      fontFamily: splashTitleFont,
                      fontSize: splashTitleSize,
                      color: '#5c1515',
                      transform: 'translate(6px, 6px)',
                    }}
                    aria-hidden
                  >
                    {quiz.name}
                  </span>
                  <span
                    className="relative z-[1] block w-full text-balance font-black leading-[0.95] tracking-tight select-none"
                    style={{
                      fontFamily: splashTitleFont,
                      fontSize: splashTitleSize,
                      background: 'linear-gradient(180deg, #f97316 0%, #fb923c 38%, #fde047 100%)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                      WebkitTextStroke: '2px rgba(255, 250, 240, 0.92)',
                      paintOrder: 'stroke fill',
                    }}
                  >
                    {quiz.name}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="-mt-2 text-center text-muted-foreground animate-slide-up">{totalQuestions} question{totalQuestions !== 1 ? 's' : ''}</p>

          <div className="w-full flex flex-col gap-4 animate-slide-up">
            {hasKnown && !addingNewStudent && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
                  Who is playing?
                </p>
                <div className="flex flex-wrap justify-center gap-3 max-w-full">
                  {knownChoices.map((s) => {
                    const selected = studentName === s.name
                    return (
                      <button
                        key={s.name}
                        type="button"
                        title={s.name}
                        aria-label={`Select ${s.name}`}
                        aria-pressed={selected}
                        onClick={() => {
                          setStudentName(s.name)
                          setAddingNewStudent(false)
                        }}
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold tracking-tight transition-all duration-200 ${
                          selected
                            ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/25 text-foreground shadow-[0_0_20px_rgba(59,130,246,0.35)] scale-105'
                            : 'border-[var(--border)] bg-[var(--surface-3)] text-foreground hover:border-[var(--brand-blue)] hover:bg-[var(--surface-2)]'
                        }`}
                      >
                        {studentInitials(s.name)}
                      </button>
                    )
                  })}
                </div>
                {!hasLockedStudent ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAddingNewStudent(true)
                      setStudentName('')
                    }}
                    className="w-full border-[var(--border)] text-foreground hover:bg-[var(--surface-3)] hover:border-[var(--brand-green)] gap-2 h-12 font-semibold"
                  >
                    <UserPlus size={18} />
                    New student
                  </Button>
                ) : null}
              </>
            )}

            {!hasLockedStudent && (addingNewStudent || !hasKnown) && (
              <div className="flex flex-col gap-2">
                {hasKnown && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAddingNewStudent(false)
                      setStudentName('')
                    }}
                    className="text-muted-foreground hover:text-foreground -mt-1 mb-1"
                  >
                    ← Choose from saved students
                  </Button>
                )}
                <Input
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && studentName.trim() && enterTitleVisible) handleStartQuiz()
                  }}
                  placeholder={hasKnown ? 'Type new student name…' : 'Enter your name...'}
                  className="bg-[var(--surface-3)] border-[var(--border)] text-foreground text-xl h-14 text-center font-bold placeholder:text-muted-foreground placeholder:font-normal"
                  autoFocus
                />
              </div>
            )}

            <Button
              onClick={handleStartQuiz}
              disabled={!studentName.trim() || !enterTitleVisible}
              className="w-full bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-bright)] text-white font-bold py-7 text-xl gap-3 shadow-[0_0_32px_rgba(59,130,246,0.4)] disabled:opacity-40 transition-all duration-200 hover:scale-[1.02]"
            >
              Start Quiz
              <ChevronRight size={22} />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  /* ── COUNTDOWN SCREEN ── */
  if (phase === 'countdown') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--surface-1)] overflow-hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={onExit}
          className="absolute right-6 top-6 text-muted-foreground hover:text-foreground h-10 w-10"
        >
          <X size={20} />
        </Button>
        <div key={countdown} className="animate-countdown-in">
          <span
            className="font-mono font-black leading-none select-none"
            style={{
              fontSize: 'clamp(8rem, 25vw, 20rem)',
              color: 'var(--brand-yellow)',
              textShadow: '0 0 60px rgba(250,204,21,0.5)',
            }}
          >
            {countdown}
          </span>
        </div>
        <p className="mt-4 text-muted-foreground text-lg font-medium animate-pulse">
          Question {currentIndex + 1} of {totalQuestions}
        </p>
      </div>
    )
  }

  /* ── QUESTION SCREEN ── */
  if (phase === 'question') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface-1)]">
        {/* Top bar */}
        <div className="relative z-[50] flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-muted-foreground">{studentName}</span>
            <span className="text-sm font-mono text-muted-foreground">
              {currentIndex + 1} / {totalQuestions}
            </span>
          </div>
          <div
            className={`font-mono text-3xl font-black tabular-nums ${timerRunning ? 'animate-timer-pulse text-[var(--brand-red)]' : 'text-foreground'}`}
          >
            {formatTime(elapsed)}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onExit}
            className="text-muted-foreground hover:text-foreground h-10 w-10"
          >
            <X size={20} />
          </Button>
        </div>

        <div className="relative z-[50] flex-1 overflow-hidden">
          {!imgError ? (
            <img
              src={question.imageUrl}
              alt={question.vocabularyWord}
              className="h-full w-full object-contain"
              onError={() => setImgError(true)}
              crossOrigin="anonymous"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-muted-foreground text-lg">Image unavailable</span>
            </div>
          )}
        </div>

        <div className="relative z-[50] flex flex-col items-center gap-5 border-t border-[var(--border)] bg-[var(--surface-2)] px-6 py-8">
          <p className="max-w-2xl text-center text-2xl font-bold text-balance leading-tight text-foreground">
            {question.questionText}
          </p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            <Button
              type="button"
              onClick={() => handleMarkSelf(true)}
              className="gap-3 rounded-2xl bg-[var(--brand-green)] px-10 py-7 text-xl font-black text-[var(--surface-1)] shadow-[0_0_32px_rgba(34,197,94,0.4)] transition-all duration-200 hover:scale-105 hover:bg-[var(--brand-green-bright)] disabled:opacity-50 disabled:hover:scale-100"
            >
              <CheckCircle2 size={28} />
              Correct
            </Button>
            <Button
              type="button"
              onClick={() => handleMarkSelf(false)}
              className="gap-3 rounded-2xl bg-[var(--brand-red)] px-10 py-7 text-xl font-black text-white shadow-[0_0_32px_rgba(239,68,68,0.4)] transition-all duration-200 hover:scale-105 hover:bg-[var(--brand-red)]/80 disabled:opacity-50 disabled:hover:scale-100"
            >
              <XCircle size={28} />
              Incorrect
            </Button>
          </div>
        </div>
      </div>
    )
  }

  /* ── RESULTS SCREEN ── */
  // Get selected animations from localStorage
  const animationSettings = getAnimationSettings()
  const selectedAnimation =
    mode === 'practice'
      ? score === totalQuestions
        ? animationSettings.perfect
        : animationSettings.success
      : isPerfect
        ? animationSettings.perfect
        : passed
          ? animationSettings.success
          : animationSettings.fail

  // Render animation based on selected preset
  const renderAnimation = () => {
    if (selectedAnimation === 'gentle-sparkles' && passed && !isPerfect) {
      // Gentle Sparkles: soft rising golden sparkles
      return [...Array(15)].map((_, i) => (
        <div
          key={`sparkle-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${25 + Math.random() * 50}%`,
            top: '80%',
            width: '2px',
            height: '2px',
            backgroundColor: '#facc15',
            boxShadow: '0 0 4px #facc15',
            animation: `rise-fade ${1.5 + Math.random() * 0.5}s ease-out forwards`,
            animationDelay: `${(i / 15) * 0.3}s`,
            opacity: 0.6 + Math.random() * 0.4,
          }}
        />
      ))
    } else if (selectedAnimation === 'fireworks-celebration' && isPerfect) {
      const colors = ['#facc15', '#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ec4899']
      const particles: ReactNode[] = []

      const pushBurst = (
        count: number,
        keyPrefix: string,
        burstDelay: string,
        distanceScale: number,
      ) => {
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2
          const distance = (28 + Math.random() * 52) * distanceScale
          const endX = 50 + Math.cos(angle) * distance
          const endY = 33 + Math.sin(angle) * distance
          particles.push(
            <div
              key={`${keyPrefix}-${i}`}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: '50%',
                top: '33%',
                width: `${4 + Math.random() * 5}px`,
                height: `${4 + Math.random() * 5}px`,
                backgroundColor: colors[Math.floor(Math.random() * colors.length)],
                boxShadow: `0 0 ${8 + Math.random() * 8}px currentColor`,
                transform: 'translate(-50%, -50%)',
                animation: `burst-out 1.15s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
                animationDelay: burstDelay,
                '--burst-end-x': `${(endX - 50) * 3}vw`,
                '--burst-end-y': `${(endY - 33) * 3}vh`,
              } as React.CSSProperties}
            />,
          )
        }
      }

      pushBurst(58, 'burst-a', '0s', 1)
      pushBurst(38, 'burst-b', '0.18s', 0.88)

      // Repeating micro-bursts (looping)
      for (let i = 0; i < 22; i++) {
        const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.4
        const distance = 22 + Math.random() * 38
        const endX = 50 + Math.cos(angle) * distance
        const endY = 33 + Math.sin(angle) * distance
        particles.push(
          <div
            key={`burst-loop-${i}`}
            className="perfect-fx-loop-burst absolute rounded-full pointer-events-none"
            style={{
              left: '50%',
              top: '33%',
              width: `${3 + Math.random() * 3}px`,
              height: `${3 + Math.random() * 3}px`,
              backgroundColor: colors[Math.floor(Math.random() * colors.length)],
              boxShadow: `0 0 ${6 + Math.random() * 5}px currentColor`,
              transform: 'translate(-50%, -50%)',
              animation: `burst-out 1.38s cubic-bezier(0.28, 0.5, 0.45, 0.94) infinite`,
              animationDelay: `${(i / 22) * 1.38}s`,
              '--burst-end-x': `${(endX - 50) * 2.4}vw`,
              '--burst-end-y': `${(endY - 33) * 2.4}vh`,
            } as React.CSSProperties}
          />,
        )
      }

      for (let i = 0; i < 56; i++) {
        const startX = Math.random() * 100
        const sway = (Math.random() - 0.5) * 36
        const duration = 2.2 + Math.random() * 2.2
        const delay = (i / 56) * 3.2
        particles.push(
          <div
            key={`confetti-${i}`}
            className="perfect-fx-confetti absolute pointer-events-none"
            style={{
              left: `${startX}%`,
              top: '-6%',
              width: `${4 + Math.random() * 5}px`,
              height: `${4 + Math.random() * 5}px`,
              backgroundColor: colors[Math.floor(Math.random() * colors.length)],
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              opacity: 0.88,
              animation: `confetti-fall ${duration}s linear infinite`,
              animationDelay: `${delay}s`,
              '--confetti-sway': `${sway}px`,
              '--confetti-rotate': `${Math.random() * 720}deg`,
            } as React.CSSProperties}
          />,
        )
      }

      return [
        <div key="ambient" className="perfect-fx-ambient" />,
        <div
          key="flash"
          className="perfect-fx-flash fixed inset-0 pointer-events-none z-[1]"
          style={{
            background: 'radial-gradient(circle at 50% 33%, rgba(250,204,21,0.52) 0%, transparent 58%)',
            animation: 'flash-burst 0.95s ease-out forwards',
          }}
        />,
        <div
          key="flash-soft"
          className="perfect-fx-flash fixed inset-0 pointer-events-none z-[1]"
          style={{
            background: 'radial-gradient(circle at 48% 38%, rgba(168,85,247,0.2) 0%, transparent 52%)',
            animation: 'flash-burst 1.05s ease-out forwards',
            animationDelay: '0.14s',
          }}
        />,
        ...particles,
      ]
    } else if (selectedAnimation === 'warm-encouragement' && !passed) {
      const particles: ReactNode[] = [
        <div key="enc-ambient" className="encouragement-fx-ambient" />,
        <div key="enc-loop-bg" className="encouragement-fx-loop-bg" />,
        <div key="enc-inset" className="encouragement-fx-inset" />,
      ]
      const redEmber = 'color-mix(in srgb, var(--brand-red) 68%, transparent)'
      const orangeEmber = 'color-mix(in srgb, var(--chart-4) 58%, transparent)'

      for (let i = 0; i < 10; i++) {
        const left = 10 + Math.random() * 80
        const useOrange = Math.random() > 0.42
        const emberColor = useOrange ? orangeEmber : redEmber
        const size = 5 + Math.random() * 6
        particles.push(
          <div
            key={`enc-ember-${i}`}
            className="encouragement-fx-lift absolute rounded-full pointer-events-none"
            style={{
              left: `${left}%`,
              top: `${70 + Math.random() * 18}%`,
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: emberColor,
              boxShadow: `0 0 ${size + 4}px ${emberColor}`,
              animation: `encouragement-lift ${3.4 + Math.random() * 2.4}s ease-out forwards`,
              animationDelay: `${(i / 10) * 2.8}s`,
              '--enc-sway': `${(Math.random() - 0.5) * 36}px`,
              '--enc-rise': `${-(30 + Math.random() * 22)}vh`,
            } as React.CSSProperties}
          />,
        )
      }

      return particles
    }

    return null
  }

  const incorrectQuestions = playQuestions.filter((q) => answerByQuestionId.get(q.id) !== true)
  const reviewQuestions: typeof playQuestions =
    mode === 'challenge' && !passed && !showAllAnswers
      ? incorrectQuestions
      : playQuestions

  return (
    <div className="fixed inset-0 z-50 bg-[var(--surface-1)] px-4 py-6 md:px-6 overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
        {renderAnimation()}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onExit}
        className="absolute right-6 top-6 z-20 text-muted-foreground hover:text-foreground h-10 w-10"
      >
        <X size={20} />
      </Button>

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-5xl items-center justify-center py-6 md:py-8">
        <div className="flex w-full flex-col items-center gap-5 md:gap-6 -translate-y-[2vh] animate-slide-up">
          <div className="w-full max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/85 backdrop-blur-sm px-5 py-6 md:px-7 md:py-7 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col items-center gap-4 md:gap-5">
              {/* Trophy when passed; encouraging mark when not */}
              {passed ? (
                <Trophy
                  size={72}
                  className={
                    isPerfect ? 'text-[var(--brand-yellow)] perfect-fx-trophy' : 'text-[var(--brand-yellow)]'
                  }
                  style={
                    !isPerfect ? { filter: 'drop-shadow(0 0 32px rgba(250,204,21,0.6))' } : undefined
                  }
                />
              ) : (
                <div
                  className="flex items-center justify-center gap-3"
                  aria-hidden
                >
                  <Star size={52} className="fail-star fail-star--steady" strokeWidth={1.85} />
                  <Star size={52} className="fail-star fail-star--steady" strokeWidth={1.85} />
                  <Star size={52} className="fail-star fail-star--fluoro" strokeWidth={1.85} />
                </div>
              )}

              <div className="text-center flex flex-col gap-1.5">
                <p className="text-sm text-muted-foreground font-medium">{studentName}</p>
                <div className="flex items-baseline justify-center gap-3">
                  <span
                    className="text-[clamp(4rem,10vw,7.5rem)] font-black"
                    style={{
                      color: isPerfect ? 'var(--brand-yellow)' : passed ? 'var(--brand-green)' : 'var(--brand-blue-bright)',
                    }}
                  >
                    {score}
                  </span>
                  <span className="text-3xl font-bold text-muted-foreground">/ {totalQuestions}</span>
                </div>
                {isPerfect ? (
                  <p className="perfect-score-headline" aria-live="polite">
                    🎉 Perfect Score! 🎉
                  </p>
                ) : mode === 'challenge' && passed ? (
                  <p className="text-2xl font-bold mt-1 text-[var(--brand-green)]">Congratulations! You passed!</p>
                ) : mode === 'challenge' ? (
                  <>
                    <p className="text-2xl font-bold mt-1 text-foreground text-balance">
                      Nice try—ready for another round?
                    </p>
                    <p className="text-base text-muted-foreground mt-1 text-balance">
                      You got {score} of {totalQuestions}—great effort!
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold mt-1 text-[var(--brand-blue-bright)]">Practice complete!</p>
                )}
              </div>

              {/* Score breakdown */}
              <div className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4 flex items-center justify-around">
                <div className="text-center">
                  <p className="text-3xl font-black text-[var(--brand-green)]">{score}</p>
                  <p className="text-sm text-muted-foreground mt-1">Correct</p>
                </div>
                <div className="w-px h-10 bg-[var(--border)]" />
                <div className="text-center">
                  <p className="text-3xl font-black text-[var(--brand-red)]">{totalQuestions - score}</p>
                  <p className="text-sm text-muted-foreground mt-1">Incorrect</p>
                </div>
                {mode === 'challenge' && (
                  <>
                    <div className="w-px h-10 bg-[var(--border)]" />
                    <div className="text-center">
                      <p className="text-3xl font-black text-foreground">{passThreshold}</p>
                      <p className="text-sm text-muted-foreground mt-1">Needed to pass</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex w-full max-w-xl gap-4">
                {mode === 'challenge' && !passed && (
                  <Button
                    onClick={handleRetry}
                    className="flex-1 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-bright)] text-white font-bold py-6 text-lg gap-2 shadow-[0_0_24px_rgba(59,130,246,0.3)]"
                  >
                    <RotateCcw size={18} />
                    Retry Quiz
                  </Button>
                )}
                <Button
                  onClick={onExit}
                  variant="outline"
                  className={`${mode === 'challenge' && passed ? 'flex-1' : ''} border-[var(--border)] text-foreground hover:bg-[var(--surface-3)] py-6 text-lg`}
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </div>

          <div className="w-full max-w-5xl rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/90 p-4 backdrop-blur-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {mode === 'challenge' && !passed ? 'Mistakes to review' : 'Answer review'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {mode === 'challenge' && !passed && incorrectQuestions.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllAnswers((v) => !v)}
                  className="border-[var(--border)] text-foreground hover:bg-[var(--surface-3)]"
                >
                  {showAllAnswers ? 'Show mistakes only' : 'Show all answers'}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowReview((v) => !v)}
                className="border-[var(--border)] text-foreground hover:bg-[var(--surface-3)]"
              >
                {showReview ? 'Hide review' : 'Show review'}
              </Button>
            </div>
          </div>

          {showReview ? (
            reviewQuestions.length > 0 ? (
              <div className="max-h-[45vh] overflow-y-auto pr-1">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {reviewQuestions.map((q) => {
                  const markedCorrect = answerByQuestionId.get(q.id) === true
                  return (
                    <div key={q.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-1)]">
                      <div className="relative aspect-[4/3] bg-[var(--surface-3)]">
                        <img
                          src={q.imageUrl}
                          alt={q.vocabularyWord}
                          className="h-full w-full object-contain"
                          crossOrigin="anonymous"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <p className="text-sm font-bold text-foreground truncate">{q.vocabularyWord}</p>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            markedCorrect
                              ? 'border-[var(--brand-green)] text-[var(--brand-green)]'
                              : 'border-[var(--brand-red)] text-[var(--brand-red)]'
                          }`}
                        >
                          {markedCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>
                    </div>
                  )
                })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No mistakes to review.</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              {mode === 'challenge' && !passed
                ? `${incorrectQuestions.length} mistake${incorrectQuestions.length === 1 ? '' : 's'} ready for review.`
                : 'Open review to see all answers.'}
            </p>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
