import type { TodaysClassSessionRow } from '@/lib/students/selectors'
import { getWeekStart, isSameLocalDay, WEEK_STARTS_ON } from '@/lib/schedule/week-view-layout'

export const MONTH_WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

export function formatMonthLabel(monthStart: Date): string {
  return monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function getMonthGridDays(monthAnchor: Date, weekStartsOn: 0 | 1 = WEEK_STARTS_ON): Date[] {
  const year = monthAnchor.getFullYear()
  const month = monthAnchor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)
  const gridStart = getWeekStart(firstOfMonth, weekStartsOn)
  const gridEndWeekStart = getWeekStart(lastOfMonth, weekStartsOn)
  const gridEnd = new Date(gridEndWeekStart)
  gridEnd.setDate(gridEnd.getDate() + 6)

  const days: Date[] = []
  const cursor = new Date(gridStart)
  while (cursor <= gridEnd) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export function isDateInMonth(date: Date, monthAnchor: Date): boolean {
  return date.getFullYear() === monthAnchor.getFullYear() && date.getMonth() === monthAnchor.getMonth()
}

export function localDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function groupSessionsByDay(sessions: TodaysClassSessionRow[]): Map<string, TodaysClassSessionRow[]> {
  const map = new Map<string, TodaysClassSessionRow[]>()
  for (const row of sessions) {
    const when = new Date(row.session.scheduledFor)
    if (!Number.isFinite(when.getTime())) continue
    const key = localDayKey(when)
    const bucket = map.get(key) ?? []
    bucket.push(row)
    map.set(key, bucket)
  }
  for (const bucket of map.values()) {
    bucket.sort(
      (a, b) => new Date(a.session.scheduledFor).getTime() - new Date(b.session.scheduledFor).getTime(),
    )
  }
  return map
}

export function daysAheadToCover(end: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const diffMs = endDay.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / 86_400_000)
  return Math.max(30, Math.min(90, diffDays + 1))
}

export function isToday(date: Date): boolean {
  return isSameLocalDay(date, new Date())
}
