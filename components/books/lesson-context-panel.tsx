'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { BookLessonRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

type ContextLevel = 'unit' | 'lesson'

interface AiRange {
  startPage: number
  endPage: number
}

interface LessonContextPanelProps {
  unit: BookUnitRecord
  lesson: BookLessonRecord
  unitText: string
  lessonText: string
  unitContextLoading: boolean
  lessonContextLoading: boolean
  aiRange: Record<ContextLevel, AiRange>
  aiBusyLevel: ContextLevel | null
  contextError: string | null
  onSetUnitText: (value: string) => void
  onSetLessonText: (value: string) => void
  onSetAiRange: (level: ContextLevel, range: AiRange) => void
  onRunUnitAi: () => void
  onRunLessonAi: () => void
}

/** Unit + lesson context notes (AI-extracted or hand-written), shown on lesson and part pages. */
export function LessonContextPanel({
  unit,
  lesson,
  unitText,
  lessonText,
  unitContextLoading,
  lessonContextLoading,
  aiRange,
  aiBusyLevel,
  contextError,
  onSetUnitText,
  onSetLessonText,
  onSetAiRange,
  onRunUnitAi,
  onRunLessonAi,
}: LessonContextPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <section className="rounded-2xl bg-[var(--surface-2)]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold tracking-tight text-foreground">Context</span>
          <span className="block text-[12px] text-muted-foreground">
            Unit theme and lesson skill notes, written by hand or extracted with AI.
          </span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="grid gap-4 px-4 pb-4 lg:grid-cols-2">
          <ContextSection
            heading={`Unit — ${unit.title}`}
            text={unitText}
            loading={unitContextLoading}
            emptyText="Not extracted for this unit yet."
            placeholder="Write unit context, goals, and focus."
            range={aiRange.unit}
            busy={aiBusyLevel === 'unit'}
            onChangeText={onSetUnitText}
            onChangeRange={(range) => onSetAiRange('unit', range)}
            onRunAi={onRunUnitAi}
          />
          <ContextSection
            heading={`Lesson — ${lesson.title}`}
            text={lessonText}
            loading={lessonContextLoading}
            emptyText="Not extracted for this lesson yet."
            placeholder="Write lesson context, goals, and strategy."
            range={aiRange.lesson}
            busy={aiBusyLevel === 'lesson'}
            onChangeText={onSetLessonText}
            onChangeRange={(range) => onSetAiRange('lesson', range)}
            onRunAi={onRunLessonAi}
          />
          {contextError ? (
            <p className="text-xs text-[var(--brand-red)] lg:col-span-2">{contextError}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function ContextSection({
  heading,
  text,
  loading,
  emptyText,
  placeholder,
  range,
  busy,
  onChangeText,
  onChangeRange,
  onRunAi,
}: {
  heading: string
  text: string
  loading: boolean
  emptyText: string
  placeholder: string
  range: AiRange
  busy: boolean
  onChangeText: (value: string) => void
  onChangeRange: (range: AiRange) => void
  onRunAi: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  return (
    <div className="ui-section space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{heading}</p>
        <div className="flex shrink-0 gap-1">
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Done' : 'Edit'}
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAiOpen((v) => !v)}>
            AI
          </Button>
        </div>
      </div>
      {editing ? (
        <Textarea
          value={text}
          onChange={(event) => onChangeText(event.target.value)}
          className="min-h-24 bg-background"
          placeholder={placeholder}
        />
      ) : (
        <p className="text-sm text-foreground">{loading ? 'Loading context...' : text || emptyText}</p>
      )}
      {aiOpen ? (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <Label className="text-xs text-muted-foreground">
            Start
            <Input
              type="number"
              min={1}
              value={range.startPage}
              onChange={(e) => {
                const startPage = Math.max(1, Number(e.target.value || 1))
                onChangeRange({ startPage, endPage: Math.max(startPage, range.endPage) })
              }}
              className="mt-1 h-8 w-24 text-xs"
            />
          </Label>
          <Label className="text-xs text-muted-foreground">
            End
            <Input
              type="number"
              min={1}
              value={range.endPage}
              onChange={(e) => {
                const endPage = Math.max(1, Number(e.target.value || range.startPage))
                onChangeRange({ startPage: range.startPage, endPage: Math.max(range.startPage, endPage) })
              }}
              className="mt-1 h-8 w-24 text-xs"
            />
          </Label>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={onRunAi}>
            {busy ? 'Generating...' : 'Run AI'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
