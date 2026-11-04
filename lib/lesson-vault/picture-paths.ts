import { BOOKS_WORKSHOP_STUDENT_ID } from '@/lib/books/books-workshop'

export const LESSON_VAULT_PICTURE_ROUTE = '/api/local-data/lesson-vault/picture'

export const LESSON_VAULT_PICTURE_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

export const LESSON_VAULT_PICTURE_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

/** A roster student (`stu_…`) or the Books workshop bucket; both get `student-work/<id>/vault`. */
export function isSafeVaultOwnerId(ownerId: string): boolean {
  return /^stu_[a-z0-9]+$/i.test(ownerId) || ownerId === BOOKS_WORKSHOP_STUDENT_ID
}

/** Card ids come from `crypto.randomUUID()` or the `lv-<time>-<rand>` fallback. */
export function isSafeVaultCardId(cardId: string): boolean {
  return /^[a-zA-Z0-9_-]{1,80}$/.test(cardId)
}

export function lessonVaultPictureExtension(mime: string): string | null {
  const lower = mime.split(';')[0]?.trim().toLowerCase() ?? ''
  return LESSON_VAULT_PICTURE_EXTENSIONS[lower] ?? null
}

export function vaultPictureUrl(studentId: string, cardId: string, version: string | number): string {
  const params = new URLSearchParams({ studentId, cardId, v: String(version) })
  return `${LESSON_VAULT_PICTURE_ROUTE}?${params.toString()}`
}

export function isLocalVaultPictureUrl(url: string): boolean {
  return url.trim().startsWith(`${LESSON_VAULT_PICTURE_ROUTE}?`)
}
