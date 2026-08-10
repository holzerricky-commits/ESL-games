export type RecurringChangeScope = 'occurrence' | 'series'

export interface PendingRecurringScheduleChange {
  studentId: string
  studentName: string
  sessionId: string
  slotId: string
  targetDate: Date
  startMinute: number
  durationMinutes: number
  dayOfWeek: number
}
