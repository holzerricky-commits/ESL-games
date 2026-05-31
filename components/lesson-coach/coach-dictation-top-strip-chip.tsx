'use client'

import { Mic } from 'lucide-react'
import { stripChipClass } from '@/components/students/annotation-top-strip-controls'
import { useLessonCoachSync } from '@/lib/lesson-coach/lesson-coach-sync-context'
import { cn } from '@/lib/utils'

/** Dictation toggle in the book overlay text-tool top strip. */
export function CoachDictationTopStripChip({ idPrefix = 'top-text' }: { idPrefix?: string }) {
  const { dictationMode, setDictationMode } = useLessonCoachSync()

  return (
    <button
      type="button"
      id={`${idPrefix}-dictation`}
      className={cn(stripChipClass, dictationMode && 'bg-amber-500/30 text-amber-100 ring-1 ring-amber-400/50')}
      aria-pressed={dictationMode}
      aria-label={dictationMode ? 'Dictation mode on' : 'Dictation mode off'}
      title={dictationMode ? 'Dictation on — syncs text to coach' : 'Dictation off'}
      onClick={() => setDictationMode(!dictationMode)}
    >
      <Mic className="h-4 w-4" aria-hidden />
    </button>
  )
}
