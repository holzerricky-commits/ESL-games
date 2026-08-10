import { NextRequest, NextResponse } from 'next/server'
import { readStudentsFromDisk, writeStudentsToDisk } from '@/lib/local-data/student-records-server'
import {
  applyAvatarUrlToStudents,
  ensureAllStudentAvatars,
  ensureStudentAvatarFile,
} from '@/lib/students/student-avatar-server'
import { studentAvatarPublicPath } from '@/lib/students/student-avatar-spec'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Expected JSON object.' }, { status: 400 })
  }

  const payload = body as { backfill?: boolean; studentId?: string; name?: string }

  if (payload.backfill === true) {
    try {
      const students = await readStudentsFromDisk()
      const { updatedStudentIds } = await ensureAllStudentAvatars(students)
      if (updatedStudentIds.length > 0) {
        const patched = applyAvatarUrlToStudents(students, updatedStudentIds)
        await writeStudentsToDisk(patched)
      }
      return NextResponse.json({
        ok: true,
        updatedStudentIds,
        updatedCount: updatedStudentIds.length,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }
  }

  const studentId = typeof payload.studentId === 'string' ? payload.studentId.trim() : ''
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  if (!studentId || !name) {
    return NextResponse.json({ ok: false, error: 'Expected { studentId, name }.' }, { status: 400 })
  }

  try {
    const result = await ensureStudentAvatarFile(studentId, name)

    const students = await readStudentsFromDisk()
    const idx = students.findIndex((s) => s.id === studentId)
    if (idx >= 0) {
      const now = new Date().toISOString()
      students[idx] = {
        ...students[idx]!,
        avatarUrl: studentAvatarPublicPath(studentId),
        updatedAt: now,
      }
      await writeStudentsToDisk(students)
    }

    return NextResponse.json({
      ok: true,
      avatarUrl: result.avatarUrl,
      created: result.created,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
