import { describe, expect, it } from 'vitest'
import type { AnnotationCommand, TextAnnotationCommand } from '@/lib/books/annotation-command-types'
import { textCommandTightBBox } from '@/lib/books/annotation-geometry'
import {
  getAnnotationBounds,
  orientedSelectionFrameForCommand,
  selectionOutlineFramesForChrome,
} from '@/lib/books/annotation-select'
import { textLabelChromeBounds } from '@/lib/books/text-label-chrome-bounds'
import { TEXT_LABEL_PLACEHOLDER } from '@/lib/books/text-tool-ux'
import {
  textToolEditingOutlineFrames,
  textToolHoverOutlineFrames,
} from '@/lib/books/text-tool-hover'

const widthPx = 800
const heightPx = 600

function textCmd(overrides: Partial<TextAnnotationCommand> = {}): TextAnnotationCommand {
  return {
    kind: 'text',
    id: 't1',
    x: 0.1,
    y: 0.1,
    text: 'hello',
    color: '#000',
    fontSizeNorm: 0.04,
    ...overrides,
  }
}

describe('text-label-chrome-bounds', () => {
  it('select mode matches textCommandTightBBox for non-empty labels', () => {
    const cmd = textCmd()
    const tight = textCommandTightBBox(cmd, widthPx, heightPx)
    const chrome = textLabelChromeBounds(cmd, widthPx, heightPx, { mode: 'select' })
    expect(chrome).toEqual(tight)
  })

  it('select mode returns null for empty labels', () => {
    expect(textLabelChromeBounds(textCmd({ text: '' }), widthPx, heightPx, { mode: 'select' })).toBeNull()
    expect(textLabelChromeBounds(textCmd({ text: '  ' }), widthPx, heightPx, { mode: 'select' })).toBeNull()
  })

  it('edit mode uses placeholder for empty new labels', () => {
    const empty = textCmd({ text: '' })
    const bounds = textLabelChromeBounds(empty, widthPx, heightPx, { mode: 'edit' })
    expect(bounds).toEqual(
      textCommandTightBBox(empty, widthPx, heightPx, TEXT_LABEL_PLACEHOLDER),
    )
  })

  it('edit mode tracks live draft width', () => {
    const cmd = textCmd()
    const short = textLabelChromeBounds(cmd, widthPx, heightPx, { mode: 'edit', liveText: 'ab' })
    const long = textLabelChromeBounds(cmd, widthPx, heightPx, {
      mode: 'edit',
      liveText: 'hello world',
    })
    expect(short).not.toBeNull()
    expect(long).not.toBeNull()
    expect(long!.w).toBeGreaterThan(short!.w)
  })

  it('filled labels use wider horizontal pad than plain', () => {
    const plain = textCmd({ visualStyle: 'plain' })
    const filled = textCmd({ visualStyle: 'filled', fillColor: '#fef3c7' })
    const plainBox = textLabelChromeBounds(plain, widthPx, heightPx, { mode: 'select' })
    const filledBox = textLabelChromeBounds(filled, widthPx, heightPx, { mode: 'select' })
    expect(filledBox!.w).toBeGreaterThan(plainBox!.w)
  })
})

describe('text-label chrome ring parity', () => {
  const cmd = textCmd()
  const commands: AnnotationCommand[] = [cmd]

  it('getAnnotationBounds and orientedSelectionFrame agree for text', () => {
    const bounds = getAnnotationBounds(cmd, widthPx, heightPx)
    const frame = orientedSelectionFrameForCommand(cmd, widthPx, heightPx)
    expect(bounds).toEqual(textLabelChromeBounds(cmd, widthPx, heightPx, { mode: 'select' }))
    expect(frame?.rect).toEqual(bounds)
  })

  it('hover and select rings match for the same committed label', () => {
    const hover = textToolHoverOutlineFrames(commands, 't1', widthPx, heightPx)[0]!.rect
    const select = selectionOutlineFramesForChrome(commands, ['t1'], widthPx, heightPx, 'union')[0]!
      .rect
    expect(hover).toEqual(select)
  })

  it('edit ring matches select when draft equals committed text', () => {
    const edit = textToolEditingOutlineFrames(commands, 't1', widthPx, heightPx, 'hello')[0]!.rect
    const select = textLabelChromeBounds(cmd, widthPx, heightPx, { mode: 'select' })
    expect(edit).toEqual(select)
  })
})
