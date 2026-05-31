'use client'

import { Mic } from 'lucide-react'
import { useLessonCoachSync } from '@/lib/lesson-coach/lesson-coach-sync-context'
import { cn } from '@/lib/utils'

/** Dictation toggle in the lesson notebook header (type mode). */
export function CoachDictationLessonPaperChip({ disabled }: { disabled?: boolean }) {
  const { dictationMode, setDictationMode } = useLessonCoachSync()

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors',
        dictationMode
          ? 'border-amber-500/50 bg-amber-500/15 text-amber-800'
          : 'border-[#dadada] bg-white text-[#6b6b6b] hover:border-[#bbb] hover:text-[#2f2f2f]',
        disabled && 'pointer-events-none opacity-40',
      )}
      aria-pressed={dictationMode}
      aria-label={dictationMode ? 'Dictation mode on' : 'Dictation mode off'}
      title={dictationMode ? 'Dictation on' : 'Dictation off'}
      onClick={() => setDictationMode(!dictationMode)}
    >
      <Mic className="h-4 w-4" aria-hidden />
    </button>
  )
}
