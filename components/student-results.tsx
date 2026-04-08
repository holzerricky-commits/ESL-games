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
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface-2)]/90 backdrop-blur-md">
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
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)]">
              <BarChart3 size={32} className="text-muted-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">No results yet</h2>
              <p className="mt-2 text-muted-foreground">Student results will appear here after playing quizzes</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {students.map((student) => {
              const isExpanded = expandedStudent === student.name
              const avgPct = Math.round((student.totalScore / student.totalQuestions) * 100)

              return (
                <div
                  key={student.name}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden transition-all duration-300"
                >
                  {/* Student row */}
                  <button
                    type="button"
                    onClick={() => setExpandedStudent(isExpanded ? null : student.name)}
                    className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-[var(--surface-3)] transition-colors duration-150"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-blue)]/20 border border-[var(--brand-blue)]/30">
                      <User size={16} className="text-[var(--brand-blue-bright)]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground">{student.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground">{student.totalQuizzes} quiz{student.totalQuizzes !== 1 ? 'zes' : ''}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar size={10} />
                          {formatDate(student.lastDate)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p
                          className="text-2xl font-black tabular-nums"
                          style={{ color: avgPct >= 70 ? 'var(--brand-green)' : avgPct >= 50 ? 'var(--brand-yellow)' : 'var(--brand-red)' }}
                        >
                          {avgPct}%
                        </p>
                        <p className="text-xs text-muted-foreground">avg score</p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-muted-foreground" />
                      ) : (
                        <ChevronDown size={16} className="text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[var(--border)] px-6 py-4 flex flex-col gap-3 animate-slide-up">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quiz History</p>
                      {student.results
                        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                        .map((r) => {
                          const pct = Math.round((r.score / r.totalQuestions) * 100)
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => setSelectedQuiz(r)}
                              className="w-full text-left flex items-center gap-4 rounded-xl bg-[var(--surface-3)] px-4 py-3 hover:bg-[var(--surface-4)] transition-colors cursor-pointer"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-foreground text-sm truncate">{r.quizName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(r.completedAt)}</p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--card)]">
              <div>
                <h2 className="text-xl font-bold text-foreground">{selectedQuiz.quizName}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(selectedQuiz.completedAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuiz(null)}
                className="p-2 rounded-lg hover:bg-[var(--surface-3)] transition-colors text-muted-foreground"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex flex-col gap-6">
              {/* Score Summary */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5 flex items-center justify-around">
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
                    className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-3)] border border-[var(--border)]"
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
              <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
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
