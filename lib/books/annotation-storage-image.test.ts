import { describe, expect, it } from 'vitest'
import { sanitizeAnnotationCommands } from '@/lib/books/annotation-storage'

describe('sanitizeAnnotationCommands image', () => {
  it('keeps valid image commands', () => {
    const src = 'data:image/png;base64,abc'
    const out = sanitizeAnnotationCommands([
      {
        kind: 'image',
        id: 'img-1',
        x: 0.1,
        y: 0.2,
        w: 0.3,
        h: 0.25,
        src,
        alt: 'Test',
      },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      kind: 'image',
      id: 'img-1',
      src,
      alt: 'Test',
    })
  })

  it('keeps image border rotation and lock fields', () => {
    const src = 'data:image/png;base64,abc'
    const out = sanitizeAnnotationCommands([
      {
        kind: 'image',
        id: 'img-3',
        x: 0.1,
        y: 0.2,
        w: 0.3,
        h: 0.25,
        src,
        rotationDeg: 45,
        strokeColor: '#ff0000',
        strokeWidthScale: 1.5,
        strokeVisible: true,
        locked: true,
      },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      kind: 'image',
      rotationDeg: 45,
      strokeColor: '#ff0000',
      strokeWidthScale: 1.5,
      locked: true,
    })
  })

  it('drops images without a data URL src', () => {
    const out = sanitizeAnnotationCommands([
      {
        kind: 'image',
        id: 'img-2',
        x: 0.1,
        y: 0.2,
        w: 0.3,
        h: 0.25,
        src: 'https://example.com/pic.png',
      },
    ])
    expect(out).toHaveLength(0)
  })
})
