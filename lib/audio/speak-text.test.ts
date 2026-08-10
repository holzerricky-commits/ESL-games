import { describe, expect, it } from 'vitest'
import {
  isChineseVoiceLike,
  isReliableChineseVoice,
  isReliableEnglishVoice,
  pickEnglishVoice,
  pickPreferredVoice,
  pickReliableVoice,
  pickVoiceForLang,
  resolveSpeakVoices,
} from './speak-text'

describe('isChineseVoiceLike', () => {
  it('matches zh and cmn langs', () => {
    expect(isChineseVoiceLike({ lang: 'zh-CN', name: 'Xiaoxiao' })).toBe(true)
    expect(isChineseVoiceLike({ lang: 'cmn-CN', name: 'Google 普通话' })).toBe(true)
    expect(isChineseVoiceLike({ lang: 'zh_TW', name: 'Han' })).toBe(true)
  })

  it('matches Chinese name tags even when lang is odd', () => {
    expect(isChineseVoiceLike({ lang: 'und', name: 'Microsoft Huihui - Chinese (Simplified)' })).toBe(
      true,
    )
  })

  it('rejects English voices', () => {
    expect(isChineseVoiceLike({ lang: 'en-US', name: 'Zira' })).toBe(false)
  })
})

describe('pickPreferredVoice', () => {
  it('English: prefers Google over Microsoft Desktop', () => {
    const picked = pickPreferredVoice(
      [
        { lang: 'en-US', name: 'Microsoft David Desktop - English (United States)', localService: true },
        { lang: 'en-US', name: 'Google US English', localService: false },
        { lang: 'en-US', name: 'Microsoft Zira Desktop - English (United States)', localService: true },
      ],
      'en',
    )
    expect(picked?.name).toBe('Google US English')
  })

  it('English: prefers Natural over Google', () => {
    const picked = pickPreferredVoice(
      [
        { lang: 'en-US', name: 'Google US English', localService: false },
        {
          lang: 'en-US',
          name: 'Microsoft Jenny Natural - English (United States)',
          localService: false,
        },
      ],
      'en',
    )
    expect(picked?.name).toContain('Natural')
  })

  it('Chinese: prefers Google Mandarin over Microsoft Huihui', () => {
    const picked = pickPreferredVoice(
      [
        {
          lang: 'zh-CN',
          name: 'Microsoft Huihui Desktop - Chinese (Simplified)',
          localService: false,
        },
        { lang: 'zh-CN', name: 'Google 普通话（中国大陆）', localService: false },
      ],
      'zh',
    )
    expect(picked?.name).toContain('Google')
  })

  it('Chinese: Google-only is a valid preferred voice', () => {
    const picked = pickPreferredVoice(
      [{ lang: 'zh-CN', name: 'Google 普通话（中国大陆）', localService: false }],
      'zh',
    )
    expect(picked?.name).toContain('Google')
  })
})

describe('pickReliableVoice', () => {
  it('English: prefers Microsoft local over Google', () => {
    const picked = pickReliableVoice(
      [
        { lang: 'en-US', name: 'Microsoft David Desktop - English (United States)', localService: true },
        { lang: 'en-US', name: 'Google US English', localService: false },
        { lang: 'en-US', name: 'Microsoft Zira Desktop - English (United States)', localService: true },
      ],
      'en',
    )
    expect(picked?.localService).toBe(true)
    expect(picked?.name).not.toBe('Google US English')
  })

  it('English: accepts Microsoft when Chrome marks it non-local', () => {
    const picked = pickReliableVoice(
      [
        { lang: 'en-US', name: 'Google US English', localService: false },
        {
          lang: 'en-US',
          name: 'Microsoft Zira Desktop - English (United States)',
          localService: false,
        },
      ],
      'en',
    )
    expect(picked?.name).toContain('Zira')
  })

  it('English: returns null when only Google exists (not reliable)', () => {
    expect(
      pickReliableVoice([{ lang: 'en-US', name: 'Google US English', localService: false }], 'en'),
    ).toBeNull()
  })

  it('Chinese: ignores cloud-only Mandarin as reliable', () => {
    expect(
      pickReliableVoice(
        [{ lang: 'zh-CN', name: 'Google 普通话（中国大陆）', localService: false }],
        'zh',
      ),
    ).toBeNull()
    expect(
      isReliableChineseVoice({ lang: 'zh-CN', name: 'Google 普通话', localService: false }),
    ).toBe(false)
  })

  it('Chinese: accepts Microsoft even when Chrome marks it non-local', () => {
    const picked = pickReliableVoice(
      [
        { lang: 'zh-CN', name: 'Google 普通话（中国大陆）', localService: false },
        {
          lang: 'zh-CN',
          name: 'Microsoft Huihui Desktop - Chinese (Simplified)',
          localService: false,
        },
      ],
      'zh',
    )
    expect(picked?.name).toContain('Huihui')
    expect(
      isReliableEnglishVoice({
        lang: 'en-US',
        name: 'Microsoft Zira Desktop - English (United States)',
        localService: false,
      }),
    ).toBe(true)
  })

  it('Chinese: picks local cmn/zh voice', () => {
    const picked = pickReliableVoice(
      [
        { lang: 'cmn-CN', name: 'Google 普通话', localService: false },
        { lang: 'zh-CN', name: 'Microsoft Huihui Desktop - Chinese (Simplified)', localService: true },
      ],
      'zh',
    )
    expect(picked?.localService).toBe(true)
    expect(picked?.name).toContain('Huihui')
  })

  it('prefers zh-CN over other Chinese locales among local voices', () => {
    const picked = pickReliableVoice(
      [
        { lang: 'zh-TW', name: 'Han', localService: true },
        { lang: 'zh-CN', name: 'Xiaoxiao', localService: true },
        { lang: 'zh-HK', name: 'HiuGaai', localService: true },
      ],
      'zh',
    )
    expect(picked?.lang).toBe('zh-CN')
  })
})

describe('resolveSpeakVoices', () => {
  it('Chinese: Google + Huihui → primary Huihui, no fallback', () => {
    const pair = resolveSpeakVoices(
      [
        { lang: 'zh-CN', name: 'Google 普通话（中国大陆）', localService: false },
        {
          lang: 'zh-CN',
          name: 'Microsoft Huihui Desktop - Chinese (Simplified)',
          localService: false,
        },
      ],
      'zh',
    )
    expect(pair.primary?.name).toContain('Huihui')
    expect(pair.fallback).toBeNull()
  })

  it('Chinese: Google only → primary Google, no fallback', () => {
    const pair = resolveSpeakVoices(
      [{ lang: 'zh-CN', name: 'Google 普通话（中国大陆）', localService: false }],
      'zh',
    )
    expect(pair.primary?.name).toContain('Google')
    expect(pair.fallback).toBeNull()
  })

  it('English: Google + Zira → primary Google, fallback Zira', () => {
    const pair = resolveSpeakVoices(
      [
        { lang: 'en-US', name: 'Google US English', localService: false },
        {
          lang: 'en-US',
          name: 'Microsoft Zira Desktop - English (United States)',
          localService: false,
        },
      ],
      'en',
    )
    expect(pair.primary?.name).toBe('Google US English')
    expect(pair.fallback?.name).toContain('Zira')
  })

  it('English: sticky reliable skips Google', () => {
    const pair = resolveSpeakVoices(
      [
        { lang: 'en-US', name: 'Google US English', localService: false },
        {
          lang: 'en-US',
          name: 'Microsoft Zira Desktop - English (United States)',
          localService: false,
        },
      ],
      'en',
      { stickyReliableOnly: true },
    )
    expect(pair.primary?.name).toContain('Zira')
    expect(pair.fallback).toBeNull()
  })
})

describe('pickVoiceForLang', () => {
  it('returns null when no matching voices exist', () => {
    expect(pickVoiceForLang([{ lang: 'zh-CN', name: 'Xiaoxiao', localService: true }], 'en')).toBeNull()
    expect(pickVoiceForLang([{ lang: 'en-US', name: 'Jenny' }], 'zh')).toBeNull()
  })

  it('prefers en-US over other English locales for preferred', () => {
    const picked = pickVoiceForLang(
      [
        { lang: 'en-GB', name: 'British', localService: true },
        { lang: 'en-US', name: 'American', localService: true },
        { lang: 'en-AU', name: 'Aussie', localService: true },
      ],
      'en',
    )
    expect(picked?.lang).toBe('en-US')
  })

  it('falls back to any en-* voice', () => {
    const picked = pickVoiceForLang([{ lang: 'en-IN', name: 'Ravi' }], 'en')
    expect(picked?.lang).toBe('en-IN')
  })

  it('English: presence uses preferred Google when both exist', () => {
    const picked = pickVoiceForLang(
      [
        { lang: 'en-US', name: 'Microsoft Zira Desktop - English (United States)', localService: true },
        { lang: 'en-US', name: 'Google US English', localService: false },
      ],
      'en',
    )
    expect(picked?.name).toBe('Google US English')
  })

  it('uses cloud English voice when it is the only option', () => {
    const picked = pickVoiceForLang(
      [{ lang: 'en-US', name: 'Google US English', localService: false }],
      'en',
    )
    expect(picked?.name).toBe('Google US English')
  })

  it('Chinese: Google-only is no longer null (preferred exists)', () => {
    expect(
      pickVoiceForLang([{ lang: 'zh-CN', name: 'Google 普通话（中国大陆）', localService: false }], 'zh'),
    ).not.toBeNull()
    expect(
      pickVoiceForLang([{ lang: 'cmn-CN', name: 'Google 普通话', localService: false }], 'zh'),
    ).not.toBeNull()
  })

  it('Chinese: presence prefers Google when Microsoft also exists', () => {
    const picked = pickVoiceForLang(
      [
        { lang: 'zh-CN', name: 'Google 普通话（中国大陆）', localService: false },
        {
          lang: 'zh-CN',
          name: 'Microsoft Huihui Desktop - Chinese (Simplified)',
          localService: false,
        },
      ],
      'zh',
    )
    expect(picked?.name).toContain('Google')
  })

  it('hasVoiceForLang-equivalent: en present means zh still missing', () => {
    const voices = [{ lang: 'en-US', name: 'Jenny' }]
    expect(pickVoiceForLang(voices, 'en')).not.toBeNull()
    expect(pickVoiceForLang(voices, 'zh')).toBeNull()
  })
})

describe('pickEnglishVoice', () => {
  it('delegates to pickVoiceForLang en', () => {
    expect(pickEnglishVoice([{ lang: 'zh-CN', name: 'Xiaoxiao', localService: true }])).toBeNull()
    expect(pickEnglishVoice([{ lang: 'en-US', name: 'Jenny' }])?.name).toBe('Jenny')
  })
})
