export type CoinSide = 'heads' | 'tails'

/** Duration of the over-book coin flip animation. */
export const CLASS_TOOLBOX_COIN_FLIP_MS = 1200

/** Keep soft dim + block book taps after the flip lands (then fade out). */
export const CLASS_TOOLBOX_COIN_SETTLE_MS = 1100

export function randomCoinSide(): CoinSide {
  return Math.random() < 0.5 ? 'heads' : 'tails'
}

export function coinSideLabel(side: CoinSide | null, flipping: boolean): string {
  if (flipping) return '…'
  if (side === null) return 'Ready'
  return side === 'heads' ? 'Heads' : 'Tails'
}
