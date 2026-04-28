import path from 'node:path'
import { access, constants, mkdir, writeFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { getBookLibraryRoot } from '@/lib/books/server'

export const runtime = 'nodejs'

function sanitizeSegment(raw: string): string {
  const normalized = raw.normalize('NFKD')
  const asciiOnly = normalized.replace(/[^\x00-\x7F]/g, '')
  return asciiOnly
    .toLowerCase()
    .trim()
    .replace(/['".,()[\]{}!@#$%^&*+=;:`~?<>\\/|]+/g, ' ')
    .replace(/[_\s-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function inferBookFolderFromFileName(fileName: string): string {
  const stem = fileName.replace(/\.pdf$/i, '')
  const stripped =
    stem
      .replace(/\s*[-_]\s*(unit|lesson|chapter|part)\b.*$/i, '')
      .replace(/\s+(unit|lesson|chapter|part)\b.*$/i, '') || stem
  return sanitizeSegment(stripped) || sanitizeSegment(stem)
}

function sanitizeFileName(raw: string): string {
  const safe = raw
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
  return safe || 'unit.pdf'
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await access(absPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'Missing or empty file.' }, { status: 400 })
  }

  const originalName = 'name' in file && typeof file.name === 'string' ? file.name : ''
  const isPdfByName = originalName.toLowerCase().endsWith('.pdf')
  const mimeType = file.type.split(';')[0]?.trim().toLowerCase() ?? ''
  const isPdfByMime = mimeType === 'application/pdf'
  if (!isPdfByName && !isPdfByMime) {
    return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 })
  }
  const safeBookFolder = inferBookFolderFromFileName(originalName)
  if (!safeBookFolder) {
    return NextResponse.json({ error: 'Could not infer a valid book folder from filename.' }, { status: 400 })
  }

  const root = getBookLibraryRoot()
  const targetDir = path.resolve(root, safeBookFolder)
  if (!targetDir.startsWith(root)) {
    return NextResponse.json({ error: 'Invalid target folder.' }, { status: 400 })
  }
  await mkdir(targetDir, { recursive: true })

  const uploadedName = sanitizeFileName(originalName || 'unit.pdf')
  const baseName = sanitizeSegment(uploadedName.replace(/\.pdf$/i, '')) || 'unit'
  let fileName = uploadedName.toLowerCase().endsWith('.pdf') ? uploadedName : `${baseName}.pdf`
  let absTargetFile = path.resolve(targetDir, fileName)
  if (!absTargetFile.startsWith(targetDir)) {
    return NextResponse.json({ error: 'Invalid target path.' }, { status: 400 })
  }
  if (await fileExists(absTargetFile)) {
    let n = 2
    while (n < 5000) {
      fileName = `${baseName}-${n}.pdf`
      absTargetFile = path.resolve(targetDir, fileName)
      if (!absTargetFile.startsWith(targetDir)) {
        return NextResponse.json({ error: 'Invalid target path.' }, { status: 400 })
      }
      if (!(await fileExists(absTargetFile))) break
      n += 1
    }
    if (await fileExists(absTargetFile)) {
      return NextResponse.json({ error: 'Could not allocate unique filename.' }, { status: 500 })
    }
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  await writeFile(absTargetFile, bytes)
  const filePath = `book-library/${safeBookFolder}/${fileName}`.replaceAll('\\', '/')

  return NextResponse.json({
    ok: true,
    filePath,
    fileName,
    bookFolder: safeBookFolder,
  })
}
