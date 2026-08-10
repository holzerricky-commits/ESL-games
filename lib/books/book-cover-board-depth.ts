import type { CSSProperties } from 'react'

/** Inset cardboard bevel on cover boards. */
export function hardcoverBoardBevelInsetBoxShadow(): string {
  return [
    'inset 1.5px 1.5px 1px rgba(255, 255, 255, 0.15)',
    'inset -1.5px -1.5px 2px rgba(0, 0, 0, 0.45)',
  ].join(', ')
}

/** @deprecated Use `hardcoverBoardBevelInsetBoxShadow`. */
export function hardcoverBoardBevelBoxShadow(): string {
  return hardcoverBoardBevelInsetBoxShadow()
}

export function hardcoverBoardPanelCornerRadiusStyle(
  side: 'left' | 'right',
  shellRadiusPx: number,
): Pick<
  CSSProperties,
  'borderTopLeftRadius' | 'borderBottomLeftRadius' | 'borderTopRightRadius' | 'borderBottomRightRadius'
> {
  if (side === 'left') {
    return {
      borderTopLeftRadius: shellRadiusPx,
      borderBottomLeftRadius: shellRadiusPx,
    }
  }
  return {
    borderTopRightRadius: shellRadiusPx,
    borderBottomRightRadius: shellRadiusPx,
  }
}
