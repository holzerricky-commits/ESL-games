import { wordTileIndex, wordTileLetter } from '@/lib/lesson-vault/word-tile'
import { cn } from '@/lib/utils'

/** Soft tints that sit well on the dark card gradient. */
const TILE_TINTS = [
  'from-sky-400/35 to-sky-700/25 text-sky-50',
  'from-violet-400/35 to-violet-700/25 text-violet-50',
  'from-emerald-400/35 to-emerald-700/25 text-emerald-50',
  'from-amber-400/35 to-amber-700/25 text-amber-50',
  'from-rose-400/35 to-rose-700/25 text-rose-50',
  'from-teal-400/35 to-teal-700/25 text-teal-50',
  'from-indigo-400/35 to-indigo-700/25 text-indigo-50',
  'from-orange-400/35 to-orange-700/25 text-orange-50',
]

/**
 * Stand-in for a card without a picture: the word's first letter on its own colour.
 * `letterClassName` sets the letter size for the tile size.
 */
export function LessonVaultWordTile({
  word,
  className,
  letterClassName = 'text-lg',
}: {
  word: string
  className?: string
  letterClassName?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex select-none items-center justify-center overflow-hidden bg-gradient-to-br font-bold leading-none ring-1 ring-inset ring-white/10',
        TILE_TINTS[wordTileIndex(word, TILE_TINTS.length)],
        className,
      )}
    >
      <span className={cn('drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]', letterClassName)}>{wordTileLetter(word)}</span>
    </span>
  )
}
