import { describe, expect, it } from 'vitest'
import { dictionaryForm, vaultWordKey } from './dictionary-form'

const form = (word: string, sentence = '') => dictionaryForm(word, sentence)

describe('dictionary form', () => {
  it('stores the base form of ordinary inflections', () => {
    const cases: [string, string][] = [
      ['feathers', 'feather'],
      ['birds', 'bird'],
      ['cats', 'cat'],
      ['walked', 'walk'],
      ['played', 'play'],
      ['jumped', 'jump'],
      ['running', 'run'],
      ['jumping', 'jump'],
      ['flying', 'fly'],
      ['flies', 'fly'],
      ['bigger', 'big'],
      ['biggest', 'big'],
      ['cities', 'city'],
      ['babies', 'baby'],
      ['happier', 'happy'],
      ['stopped', 'stop'],
      ['hoped', 'hope'],
      ['tried', 'try'],
      ['danced', 'dance'],
      ['boxes', 'box'],
      ['horses', 'horse'],
      ['shoes', 'shoe'],
      ['cookies', 'cookie'],
    ]
    for (const [word, expected] of cases) expect(form(word), word).toBe(expected)
  })

  it('stores the base form of irregular verbs and nouns', () => {
    expect(form('flew')).toBe('fly')
    expect(form('went')).toBe('go')
    expect(form('ate')).toBe('eat')
    expect(form('ran')).toBe('run')
    expect(form('was')).toBe('be')
    expect(form('children')).toBe('child')
    expect(form('men')).toBe('man')
    expect(form('women')).toBe('woman')
    expect(form('mice')).toBe('mouse')
    expect(form('better')).toBe('good')
    expect(form('best')).toBe('good')
    expect(form('worse')).toBe('bad')
  })

  it('uses the sentence when the same spelling is two words', () => {
    expect(form('saw', 'She saw a bird.')).toBe('see')
    expect(form('saw', 'He cut the wood with a saw.')).toBe('saw')
    expect(form('saw')).toBe('saw')
    expect(form('left', 'She left the room.')).toBe('leave')
    expect(form('left', 'Turn to the left.')).toBe('left')
    expect(form('rose', 'A red rose grew in the garden.')).toBe('rose')
    expect(form('rose', 'The sun rose over the hill.')).toBe('rise')
    expect(form('found', 'She found a shell.')).toBe('find')
    expect(form('found')).toBe('found')
    expect(form('tears', 'Tears fell down her face.')).toBe('tears')
    expect(form('tears', 'She tears the paper.')).toBe('tear')
    expect(form('lives', 'A cat lives here.')).toBe('live')
    expect(form('lives', 'A cat has nine lives.')).toBe('life')
    expect(form('leaves', 'The leaves fell.')).toBe('leaf')
    expect(form('leaves', 'She leaves the house.')).toBe('leave')
    expect(form('reading', 'She is reading a book.')).toBe('read')
    expect(form('reading', 'A reading of the poem.')).toBe('reading')
    expect(form('wound', 'He wound the clock.')).toBe('wind')
    expect(form('wound', 'The soldier had a wound.')).toBe('wound')
  })

  it('leaves real words, names, phrases and contractions as they are', () => {
    expect(form('feather')).toBe('feather')
    expect(form('fly')).toBe('fly')
    expect(form('teacher')).toBe('teacher')
    expect(form('flower')).toBe('flower')
    expect(form('glasses')).toBe('glasses')
    expect(form('scissors')).toBe('scissors')
    expect(form('clothes')).toBe('clothes')
    expect(form('pants')).toBe('pants')
    expect(form('shorts')).toBe('shorts')
    expect(form('news')).toBe('news')
    expect(form('people')).toBe('people')
    expect(form('hundred')).toBe('hundred')
    expect(form('this')).toBe('this')
    expect(form('famous')).toBe('famous')
    expect(form("don't")).toBe("don't")
    expect(form("it's")).toBe("it's")
    expect(form("bird's")).toBe('bird')
    expect(form('ice cream')).toBe('ice cream')
    expect(form('look after')).toBe('look after')
    expect(form('Feathers', 'Feathers fell from the bird.')).toBe('feather')
    expect(form('Feathers', 'The parrot Feathers sat still.')).toBe('Feathers')
    expect(form('FEATHERS')).toBe('feather')
  })

  it('matches feathers with feather, and keeps a name on its own key', () => {
    expect(vaultWordKey('feathers')).toBe(vaultWordKey('feather'))
    expect(vaultWordKey('flew')).toBe('fly')
    expect(vaultWordKey('Feathers')).toBe('feathers')
    expect(vaultWordKey('Seastar')).toBe('seastar')
  })
})
