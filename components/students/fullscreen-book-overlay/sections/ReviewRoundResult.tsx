'use client'

import { Check } from 'lucide-react'
import type { LessonVaultCard, LessonVaultReviewStatus } from '@/lib/lesson-vault/types'
import { cn } from '@/lib/utils'
import { CardPicture, REVIEW_PRIMARY_BTN } from './lesson-vault-review-parts'

export type ReviewRoundRow = {
  card: LessonVaultCard
  result: 'hit' | 'miss'
  status: LessonVaultReviewStatus
}

const STATUS_PILL =
  'shrink-0 cursor-pointer rounded-full px-3 py-1 text-sm font-semibold'

function statusPillClass(status: LessonVaultReviewStatus): string {
  if (status === 'mastered') return 'bg-emerald-400/20 text-emerald-100'
  if (status === 'learned') return 'bg-sky-400/20 text-sky-100'
  return 'bg-amber-400/20 text-amber-100'
}

function statusLabel(status: LessonVaultReviewStatus): string {
  if (status === 'mastered') return 'Mastered'
  if (status === 'learned') return 'Learned'
  return 'Practising'
}

/** The words from a finished round, each with a label the teacher can flip before saving. */
export function ReviewRoundResult({
  rows,
  onToggle,
  onSave,
}: {
  rows: readonly ReviewRoundRow[]
  onToggle: (cardId: string) => void
  onSave: () => void
}) {
  if (rows.length === 0) return null
  return (
    <div className="mt-2 flex w-full max-w-xl flex-col gap-3 text-left">
      <p className="text-center text-sm font-semibold uppercase tracking-wider text-white/50">Save this review</p>
      <ul className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
        {rows.map((row) => {
          const label = statusLabel(row.status)
          return (
            <li key={row.card.id} className="flex items-center gap-3 rounded-2xl bg-white/10 py-1.5 pr-2 pl-1.5">
              <CardPicture card={row.card} className="h-8 w-8 shrink-0 rounded-full" letterClassName="text-sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{row.card.word}</span>
                <span className="block text-xs text-white/50">{row.result === 'hit' ? 'First try' : 'Missed'}</span>
              </span>
              <button
                type="button"
                className={cn(STATUS_PILL, statusPillClass(row.status))}
                aria-label={`${row.card.word}, ${label}. Click to change.`}
                onClick={() => onToggle(row.card.id)}
              >
                {label}
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" className={cn(REVIEW_PRIMARY_BTN, 'self-center')} onClick={onSave}>
        <Check className="h-4 w-4" aria-hidden />
        Save review
      </button>
    </div>
  )
}
