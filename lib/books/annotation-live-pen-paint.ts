import type { PenInkStyle } from '@/lib/books/pen-ink'
import { penProfileDrawStyle, type PenStrokeProfile } from '@/lib/books/pen-stroke-profile'

/** Pen ink that must show full multi-pass / pattern fidelity while the stroke is in progress. */
export function penStrokeUsesRichLivePaint(args: {
  penInkStyle?: PenInkStyle
  penStrokeProfile?: PenStrokeProfile
}): boolean {
  if (args.penInkStyle && args.penInkStyle !== 'solid') return true
  const profileStyle = penProfileDrawStyle(args.penStrokeProfile)
  if ((profileStyle.softPasses?.length ?? 0) > 0) return true
  if (profileStyle.alpha < 0.9) return true
  return false
}
