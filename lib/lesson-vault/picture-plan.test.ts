import { describe, expect, it } from 'vitest'
import {
  buildPicturePlanPrompt,
  isObviouslyUnpicturable,
  parsePicturePlans,
  resolvePicturePlans,
  usableVaultGloss,
  wordsNeedingModel,
} from './picture-plan'

const curated = (word: string) => (word === 'bat' ? 'flying bat animal' : undefined)

describe('vault picture plan', () => {
  it('skips function words without asking the model', () => {
    expect(isObviouslyUnpicturable('However')).toBe(true)
    expect(isObviouslyUnpicturable('123')).toBe(true)
    expect(isObviouslyUnpicturable('seastar')).toBe(false)
    expect(wordsNeedingModel(['however', 'bat', 'Seastar', 'seastar'])).toEqual(['bat', 'seastar'])
  })

  it('parses model JSON, keeps only asked words, and treats empty phrases as not picturable', () => {
    const text =
      '```json\n{"plans":{"Seastar":{"picturable":true,"keyword":"Starfish","phrase":"cartoon seastar","gloss":"a star-shaped sea animal"},"idea":{"picturable":false,"phrase":"x","gloss":"a thought"},"brave":{"picturable":true,"phrase":""},"extra":{"picturable":true,"phrase":"no"}}}\n```'
    expect(parsePicturePlans(text, ['seastar', 'idea', 'brave'])).toEqual({
      seastar: { picturable: true, keyword: 'starfish', phrase: 'cartoon seastar', gloss: 'a star-shaped sea animal' },
      idea: { picturable: false, keyword: 'idea', phrase: '', gloss: 'a thought' },
      brave: { picturable: false, keyword: 'brave', phrase: '', gloss: '' },
    })
    expect(parsePicturePlans('not json', ['a'])).toEqual({})
  })

  it('resolves: skip list, then model, then curated, then the plain word', () => {
    const seastar = { picturable: true, keyword: 'starfish', phrase: 'cartoon seastar', gloss: 'a sea animal' }
    expect(
      resolvePicturePlans(['the', 'bat', 'seastar', 'crab'], { curated, model: { seastar } }),
    ).toEqual({
      the: { picturable: false, keyword: 'the', phrase: '', gloss: '' },
      bat: { picturable: true, keyword: 'bat', phrase: 'flying bat animal', gloss: '' },
      seastar,
      crab: { picturable: true, keyword: 'crab', phrase: 'crab', gloss: '' },
    })
    const cricket = { picturable: true, keyword: 'bat', phrase: 'cricket bat', gloss: 'a bat used in cricket' }
    expect(resolvePicturePlans(['bat'], { curated, model: { bat: cricket } }).bat).toEqual(cricket)
    expect(
      resolvePicturePlans(['however'], {
        curated,
        model: { however: { picturable: true, keyword: 'however', phrase: 'however', gloss: 'but; showing a difference' } },
      }).however,
    ).toEqual({ picturable: false, keyword: 'however', phrase: '', gloss: 'but; showing a difference' })
  })

  it('drops a gloss that only repeats the word or the sentence', () => {
    expect(usableVaultGloss('the land beside a river', 'We sat on the river bank.', 'bank')).toBe(
      'the land beside a river',
    )
    expect(usableVaultGloss('bank', 'We sat on the river bank.', 'bank')).toBe('')
    expect(usableVaultGloss('We sat on the river bank.', 'We sat on the river bank.', 'bank')).toBe('')
    expect(usableVaultGloss('the land beside a river', '', 'bank')).toBe('')
  })

  it('puts each word and its sentence in the prompt', () => {
    expect(buildPicturePlanPrompt([{ word: 'Bank', sentence: 'We sat on the  river bank.' }])).toContain(
      '"bank" — sentence: We sat on the river bank.',
    )
  })
})
