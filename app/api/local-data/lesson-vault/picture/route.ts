import { readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { MAX_VAULT_PICTURE_BYTES } from '@/lib/lesson-vault/picture-backup'
import { listCardFiles, vaultDirFor, writeVaultPictureFile } from '@/lib/lesson-vault/picture-disk-server'
import {
  isSafeVaultCardId,
  isSafeVaultOwnerId,
  LESSON_VAULT_PICTURE_MIME_BY_EXT,
  lessonVaultPictureExtension,
  vaultPictureUrl,
} from '@/lib/lesson-vault/picture-paths'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get('studentId') ?? ''
  const cardId = req.nextUrl.searchParams.get('cardId') ?? ''
  if (!isSafeVaultOwnerId(studentId) || !isSafeVaultCardId(cardId)) {
    return NextResponse.json({ error: 'Invalid picture request.' }, { status: 400 })
  }
  const dir = vaultDirFor(studentId)
  if (!dir) return NextResponse.json({ error: 'Invalid path.' }, { status: 400 })
  const [name] = await listCardFiles(dir, cardId)
  if (!name) return NextResponse.json({ error: 'Picture not found.' }, { status: 404 })
  const ext = path.extname(name).toLowerCase()
  const buf = await readFile(path.join(dir, name))
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': LESSON_VAULT_PICTURE_MIME_BY_EXT[ext] ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  })
}

export async function DELETE(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get('studentId') ?? ''
  const cardId = req.nextUrl.searchParams.get('cardId') ?? ''
  if (!isSafeVaultOwnerId(studentId) || !isSafeVaultCardId(cardId)) {
    return NextResponse.json({ error: 'Invalid picture request.' }, { status: 400 })
  }
  const dir = vaultDirFor(studentId)
  if (!dir) return NextResponse.json({ error: 'Invalid path.' }, { status: 400 })
  for (const name of await listCardFiles(dir, cardId)) {
    await unlink(path.join(dir, name)).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }
  const studentId = form.get('studentId')
  const cardId = form.get('cardId')
  const file = form.get('file')
  if (typeof studentId !== 'string' || !isSafeVaultOwnerId(studentId)) {
    return NextResponse.json({ error: 'Invalid studentId.' }, { status: 400 })
  }
  if (typeof cardId !== 'string' || !isSafeVaultCardId(cardId)) {
    return NextResponse.json({ error: 'Invalid cardId.' }, { status: 400 })
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'Missing or empty picture.' }, { status: 400 })
  }
  if (file.size > MAX_VAULT_PICTURE_BYTES) {
    return NextResponse.json({ error: 'That picture is too large.' }, { status: 413 })
  }
  const ext = lessonVaultPictureExtension(file.type || '')
  if (!ext) return NextResponse.json({ error: 'Unsupported picture type.' }, { status: 400 })

  const dir = vaultDirFor(studentId)
  if (!dir) return NextResponse.json({ error: 'Invalid path.' }, { status: 400 })
  const onlyIfEmpty = form.get('onlyIfEmpty') === '1'
  const wrote = await writeVaultPictureFile(dir, cardId, new Uint8Array(await file.arrayBuffer()), ext, {
    onlyIfEmpty,
  })
  if (!wrote) return NextResponse.json({ ok: true, skipped: true })

  return NextResponse.json({ ok: true, url: vaultPictureUrl(studentId, cardId, Date.now()) })
}
