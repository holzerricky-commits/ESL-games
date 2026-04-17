export function normalizeStudentKey(studentName: string): string {
  return studentName.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function generateStudentId(): string {
  return `stu_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}
