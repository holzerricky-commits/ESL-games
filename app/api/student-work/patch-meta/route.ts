import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getStudentWorkRoot, isSafeStudentIdSegment } from '@/lib/students/student-work-path'

export const runtime = 'nodejs'

const bodySchema = z
  .object({
    studentId: z.string(),
    /** Path under `student-work/` without prefix, e.g. `stu_abc/exports/book-review/2026-04-19/foo.png` */
    fileRelativePath: z.string().max(500),
    caption: z.string().max(2000),
  })
  .strict()

export async function POST(req: NextRequest) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }
  const { studentId, fileRelativePath, caption } = parsed.data
  if (!isSafeStudentIdSegment(studentId)) {
    return NextResponse.json({ error: 'Invalid studentId.' }, { status: 400 })
  }
  const norm = fileRelativePath.replaceAll('\\', '/').replace(/^\/+/, '')
  if (norm.includes('..') || !norm.startsWith(`${studentId}/`)) {
    return NextResponse.json({ error: 'Invalid file path.' }, { status: 400 })
  }

  const root = getStudentWorkRoot()
  const absAsset = path.resolve(root, norm)
  if (!absAsset.startsWith(root)) {
    return NextResponse.json({ error: 'Path escape.' }, { status: 400 })
  }

  const metaPath = absAsset.replace(/\.[^.]+$/, '') + '.meta.json'
  if (!metaPath.startsWith(root)) {
    return NextResponse.json({ error: 'Invalid meta path.' }, { status: 400 })
  }

  let existing: Record<string, unknown> = {}
  try {
    const raw = await readFile(metaPath, 'utf8')
    existing = JSON.parse(raw) as Record<string, unknown>
  } catch {
    existing = {}
  }
  const next = { ...existing, caption, captionUpdatedAt: new Date().toISOString() }
  await writeFile(metaPath, JSON.stringify(next, null, 2), 'utf8')
  return NextResponse.json({ ok: true })
}
