'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface StudentsSearchBarProps {
  value: string
  onChange: (value: string) => void
  count: number
}

export function StudentsSearchBar({ value, onChange, count }: StudentsSearchBarProps) {
  return (
    <div className="sticky top-0 z-10 mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/95 px-4 py-3 backdrop-blur">
      <div className="relative min-w-[260px] flex-1">
        <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search students..."
          className="pl-8"
          aria-label="Search students"
        />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{count} students</p>
    </div>
  )
}
