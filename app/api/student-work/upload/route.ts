import { access, constants, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  isSafeExportBaseName,
  isSafeStudentIdSegment,
  resolveStudentWorkUploadPath,
  type StudentWorkUploadCategory,
} from '@/lib/students/student-work-path'

export const runtime = 'nodejs'

const CATEGORY_VALUES = [
  'exports-book-review',
  'homework-assigned',
  'homework-submitted',
  'materials',
  'audio',
  'lesson-notes',
] as const satisfies readonly StudentWorkUploadCategory[]

const uploadMetaSchema = z
  .object({
    bookId: z.string().max(200).optional(),
    unitId: z.string().max(200).optional(),
    page: z.number().int().positive().optional(),
    pageFrom: z.number().int().positive().optional(),
    pageTo: z.number().int().positive().optional(),
    captureKind: z.string().max(64).optional(),
    format: z.string().max(32).optional(),
    watermarked: z.boolean().optional(),
    caption: z.string().max(2000).optional(),
    exportedAt: z.string().max(64).optional(),
    studentName: z.string().max(200).optional(),
  })
  .strict()

const ALLOWED_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
}

function localDateFolder(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function extensionForMime(mime: string): string | null {
  const lower = mime.split(';')[0]?.trim().toLowerCase() ?? ''
  return ALLOWED_MIME[lower] ?? null
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await access(absPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const studentId = form.get('studentId')
  const category = form.get('category')
  const baseName = form.get('baseName')
  const file = form.get('file')
  const metaRaw = form.get('meta')

  if (typeof studentId !== 'string' || !isSafeStudentIdSegment(studentId)) {
    return NextResponse.json({ error: 'Invalid studentId.' }, { status: 400 })
  }
  if (typeof category !== 'string' || !CATEGORY_VALUES.includes(category as StudentWorkUploadCategory)) {
    return NextResponse.json({ error: 'Invalid category.' }, { status: 400 })
  }
  if (typeof baseName !== 'string' || !isSafeExportBaseName(baseName)) {
    return NextResponse.json({ error: 'Invalid baseName.' }, { status: 400 })
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'Missing or empty file.' }, { status: 400 })
  }

  const mime = file.type || 'application/octet-stream'
  const ext = extensionForMime(mime)
  if (!ext) {
    return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 })
  }

  let metaParsed: z.infer<typeof uploadMetaSchema> | undefined
  if (metaRaw != null && metaRaw !== '') {
    if (typeof metaRaw !== 'string') {
      return NextResponse.json({ error: 'meta must be a JSON string.' }, { status: 400 })
    }
    let json: unknown
    try {
      json = JSON.parse(metaRaw) as unknown
    } catch {
      return NextResponse.json({ error: 'meta must be valid JSON.' }, { status: 400 })
    }
    const parsed = uploadMetaSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid meta shape.', details: parsed.error.flatten() }, { status: 400 })
    }
    metaParsed = parsed.data
  }

  const dateFolder = localDateFolder()
  const cat = category as StudentWorkUploadCategory

  const { absDir, root } = resolveStudentWorkUploadPath({
    studentId,
    category: cat,
    dateFolder,
    fileName: `_placeholder${ext}`,
  })
  await mkdir(absDir, { recursive: true })

  let fileName = `${baseName}${ext}`
  let absFile = path.join(absDir, fileName)
  if (!absFile.startsWith(absDir)) {
    return NextResponse.json({ error: 'Invalid path.' }, { status: 400 })
  }

  if (await fileExists(absFile)) {
    let n = 2
    while (n < 5000) {
      fileName = `${baseName}-${n}${ext}`
      absFile = path.join(absDir, fileName)
      if (!absFile.startsWith(absDir)) {
        return NextResponse.json({ error: 'Invalid path.' }, { status: 400 })
      }
      if (!(await fileExists(absFile))) break
      n += 1
    }
    if (await fileExists(absFile)) {
      return NextResponse.json({ error: 'Could not allocate unique filename.' }, { status: 500 })
    }
  }

  if (!absFile.startsWith(root)) {
    return NextResponse.json({ error: 'Invalid path.' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  await writeFile(absFile, buf)

  const metaBase = fileName.replace(/\.[^.]+$/, '')
  if (metaParsed) {
    const metaPath = path.join(absDir, `${metaBase}.meta.json`)
    if (metaPath.startsWith(root) && metaPath.startsWith(absDir)) {
      const withStamp = { ...metaParsed, savedAt: new Date().toISOString() }
      await writeFile(metaPath, JSON.stringify(withStamp, null, 2), 'utf8')
    }
  }

  const relFromRoot = path.relative(root, absFile).replaceAll('\\', '/')
  return NextResponse.json({
    ok: true,
    relativePath: `student-work/${relFromRoot}`,
    fileName,
    dateFolder,
  })
}
