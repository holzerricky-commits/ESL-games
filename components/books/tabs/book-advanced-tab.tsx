'use client'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { BOOK_SETUP_COPY } from '@/lib/books/book-setup-copy'
import type { BookLessonPartRecord, BookLessonRecord, BookUnitRecord } from '@/lib/books/types'

interface AiRange {
  startPage: number
  endPage: number
}

interface BookAdvancedTabProps {
  selectedUnit: BookUnitRecord | null
  selectedLesson: BookLessonRecord | null
  selectedPart: BookLessonPartRecord | null
  unitText: string
  lessonText: string
  partText: string
  unitContextLoading: boolean
  lessonContextLoading: boolean
  editingLevel: Record<'unit' | 'lesson' | 'part', boolean>
  aiPanelOpen: Record<'unit' | 'lesson' | 'part', boolean>
  aiRange: { unit: AiRange; lesson: AiRange; part: AiRange }
  aiBusyLevel: 'unit' | 'lesson' | null
  contextError: string | null
  selectedStudentId: string | null
  isSavingStudentStart: boolean
  onSaveStudentStart: () => void
  onSetUnitText: (value: string) => void
  onSetLessonText: (value: string) => void
  onSetPartText: (value: string) => void
  onToggleEditing: (level: 'unit' | 'lesson' | 'part') => void
  onToggleAiPanel: (level: 'unit' | 'lesson' | 'part') => void
  onSetAiRange: React.Dispatch<
    React.SetStateAction<Record<'book' | 'unit' | 'lesson' | 'part', { startPage: number; endPage: number }>>
  >
  onRunUnitAi: () => void
  onRunLessonAi: () => void
}

export function BookAdvancedTab({
  selectedUnit,
  selectedLesson,
  selectedPart,
  unitText,
  lessonText,
  partText,
  unitContextLoading,
  lessonContextLoading,
  editingLevel,
  aiPanelOpen,
  aiRange,
  aiBusyLevel,
  contextError,
  selectedStudentId,
  isSavingStudentStart,
  onSaveStudentStart,
  onSetUnitText,
  onSetLessonText,
  onSetPartText,
  onToggleEditing,
  onToggleAiPanel,
  onSetAiRange,
  onRunUnitAi,
  onRunLessonAi,
}: BookAdvancedTabProps) {
  const hasSelection = selectedUnit || selectedLesson || selectedPart

  if (!hasSelection) {
    return (
      <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{BOOK_SETUP_COPY.advanced.emptyHint}</p>
    )
  }

  return (
    <div className="space-y-4">
      {selectedStudentId && selectedUnit ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/50 p-3">
          <p className="text-xs text-muted-foreground mb-2">
            Student linked in URL — save the current book page as this book’s starting place.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="text-xs"
            disabled={isSavingStudentStart}
            onClick={onSaveStudentStart}
          >
            {isSavingStudentStart ? 'Saving…' : 'Use this page as start'}
          </Button>
        </div>
      ) : null}

      <section className="ui-section space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            Unit {selectedUnit ? `— ${selectedUnit.title}` : ''}
          </p>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={!selectedUnit}
              onClick={() => onToggleEditing('unit')}
            >
              {editingLevel.unit ? 'Done' : 'Edit'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={!selectedUnit}
              onClick={() => onToggleAiPanel('unit')}
            >
              AI
            </Button>
          </div>
        </div>
        {!selectedUnit ? (
          <p className="text-sm text-muted-foreground">Select a unit from the Outline tab.</p>
        ) : editingLevel.unit ? (
          <Textarea
            value={unitText}
            onChange={(event) => onSetUnitText(event.target.value)}
            className="min-h-24 bg-background"
            placeholder="Write unit context, goals, and focus."
          />
        ) : (
          <p className="text-sm text-foreground">
            {unitContextLoading ? 'Loading context...' : unitText || `Not extracted for this unit (${selectedUnit.title}).`}
          </p>
        )}
        {aiPanelOpen.unit && selectedUnit ? (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <Label className="text-xs text-muted-foreground">
                Start
                <Input
                  type="number"
                  min={1}
                  value={aiRange.unit.startPage}
                  onChange={(e) => {
                    const startPage = Math.max(1, Number(e.target.value || 1))
                    onSetAiRange((prev) => ({
                      ...prev,
                      unit: { startPage, endPage: Math.max(startPage, prev.unit.endPage) },
                    }))
                  }}
                  className="mt-1 h-8 w-24 text-xs"
                />
              </Label>
              <Label className="text-xs text-muted-foreground">
                End
                <Input
                  type="number"
                  min={1}
                  value={aiRange.unit.endPage}
                  onChange={(e) => {
                    const endPage = Math.max(1, Number(e.target.value || aiRange.unit.startPage))
                    onSetAiRange((prev) => ({
                      ...prev,
                      unit: { ...prev.unit, endPage: Math.max(prev.unit.startPage, endPage) },
                    }))
                  }}
                  className="mt-1 h-8 w-24 text-xs"
                />
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={aiBusyLevel === 'unit'}
                onClick={onRunUnitAi}
              >
                {aiBusyLevel === 'unit' ? 'Generating...' : 'Run AI'}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="ui-section space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            Lesson {selectedLesson ? `— ${selectedLesson.title}` : ''}
          </p>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={!selectedLesson}
              onClick={() => onToggleEditing('lesson')}
            >
              {editingLevel.lesson ? 'Done' : 'Edit'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={!selectedLesson}
              onClick={() => onToggleAiPanel('lesson')}
            >
              AI
            </Button>
          </div>
        </div>
        {!selectedLesson ? (
          <p className="text-sm text-muted-foreground">Select a lesson from the Outline tab.</p>
        ) : editingLevel.lesson ? (
          <Textarea
            value={lessonText}
            onChange={(event) => onSetLessonText(event.target.value)}
            className="min-h-24 bg-background"
            placeholder="Write lesson context, goals, and strategy."
          />
        ) : (
          <p className="text-sm text-foreground">
            {lessonContextLoading
              ? 'Loading context...'
              : lessonText || `Not extracted for this lesson (${selectedLesson.title}).`}
          </p>
        )}
        {aiPanelOpen.lesson && selectedLesson ? (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <Label className="text-xs text-muted-foreground">
                Start
                <Input
                  type="number"
                  min={1}
                  value={aiRange.lesson.startPage}
                  onChange={(e) => {
                    const startPage = Math.max(1, Number(e.target.value || 1))
                    onSetAiRange((prev) => ({
                      ...prev,
                      lesson: { startPage, endPage: Math.max(startPage, prev.lesson.endPage) },
                    }))
                  }}
                  className="mt-1 h-8 w-24 text-xs"
                />
              </Label>
              <Label className="text-xs text-muted-foreground">
                End
                <Input
                  type="number"
                  min={1}
                  value={aiRange.lesson.endPage}
                  onChange={(e) => {
                    const endPage = Math.max(1, Number(e.target.value || aiRange.lesson.startPage))
                    onSetAiRange((prev) => ({
                      ...prev,
                      lesson: { ...prev.lesson, endPage: Math.max(prev.lesson.startPage, endPage) },
                    }))
                  }}
                  className="mt-1 h-8 w-24 text-xs"
                />
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={aiBusyLevel === 'lesson'}
                onClick={onRunLessonAi}
              >
                {aiBusyLevel === 'lesson' ? 'Generating...' : 'Run AI'}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="ui-section space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            Lesson Part {selectedPart ? `— ${selectedPart.title}` : ''}
          </p>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={!selectedPart}
              onClick={() => onToggleEditing('part')}
            >
              {editingLevel.part ? 'Done' : 'Edit'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={!selectedPart}
              onClick={() => onToggleAiPanel('part')}
            >
              AI
            </Button>
          </div>
        </div>
        {!selectedPart ? (
          <p className="text-sm text-muted-foreground">Select a lesson part from the Outline tab.</p>
        ) : editingLevel.part ? (
          <Textarea
            value={partText}
            onChange={(event) => onSetPartText(event.target.value)}
            className="min-h-24 bg-background"
            placeholder="Write part-level context and activity goals."
          />
        ) : (
          <p className="text-sm text-foreground">
            {partText || `No generated context yet for ${selectedPart.title}.`}
          </p>
        )}
        {aiPanelOpen.part && selectedPart ? (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <Label className="text-xs text-muted-foreground">
                Start
                <Input
                  type="number"
                  min={1}
                  value={aiRange.part.startPage}
                  onChange={(e) => {
                    const startPage = Math.max(1, Number(e.target.value || 1))
                    onSetAiRange((prev) => ({
                      ...prev,
                      part: { startPage, endPage: Math.max(startPage, prev.part.endPage) },
                    }))
                  }}
                  className="mt-1 h-8 w-24 text-xs"
                />
              </Label>
              <Label className="text-xs text-muted-foreground">
                End
                <Input
                  type="number"
                  min={1}
                  value={aiRange.part.endPage}
                  onChange={(e) => {
                    const endPage = Math.max(1, Number(e.target.value || aiRange.part.startPage))
                    onSetAiRange((prev) => ({
                      ...prev,
                      part: { ...prev.part, endPage: Math.max(prev.part.startPage, endPage) },
                    }))
                  }}
                  className="mt-1 h-8 w-24 text-xs"
                />
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => toast.info('Part-level AI generation endpoint will be added next.')}
              >
                Run AI
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {contextError ? <p className="text-xs text-[var(--brand-red)]">{contextError}</p> : null}
    </div>
  )
}
