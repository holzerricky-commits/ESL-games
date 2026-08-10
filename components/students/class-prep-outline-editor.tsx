'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  clampClassDurationMin,
  computePrepBlockRanges,
  createEmptyPrepBlock,
  formatActivityTypeLabel,
  formatPrepMinuteRange,
  getPrepDurationStatus,
  getRemainingPrepMinutes,
  hasLegacyPrepSummaryOnly,
  normalizePrepBlocksToDuration,
  prepDurationStatusLabel,
  sumPrepBlockMinutes,
  type ClassPrepOutlineViewMode,
  type ClassPrepTimeBlock,
  type PrepDurationStatus,
} from '@/lib/students/class-prep-outline'
import type { StudentClassSessionView } from '@/lib/students/types'
import { cn } from '@/lib/utils'

interface ClassPrepOutlineEditorProps {
  session: StudentClassSessionView
  blocks: ClassPrepTimeBlock[]
  viewMode: ClassPrepOutlineViewMode
  onViewModeChange: (mode: ClassPrepOutlineViewMode) => void
  onBlocksChange: (blocks: ClassPrepTimeBlock[]) => void
  onSave: () => void
  saveLabel?: string
  className?: string
}

function updateBlock(
  blocks: ClassPrepTimeBlock[],
  blockId: string,
  patch: Partial<ClassPrepTimeBlock>,
): ClassPrepTimeBlock[] {
  return blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block))
}

function durationBarClass(status: PrepDurationStatus): string {
  if (status === 'on-target') return 'bg-emerald-500'
  if (status === 'under') return 'bg-amber-500'
  if (status === 'over') return 'bg-[var(--brand-red)]'
  return 'bg-muted-foreground/40'
}

function durationStatusTextClass(status: PrepDurationStatus): string {
  if (status === 'on-target') return 'text-emerald-700 dark:text-emerald-400'
  if (status === 'under') return 'text-amber-800 dark:text-amber-300'
  if (status === 'over') return 'text-[var(--brand-red)]'
  return 'text-muted-foreground'
}

function PrepDurationBudget({
  totalMin,
  classDurationMin,
  status,
}: {
  totalMin: number
  classDurationMin: number
  status: PrepDurationStatus
}) {
  const target = clampClassDurationMin(classDurationMin)
  const fillPct = target > 0 ? Math.min(100, Math.round((totalMin / target) * 100)) : 0
  const diff = totalMin - target

  return (
    <div className="space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium tabular-nums text-foreground">
          {totalMin} / {target} min planned
        </span>
        <span className={cn('font-semibold', durationStatusTextClass(status))}>
          {prepDurationStatusLabel(status)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className={cn('h-full rounded-full transition-[width]', durationBarClass(status))}
          style={{ width: `${fillPct}%` }}
        />
      </div>
      {status === 'over' ? (
        <p className="text-[11px] text-[var(--brand-red)]">
          {diff} min over class length — trim blocks or use Fit to class length.
        </p>
      ) : null}
      {status === 'under' ? (
        <p className="text-[11px] text-amber-800 dark:text-amber-300">
          {Math.abs(diff)} min unplanned — add time or use Fit to class length.
        </p>
      ) : null}
    </div>
  )
}

export function ClassPrepOutlineEditor({
  session,
  blocks,
  viewMode,
  onViewModeChange,
  onBlocksChange,
  onSave,
  saveLabel = 'Save outline',
  className,
}: ClassPrepOutlineEditorProps) {
  const classDurationMin = clampClassDurationMin(session.durationMin)
  const totalMin = sumPrepBlockMinutes(blocks)
  const durationStatus = getPrepDurationStatus(totalMin, classDurationMin)
  const ranged = computePrepBlockRanges(blocks)
  const summary = session.prepOutlineSummary?.trim()
  const legacyOnly = hasLegacyPrepSummaryOnly(session)
  const remainingMin = getRemainingPrepMinutes(blocks, classDurationMin)

  function handleFitToClassLength() {
    if (blocks.length === 0) return
    onBlocksChange(normalizePrepBlocksToDuration(blocks, classDurationMin))
  }

  function handleAddBlock() {
    onBlocksChange([...blocks, createEmptyPrepBlock(remainingMin > 0 ? remainingMin : undefined)])
  }

  if (legacyOnly && blocks.length === 0) {
    return (
      <div className={cn('space-y-2', className)}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lesson outline</p>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2">
          <p className="whitespace-pre-line text-xs text-foreground md:text-sm line-clamp-8">{session.aiPrepSummary}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Older saved plan — generate a new outline to get editable time blocks for this {classDurationMin}-minute class.
          </p>
        </div>
      </div>
    )
  }

  if (blocks.length === 0) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-3">
          <p className="text-xs text-muted-foreground">
            No outline for this {classDurationMin}-minute class yet.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => onBlocksChange([createEmptyPrepBlock(classDurationMin)])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add block
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lesson outline</p>
        <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--card)] p-0.5">
          <button
            type="button"
            className={cn(
              'rounded px-2 py-1 text-xs',
              viewMode === 'quick' ? 'bg-[var(--surface-2)] font-semibold text-foreground' : 'text-muted-foreground',
            )}
            onClick={() => onViewModeChange('quick')}
          >
            Quick
          </button>
          <button
            type="button"
            className={cn(
              'rounded px-2 py-1 text-xs',
              viewMode === 'detailed' ? 'bg-[var(--surface-2)] font-semibold text-foreground' : 'text-muted-foreground',
            )}
            onClick={() => onViewModeChange('detailed')}
          >
            Detailed
          </button>
        </div>
      </div>

      <PrepDurationBudget totalMin={totalMin} classDurationMin={classDurationMin} status={durationStatus} />

      {summary ? <p className="text-xs leading-snug text-muted-foreground md:text-sm">{summary}</p> : null}

      <ul className="space-y-2">
        {ranged.map((block) => (
          <li key={block.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="shrink-0 rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground">
                    {formatPrepMinuteRange(block.startMin, block.endMin)}
                  </span>
                  <input
                    className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-background px-2 py-1 text-sm font-medium text-foreground"
                    value={block.label}
                    onChange={(e) => onBlocksChange(updateBlock(blocks, block.id, { label: e.target.value }))}
                    aria-label="Block title"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <input
                      type="number"
                      min={1}
                      max={classDurationMin}
                      className="w-14 rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs tabular-nums"
                      value={block.minutes}
                      onChange={(e) =>
                        onBlocksChange(
                          updateBlock(blocks, block.id, {
                            minutes: Math.max(1, Math.min(classDurationMin, Number(e.target.value) || 1)),
                          }),
                        )
                      }
                      aria-label="Minutes"
                    />
                    min
                  </label>
                </div>

                {viewMode === 'quick' ? (
                  <p className="text-xs text-muted-foreground">{formatActivityTypeLabel(block.activityType)}</p>
                ) : (
                  <div className="space-y-2">
                    <input
                      className="w-full rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs"
                      value={block.activityType}
                      onChange={(e) => onBlocksChange(updateBlock(blocks, block.id, { activityType: e.target.value }))}
                      placeholder="Activity type"
                    />
                    <textarea
                      className="min-h-[52px] w-full rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs"
                      value={block.objective}
                      onChange={(e) => onBlocksChange(updateBlock(blocks, block.id, { objective: e.target.value }))}
                      placeholder="Objective"
                    />
                    <textarea
                      className="min-h-[44px] w-full rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs"
                      value={(block.teacherMoves ?? []).join('; ')}
                      onChange={(e) =>
                        onBlocksChange(
                          updateBlock(blocks, block.id, {
                            teacherMoves: e.target.value
                              .split(';')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }),
                        )
                      }
                      placeholder="Teacher moves (separate with ;)"
                    />
                    <input
                      className="w-full rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs"
                      value={block.studentOutput ?? ''}
                      onChange={(e) => onBlocksChange(updateBlock(blocks, block.id, { studentOutput: e.target.value }))}
                      placeholder="Student output"
                    />
                    <input
                      className="w-full rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs"
                      value={block.checkForUnderstanding ?? ''}
                      onChange={(e) =>
                        onBlocksChange(updateBlock(blocks, block.id, { checkForUnderstanding: e.target.value }))
                      }
                      placeholder="Check for understanding"
                    />
                  </div>
                )}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onBlocksChange(blocks.filter((row) => row.id !== block.id))}
                aria-label="Remove block"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={handleAddBlock}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add block
          {remainingMin > 0 ? <span className="ml-1 text-muted-foreground">({remainingMin} min left)</span> : null}
        </Button>
        {durationStatus !== 'on-target' && durationStatus !== 'empty' ? (
          <Button type="button" size="sm" variant="outline" onClick={handleFitToClassLength}>
            Fit to class length
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
