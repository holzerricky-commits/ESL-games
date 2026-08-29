import { describe, expect, it } from 'vitest'
import {
  canonicalizeListeningNumberKey,
  hasAudioPinOnPage,
  listVisibleBookAudioPinsForUnit,
  listeningNumberTokens,
  matchTrackByListeningLabel,
  normalizeListeningLabel,
  primaryTrackListeningKey,
  type BookAudioPin,
  type BookAudioTrack,
} from '@/lib/books/book-audio'

function track(partial: Partial<BookAudioTrack> & Pick<BookAudioTrack, 'id' | 'fileName'>): BookAudioTrack {
  return {
    title: partial.title ?? partial.fileName.replace(/\.[^.]+$/, ''),
    filePath: partial.filePath ?? `book-library/demo/audio/${partial.fileName}`,
    sizeBytes: partial.sizeBytes ?? 1000,
    contentType: partial.contentType ?? 'audio/mpeg',
    savedAt: partial.savedAt ?? '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('normalizeListeningLabel', () => {
  it('strips Track prefix and normalizes separators', () => {
    expect(normalizeListeningLabel('Track 1.12')).toBe('1.12')
    expect(normalizeListeningLabel('1-12')).toBe('1.12')
    expect(normalizeListeningLabel('  3.4  ')).toBe('3.4')
  })
})

describe('canonicalizeListeningNumberKey', () => {
  it('strips leading zeros', () => {
    expect(canonicalizeListeningNumberKey('001')).toBe('1')
    expect(canonicalizeListeningNumberKey('012')).toBe('12')
    expect(canonicalizeListeningNumberKey('1.02')).toBe('1.2')
  })
})

describe('listeningNumberTokens', () => {
  it('prefers dotted forms', () => {
    const tokens = listeningNumberTokens('1.12')
    expect(tokens[0]).toBe('1.12')
    expect(tokens).toContain('1')
    expect(tokens).toContain('12')
  })
})

describe('primaryTrackListeningKey', () => {
  it('uses trailing padded number from publisher names', () => {
    expect(
      primaryTrackListeningKey('Compact Key for Schools SB Audio-COMPACT_KFS_SB_001.mp3'),
    ).toBe('1')
    expect(
      primaryTrackListeningKey('Compact Key for Schools SB Audio-COMPACT_KFS_SB_012.mp3'),
    ).toBe('12')
  })

  it('prefers trailing dotted unit.track forms', () => {
    expect(primaryTrackListeningKey('1.12.mp3')).toBe('1.12')
    expect(primaryTrackListeningKey('lesson-3.4.mp3')).toBe('3.4')
  })
})

describe('matchTrackByListeningLabel', () => {
  const tracks = [
    track({ id: 'a', fileName: '1.12.mp3' }),
    track({ id: 'b', fileName: '1.13.mp3' }),
    track({ id: 'c', fileName: '3.4.mp3', title: 'Lesson 3 Track 4' }),
  ]

  const compactTracks = [
    track({
      id: 'k1',
      fileName: 'Compact Key for Schools SB Audio-COMPACT_KFS_SB_001.mp3',
    }),
    track({
      id: 'k2',
      fileName: 'Compact Key for Schools SB Audio-COMPACT_KFS_SB_002.mp3',
    }),
    track({
      id: 'k3',
      fileName: 'Compact Key for Schools SB Audio-COMPACT_KFS_SB_003.mp3',
    }),
  ]

  it('matches exact file base', () => {
    const result = matchTrackByListeningLabel('1.12', tracks)
    expect(result).toEqual({ ok: true, track: tracks[0] })
  })

  it('matches Track-prefixed labels', () => {
    const result = matchTrackByListeningLabel('Track 1.13', tracks)
    expect(result).toEqual({ ok: true, track: tracks[1] })
  })

  it('matches hyphenated printed labels', () => {
    const result = matchTrackByListeningLabel('1-12', tracks)
    expect(result).toEqual({ ok: true, track: tracks[0] })
  })

  it('matches Compact Key trailing numbers with printed 1/2/3', () => {
    expect(matchTrackByListeningLabel('1', compactTracks)).toEqual({
      ok: true,
      track: compactTracks[0],
    })
    expect(matchTrackByListeningLabel('2', compactTracks)).toEqual({
      ok: true,
      track: compactTracks[1],
    })
    expect(matchTrackByListeningLabel('001', compactTracks)).toEqual({
      ok: true,
      track: compactTracks[0],
    })
  })

  it('returns none when no file matches', () => {
    expect(matchTrackByListeningLabel('9.99', tracks)).toEqual({ ok: false, reason: 'none' })
  })

  it('returns empty for blank label', () => {
    expect(matchTrackByListeningLabel('  ', tracks)).toEqual({ ok: false, reason: 'empty' })
  })

  it('returns ambiguous when two files share the same trailing number', () => {
    const dupes = [
      track({ id: 'x', fileName: 'track-12-a.mp3' }),
      track({ id: 'y', fileName: 'track-12-b.mp3' }),
    ]
    expect(matchTrackByListeningLabel('12', dupes)).toEqual({ ok: false, reason: 'ambiguous' })
  })

  it('does not treat bare 12 as a match for dotted 1.12', () => {
    const single = [track({ id: 'a', fileName: '1.12.mp3' })]
    expect(matchTrackByListeningLabel('12', single)).toEqual({ ok: false, reason: 'none' })
  })
})

describe('listVisibleBookAudioPinsForUnit', () => {
  const pin = (
    partial: Pick<BookAudioPin, 'id' | 'trackId' | 'unitId' | 'pdfPage'>,
  ): BookAudioPin => ({
    center: [0.5, 0.5],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  })

  const units = [
    { id: 'u1', filePath: 'book-library/demo/book.pdf' },
    { id: 'u12', filePath: 'book-library/demo/book.pdf' },
    { id: 'wb', filePath: 'book-library/demo/workbook.pdf' },
  ]

  it('shows pins from every unit that shares the same PDF', () => {
    const pins = [
      pin({ id: 'a', trackId: 't1', unitId: 'u1', pdfPage: 8 }),
      pin({ id: 'b', trackId: 't2', unitId: 'u12', pdfPage: 20 }),
    ]
    const visible = listVisibleBookAudioPinsForUnit(pins, {
      unitId: 'u12',
      unitFilePath: 'book-library/demo/book.pdf',
      bookUnits: units,
    })
    expect(visible.map((item) => item.id).sort()).toEqual(['a', 'b'])
  })

  it('hides pins that belong to a different PDF in the same book', () => {
    const pins = [
      pin({ id: 'a', trackId: 't1', unitId: 'u1', pdfPage: 8 }),
      pin({ id: 'w', trackId: 't9', unitId: 'wb', pdfPage: 8 }),
    ]
    const visible = listVisibleBookAudioPinsForUnit(pins, {
      unitId: 'u1',
      unitFilePath: 'book-library/demo/book.pdf',
      bookUnits: units,
    })
    expect(visible.map((item) => item.id)).toEqual(['a'])
  })

  it('dedupes the same track on the same page across units', () => {
    const pins = [
      pin({ id: 'old', trackId: 't1', unitId: 'u1', pdfPage: 20 }),
      pin({ id: 'new', trackId: 't1', unitId: 'u12', pdfPage: 20 }),
    ]
    const visible = listVisibleBookAudioPinsForUnit(pins, {
      unitId: 'u12',
      unitFilePath: 'book-library/demo/book.pdf',
      bookUnits: units,
    })
    expect(visible).toHaveLength(1)
    expect(visible[0]?.id).toBe('new')
  })
})

describe('hasAudioPinOnPage', () => {
  const pins: BookAudioPin[] = [
    {
      id: 'p1',
      trackId: 'a',
      unitId: 'u1',
      pdfPage: 5,
      center: [0.5, 0.5],
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]

  it('detects duplicate on same unit page', () => {
    expect(hasAudioPinOnPage(pins, 'a', 'u1', 5)).toBe(true)
    expect(hasAudioPinOnPage(pins, 'a', 'u1', 6)).toBe(false)
    expect(hasAudioPinOnPage(pins, 'a', 'u2', 5)).toBe(false)
    expect(hasAudioPinOnPage(pins, 'b', 'u1', 5)).toBe(false)
  })
})
