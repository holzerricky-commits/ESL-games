const STORAGE_KEY = 'esl_writing_assist_prefs_v1'

export type WritingAssistPrefs = {
  enabled?: boolean
}

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

export function loadWritingAssistEnabled(): boolean {
  if (!storageAvailable()) return true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return true
    const parsed = JSON.parse(raw) as WritingAssistPrefs
    return parsed.enabled !== false
  } catch {
    return true
  }
}

export function saveWritingAssistEnabled(enabled: boolean): void {
  if (!storageAvailable()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled } satisfies WritingAssistPrefs))
  } catch {
    /* ignore */
  }
}
