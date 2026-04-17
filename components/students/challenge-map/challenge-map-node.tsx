'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import type { ChallengeMapNode } from '@/lib/students/challenge-map'

interface ChallengeMapNodeCardProps {
  node: ChallengeMapNode
  showAction?: boolean
  compact?: boolean
  isSelected?: boolean
  onSelect?: (node: ChallengeMapNode) => void
}

export function ChallengeMapNodeCard({
  node,
  showAction = true,
  compact = false,
  isSelected = false,
  onSelect,
}: ChallengeMapNodeCardProps) {
  const isCurrent = node.status === 'current'
  const isLocked = node.status === 'locked'
  const isCompleted = node.status === 'completed'
  const statusLabel = isCompleted ? 'Completed' : isCurrent ? 'Current' : 'Locked'
  const nodeAriaLabel = `Step ${node.stepNumber}: ${node.title}. Status ${statusLabel}. ${
    isLocked ? node.unlockHint : `Reward ${node.reward} coins.`
  }`
  const circleSize = compact ? 'h-[3.75rem] w-[3.75rem]' : 'h-[5.75rem] w-[5.75rem]'
  const numberSizeClass = compact ? 'text-[1.25rem]' : 'text-[1.75rem]'
  const lockedNumberSizeClass = compact ? 'text-xl' : 'text-2xl'
  const labelClass = compact ? 'text-[11px]' : 'text-xs'
  const circleStateClass = isLocked
    ? 'border-[#7f8380] bg-gradient-to-b from-[#d3d7d3] to-[#a8ada9] text-[#454b48] saturate-0 shadow-[0_10px_18px_rgba(20,24,22,0.35)]'
    : isCurrent
      ? 'border-[#2ca9b8] bg-gradient-to-b from-[#fff0c6] to-[#f3bb5e] text-[#5a350c] shadow-[0_0_0_6px_rgba(44,169,184,0.45),0_14px_24px_rgba(17,59,66,0.42)]'
      : 'border-[#ab6b1d] bg-gradient-to-b from-[#fff4d1] to-[#e7b25b] text-[#5a350c] shadow-[0_12px_20px_rgba(56,44,19,0.42)]'
  const nodeTitleClass = isLocked ? 'text-[#6b726f]' : 'text-foreground'
  const metaTextClass = isLocked ? 'text-[#79817d]' : 'text-muted-foreground'
  const isClickable = showAction && Boolean(node.launchHref) && !isLocked
  const isSelectable = typeof onSelect === 'function'

  const content = (
    <>
      <div
        className={[
          'relative flex items-center justify-center rounded-full border-4 font-black transition-colors',
          circleSize,
          circleStateClass,
          isSelected ? 'ring-4 ring-[var(--brand-blue)]/55 ring-offset-2 ring-offset-transparent' : '',
        ].join(' ')}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[6px] rounded-full border border-white/45 shadow-[inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-3px_6px_rgba(0,0,0,0.16)]"
        />
        {isLocked ? (
          <>
            <span className={`${lockedNumberSizeClass} leading-none opacity-70`}>{node.stepNumber}</span>
            <span className="absolute -right-1 -top-1 rounded-full border border-[#666c69] bg-[#e2e6e3] p-1 shadow">
              <Lock className="h-4 w-4 text-[#4f5652]" aria-hidden />
            </span>
          </>
        ) : (
          <span className={`${numberSizeClass} leading-none drop-shadow-[0_1px_0_rgba(255,255,255,0.45)]`}>{node.stepNumber}</span>
        )}
      </div>
      <div className="mt-2 rounded-lg border border-black/15 bg-black/25 px-2 py-1 text-center backdrop-blur-[1px]">
        <p className={`${labelClass} font-semibold ${nodeTitleClass}`}>{node.title}</p>
      </div>
    </>
  )

  return (
    <article aria-label={nodeAriaLabel} className="mx-auto flex w-full max-w-[20rem] flex-col items-center">
      {isSelectable ? (
        <button
          type="button"
          onClick={() => onSelect?.(node)}
          className="inline-flex flex-col items-center rounded-xl outline-none transition-transform hover:scale-[1.05] focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]/70"
          aria-label={`Select step ${node.stepNumber}: ${node.title}`}
          aria-pressed={isSelected}
        >
          {content}
        </button>
      ) : isClickable && node.launchHref ? (
        <Link
          href={node.launchHref}
          className="inline-flex flex-col items-center rounded-xl outline-none transition-transform hover:scale-[1.05] focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]/70"
          aria-label={`Open step ${node.stepNumber}: ${node.title}`}
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </article>
  )
}
