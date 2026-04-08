export type StudentProfileTab = 'overview' | 'practice' | 'challenges' | 'avatar' | 'info'

export interface StudentListItemView {
  id: string
  name: string
  levelLabel: string
  progressLabel: string
  coinsLabel: string
  currentChallengeLabel: string
  totalAttempts: number
  lastActiveLabel: string
}

export interface StudentProfileView extends StudentListItemView {
  recentActivity: string[]
  practiceSummary: string
  challengeSummary: string
  avatarSummary: string
  infoSummary: string
}
