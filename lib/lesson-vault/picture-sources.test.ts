import { describe, expect, it } from 'vitest'
import {
  arasaacChoice,
  arasaacChoices,
  fluentChoice,
  fluentChoices,
  isAllowedPictureUrl,
  mergePictureChoices,
  pixabayChoice,
  relevantFluentNames,
} from './picture-sources'

const c = (n: string) => ({ thumb: `t-${n}`, full: `f-${n}` })

describe('vault picture sources', () => {
  it('only downloads from known picture hosts over https', () => {
    expect(isAllowedPictureUrl('https://static.arasaac.org/pictograms/1/1_500.png')).toBe(true)
    expect(isAllowedPictureUrl('https://cdn.pixabay.com/photo/x.jpg')).toBe(true)
    expect(isAllowedPictureUrl('https://api.iconify.design/fluent-emoji-flat/x.svg')).toBe(true)
    expect(isAllowedPictureUrl('http://static.arasaac.org/x.png')).toBe(false)
    expect(isAllowedPictureUrl('https://evil.example/arasaac.org.png')).toBe(false)
    expect(isAllowedPictureUrl('file:///etc/passwd')).toBe(false)
  })

  it('ARASAAC: exact matches first, fuzzy search only when allowed', async () => {
    const asked: string[] = []
    const fetchJson = async (url: string) => {
      asked.push(url)
      if (url.includes('/bestsearch/')) return null
      return [{ _id: 7 }, { _id: 8, violence: true }, { _id: 9 }]
    }
    expect(await arasaacChoices('Riverbank', fetchJson, { limit: 3, fuzzy: false })).toEqual([])
    expect(await arasaacChoices('riverbank', fetchJson, { limit: 3, fuzzy: true })).toEqual([
      arasaacChoice(7),
      arasaacChoice(9),
    ])
    expect(asked[0]).toBe('https://api.arasaac.org/v1/pictograms/en/bestsearch/riverbank')
  })

  it('Fluent emoji: keeps names with the keyword as a word, drops skin tones and loose matches', async () => {
    const icons = [
      'fluent-emoji-flat:man-running-light',
      'fluent-emoji-flat:person-running',
      'fluent-emoji-flat:running-shoe',
      'fluent-emoji-flat:runway',
    ]
    expect(relevantFluentNames('run', icons)).toEqual(['person-running', 'running-shoe'])
    expect(relevantFluentNames('car', ['fluent-emoji-flat:card-index', 'fluent-emoji-flat:racing-car'])).toEqual([
      'racing-car',
    ])
    const fetchJson = async () => ({ icons: ['fluent-emoji-flat:world-map'] })
    expect(await fluentChoices('world', fetchJson, 2)).toEqual([fluentChoice('world-map')])
  })

  it('uses the lasting Pixabay CDN copy instead of the expiring API link', () => {
    expect(
      pixabayChoice('https://cdn.pixabay.com/photo/2014/04/06/03/12/starfish-317511_150.jpg', 'https://pixabay.com/get/x_1280.jpg'),
    ).toEqual({
      thumb: 'https://cdn.pixabay.com/photo/2014/04/06/03/12/starfish-317511_150.jpg',
      full: 'https://cdn.pixabay.com/photo/2014/04/06/03/12/starfish-317511_640.jpg',
    })
    expect(pixabayChoice('', 'https://pixabay.com/get/x_1280.jpg').full).toBe('https://pixabay.com/get/x_1280.jpg')
  })

  it('merges pictograms, then an icon, then stock pictures, up to the max', () => {
    expect(
      mergePictureChoices(
        { arasaac: [c('a1'), c('a2'), c('a3')], fluent: [c('e1'), c('e2')], pixabay: [c('p1'), c('p2'), c('p3')] },
        5,
      ).map((x) => x.full),
    ).toEqual(['f-a1', 'f-a2', 'f-e1', 'f-p1', 'f-p2'])
    expect(
      mergePictureChoices({ arasaac: [], fluent: [c('e1'), c('e2')], pixabay: [c('p1')] }, 5).map((x) => x.full),
    ).toEqual(['f-e1', 'f-p1', 'f-e2'])
  })
})
