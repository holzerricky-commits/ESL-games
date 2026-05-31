'use client'

import { useMemo, useState } from 'react'
import { BookOpen, PanelRightClose, RotateCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useVocabNotebook, type NotebookStatus } from '@/components/students/fullscreen-book-overlay/hooks/useVocabNotebook'

interface VocabNotebookPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type NotebookTab = 'notebook' | 'review' | 'mastered'

export function VocabNotebookPanel({ open, onOpenChange }: VocabNotebookPanelProps) {
  const [tab, setTab] = useState<NotebookTab>('notebook')
  const [search, setSearch] = useState('')
  const [showCardBack, setShowCardBack] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)
  const { entries, reviewEntries, dueReviewEntries, markStatus } = useVocabNotebook()

  const normalizedQuery = search.trim().toLowerCase()
  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (!normalizedQuery) return true
        return (
          entry.source.toLowerCase().includes(normalizedQuery) ||
          entry.chinese.toLowerCase().includes(normalizedQuery) ||
          entry.pinyin.toLowerCase().includes(normalizedQuery)
        )
      }),
    [entries, normalizedQuery],
  )
  const masteredEntries = filteredEntries.filter((entry) => entry.status === 'mastered')
  const dueNowCount = dueReviewEntries.length
  const upcomingCount = Math.max(0, reviewEntries.length - dueNowCount)
  const masteredCount = entries.filter((entry) => entry.status === 'mastered').length
  const activeCard = dueReviewEntries.length > 0 ? dueReviewEntries[reviewIndex % dueReviewEntries.length] : null

  const markCardStatus = (status: NotebookStatus) => {
    if (!activeCard) return
    markStatus(activeCard.id, status)
    setShowCardBack(false)
    setReviewIndex((n) => n + 1)
  }

  return (
    <div
      className={cn(
        'pointer-events-auto absolute inset-0 z-[72] flex h-full min-h-0 flex-col bg-[#0c1524]/96 backdrop-blur-sm',
        !open && 'pointer-events-none hidden',
      )}
      aria-hidden={!open}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3">
        <BookOpen className="h-4 w-4 text-white/80" aria-hidden />
        <p className="text-sm font-semibold text-white">Vocabulary notebook</p>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={tab === 'notebook' ? 'secondary' : 'ghost'}
            className="h-8 text-xs text-white hover:bg-white/15"
            onClick={() => setTab('notebook')}
          >
            Notebook
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === 'review' ? 'secondary' : 'ghost'}
            className="h-8 text-xs text-white hover:bg-white/15"
            onClick={() => setTab('review')}
          >
            <RotateCw className="mr-1 h-3.5 w-3.5" aria-hidden />
            Review
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === 'mastered' ? 'secondary' : 'ghost'}
            className="h-8 text-xs text-white hover:bg-white/15"
            onClick={() => setTab('mastered')}
          >
            Mastered
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-white hover:bg-white/15"
            onClick={() => onOpenChange(false)}
          >
            <PanelRightClose className="h-4 w-4" aria-hidden />
            Back to book
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-amber-100/80">Due now</p>
            <p className="text-base font-semibold text-amber-50">{dueNowCount}</p>
          </div>
          <div className="rounded-lg border border-sky-300/30 bg-sky-300/10 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-sky-100/80">Upcoming</p>
            <p className="text-base font-semibold text-sky-50">{upcomingCount}</p>
          </div>
          <div className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-emerald-100/80">Mastered</p>
            <p className="text-base font-semibold text-emerald-50">{masteredCount}</p>
          </div>
        </div>
        {tab === 'review' ? (
          activeCard ? (
            <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 rounded-2xl border border-white/15 bg-white/[0.06] p-4">
              <p className="text-xs text-white/60">
                Due now {reviewIndex % dueReviewEntries.length + 1}/{dueReviewEntries.length}
              </p>
              <button
                type="button"
                className="w-full flex-1 rounded-xl border border-white/15 bg-[#0f1d33] p-4 text-left"
                onClick={() => setShowCardBack((v) => !v)}
              >
                {showCardBack ? (
                  <div className="space-y-2">
                    <p className="text-2xl font-semibold text-white">{activeCard.chinese}</p>
                    {activeCard.pinyin ? <p className="text-sm text-white/75">{activeCard.pinyin}</p> : null}
                    {activeCard.exampleEn && activeCard.exampleZh ? (
                      <p className="text-sm leading-relaxed text-white/70">
                        {activeCard.exampleEn}
                        {' -> '}
                        {activeCard.exampleZh}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-white">{activeCard.source}</p>
                    {activeCard.imageUrl ? (
                      <img
                        src={activeCard.imageUrl}
                        alt={`Flashcard visual for ${activeCard.source}`}
                        className="h-44 w-full rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                )}
              </button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" className="h-8 bg-white/15 text-white hover:bg-white/25" onClick={() => markCardStatus('new')}>
                  Hard
                </Button>
                <Button type="button" size="sm" variant="secondary" className="h-8 bg-white/15 text-white hover:bg-white/25" onClick={() => markCardStatus('learning')}>
                  Okay
                </Button>
                <Button type="button" size="sm" variant="secondary" className="h-8 bg-white/15 text-white hover:bg-white/25" onClick={() => markCardStatus('mastered')}>
                  Easy
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <p className="text-sm text-white/65">
                No cards due right now. Reviewing queue total: {reviewEntries.length}.
              </p>
            </div>
          )
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2">
              <Search className="h-4 w-4 text-white/60" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search word, Chinese, or pinyin..."
                className="h-9 border-white/15 bg-white/10 text-sm text-white placeholder:text-white/45"
              />
            </div>
            <ul className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
              {(tab === 'mastered' ? masteredEntries : filteredEntries).map((entry) => (
                <li key={entry.id} className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{entry.source}</p>
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
                      {entry.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/80">{entry.chinese}</p>
                  {entry.pinyin ? <p className="text-xs text-white/65">{entry.pinyin}</p> : null}
                  {entry.imageUrl ? (
                    <img
                      src={entry.imageUrl}
                      alt={`Saved visual for ${entry.source}`}
                      className="mt-2 h-28 w-full rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </li>
              ))}
              {(tab === 'mastered' ? masteredEntries : filteredEntries).length === 0 ? (
                <li className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-4 text-sm text-white/60">
                  {entries.length === 0
                    ? 'No saved words yet. Use Translate Dock -> Save word.'
                    : 'No entries match this filter.'}
                </li>
              ) : null}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

