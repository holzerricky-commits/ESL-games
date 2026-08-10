import {
  CLASS_TOOLBOX_DICE_SIDES_READY,
  type DiceSides,
} from '@/lib/class-toolbox/dice-roll'

/**
 * PNG face art lives at:
 *   public/class-toolbox/dice/d{N}/face-{1..N}.png
 * Example: public/class-toolbox/dice/d4/face-1.png … face-4.png
 *
 * Ready die types (d4 / d6 / d8) always use these images on stage and dock.
 */
export function diceFaceSrc(sides: DiceSides, face: number): string {
  return `/class-toolbox/dice/d${sides}/face-${face}.png`
}

/** Warm browser cache for every face of a ready die type. */
export function preloadDicePngArt(sides: DiceSides): void {
  for (let face = 1; face <= sides; face++) {
    const img = new Image()
    img.src = diceFaceSrc(sides, face)
  }
}

/** Preload all ready PNG sets (d4 / d6 / d8). */
export function preloadReadyDicePngArt(): void {
  for (const sides of CLASS_TOOLBOX_DICE_SIDES_READY) {
    preloadDicePngArt(sides)
  }
}
