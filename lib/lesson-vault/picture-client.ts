'use client'

import { fetchPlacedImageAsFile } from '@/lib/board-image-import-client'
import { downscaleImageFile } from '@/lib/books/clipboard-image'
import { LESSON_VAULT_PICTURE_ROUTE } from '@/lib/lesson-vault/picture-paths'

const VAULT_PICTURE_MAX_DIMENSION_PX = 800
const VAULT_PICTURE_MAX_BYTES = 600_000

/** Shrinks the picture, saves it as this card's file and returns the local url. */
export async function uploadLessonVaultPicture(studentId: string, cardId: string, file: Blob): Promise<string> {
  const asFile = file instanceof File ? file : new File([file], 'vault-picture', { type: file.type })
  const shrunk = await downscaleImageFile(asFile, {
    maxDimensionPx: VAULT_PICTURE_MAX_DIMENSION_PX,
    maxBytes: VAULT_PICTURE_MAX_BYTES,
  })
  if (!shrunk) throw new Error('Could not read that picture.')
  const blob = await (await fetch(shrunk.dataUrl)).blob()

  const form = new FormData()
  form.set('studentId', studentId)
  form.set('cardId', cardId)
  form.set('file', blob, 'picture')
  const res = await fetch(LESSON_VAULT_PICTURE_ROUTE, { method: 'POST', body: form })
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !data.url) throw new Error(data.error ?? `Could not save the picture (${res.status}).`)
  return data.url
}

export async function deleteLessonVaultPicture(studentId: string, cardId: string): Promise<void> {
  const params = new URLSearchParams({ studentId, cardId })
  await fetch(`${LESSON_VAULT_PICTURE_ROUTE}?${params.toString()}`, { method: 'DELETE' }).catch(() => {})
}

/** Downloads a web picture into this card's file. Null when the picture cannot be fetched. */
export async function storeRemotePictureForCard(
  studentId: string,
  cardId: string,
  remoteUrl: string,
): Promise<string | null> {
  try {
    const file = await fetchPlacedImageAsFile(remoteUrl)
    if (!file) return null
    return await uploadLessonVaultPicture(studentId, cardId, file)
  } catch {
    return null
  }
}
