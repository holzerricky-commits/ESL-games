export const STUDENT_REWARD_STYLES = ['sticker', 'billboard', 'warm-card'] as const

export type StudentRewardStyle = (typeof STUDENT_REWARD_STYLES)[number]

export const DEFAULT_STUDENT_REWARD_STYLE: StudentRewardStyle = 'sticker'

export const STUDENT_REWARD_STYLE_STORAGE_KEY = 'esl_student_reward_style'

export const STUDENT_REWARD_STYLE_CHANGED_EVENT = 'esl-student-reward-style-changed'

export const STUDENT_REWARD_STYLE_META: Record<
  StudentRewardStyle,
  { label: string; shortLabel: string; blurb: string }
> = {
  sticker: {
    label: 'Sticker badge',
    shortLabel: 'Sticker',
    blurb: 'Bright game-achievement banner',
  },
  billboard: {
    label: 'Spotlight',
    shortLabel: 'Spotlight',
    blurb: 'Big words under a stage light',
  },
  'warm-card': {
    label: 'Ribbon',
    shortLabel: 'Ribbon',
    blurb: 'A big celebration banner',
  },
}

/** Session fallback when browser storage is blocked or throws. */
let memoryStyle: StudentRewardStyle = DEFAULT_STUDENT_REWARD_STYLE

export function isStudentRewardStyle(value: unknown): value is StudentRewardStyle {
  return (
    typeof value === 'string' &&
    (STUDENT_REWARD_STYLES as readonly string[]).includes(value)
  )
}

export function getStudentRewardStyle(): StudentRewardStyle {
  if (typeof window === 'undefined') return memoryStyle
  try {
    const raw = localStorage.getItem(STUDENT_REWARD_STYLE_STORAGE_KEY)
    if (isStudentRewardStyle(raw)) {
      memoryStyle = raw
      return raw
    }
  } catch {
    /* storage blocked — use memory */
  }
  return memoryStyle
}

export function saveStudentRewardStyle(style: StudentRewardStyle): void {
  memoryStyle = style
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STUDENT_REWARD_STYLE_STORAGE_KEY, style)
  } catch {
    /* keep memoryStyle; UI must still update */
  }
  try {
    window.dispatchEvent(
      new CustomEvent(STUDENT_REWARD_STYLE_CHANGED_EVENT, { detail: style }),
    )
  } catch {
    /* ignore */
  }
}
