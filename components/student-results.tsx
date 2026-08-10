'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, User, ChevronDown, ChevronUp, CheckCircle2, XCircle, Calendar, BarChart3, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { StudentResult } from '@/lib/types'
import { getStudentResults } from '@/lib/storage'

interface StudentSummary {
  name: string
  totalQuizzes: number
  totalScore: number
  totalQuestions: number
  lastDate: string
  results: StudentResult[]
}

interface StudentResultsProps {
  onBack: () => void
}

export function StudentResults({ onBack }: StudentResultsProps) {
  const [results, setResults] = useState<StudentResult[]>([])
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  const [selectedQuiz, setSelectedQuiz] = useState<StudentResult | null>(null)

  useEffect(() => {
    setResults(getStudentResults())
  }, [])

  // Group by student name
  const studentMap = new Map<string, StudentSummary>()
  for (const r of results) {
    const existing = studentMap.get(r.studentName)
    if (existing) {
      existing.totalQuizzes += 1
      existing.totalScore += r.score
      existing.totalQuestions += r.totalQuestions
      if (r.completedAt > existing.lastDate) existing.lastDate = r.completedAt
      existing.results.push(r)
    } else {
      studentMap.set(r.studentName, {
        name: r.studentName,
        totalQuizzes: 1,
        totalScore: r.score,
        totalQuestions: r.totalQuestions,
        lastDate: r.completedAt,
        results: [r],
      })
    }
  }
  const students = Array.from(studentMap.values()).sort(
    (a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
  )

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <Button
            onClick={onBack}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-9 w-9"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-none">Student Results</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{students.length} student{students.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {students.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 py-24">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <BarChart3 size={32} className="text-muted-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">No results yet</h2>
              <p className="mt-2 text-muted-foreground">Student results will appear here after playing quizzes</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {students.map((student) => {
              const isExpanded = expandedStudent === student.name
              const avgPct = Math.round((student.totalScore / student.totalQuestions) * 100)

              return (
                <div key={student.name} className="overflow-hidden rounded-lg">
                  <button
                    type="button"
                    onClick={() => setExpandedStudent(isExpanded ? null : student.name)}
                    className="ui-row w-full text-left"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{student.name}</p>
                      <div className="mt-0.5 flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{student.totalQuizzes} quiz{student.totalQuizzes !== 1 ? 'zes' : ''}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar size={10} />
                          {formatDate(student.lastDate)}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <p
                        className="text-xl font-black tabular-nums"
                        style={{ color: avgPct >= 70 ? 'var(--brand-green)' : avgPct >= 50 ? 'var(--brand-yellow)' : 'var(--brand-red)' }}
                      >
                        {avgPct}%
                      </p>
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-muted-foreground" />
                      ) : (
                        <ChevronDown size={16} className="text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="space-y-2 px-3 pb-3 animate-slide-up">
                      {student.results
                        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                        .map((r) => {
                          const pct = Math.round((r.score / r.totalQuestions) * 100)
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => setSelectedQuiz(r)}
                              className="ui-row w-full cursor-pointer text-left"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">{r.quizName}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(r.completedAt)}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                <div className="flex items-center gap-1.5 text-sm">
                                  <CheckCircle2 size={13} className="text-[var(--brand-green)]" />
                                  <span className="text-foreground font-bold">{r.score}</span>
                                  <span className="text-muted-foreground">/ {r.totalQuestions}</span>
                                </div>
                                <Badge
                                  variant="outline"
                                  className="text-xs font-bold"
                                  style={{
                                    borderColor: pct >= 70 ? 'var(--brand-green)' : pct >= 50 ? 'var(--brand-yellow)' : 'var(--brand-red)',
                                    color: pct >= 70 ? 'var(--brand-green)' : pct >= 50 ? 'var(--brand-yellow)' : 'var(--brand-red)',
                                    background: 'transparent',
                                  }}
                                >
                                  {pct}%
                                </Badge>
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Quiz Detail Modal */}
      {selectedQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card shadow-lg">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">{selectedQuiz.quizName}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(selectedQuiz.completedAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuiz(null)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex flex-col gap-6">
              {/* Score Summary */}
              <div className="flex items-center justify-around rounded-2xl bg-muted/40 p-5">
                <div className="text-center">
                  <p className="text-3xl font-black text-[var(--brand-green)]">{selectedQuiz.score}</p>
                  <p className="text-sm text-muted-foreground mt-1">Correct</p>
                </div>
                <div className="w-px h-10 bg-[var(--border)]" />
                <div className="text-center">
                  <p className="text-3xl font-black text-[var(--brand-red)]">{selectedQuiz.totalQuestions - selectedQuiz.score}</p>
                  <p className="text-sm text-muted-foreground mt-1">Incorrect</p>
                </div>
                <div className="w-px h-10 bg-[var(--border)]" />
                <div className="text-center">
                  <p
                    className="text-3xl font-black"
                    style={{ color: (selectedQuiz.score / selectedQuiz.totalQuestions) >= 0.7 ? 'var(--brand-green)' : 'var(--brand-yellow)' }}
                  >
                    {Math.round((selectedQuiz.score / selectedQuiz.totalQuestions) * 100)}%
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Score</p>
                </div>
              </div>

              {/* Question Breakdown */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Question Results</h3>
                {selectedQuiz.answers.map((answer, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
                  >
                    {answer.correct ? (
                      <CheckCircle2 size={20} className="text-[var(--brand-green)] shrink-0" />
                    ) : (
                      <XCircle size={20} className="text-[var(--brand-red)] shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Question {idx + 1}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{answer.correct ? 'Correct' : 'Incorrect'}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs font-bold shrink-0 ${answer.correct ? 'border-[var(--brand-green)] text-[var(--brand-green)]' : 'border-[var(--brand-red)] text-[var(--brand-red)]'}`}
                      style={{ background: 'transparent' }}
                    >
                      {answer.correct ? '✓' : '✗'}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Student Info */}
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Student</p>
                <p className="text-lg font-bold text-foreground mt-1">{selectedQuiz.studentName}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
