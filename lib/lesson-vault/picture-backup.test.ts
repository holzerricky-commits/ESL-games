import { describe, expect, it } from 'vitest'
import {
  localPictureCardIds,
  MAX_VAULT_PICTURE_BYTES,
  parsePictureDataUrl,
  parsePicturesBackup,
  toPictureDataUrl,
} from './picture-backup'
import { vaultPictureUrl } from './picture-paths'
import type { LessonVaultCard } from './types'

function card(id: string, imageUrl: string): LessonVaultCard {
  return {
    id,
    bookId: 'b',
    unitId: 'u',
    lessonId: 'l',
    lessonTitle: 'L',
    partId: '',
    partTitle: '',
    word: id,
    sentence: '',
    meaning: '',
    chinese: '',
    imageUrl,
    pictureSource: imageUrl ? 'own' : '',
    pictureChoices: [],
    pictureChoiceIndex: 0,
    autoPicture: '',
    reviewStatus: 'unchecked',
    pdfPage: 1,
    createdAt: '',
    updatedAt: '',
  }
}

describe('vault picture backup helpers', () => {
  it('lists only cards with local pictures', () => {
    const ids = localPictureCardIds({
      stu_a: [card('c1', vaultPictureUrl('stu_a', 'c1', 1)), card('c2', 'https://x.test/p.png'), card('c3', '')],
      stu_b: [card('c4', '')],
    })
    expect(ids).toEqual({ stu_a: ['c1'] })
  })

  it('round-trips a picture through a data URL', () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3])
    const parsed = parsePictureDataUrl(toPictureDataUrl(bytes, 'image/png'))
    expect(parsed?.ext).toBe('.png')
    expect(Array.from(parsed!.bytes)).toEqual(Array.from(bytes))
  })

  it('rejects unsupported, empty, malformed and oversized data URLs', () => {
    expect(parsePictureDataUrl('data:text/html;base64,PGI+')).toBeNull()
    expect(parsePictureDataUrl('data:image/png;base64,')).toBeNull()
    expect(parsePictureDataUrl('https://x.test/p.png')).toBeNull()
    const big = 'A'.repeat(Math.ceil((MAX_VAULT_PICTURE_BYTES * 4) / 3) + 8)
    expect(parsePictureDataUrl(`data:image/png;base64,${big}`)).toBeNull()
  })

  it('parses the backup key and drops junk', () => {
    expect(parsePicturesBackup(null)).toEqual({ byStudent: {} })
    expect(parsePicturesBackup('not json')).toEqual({ byStudent: {} })
    expect(
      parsePicturesBackup(JSON.stringify({ byStudent: { stu_a: { c1: 'data:x', c2: 5 }, stu_b: [] } })),
    ).toEqual({ byStudent: { stu_a: { c1: 'data:x' } } })
  })
})
