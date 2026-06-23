import { preserveCase } from '@/lib/writing-assist/spell-engine'

/** High-confidence single-token typo fixes before SymSpell. */
const COMMON_TYPOS: Record<string, string> = {
  si: 'is',
  teh: 'the',
  yuo: 'you',
  taht: 'that',
  becuase: 'because',
  recieve: 'receive',
  freind: 'friend',
  wierd: 'weird',
  goverment: 'government',
  definately: 'definitely',
  occured: 'occurred',
  untill: 'until',
  alot: 'a lot',
  thier: 'their',
  recieved: 'received',
  occassion: 'occasion',
  seperate: 'separate',
  enviroment: 'environment',
  accomodate: 'accommodate',
  neccessary: 'necessary',
  begining: 'beginning',
  writting: 'writing',
}

export function suggestCommonTypo(word: string): string | null {
  const lower = word.toLowerCase()
  const hit = COMMON_TYPOS[lower]
  if (!hit) return null
  return preserveCase(word, hit)
}
