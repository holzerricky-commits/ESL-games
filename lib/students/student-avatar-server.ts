import 'server-only'

import path from 'node:path'
import { access, mkdir, writeFile } from 'node:fs/promises'
import type { StudentRecord } from '@/lib/types'
import {
  buildStudentAvatarDiceBearSpec,
  buildStudentAvatarDiceBearUrl,
  studentAvatarPublicPath,
} from '@/lib/students/student-avatar-spec'

const PROJECT_ROOT = process.cwd()
const AVATARS_DIR = path.resolve(PROJECT_ROOT, 'public', 'student-avatars')

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await access(absPath)
    return true
  } catch {
    return false
  }
}

function avatarDiskPath(studentId: string): string {
  return path.resolve(AVATARS_DIR, `${studentId}.png`)
}

async function downloadDiceBearPng(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`DiceBear fetch failed (${res.status})`)
  }
  return Buffer.from(await res.arrayBuffer())
}

export interface EnsureStudentAvatarResult {
  avatarUrl: string
  created: boolean
}

/** Ensure `public/student-avatars/{studentId}.png` exists; fetch from DiceBear when missing. */
export async function ensureStudentAvatarFile(
  studentId: string,
  name: string,
): Promise<EnsureStudentAvatarResult> {
  const trimmedId = studentId.trim()
  const trimmedName = name.trim()
  if (!trimmedId) throw new Error('studentId is required.')
  if (!trimmedName) throw new Error('name is required.')

  const diskPath = avatarDiskPath(trimmedId)
  const avatarUrl = studentAvatarPublicPath(trimmedId)

  if (await fileExists(diskPath)) {
    return { avatarUrl, created: false }
  }

  const spec = buildStudentAvatarDiceBearSpec(trimmedId, trimmedName)
  const url = buildStudentAvatarDiceBearUrl(spec)
  const png = await downloadDiceBearPng(url)

  await mkdir(AVATARS_DIR, { recursive: true })
  await writeFile(diskPath, png)

  return { avatarUrl, created: true }
}

export interface EnsureAllStudentAvatarsResult {
  updatedStudentIds: string[]
}

/** Backfill avatar PNG files and return student ids that gained a new file. */
export async function ensureAllStudentAvatars(students: StudentRecord[]): Promise<EnsureAllStudentAvatarsResult> {
  const updatedStudentIds: string[] = []

  for (const student of students) {
    if (!student?.id || !student?.name) continue
    const diskPath = avatarDiskPath(student.id)
    if (await fileExists(diskPath)) continue

    try {
      const result = await ensureStudentAvatarFile(student.id, student.name)
      if (result.created) updatedStudentIds.push(student.id)
    } catch (error) {
      console.warn(`[student-avatar] Could not ensure avatar for ${student.id}:`, error)
    }
  }

  return { updatedStudentIds }
}

export function applyAvatarUrlToStudents(
  students: StudentRecord[],
  studentIds: string[],
): StudentRecord[] {
  if (studentIds.length === 0) return students
  const idSet = new Set(studentIds)
  const now = new Date().toISOString()
  return students.map((student) => {
    if (!idSet.has(student.id)) return student
    return {
      ...student,
      avatarUrl: studentAvatarPublicPath(student.id),
      updatedAt: now,
    }
  })
}
