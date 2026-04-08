'use client'

import { useEffect, useState } from 'react'
import { User, ChevronDown, ChevronUp, CheckCircle2, XCircle, Calendar, BarChart3, X } from 'lucide-react'
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

export function StudentsOverview() {
  const [results, setResults] = useState<StudentResult[]>([])
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  const [selectedQuiz, setSelectedQuiz] = useState<StudentResult | null>(null)

  useEffect(() => {
    setResults(getStudentResults())
  }, [])

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
    (a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime(),
  )

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)]">
          <BarChart3 size={32} className="text-muted-foreground" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">No results yet</h2>
          <p className="mt-2 text-muted-foreground">Student results will appear here after playing quizzes.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {students.map((student) => {
          const isExpanded = expandedStudent === student.name
          const avgPct = Math.round((student.totalScore / student.totalQuestions) * 100)

          return (
            <div
              key={student.name}
              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all duration-300"
            >
              <button
                type="button"
                onClick={() => setExpandedStudent(isExpanded ? null : student.name)}
                className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors duration-150 hover:bg-[var(--surface-3)]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--brand-blue)]/30 bg-[var(--brand-blue)]/20">
                  <User size={16} className="text-[var(--brand-blue-bright)]" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-bold text-foreground">{student.name}</p>
                  <div className="mt-0.5 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {student.totalQuizzes} quiz{student.totalQuizzes !== 1 ? 'zes' : ''}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar size={10} />
                      {formatDate(student.lastDate)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <p
                      className="text-2xl font-black tabular-nums"
                      style={{
                        color:
                          avgPct >= 70 ? 'var(--brand-green)' : avgPct >= 50 ? 'var(--brand-yellow)' : 'var(--brand-red)',
                      }}
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

              {isExpanded ? (
                <div className="flex flex-col gap-3 border-t border-[var(--border)] px-6 py-4 animate-slide-up">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quiz history</p>
                  {student.results
                    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                    .map((r) => {
                      const pct = Math.round((r.score / r.totalQuestions) * 100)
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedQuiz(r)}
                          className="flex w-full cursor-pointer items-center gap-4 rounded-xl bg-[var(--surface-3)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-4)]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{r.quizName}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(r.completedAt)}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <div className="flex items-center gap-1.5 text-sm">
                              <CheckCircle2 size={13} className="text-[var(--brand-green)]" />
                              <span className="font-bold text-foreground">{r.score}</span>
                              <span className="text-muted-foreground">/ {r.totalQuestions}</span>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-xs font-bold"
                              style={{
                                borderColor:
                                  pct >= 70 ? 'var(--brand-green)' : pct >= 50 ? 'var(--brand-yellow)' : 'var(--brand-red)',
                                color:
                                  pct >= 70 ? 'var(--brand-green)' : pct >= 50 ? 'var(--brand-yellow)' : 'var(--brand-red)',
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
              ) : null}
            </div>
          )
        })}
      </div>

      {selectedQuiz ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">{selectedQuiz.quizName}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(selectedQuiz.completedAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuiz(null)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-[var(--surface-3)]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-6 p-6">
              <div className="flex items-center justify-around rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
                <div className="text-center">
                  <p className="text-3xl font-black text-[var(--brand-green)]">{selectedQuiz.score}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Correct</p>
                </div>
                <div className="h-10 w-px bg-[var(--border)]" />
                <div className="text-center">
                  <p className="text-3xl font-black text-[var(--brand-red)]">
                    {selectedQuiz.totalQuestions - selectedQuiz.score}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Incorrect</p>
                </div>
                <div className="h-10 w-px bg-[var(--border)]" />
                <div className="text-center">
                  <p
                    className="text-3xl font-black"
                    style={{
                      color:
                        selectedQuiz.score / selectedQuiz.totalQuestions >= 0.7
                          ? 'var(--brand-green)'
                          : 'var(--brand-yellow)',
                    }}
                  >
                    {Math.round((selectedQuiz.score / selectedQuiz.totalQuestions) * 100)}%
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Score</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Question results</h3>
                {selectedQuiz.answers.map((answer, idx) => (
                  <div
                    key={`${selectedQuiz.id}-${idx}`}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-3)] p-3"
                  >
                    {answer.correct ? (
                      <CheckCircle2 size={20} className="shrink-0 text-[var(--brand-green)]" />
                    ) : (
                      <XCircle size={20} className="shrink-0 text-[var(--brand-red)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">Question {idx + 1}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{answer.correct ? 'Correct' : 'Incorrect'}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs font-bold ${answer.correct ? 'border-[var(--brand-green)] text-[var(--brand-green)]' : 'border-[var(--brand-red)] text-[var(--brand-red)]'}`}
                      style={{ background: 'transparent' }}
                    >
                      {answer.correct ? '✓' : '✗'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
