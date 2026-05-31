import { NextRequest, NextResponse } from 'next/server'
import type { StudentProgressRecord } from '@/lib/types'
import { readStudentProgressFromDisk, writeStudentProgressToDisk } from '@/lib/local-data/student-records-server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const progress = await readStudentProgressFromDisk()
    return NextResponse.json({ ok: true, progress })
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
  const progress =
    body && typeof body === 'object' && 'progress' in body && typeof (body as { progress: unknown }).progress === 'object'
      ? ((body as { progress: Record<string, StudentProgressRecord> }).progress ?? {})
      : null
  if (!progress || Array.isArray(progress)) {
    return NextResponse.json({ ok: false, error: 'Expected { progress: Record<string, StudentProgressRecord> }.' }, { status: 400 })
  }
  try {
    await writeStudentProgressToDisk(progress)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
