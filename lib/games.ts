export interface GameDefinition {
  slug: string
  title: string
  shortDescription: string
  /** Path under /public, e.g. /games/lvyQA.jpg */
  coverImage: string
  available: boolean
  badge: 'Live' | 'Soon'
}

export const GAMES: GameDefinition[] = [
  {
    slug: 'timed-challenge',
    title: 'Timed Challenge',
    shortDescription: 'Timed vocabulary quizzes with images—build, play, and track student results.',
    coverImage: '/games/lvyQA.jpg',
    available: true,
    badge: 'Live',
  },
  {
    slug: 'dice-roll',
    title: 'Dice Roll',
    shortDescription: 'Roll for speaking prompts, grammar targets, or team tasks—fast classroom fun.',
    coverImage: '/games/iUjhN.jpg',
    available: false,
    badge: 'Soon',
  },
  {
    slug: 'picture-prompts',
    title: 'Picture Prompts',
    shortDescription: 'Storytelling and discussion from a single image—perfect for ESL fluency.',
    coverImage: '/games/BEt4t.jpg',
    available: false,
    badge: 'Soon',
  },
]

export function gameHref(slug: string): string {
  return `/games/${slug}`
}
