import { describe, expect, it } from 'vitest'
import {
  isLocalVaultPictureUrl,
  isSafeVaultCardId,
  isSafeVaultOwnerId,
  lessonVaultPictureExtension,
  vaultPictureUrl,
} from './picture-paths'

describe('lesson vault picture paths', () => {
  it('accepts generated card ids and rejects path tricks', () => {
    expect(isSafeVaultCardId('3f2b8c1e-9a4d-4b7e-8f10-2c3d4e5f6a7b')).toBe(true)
    expect(isSafeVaultCardId('lv-1728380000000-ab12cd')).toBe(true)
    expect(isSafeVaultCardId('../students')).toBe(false)
    expect(isSafeVaultCardId('a/b')).toBe(false)
    expect(isSafeVaultCardId('')).toBe(false)
  })

  it('accepts roster students and the Books workshop as picture owners', () => {
    expect(isSafeVaultOwnerId('stu_lgub79e3mrgddhos')).toBe(true)
    expect(isSafeVaultOwnerId('__books_workshop__')).toBe(true)
    expect(isSafeVaultOwnerId('__other__')).toBe(false)
    expect(isSafeVaultOwnerId('../stu_a')).toBe(false)
  })

  it('maps image types to file endings', () => {
    expect(lessonVaultPictureExtension('image/webp')).toBe('.webp')
    expect(lessonVaultPictureExtension('image/jpeg; charset=binary')).toBe('.jpg')
    expect(lessonVaultPictureExtension('application/pdf')).toBeNull()
  })

  it('builds a local url the card can show', () => {
    const url = vaultPictureUrl('stu_abc', 'card-1', 42)
    expect(url).toBe('/api/local-data/lesson-vault/picture?studentId=stu_abc&cardId=card-1&v=42')
    expect(isLocalVaultPictureUrl(url)).toBe(true)
    expect(isLocalVaultPictureUrl('https://cdn.example.com/a.jpg')).toBe(false)
  })
})
