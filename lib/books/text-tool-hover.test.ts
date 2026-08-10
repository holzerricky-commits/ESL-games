import { describe, expect, it } from 'vitest'
import type { AnnotationCommand, TextAnnotationCommand } from '@/lib/books/annotation-command-types'
import { textLabelChromeBounds } from '@/lib/books/text-label-chrome-bounds'
import { getAnnotationBounds } from '@/lib/books/annotation-select'
import {
  resolveTextToolHoverTargetId,
  textToolEditingOutlineFrames,
  textToolHoverOutlineFrames,
  textToolPlacementCursor,
} from '@/lib/books/text-tool-hover'

const text: AnnotationCommand = {
  kind: 'text',
  id: 't1',
  x: 0.1,
  y: 0.1,
  text: 'hello',
  color: '#000',
  fontSizeNorm: 0.04,
}

const sticky: AnnotationCommand = {
  kind: 'sticky',
  id: 'n1',
  x: 0.5,
  y: 0.5,
  w: 0.22,
  h: 0.11,
  text: 'note',
  fontSizeNorm: 0.02,
  fillColor: '#fef3c7',
}

const commands = [text, sticky]
const widthPx = 800
const heightPx = 600

describe('text-tool-hover', () => {
  it('resolves text hover on tight label bounds', () => {
    const tight = textLabelChromeBounds(text as TextAnnotationCommand, widthPx, heightPx, {
      mode: 'select',
    })!
    const nx = tight.x + tight.w / 2
    const ny = tight.y + tight.h / 2
    expect(resolveTextToolHoverTargetId(commands, nx, ny, widthPx, heightPx, 'text')).toBe('t1')
  })

  it('text tool ignores stickies', () => {
    const bounds = getAnnotationBounds(sticky, widthPx, heightPx)!
    const nx = bounds.x + bounds.w / 2
    const ny = bounds.y + bounds.h / 2
    expect(resolveTextToolHoverTargetId(commands, nx, ny, widthPx, heightPx, 'text')).toBeNull()
  })

  it('writable tool resolves sticky hover', () => {
    const bounds = getAnnotationBounds(sticky, widthPx, heightPx)!
    const nx = bounds.x + bounds.w / 2
    const ny = bounds.y + bounds.h / 2
    expect(resolveTextToolHoverTargetId(commands, nx, ny, widthPx, heightPx, 'writable')).toBe(
      'n1',
    )
  })

  it('outline frames use tight text box and full sticky box', () => {
    const textFrames = textToolHoverOutlineFrames(commands, 't1', widthPx, heightPx)
    expect(textFrames).toHaveLength(1)
    expect(textFrames[0]!.rect).toEqual(
      textLabelChromeBounds(text as TextAnnotationCommand, widthPx, heightPx, { mode: 'hover' }),
    )

    const stickyFrames = textToolHoverOutlineFrames(commands, 'n1', widthPx, heightPx)
    expect(stickyFrames).toHaveLength(1)
    expect(stickyFrames[0]!.rect).toEqual(getAnnotationBounds(sticky, widthPx, heightPx))
  })

  it('editing frames are hidden while typing (WYSIWYG — no solid edit ring)', () => {
    const empty: AnnotationCommand = { ...text, id: 'new', text: '' }
    expect(textToolEditingOutlineFrames([empty], 'new', widthPx, heightPx)).toEqual([])
    expect(textToolEditingOutlineFrames(commands, 't1', widthPx, heightPx, 'hello')).toEqual([])
  })

  it('text tool uses I-beam by default and grab over selected label', () => {
    expect(textToolPlacementCursor('t1', true, false)).toBe('text')
    expect(textToolPlacementCursor(null, true, false)).toBe('text')
    expect(textToolPlacementCursor(null, false, true)).toBe('crosshair')
    expect(textToolPlacementCursor('n1', false, true)).toBe('text')
    expect(textToolPlacementCursor(null, true, false, 't1')).toBe('text')
    expect(textToolPlacementCursor('t1', true, false, null, 't1')).toBe('grab')
    expect(textToolPlacementCursor('t1', true, false, null, 't1', true)).toBe('grabbing')
    expect(textToolPlacementCursor('t2', true, false, null, 't1')).toBe('text')
  })
})
