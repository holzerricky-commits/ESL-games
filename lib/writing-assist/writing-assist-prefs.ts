const STORAGE_KEY = 'esl_writing_assist_prefs_v1'

export type WritingAssistPrefs = {
  enabled?: boolean
  learnedWords?: string[]
}

let memoryPrefs: WritingAssistPrefs | null = null

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

export function loadWritingAssistPrefs(): WritingAssistPrefs {
  if (!storageAvailable()) return memoryPrefs ?? {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as WritingAssistPrefs
  } catch {
    return {}
  }
}

export function saveWritingAssistPrefs(prefs: WritingAssistPrefs): void {
  if (!storageAvailable()) {
    memoryPrefs = prefs
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

/** Reset for tests only. */
export function resetWritingAssistPrefsForTests(): void {
  memoryPrefs = null
  if (!storageAvailable()) return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function loadWritingAssistEnabled(): boolean {
  const parsed = loadWritingAssistPrefs()
  return parsed.enabled !== false
}

export function saveWritingAssistEnabled(enabled: boolean): void {
  saveWritingAssistPrefs({ ...loadWritingAssistPrefs(), enabled })
}
