import type { StudentHomeSection, StudentProfileTab } from '@/lib/students/types'
import type { StudentClassSession, WeeklySlotAssignment } from '@/lib/types'
import { DAY_LABELS, fmtScheduleMinute } from '@/lib/schedule/schedule-time-labels'

export const DEFAULT_STUDENT_PLAN_TAB: StudentProfileTab = 'classes'
export const DEFAULT_STUDENT_PROFILE_TAB: StudentProfileTab = 'map'
export const DEFAULT_STUDENT_HOME_SECTION: StudentHomeSection = 'classes'

const STUDENT_PROFILE_PREVIEW_TABS: StudentProfileTab[] = ['map', 'avatar', 'words', 'info']

/** Legacy student preview tabs — map, avatar, words, info. */
export function resolveStudentProfilePreviewTab(tab: string | null | undefined): StudentProfileTab {
  if (tab && STUDENT_PROFILE_PREVIEW_TABS.includes(tab as StudentProfileTab)) {
    return tab as StudentProfileTab
  }
  return DEFAULT_STUDENT_PROFILE_TAB
}

const STUDENT_HOME_SECTIONS: StudentHomeSection[] = ['classes', 'curriculum', 'words', 'info']

/**
 * Teacher student home (`/students/[id]`).
 * Accepts home section ids plus legacy plan/preview tab names.
 */
export function resolveStudentHomeSection(tab: string | null | undefined): StudentHomeSection {
  if (tab === 'challenges' || tab === 'map' || tab === 'avatar') return DEFAULT_STUDENT_HOME_SECTION
  if (tab && STUDENT_HOME_SECTIONS.includes(tab as StudentHomeSection)) {
    return tab as StudentHomeSection
  }
  return DEFAULT_STUDENT_HOME_SECTION
}

const STUDENT_PLAN_TABS: StudentProfileTab[] = ['curriculum', 'classes']

/** Plan screen (`/students/[id]/plan`) — books + class prep; legacy tabs fall back to classes. */
export function resolveStudentPlanTab(tab: string | null | undefined): StudentProfileTab {
  if (tab === 'challenges' || tab === 'map' || tab === 'avatar' || tab === 'info') return DEFAULT_STUDENT_PLAN_TAB
  if (tab && STUDENT_PLAN_TABS.includes(tab as StudentProfileTab)) {
    return tab as StudentProfileTab
  }
  return DEFAULT_STUDENT_PLAN_TAB
}

export interface StudentSetupStatus {
  needsSetup: boolean
  setupHint: string
  hasBook: boolean
  hasWeeklySlot: boolean
  /** Planned, prepared, or live class on the calendar (not only “next upcoming”). */
  hasUpcomingClass: boolean
  weeklySlotSummary: string
  nextClassLabel: string
}

export function formatWeeklySlotSummary(slots: WeeklySlotAssignment[]): string {
  if (slots.length === 0) return ''
  return slots
    .map((slot) => `${DAY_LABELS[slot.dayOfWeek]} ${fmtScheduleMinute(slot.startMinute)} · ${slot.durationMinutes} min`)
    .join(' · ')
}

/** True when the student has any class that still belongs on the teaching calendar. */
export function studentHasBookedClass(sessions: StudentClassSession[] | null | undefined): boolean {
  return (sessions ?? []).some(
    (session) =>
      session.status === 'planned' ||
      session.status === 'prepared' ||
      session.status === 'in_progress',
  )
}

export function resolveStudentSetupStatus(input: {
  studentId: string
  assignedBookIds?: string[]
  nextClass: StudentClassSession | null
  weeklySlotStudentIds: ReadonlySet<string>
  weeklySlots?: WeeklySlotAssignment[]
  nextClassLabel?: string
  /** Prefer passing this; falls back to nextClass !== null. */
  hasBookedClass?: boolean
}): StudentSetupStatus {
  const hasBook = (input.assignedBookIds ?? []).some((id) => id.trim().length > 0)
  const hasWeeklySlot = input.weeklySlotStudentIds.has(input.studentId)
  const hasUpcomingClass = input.hasBookedClass ?? input.nextClass !== null
  const hasSchedule = hasWeeklySlot || hasUpcomingClass
  const needsSetup = !hasBook || !hasSchedule

  const slots =
    input.weeklySlots?.filter((slot) => slot.studentId === input.studentId) ??
    []
  const weeklySlotSummary = formatWeeklySlotSummary(slots)

  const missing: string[] = []
  if (!hasBook) missing.push('a book')
  if (!hasSchedule) missing.push('a class on the calendar (or weekly time)')

  let setupHint = ''
  if (missing.length === 1) {
    setupHint =
      missing[0] === 'a book'
        ? 'Assign a book below'
        : 'Book a class on the calendar or set a weekly time'
  } else if (missing.length > 1) {
    setupHint = `Still need: ${missing.join(' · ')}`
  }

  return {
    needsSetup,
    setupHint,
    hasBook,
    hasWeeklySlot,
    hasUpcomingClass,
    weeklySlotSummary,
    nextClassLabel: input.nextClassLabel ?? '',
  }
}

/** Opens the teacher student home (Next class by default). */
export function buildStudentOpenPlanHref(studentId: string): string {
  return `/students/${studentId}?tab=${DEFAULT_STUDENT_HOME_SECTION}`
}

/** Student home — next/upcoming class section. */
export function buildStudentClassPrepHref(studentId: string): string {
  return `/students/${studentId}?tab=classes`
}

/** Opens student home with setup checklist (first missing step highlighted in UI). */
export function buildStudentFinishSetupHref(
  studentId: string,
  setup: Pick<StudentSetupStatus, 'hasBook' | 'hasWeeklySlot' | 'hasUpcomingClass'>,
): string {
  const base = `/students/${studentId}?setup=1`
  if (!setup.hasBook) return `${base}&tab=curriculum`
  return base
}

export interface StudentSetupChecklistStep {
  id: 'book' | 'weeklySlot'
  label: string
  done: boolean
}

export function buildStudentSetupChecklistSteps(
  setup: Pick<StudentSetupStatus, 'hasBook' | 'hasWeeklySlot' | 'hasUpcomingClass'>,
): StudentSetupChecklistStep[] {
  return [
    {
      id: 'book',
      label: 'Assign a book',
      done: setup.hasBook,
    },
    {
      id: 'weeklySlot',
      label: 'Book a class or set weekly time',
      done: setup.hasWeeklySlot || setup.hasUpcomingClass,
    },
  ]
}
