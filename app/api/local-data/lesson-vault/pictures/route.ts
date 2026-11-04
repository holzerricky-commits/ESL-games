import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { readLessonVaultFromDisk } from '@/lib/lesson-vault/disk-server'
import {
  localPictureCardIds,
  parsePictureDataUrl,
  toPictureDataUrl,
  type LessonVaultPicturesBackup,
} from '@/lib/lesson-vault/picture-backup'
import { listCardFiles, vaultDirFor, writeVaultPictureFile } from '@/lib/lesson-vault/picture-disk-server'
import {
  isSafeVaultCardId,
  isSafeVaultOwnerId,
  LESSON_VAULT_PICTURE_MIME_BY_EXT,
} from '@/lib/lesson-vault/picture-paths'

export const runtime = 'nodejs'

/** Every vault picture still used by a card, as data URLs (for the JSON backup). */
export async function GET() {
  try {
    const { byStudent } = await readLessonVaultFromDisk()
    const out: LessonVaultPicturesBackup['byStudent'] = {}
    for (const [studentId, cardIds] of Object.entries(localPictureCardIds(byStudent))) {
      if (!isSafeVaultOwnerId(studentId)) continue
      const dir = vaultDirFor(studentId)
      if (!dir) continue
      const pictures: Record<string, string> = {}
      for (const cardId of cardIds) {
        const [name] = await listCardFiles(dir, cardId)
        if (!name) continue
        const mime = LESSON_VAULT_PICTURE_MIME_BY_EXT[path.extname(name).toLowerCase()]
        if (!mime) continue
        try {
          pictures[cardId] = toPictureDataUrl(new Uint8Array(await readFile(path.join(dir, name))), mime)
        } catch {
          /* unreadable file: leave it out */
        }
      }
      if (Object.keys(pictures).length > 0) out[studentId] = pictures
    }
    return NextResponse.json({ ok: true, byStudent: out })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/** Restores one student's vault pictures from the backup. */
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }
  const { studentId, pictures } = (body ?? {}) as { studentId?: unknown; pictures?: unknown }
  if (typeof studentId !== 'string' || !isSafeVaultOwnerId(studentId)) {
    return NextResponse.json({ ok: false, error: 'Invalid studentId.' }, { status: 400 })
  }
  if (!pictures || typeof pictures !== 'object' || Array.isArray(pictures)) {
    return NextResponse.json({ ok: false, error: 'Expected pictures.' }, { status: 400 })
  }
  const dir = vaultDirFor(studentId)
  if (!dir) return NextResponse.json({ ok: false, error: 'Invalid path.' }, { status: 400 })

  let written = 0
  for (const [cardId, dataUrl] of Object.entries(pictures as Record<string, unknown>)) {
    if (!isSafeVaultCardId(cardId) || typeof dataUrl !== 'string') continue
    const parsed = parsePictureDataUrl(dataUrl)
    if (!parsed) continue
    try {
      await writeVaultPictureFile(dir, cardId, parsed.bytes, parsed.ext)
      written += 1
    } catch {
      /* skip this picture */
    }
  }
  return NextResponse.json({ ok: true, written })
}
