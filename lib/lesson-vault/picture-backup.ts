import { isLocalVaultPictureUrl, isSafeVaultCardId, lessonVaultPictureExtension } from '@/lib/lesson-vault/picture-paths'
import type { LessonVaultCard } from '@/lib/lesson-vault/types'

/** Backup key holding `{ byStudent: { [studentId]: { [cardId]: dataUrl } } }` as a JSON string. */
export const LESSON_VAULT_PICTURES_BACKUP_KEY = 'esl_lesson_vault_pictures_v1'

export const MAX_VAULT_PICTURE_BYTES = 8_000_000

export type LessonVaultPicturesBackup = {
  byStudent: Record<string, Record<string, string>>
}

/** Card ids per student whose picture lives in student-work (not a web link). */
export function localPictureCardIds(byStudent: Record<string, readonly LessonVaultCard[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [studentId, cards] of Object.entries(byStudent)) {
    const ids = cards.filter((c) => isLocalVaultPictureUrl(c.imageUrl) && isSafeVaultCardId(c.id)).map((c) => c.id)
    if (ids.length > 0) out[studentId] = ids
  }
  return out
}

export function toPictureDataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
}

/** Null for non-picture data URLs, unsupported types, empty or oversized pictures. */
export function parsePictureDataUrl(dataUrl: string): { mime: string; ext: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim())
  if (!match) return null
  const mime = match[1]!.toLowerCase()
  const ext = lessonVaultPictureExtension(mime)
  if (!ext) return null
  const b64 = match[2]!
  if ((b64.length * 3) / 4 > MAX_VAULT_PICTURE_BYTES + 3) return null
  const bytes = new Uint8Array(Buffer.from(b64, 'base64'))
  if (bytes.length === 0 || bytes.length > MAX_VAULT_PICTURE_BYTES) return null
  return { mime, ext, bytes }
}

/** Reads the backup key's JSON; drops anything that isn't a string map. */
export function parsePicturesBackup(raw: string | null | undefined): LessonVaultPicturesBackup {
  const empty: LessonVaultPicturesBackup = { byStudent: {} }
  if (!raw) return empty
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return empty
  }
  const byStudentRaw = (parsed as { byStudent?: unknown } | null)?.byStudent
  if (!byStudentRaw || typeof byStudentRaw !== 'object' || Array.isArray(byStudentRaw)) return empty
  const byStudent: Record<string, Record<string, string>> = {}
  for (const [studentId, pictures] of Object.entries(byStudentRaw as Record<string, unknown>)) {
    if (!pictures || typeof pictures !== 'object' || Array.isArray(pictures)) continue
    const clean: Record<string, string> = {}
    for (const [cardId, dataUrl] of Object.entries(pictures as Record<string, unknown>)) {
      if (typeof dataUrl === 'string') clean[cardId] = dataUrl
    }
    if (Object.keys(clean).length > 0) byStudent[studentId] = clean
  }
  return { byStudent }
}
