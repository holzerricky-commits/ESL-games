'use client'

import { ChevronLeft, ChevronRight, Vault } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClassToolDrawerShell } from '@/components/students/fullscreen-book-overlay/sections/ClassToolDrawerShell'
import type { BookLessonRecord } from '@/lib/books/types'
import type { LessonVaultCard } from '@/lib/lesson-vault/types'

type LessonVaultPanelProps = {
  open: boolean
  onClose: () => void
  hasStudent: boolean
  viewedLesson: BookLessonRecord | null
  cards: LessonVaultCard[]
  pageLesson: BookLessonRecord | null
  hasPreviousLesson: boolean
  hasNextLesson: boolean
  onPreviousLesson: () => void
  onNextLesson: () => void
  onShowPageLesson: () => void
}

const NAV_BTN =
  'h-7 w-7 shrink-0 cursor-pointer rounded-md text-[#a1a1aa] hover:bg-white/5 hover:text-[#f4f4f5] disabled:opacity-30'

export function LessonVaultPanel({
  open,
  onClose,
  hasStudent,
  viewedLesson,
  cards,
  pageLesson,
  hasPreviousLesson,
  hasNextLesson,
  onPreviousLesson,
  onNextLesson,
  onShowPageLesson,
}: LessonVaultPanelProps) {
  const pageIsOtherLesson = pageLesson != null && viewedLesson != null && pageLesson.id !== viewedLesson.id

  return (
    <ClassToolDrawerShell
      open={open}
      onClose={onClose}
      title="Vault"
      icon={Vault}
      ariaLabel="Words saved for this lesson"
      headerExtra={
        viewedLesson ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={NAV_BTN}
                disabled={!hasPreviousLesson}
                onClick={onPreviousLesson}
                aria-label="Previous lesson"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="min-w-0 flex-1 truncate text-center text-base font-semibold text-[#f4f4f5]">
                {viewedLesson.title}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={NAV_BTN}
                disabled={!hasNextLesson}
                onClick={onNextLesson}
                aria-label="Next lesson"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {pageIsOtherLesson ? (
              <div className="flex items-center justify-between gap-2 rounded-md bg-white/[0.04] px-2.5 py-1.5">
                <p className="min-w-0 truncate text-xs text-white/55">The page is on {pageLesson.title}</p>
                <button
                  type="button"
                  className="shrink-0 cursor-pointer text-xs font-medium text-sky-300 hover:text-sky-200"
                  onClick={onShowPageLesson}
                >
                  Show this page’s lesson
                </button>
              </div>
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {!hasStudent ? (
          <p className="pt-2 text-sm text-white/55">Open a student session to use the vault.</p>
        ) : !viewedLesson ? (
          <p className="pt-2 text-sm text-white/55">
            This page is not part of a lesson yet. Outline the book to use the vault.
          </p>
        ) : cards.length === 0 ? (
          <p className="pt-2 text-sm leading-relaxed text-white/55">
            No words yet. In Select mode, click a word on the page and choose Save to vault.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cards.map((card) => (
              <li key={card.id} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-lg font-semibold text-[#f4f4f5]">{card.word}</p>
                  {card.partTitle ? (
                    <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">
                      {card.partTitle}
                    </span>
                  ) : null}
                </div>
                {card.sentence ? (
                  <p className="mt-1 text-sm leading-relaxed text-[#d4d4d8]">{card.sentence}</p>
                ) : (
                  <p className="mt-1 text-sm italic text-white/35">No sentence yet</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </ClassToolDrawerShell>
  )
}
