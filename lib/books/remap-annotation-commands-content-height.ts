import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { TEXT_FONT_SIZE_NORM_MIN } from '@/lib/books/text-font-size-min'

/**
 * When a lesson-board page grows taller, Y norms are fractions of total height.
 * Scale Y (and height-tied sizes) so on-screen pixel positions/sizes stay the same.
 */
export function remapAnnotationCommandForContentHeightChange(
  cmd: AnnotationCommand,
  oldHeightPx: number,
  newHeightPx: number,
): AnnotationCommand {
  if (!(oldHeightPx > 0) || !(newHeightPx > 0) || oldHeightPx === newHeightPx) return cmd
  const fy = oldHeightPx / newHeightPx
  const sy = (y: number) => y * fy
  const sh = (h: number) => h * fy

  switch (cmd.kind) {
    case 'stroke':
      return {
        ...cmd,
        points: cmd.points.map(([x, y]) => [x, sy(y)] as [number, number]),
        ...(cmd.rotationBounds
          ? {
              rotationBounds: {
                x: cmd.rotationBounds.x,
                y: sy(cmd.rotationBounds.y),
                w: cmd.rotationBounds.w,
                h: sh(cmd.rotationBounds.h),
              },
            }
          : {}),
      }
    case 'line':
      return {
        ...cmd,
        a: [cmd.a[0], sy(cmd.a[1])],
        b: [cmd.b[0], sy(cmd.b[1])],
      }
    case 'arrow':
      return {
        ...cmd,
        from: [cmd.from[0], sy(cmd.from[1])],
        to: [cmd.to[0], sy(cmd.to[1])],
      }
    case 'rect':
    case 'ellipse':
    case 'triangle':
      return { ...cmd, y: sy(cmd.y), h: sh(cmd.h) }
    case 'stamp':
    case 'callout':
      return { ...cmd, center: [cmd.center[0], sy(cmd.center[1])] }
    case 'text':
      return {
        ...cmd,
        y: sy(cmd.y),
        fontSizeNorm: Math.max(TEXT_FONT_SIZE_NORM_MIN, cmd.fontSizeNorm * fy),
      }
    case 'sticky':
      return {
        ...cmd,
        y: sy(cmd.y),
        h: sh(cmd.h),
        fontSizeNorm: Math.max(TEXT_FONT_SIZE_NORM_MIN, cmd.fontSizeNorm * fy),
      }
    case 'image':
    case 'flashcard':
      return { ...cmd, y: sy(cmd.y), h: sh(cmd.h) }
    default:
      return cmd
  }
}

export function remapAnnotationCommandsForContentHeightChange(
  commands: readonly AnnotationCommand[],
  oldHeightPx: number,
  newHeightPx: number,
): AnnotationCommand[] {
  if (!(oldHeightPx > 0) || !(newHeightPx > 0) || oldHeightPx === newHeightPx) {
    return commands.map((c) => c)
  }
  return commands.map((c) =>
    remapAnnotationCommandForContentHeightChange(c, oldHeightPx, newHeightPx),
  )
}
