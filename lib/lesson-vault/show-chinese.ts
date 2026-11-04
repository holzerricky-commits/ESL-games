/** Shared preference for Chinese on vault flashcards and collapsed rows. */
export const LESSON_VAULT_SHOW_CHINESE_KEY = 'lessonVault.flashcardShowChinese'

export function readLessonVaultShowChinese(): boolean {
  try {
    return window.localStorage.getItem(LESSON_VAULT_SHOW_CHINESE_KEY) !== '0'
  } catch {
    return true
  }
}

export function writeLessonVaultShowChinese(show: boolean) {
  try {
    window.localStorage.setItem(LESSON_VAULT_SHOW_CHINESE_KEY, show ? '1' : '0')
  } catch {
    /* private mode */
  }
}
