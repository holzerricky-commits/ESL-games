export type DiceSides = 4 | 6 | 8 | 10 | 12 | 20

export type DiceFace = 1 | 2 | 3 | 4 | 5 | 6

/** Google-style side options (dock row). */
export const CLASS_TOOLBOX_DICE_SIDES: readonly DiceSides[] = [4, 6, 8, 10, 12, 20]

/** Sides with PNG art that can be added and rolled. Others stay visible as coming soon. */
export const CLASS_TOOLBOX_DICE_SIDES_READY: readonly DiceSides[] = [4, 6, 8]

export function isDiceSidesReady(sides: DiceSides): boolean {
  return (CLASS_TOOLBOX_DICE_SIDES_READY as readonly number[]).includes(sides)
}

export const CLASS_TOOLBOX_DICE_MAX = 6

/** Soft dim + block book taps after the last die lands (then fade out). */
export const CLASS_TOOLBOX_DICE_SETTLE_MS = 1100

/** Per-die tumble duration range (ms) — long enough for classroom suspense. */
export const CLASS_TOOLBOX_DICE_DURATION_MIN_MS = 1500
export const CLASS_TOOLBOX_DICE_DURATION_MAX_MS = 2100

/** Stagger between dice starts. */
export const CLASS_TOOLBOX_DICE_STAGGER_BASE_MS = 90
export const CLASS_TOOLBOX_DICE_STAGGER_JITTER_MS = 45

export const CLASS_TOOLBOX_DICE_PEAK_Y_MIN_PX = 110
export const CLASS_TOOLBOX_DICE_PEAK_Y_MAX_PX = 170
export const CLASS_TOOLBOX_DICE_DRIFT_X_MIN_PX = 28
export const CLASS_TOOLBOX_DICE_DRIFT_X_MAX_PX = 78
/** Whole turns only so the die lands upright (no fractional tilt snap). */
export const CLASS_TOOLBOX_DICE_SPINS_MIN = 5
export const CLASS_TOOLBOX_DICE_SPINS_MAX = 8

/** Fraction of (delay + duration) when the final face locks — late, near land. */
export const CLASS_TOOLBOX_DICE_REVEAL_FRACTION = 0.8

/**
 * Mid-range default for fallbacks. Prefer per-die motion duration.
 */
export const CLASS_TOOLBOX_DICE_ROLL_MS = 1800

/**
 * Mid-range default for fallbacks. Prefer per-die `revealAtMs` from motion seeds.
 */
export const CLASS_TOOLBOX_DICE_REVEAL_MS = 1450

export type ToolboxDie = {
  id: string
  sides: DiceSides
  value: number | null
  /** When true, Roll leaves this die’s value alone. */
  locked: boolean
}

/** One roll’s motion seed for a single die (CSS vars + timing). */
export type DiceRollMotion = {
  delayMs: number
  durationMs: number
  /** Positive lift in px; CSS uses negative Y. */
  peakYPx: number
  /** Signed lateral drift in px (one direction for the whole arc). */
  driftXPx: number
  /** Signed full turns (negative = counterclockwise). */
  spins: number
  /** Absolute ms from roll start when the final face locks. */
  revealAtMs: number
}

export type DiceRollMotions = Record<string, DiceRollMotion>

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function randSign(): 1 | -1 {
  return Math.random() < 0.5 ? -1 : 1
}

/** Inclusive integer in [min, max]. */
function randIntInclusive(min: number, max: number): number {
  return Math.floor(randBetween(min, max + 1))
}

/** Build a fresh motion seed per die for this roll (stagger + variety). */
export function createDiceRollMotions(dice: readonly ToolboxDie[]): DiceRollMotions {
  const motions: DiceRollMotions = {}
  dice.forEach((die, index) => {
    const durationMs = Math.round(
      randBetween(CLASS_TOOLBOX_DICE_DURATION_MIN_MS, CLASS_TOOLBOX_DICE_DURATION_MAX_MS),
    )
    const stagger =
      index === 0
        ? Math.round(randBetween(0, CLASS_TOOLBOX_DICE_STAGGER_JITTER_MS * 0.35))
        : Math.round(
            index * CLASS_TOOLBOX_DICE_STAGGER_BASE_MS +
              randBetween(-CLASS_TOOLBOX_DICE_STAGGER_JITTER_MS, CLASS_TOOLBOX_DICE_STAGGER_JITTER_MS),
          )
    const delayMs = Math.max(0, stagger)
    const peakYPx = Math.round(
      randBetween(CLASS_TOOLBOX_DICE_PEAK_Y_MIN_PX, CLASS_TOOLBOX_DICE_PEAK_Y_MAX_PX),
    )
    const driftXPx =
      Math.round(randBetween(CLASS_TOOLBOX_DICE_DRIFT_X_MIN_PX, CLASS_TOOLBOX_DICE_DRIFT_X_MAX_PX)) *
      randSign()
    // Whole turns only — land upright so clearing the animation class does not snap.
    const spins = randIntInclusive(CLASS_TOOLBOX_DICE_SPINS_MIN, CLASS_TOOLBOX_DICE_SPINS_MAX) * randSign()
    const landAtMs = delayMs + durationMs
    const revealAtMs = Math.round(landAtMs * CLASS_TOOLBOX_DICE_REVEAL_FRACTION)
    motions[die.id] = {
      delayMs,
      durationMs,
      peakYPx,
      driftXPx,
      spins,
      revealAtMs,
    }
  })
  return motions
}

export function diceMotionLandAtMs(motion: DiceRollMotion): number {
  return motion.delayMs + motion.durationMs
}

export function maxDiceLandMs(motions: DiceRollMotions): number {
  let max = 0
  for (const motion of Object.values(motions)) {
    max = Math.max(max, diceMotionLandAtMs(motion))
  }
  return max
}

export function maxDiceRevealMs(motions: DiceRollMotions): number {
  let max = 0
  for (const motion of Object.values(motions)) {
    max = Math.max(max, motion.revealAtMs)
  }
  return max
}

/** Inline style for the tumbling die (duration, delay, arc vars). */
export function diceRollMotionStyle(motion: DiceRollMotion): {
  animationDuration: string
  animationDelay: string
  ['--dice-peak-y']: string
  ['--dice-drift-x']: string
  ['--dice-spins']: string
} {
  return {
    animationDuration: `${motion.durationMs}ms`,
    animationDelay: `${motion.delayMs}ms`,
    '--dice-peak-y': `-${motion.peakYPx}px`,
    '--dice-drift-x': `${motion.driftXPx}px`,
    '--dice-spins': String(motion.spins),
  }
}

export function randomDieValue(sides: DiceSides): number {
  return Math.floor(Math.random() * sides) + 1
}

export function randomDiceFace(): DiceFace {
  return randomDieValue(6) as DiceFace
}

export function sumDiceValues(dice: readonly ToolboxDie[]): number {
  return dice.reduce((sum, die) => sum + (die.value ?? 0), 0)
}

export function formatDiceValuesList(dice: readonly ToolboxDie[], rolling: boolean): string {
  if (rolling) return '…'
  if (dice.length === 0) return 'Ready'
  if (dice.every((die) => die.value == null)) return 'Ready'
  return dice.map((die) => (die.value == null ? '–' : String(die.value))).join(' · ')
}

export function formatDiceTotal(dice: readonly ToolboxDie[], rolling: boolean): string {
  if (rolling) return '…'
  if (dice.length === 0 || dice.every((die) => die.value == null)) return '—'
  return String(sumDiceValues(dice))
}

export function createToolboxDie(sides: DiceSides, id?: string): ToolboxDie {
  return {
    id: id ?? `die-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sides,
    value: null,
    locked: false,
  }
}

export function createDefaultDiceBag(): ToolboxDie[] {
  return [createToolboxDie(6)]
}

export function isD6Face(value: number): value is DiceFace {
  return value >= 1 && value <= 6
}
