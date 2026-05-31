import { NextRequest, NextResponse } from 'next/server'
import type { StudentRecord } from '@/lib/types'
import { readStudentsFromDisk, writeStudentsToDisk } from '@/lib/local-data/student-records-server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const students = await readStudentsFromDisk()
    return NextResponse.json({ ok: true, students })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }
  const students =
    body && typeof body === 'object' && 'students' in body && Array.isArray((body as { students: unknown }).students)
      ? ((body as { students: StudentRecord[] }).students ?? [])
      : null
  if (!students) {
    return NextResponse.json({ ok: false, error: 'Expected { students: StudentRecord[] }.' }, { status: 400 })
  }
  try {
    await writeStudentsToDisk(students)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
