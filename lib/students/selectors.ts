import { getKnownStudentSummaries } from '@/lib/storage'
import type { StudentListItemView, StudentProfileTab, StudentProfileView } from '@/lib/students/types'

const PROFILE_TABS: StudentProfileTab[] = ['overview', 'practice', 'challenges', 'avatar', 'info']

function slugifyStudentName(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'student'
}

function estimateLevel(totalAttempts: number): string {
  if (totalAttempts >= 20) return 'Level 4'
  if (totalAttempts >= 10) return 'Level 3'
  if (totalAttempts >= 5) return 'Level 2'
  return 'Level 1'
}

function estimateProgress(totalAttempts: number): string {
  const pct = Math.min(100, totalAttempts * 8)
  return `${pct}% progress`
}

function formatLastActive(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'No recent activity'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function getStudentsListView(): StudentListItemView[] {
  return getKnownStudentSummaries().map((student) => ({
    id: slugifyStudentName(student.name),
    name: student.name,
    levelLabel: estimateLevel(student.totalQuizzes),
    progressLabel: estimateProgress(student.totalQuizzes),
    coinsLabel: 'Coins: --',
    currentChallengeLabel: 'Challenge: Coming soon',
    totalAttempts: student.totalQuizzes,
    lastActiveLabel: formatLastActive(student.lastDate),
  }))
}

export function getStudentProfileView(studentId: string): StudentProfileView | null {
  const student = getStudentsListView().find((item) => item.id === studentId)
  if (!student) return null

  return {
    ...student,
    recentActivity: [
      `Last active ${student.lastActiveLabel}`,
      `${student.totalAttempts} total attempts recorded`,
      'Challenge results integration pending',
    ],
    practiceSummary: 'Practice assignments will appear here.',
    challengeSummary: 'Challenge history and status will plug in here.',
    avatarSummary: 'Avatar unlocks and cosmetics will plug in here.',
    infoSummary: 'Student profile details and notes will be editable here.',
  }
}

export function isValidStudentProfileTab(tab: string | null | undefined): tab is StudentProfileTab {
  return !!tab && PROFILE_TABS.includes(tab as StudentProfileTab)
}
