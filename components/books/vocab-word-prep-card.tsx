'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface VocabWordPrepCardProps {
  word: string
  definition: string
  examplesText: string
  index: number
  canRemove: boolean
  onWordChange: (value: string) => void
  onDefinitionChange: (value: string) => void
  onExamplesChange: (value: string) => void
  onRemove: () => void
  className?: string
}

const fieldReset =
  'w-full border-0 bg-transparent shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0'

export function VocabWordPrepCard({
  word,
  definition,
  examplesText,
  index,
  canRemove,
  onWordChange,
  onDefinitionChange,
  onExamplesChange,
  onRemove,
  className,
}: VocabWordPrepCardProps) {
  return (
    <article
      className={cn(
        'group relative rounded-2xl bg-[var(--surface-3)] p-4 sm:p-5',
        className,
      )}
    >
      <span className="sr-only">Word {index + 1}</span>

      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="absolute right-3 top-3 h-8 w-8 shrink-0 rounded-full text-muted-foreground/70 opacity-0 transition hover:bg-[var(--surface-2)] hover:text-foreground group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Remove word ${index + 1}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>

      <div className="space-y-3 pr-8">
        <input
          type="text"
          value={word}
          onChange={(e) => onWordChange(e.target.value)}
          placeholder="Word"
          aria-label={`Word ${index + 1}`}
          className={cn(
            fieldReset,
            'text-[28px] font-semibold leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/40',
          )}
        />

        <textarea
          value={definition}
          onChange={(e) => onDefinitionChange(e.target.value)}
          placeholder="Meaning"
          aria-label={`Meaning for word ${index + 1}`}
          rows={2}
          className={cn(
            fieldReset,
            'min-h-[3rem] resize-none text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/50',
          )}
        />

        <textarea
          value={examplesText}
          onChange={(e) => onExamplesChange(e.target.value)}
          placeholder="Add an example… (one per line)"
          aria-label={`Examples for word ${index + 1}`}
          rows={2}
          className={cn(
            fieldReset,
            'min-h-[2.5rem] resize-none text-[13px] leading-relaxed text-muted-foreground placeholder:text-muted-foreground/45',
          )}
        />
      </div>
    </article>
  )
}
