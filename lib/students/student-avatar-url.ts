/** Public path for a student's profile image (files live under `public/student-avatars/`). */
export function defaultStudentAvatarPath(studentId: string): string {
  return `/student-avatars/${studentId}.png`
}

/** Prefer stored URL; otherwise use the conventional on-disk avatar path. */
export function resolveStudentAvatarUrl(studentId: string, avatarUrl?: string | null): string {
  const trimmed = avatarUrl?.trim()
  if (trimmed) return trimmed
  return defaultStudentAvatarPath(studentId)
}
