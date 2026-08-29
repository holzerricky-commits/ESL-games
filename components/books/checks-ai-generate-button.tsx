'use client'

import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChecksAiGenerateButtonProps {
  busy?: boolean
  disabled?: boolean
  /** Larger hero empty-state control */
  size?: 'sm' | 'lg'
  /** Idle label. Use “Regenerate” after a draft exists. */
  label?: string
  className?: string
  title?: string
  onClick: () => void
}

/** Apple-Intelligence-style Generate control for reading checks. */
export function ChecksAiGenerateButton({
  busy = false,
  disabled = false,
  size = 'sm',
  label = 'Generate',
  className,
  title,
  onClick,
}: ChecksAiGenerateButtonProps) {
  const lg = size === 'lg'
  const regenerating = label.toLowerCase().includes('regenerate')
  return (
    <button
      type="button"
      title={title}
      disabled={disabled || busy}
      data-busy={busy ? 'true' : undefined}
      className={cn(
        regenerating
          ? 'inline-flex items-center justify-center gap-1.5 rounded-full font-medium text-muted-foreground transition-colors hover:bg-[var(--surface-3)] hover:text-foreground disabled:pointer-events-none disabled:opacity-45'
          : cn(
              'checks-ai-generate inline-flex items-center justify-center gap-1.5 rounded-full font-medium text-foreground',
              'bg-[var(--surface-2)] shadow-[inset_0_0_0_1px_var(--border)]',
              'disabled:pointer-events-none disabled:opacity-45',
            ),
        lg ? 'h-12 gap-2 px-6 text-[15px]' : 'h-9 px-3.5 text-[13px]',
        className,
      )}
      onClick={onClick}
    >
      <Sparkles
        className={cn(lg ? 'size-4' : 'size-3.5', busy && 'animate-pulse')}
        aria-hidden
      />
      {busy ? (regenerating ? 'Regenerating…' : 'Generating…') : label}
    </button>
  )
}

/** Frost + drifting sparkles over the editor body while AI drafts. */
export function ChecksAiGeneratingOverlay() {
  return (
    <div
      className="checks-ai-frost pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[color-mix(in_srgb,var(--surface-1)_72%,transparent)] backdrop-blur-[3px]"
      aria-hidden
    >
      <span className="checks-ai-sparkle" />
      <span className="checks-ai-sparkle" />
      <span className="checks-ai-sparkle" />
      <span className="checks-ai-sparkle" />
      <span className="checks-ai-sparkle" />
      <div className="relative z-[1] flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-4 py-2 text-[13px] font-medium text-foreground shadow-[0_8px_28px_-12px_rgba(0,0,0,0.25)]">
        <Sparkles className="size-3.5 text-[var(--brand-blue)]" aria-hidden />
        Drafting checks…
      </div>
    </div>
  )
}
