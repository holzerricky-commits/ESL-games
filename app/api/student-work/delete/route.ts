import { rm } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { getStudentWorkRoot, isSafeStudentIdSegment } from '@/lib/students/student-work-path'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  const studentId =
    body && typeof body === 'object' && 'studentId' in body && typeof (body as { studentId: unknown }).studentId === 'string'
      ? (body as { studentId: string }).studentId
      : null
  if (!studentId || !isSafeStudentIdSegment(studentId)) {
    return NextResponse.json({ error: 'Invalid studentId.' }, { status: 400 })
  }

  const root = getStudentWorkRoot()
  const target = path.resolve(root, studentId)
  if (!target.startsWith(root)) {
    return NextResponse.json({ error: 'Invalid path.' }, { status: 400 })
  }

  try {
    await rm(target, { recursive: true, force: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: 'Could not delete folder.', detail: message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
