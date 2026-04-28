import path from 'node:path'

const STUDENT_WORK_DIR = 'student-work'

/** Stable root for all teacher-local student files (PDFs, exports, homework). */
export function getStudentWorkRoot(): string {
  return path.resolve(process.cwd(), STUDENT_WORK_DIR)
}

/** Match ids from `generateStudentId()` in identity.ts. */
export function isSafeStudentIdSegment(studentId: string): boolean {
  return /^stu_[a-z0-9]+$/i.test(studentId)
}

/** Base filename without extension (caller adds ext). */
export function isSafeExportBaseName(baseName: string): boolean {
  return /^[a-zA-Z0-9_-]{1,120}$/.test(baseName)
}

export type StudentWorkUploadCategory =
  | 'exports-book-review'
  | 'homework-assigned'
  | 'homework-submitted'
  | 'materials'
  | 'audio'
  | 'lesson-notes'

const CATEGORY_RELATIVE: Record<StudentWorkUploadCategory, string> = {
  'exports-book-review': 'exports/book-review',
  'homework-assigned': 'homework/assigned',
  'homework-submitted': 'homework/submitted',
  materials: 'materials',
  audio: 'audio',
  'lesson-notes': 'lesson-notes',
}

export function categoryToRelativeBase(category: StudentWorkUploadCategory): string {
  return CATEGORY_RELATIVE[category]
}

/** `dateFolder` is `YYYY-MM-DD` (local or UTC — caller decides). */
export function resolveStudentWorkUploadPath(params: {
  studentId: string
  category: StudentWorkUploadCategory
  dateFolder: string
  fileName: string
}): { absDir: string; absFile: string; root: string } {
  const root = getStudentWorkRoot()
  if (!isSafeStudentIdSegment(params.studentId)) {
    throw new Error('Invalid studentId')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.dateFolder)) {
    throw new Error('Invalid dateFolder')
  }
  if (params.fileName.includes('..') || path.isAbsolute(params.fileName)) {
    throw new Error('Invalid fileName')
  }
  const relBase = categoryToRelativeBase(params.category)
  const absDir = path.resolve(root, params.studentId, relBase, params.dateFolder)
  const absFile = path.resolve(absDir, params.fileName)
  if (!absDir.startsWith(root) || !absFile.startsWith(absDir)) {
    throw new Error('Path escape')
  }
  return { absDir, absFile, root }
}
