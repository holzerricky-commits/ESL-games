import { describe, expect, it } from 'vitest'
import {
  appendTextGlossToCommands,
  buildGlossTextSegments,
  commitTextGlossesForLabel,
  pruneInvalidTextGlosses,
  reconcileTextGlossesAfterTrim,
  upsertTextGloss,
} from '@/lib/books/text-gloss'
import type { TextAnnotationCommand } from '@/lib/books/annotation-command-types'

function textCmd(text: string, glosses?: TextAnnotationCommand['glosses']): TextAnnotationCommand {
  return {
    kind: 'text',
    id: 't1',
    x: 0.1,
    y: 0.1,
    text,
    color: '#111',
    fontSizeNorm: 0.02,
    ...(glosses ? { glosses } : {}),
  }
}

describe('text-gloss', () => {
  it('builds inline segments for valid gloss ranges', () => {
    const segments = buildGlossTextSegments('The cat sat', [
      { id: 'g1', start: 4, end: 7, source: 'cat', chinese: '猫', pinyin: 'māo' },
    ])
    expect(segments).toEqual([
      { text: 'The ' },
      {
        text: 'cat',
        gloss: { id: 'g1', start: 4, end: 7, source: 'cat', chinese: '猫', pinyin: 'māo' },
      },
      { text: ' sat' },
    ])
  })

  it('drops invalid glosses after text edits', () => {
    const glosses = [
      { id: 'g1', start: 4, end: 7, source: 'cat', chinese: '猫', pinyin: 'māo' },
      { id: 'g2', start: 8, end: 11, source: 'sat', chinese: '坐', pinyin: 'zuò' },
    ]
    expect(pruneInvalidTextGlosses('The dog sat', glosses)).toEqual([
      { id: 'g2', start: 8, end: 11, source: 'sat', chinese: '坐', pinyin: 'zuò' },
    ])
  })

  it('shifts gloss indices after leading trim', () => {
    const glosses = [
      { id: 'g1', start: 6, end: 9, source: 'cat', chinese: '猫', pinyin: 'māo' },
    ]
    expect(reconcileTextGlossesAfterTrim('  The cat', 'The cat', glosses)).toEqual([
      { id: 'g1', start: 4, end: 7, source: 'cat', chinese: '猫', pinyin: 'māo' },
    ])
  })

  it('upserts gloss on the same range', () => {
    const existing = [
      { id: 'g1', start: 0, end: 3, source: 'old', chinese: '旧', pinyin: 'jiù' },
    ]
    const next = upsertTextGloss(existing, {
      start: 0,
      end: 3,
      source: 'new',
      chinese: '新',
      pinyin: 'xīn',
    })
    expect(next).toHaveLength(1)
    expect(next[0]?.source).toBe('new')
    expect(next[0]?.chinese).toBe('新')
  })

  it('appends gloss to matching text command', () => {
    const cmds = appendTextGlossToCommands([textCmd('hello world')], {
      commandId: 't1',
      start: 0,
      end: 5,
      source: 'hello',
      chinese: '你好',
      pinyin: 'nǐ hǎo',
    })
    const cmd = cmds[0]
    expect(cmd?.kind).toBe('text')
    if (cmd?.kind !== 'text') return
    expect(cmd.glosses).toHaveLength(1)
    expect(cmd.glosses?.[0]?.source).toBe('hello')
  })

  it('clears glosses on label commit when text no longer matches', () => {
    const glosses = commitTextGlossesForLabel('  cat', 'cat', [
      { id: 'g1', start: 2, end: 5, source: 'cat', chinese: '猫', pinyin: 'māo' },
    ])
    expect(glosses).toEqual([
      { id: 'g1', start: 0, end: 3, source: 'cat', chinese: '猫', pinyin: 'māo' },
    ])
  })
})
