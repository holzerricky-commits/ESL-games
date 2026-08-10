/** Opens Schedule with this student's weekly slots highlighted. */
export function buildScheduleStudentHref(studentId: string): string {
  return `/schedule?student=${encodeURIComponent(studentId)}`
}

export function parseScheduleStudentId(raw: string | null | undefined): string | null {
  const id = raw?.trim()
  return id ? id : null
}
