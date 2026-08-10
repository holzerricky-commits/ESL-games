'use client'

import { LayoutGrid, List, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
      <div className="relative w-full sm:w-64 sm:shrink-0">
        <Search
          size={14}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search students..."
          className="pl-8"
          aria-label="Search students"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={statusFilter}
          onValueChange={(value) => onStatusFilterChange(value as StudentsRosterStatusFilter)}
        >
          <SelectTrigger size="sm" aria-label="Filter by status" className="min-w-[9.5rem]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="needsSetup">
              Needs setup{needsSetupCount > 0 ? ` (${needsSetupCount})` : ''}
            </SelectItem>
            <SelectItem value="onBreak">
              On break{onBreakCount > 0 ? ` (${onBreakCount})` : ''}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(value) => onSortChange(value as StudentsRosterSort)}>
          <SelectTrigger size="sm" aria-label="Sort students" className="min-w-[11rem]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="nextClass">Next class</SelectItem>
            <SelectItem value="needsSetup">Needs setup first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(value) => {
          if (value === 'list' || value === 'grid') onViewModeChange(value)
        }}
        variant="outline"
        size="sm"
        className="ml-auto"
        aria-label="Roster layout"
      >
        <ToggleGroupItem value="list" aria-label="List view" className="px-2.5">
          <List className="h-4 w-4" aria-hidden />
          <span className="sr-only sm:not-sr-only sm:ml-1.5">List</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="grid" aria-label="Grid view" className="px-2.5">
          <LayoutGrid className="h-4 w-4" aria-hidden />
          <span className="sr-only sm:not-sr-only sm:ml-1.5">Grid</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
