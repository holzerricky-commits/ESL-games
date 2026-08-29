'use client'

import { LayoutGrid, List, Search } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  teacherFocusRingClass,
  teacherMenuContentClass,
} from '@/components/teacher-chrome'
import type {
  StudentsRosterSort,
  StudentsRosterStatusFilter,
  StudentsRosterViewMode,
} from '@/lib/students/students-roster-prefs'
import { cn } from '@/lib/utils'

interface StudentsRosterToolbarProps {
  query: string
  onQueryChange: (value: string) => void
  statusFilter: StudentsRosterStatusFilter
  onStatusFilterChange: (value: StudentsRosterStatusFilter) => void
  sort: StudentsRosterSort
  onSortChange: (value: StudentsRosterSort) => void
  viewMode: StudentsRosterViewMode
  onViewModeChange: (value: StudentsRosterViewMode) => void
  onBreakCount: number
  needsSetupCount: number
  className?: string
}

const STATUS_OPTIONS: Array<{
  value: StudentsRosterStatusFilter
  label: string
  count?: (needsSetup: number, onBreak: number) => number | null
}> = [
  { value: 'active', label: 'Active' },
  {
    value: 'needsSetup',
    label: 'Needs setup',
    count: (needsSetup) => (needsSetup > 0 ? needsSetup : null),
  },
  {
    value: 'onBreak',
    label: 'On break',
    count: (_needsSetup, onBreak) => (onBreak > 0 ? onBreak : null),
  },
]

export function StudentsRosterToolbar({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  onBreakCount,
  needsSetupCount,
  className,
}: StudentsRosterToolbarProps) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
    >
      <div className="chrome-search w-full max-w-none sm:w-64 sm:shrink-0">
        <Search size={15} strokeWidth={2} className="shrink-0 opacity-70" aria-hidden />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search students…"
          aria-label="Search students"
        />
      </div>

      <div className="flex flex-wrap items-center gap-0.5" role="radiogroup" aria-label="Filter by status">
        {STATUS_OPTIONS.map((option) => {
          const count = option.count?.(needsSetupCount, onBreakCount)
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={statusFilter === option.value}
              data-active={statusFilter === option.value}
              className={cn('chrome-nav-pill px-3.5 py-1.5 text-[13px]', teacherFocusRingClass)}
              onClick={() => onStatusFilterChange(option.value)}
            >
              {option.label}
              {count != null ? <span className="ml-1.5 text-muted-foreground">{count}</span> : null}
            </button>
          )
        })}
      </div>

      <Select value={sort} onValueChange={(value) => onSortChange(value as StudentsRosterSort)}>
        <SelectTrigger
          size="sm"
          aria-label="Sort students"
          className={cn(
            'h-9 min-w-[11rem] rounded-full border-0 bg-[var(--surface-3)] px-3.5 text-[13px] font-medium tracking-tight shadow-none hover:bg-[var(--surface-4)]',
            teacherFocusRingClass,
          )}
        >
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent className={teacherMenuContentClass}>
          <SelectItem value="name">Name A–Z</SelectItem>
          <SelectItem value="nextClass">Next class</SelectItem>
          <SelectItem value="needsSetup">Needs setup first</SelectItem>
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center" role="radiogroup" aria-label="Roster layout">
        <button
          type="button"
          role="radio"
          aria-checked={viewMode === 'list'}
          data-active={viewMode === 'list'}
          className={cn('chrome-nav-pill gap-1.5 px-3.5 py-1.5 text-[13px]', teacherFocusRingClass)}
          onClick={() => onViewModeChange('list')}
        >
          <List className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          <span className="sr-only sm:not-sr-only">List</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={viewMode === 'grid'}
          data-active={viewMode === 'grid'}
          className={cn('chrome-nav-pill gap-1.5 px-3.5 py-1.5 text-[13px]', teacherFocusRingClass)}
          onClick={() => onViewModeChange('grid')}
        >
          <LayoutGrid className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          <span className="sr-only sm:not-sr-only">Grid</span>
        </button>
      </div>
    </div>
  )
}
