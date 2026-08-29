import { describe, expect, it } from 'vitest'
import type { AnnotationCommand, TextAnnotationCommand } from '@/lib/books/annotation-command-types'
import { textCommandTightBBox } from '@/lib/books/annotation-geometry'
import {
  getAnnotationBounds,
  orientedSelectionFrameForCommand,
  selectionOutlineFramesForChrome,
} from '@/lib/books/annotation-select'
import { textLabelChromeBounds } from '@/lib/books/text-label-chrome-bounds'
import { resolveFilledTextFieldLayout, resolveTextLabelFieldLayout } from '@/lib/books/filled-text-layout'
import { measureFilledTextLabelBounds, measurePlainTextLabelBounds } from '@/lib/books/text-label-measure'
import { annotationTextFontFamily } from '@/lib/books/annotation-text-fonts'
import { FILLED_EDIT_CHROME_INSET_PX } from '@/lib/books/text-label-layout'
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

/**
 * @vitest-environment jsdom
 */
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

  it('edit mode uses minimal caret-sized bounds for empty new labels', () => {
    const empty = textCmd({ text: '' })
    const bounds = textLabelChromeBounds(empty, widthPx, heightPx, { mode: 'edit' })
    expect(bounds).toEqual(textCommandTightBBox(empty, widthPx, heightPx, ''))
    expect(bounds!.w).toBeGreaterThan(0)
  })

  it('edit mode preserves trailing spaces in live draft width', () => {
    const cmd = textCmd()
    const noSpace = textLabelChromeBounds(cmd, widthPx, heightPx, {
      mode: 'edit',
      liveText: 'hello',
    })
    const withSpace = textLabelChromeBounds(cmd, widthPx, heightPx, {
      mode: 'edit',
      liveText: 'hello ',
    })
    expect(noSpace).not.toBeNull()
    expect(withSpace).not.toBeNull()
    expect(withSpace!.w).toBeGreaterThan(noSpace!.w)
  })

  it('edit mode tracks live draft width', () => {
    const cmd = textCmd()
    const short = textLabelChromeBounds(cmd, widthPx, heightPx, { mode: 'edit', liveText: 'a' })
    const long = textLabelChromeBounds(cmd, widthPx, heightPx, {
      mode: 'edit',
      liveText: 'abcdefghijklmnopqrstuvwxyz',
    })
    expect(short).not.toBeNull()
    expect(long).not.toBeNull()
    expect(long!.w).toBeGreaterThan(short!.w)
  })

  it('filled labels use pill-layout bounds with chrome inset', () => {
    const plain = textCmd({ visualStyle: 'plain' })
    const filled = textCmd({ visualStyle: 'filled', fillColor: '#fef3c7' })
    const plainBox = textLabelChromeBounds(plain, widthPx, heightPx, { mode: 'select' })
    const filledBox = textLabelChromeBounds(filled, widthPx, heightPx, { mode: 'select' })
    expect(plainBox).not.toBeNull()
    expect(filledBox).not.toBeNull()
    expect(filledBox!.h).toBeGreaterThan(0)
    expect(filledBox!.w).toBeGreaterThan(0)
  })
})

/**
 * @vitest-environment jsdom
 */
describe('filled text edit ring parity', () => {
  it('edit ring outer width matches resolveFilledTextFieldLayout + chrome inset', () => {
    const cmd = textCmd({ visualStyle: 'filled', fillColor: '#fef3c7', text: 'skupo' })
    const fontSizePx = Math.max(10, Math.round(cmd.fontSizeNorm * heightPx))
    const layout = resolveFilledTextFieldLayout(
      'skupo',
      annotationTextFontFamily(cmd.fontId),
      fontSizePx,
      cmd.x,
      widthPx,
      { growOnly: true },
    )
    const outerPx = layout.fieldWidthPx + FILLED_EDIT_CHROME_INSET_PX * 2
    const edit = textLabelChromeBounds(cmd, widthPx, heightPx, {
      mode: 'edit',
      liveText: 'skupo',
    })
    expect(edit).not.toBeNull()
    expect(edit!.w * widthPx).toBeCloseTo(outerPx, 0)
  })

  it('measureFilledTextLabelBounds matches textLabelChromeBounds for filled edit', () => {
    const cmd = textCmd({ visualStyle: 'filled', fillColor: '#fef3c7', text: 'skupo' })
    const chrome = textLabelChromeBounds(cmd, widthPx, heightPx, {
      mode: 'edit',
      liveText: 'skupo',
    })
    const measured = measureFilledTextLabelBounds(cmd, widthPx, heightPx, {
      mode: 'tight',
      textOverride: 'skupo',
      growOnly: true,
    })
    expect(chrome).toEqual(measured)
  })
})

/**
 * @vitest-environment jsdom
 */
describe('plain text edit ring parity', () => {
  it('edit ring width matches resolveTextLabelFieldLayout for plain', () => {
    const cmd = textCmd({ text: 'skupo' })
    const fontSizePx = Math.max(10, Math.round(cmd.fontSizeNorm * heightPx))
    const layout = resolveTextLabelFieldLayout(
      'skupo',
      annotationTextFontFamily(cmd.fontId),
      fontSizePx,
      cmd.x,
      widthPx,
      { variant: 'plain', growOnly: true },
    )
    const edit = textLabelChromeBounds(cmd, widthPx, heightPx, {
      mode: 'edit',
      liveText: 'skupo',
    })
    expect(edit).not.toBeNull()
    expect(edit!.w * widthPx).toBeCloseTo(layout.fieldWidthPx, 0)
  })

  it('measurePlainTextLabelBounds matches textLabelChromeBounds for plain edit', () => {
    const cmd = textCmd({ text: 'skupo' })
    const chrome = textLabelChromeBounds(cmd, widthPx, heightPx, {
      mode: 'edit',
      liveText: 'skupo',
    })
    const measured = measurePlainTextLabelBounds(cmd, widthPx, heightPx, {
      mode: 'tight',
      textOverride: 'skupo',
      growOnly: true,
    })
    expect(chrome).toEqual(measured)
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

  it('edit ring is shown while typing', () => {
    const frames = textToolEditingOutlineFrames(commands, 't1', widthPx, heightPx, 'hello')
    expect(frames).toHaveLength(1)
    expect(frames[0]!.rect.w).toBeGreaterThan(0)
  })
})
