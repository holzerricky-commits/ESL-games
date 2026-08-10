import type { CSSProperties } from 'react'

/** Soft shadow reach on the left page (spine on the right edge of that page). */
export const BINDING_GUTTER_LEFT_FALLOFF_PX = 40

/** Shadow + highlight reach on the right page (spine on the left edge of that page). */
export const BINDING_GUTTER_RIGHT_FALLOFF_PX = 30

/** Full asymmetric lighting overlay width, centered on the binding. */
export const BINDING_GUTTER_LIGHTING_WIDTH_PX =
  BINDING_GUTTER_LEFT_FALLOFF_PX + BINDING_GUTTER_RIGHT_FALLOFF_PX

/**
 * Legacy clear-column width for page-stack gutter masking (bulge valleys).
 * Wider than the lighting overlay so curves stay clean.
 */
export const BINDING_SEAM_SHADOW_WIDTH_PX = 140

/** @deprecated Use BINDING_GUTTER_RIGHT_FALLOFF_PX */
export const BINDING_SEAM_AMBIENT_RADIUS_PX = BINDING_GUTTER_RIGHT_FALLOFF_PX

export type BookBindingGutterLightingLayerStyle = CSSProperties & {
  mixBlendMode: 'multiply' | 'screen' | 'overlay'
}

/**
 * Left page — deep shadow drifting away from the spine (multiply).
 * Light from top-left leaves this page slightly in shade near the binding.
 */
export function bookBindingGutterLeftPageShadowBackground(): string {
  return 'linear-gradient(to left, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.08) 30%, transparent 100%)'
}

/**
 * Right page — sharp ambient-occlusion crack at the joint (multiply only).
 */
export function bookBindingGutterRightPageShadowBackground(): string {
  return 'linear-gradient(to right, rgba(0, 0, 0, 0.3) 0px, rgba(0, 0, 0, 0.3) 2px, transparent 2px)'
}

/**
 * Right page — paper crest catching top-left light (screen; no opaque fills).
 */
export function bookBindingGutterRightPageHighlightBackground(): string {
  return 'linear-gradient(to right, transparent 2px, rgba(255, 255, 255, 0.18) 4px, rgba(255, 255, 255, 0.05) 15px, transparent 30px)'
}

export function bookBindingGutterLeftPageShadowStyle(
  pageCanvasHeightPx: number,
): BookBindingGutterLightingLayerStyle {
  return {
    width: BINDING_GUTTER_LEFT_FALLOFF_PX,
    height: pageCanvasHeightPx,
    background: bookBindingGutterLeftPageShadowBackground(),
    mixBlendMode: 'multiply',
  }
}

export function bookBindingGutterRightPageShadowStyle(
  pageCanvasHeightPx: number,
): BookBindingGutterLightingLayerStyle {
  return {
    width: BINDING_GUTTER_RIGHT_FALLOFF_PX,
    height: pageCanvasHeightPx,
    background: bookBindingGutterRightPageShadowBackground(),
    mixBlendMode: 'multiply',
  }
}

export function bookBindingGutterRightPageHighlightStyle(
  pageCanvasHeightPx: number,
): BookBindingGutterLightingLayerStyle {
  return {
    width: BINDING_GUTTER_RIGHT_FALLOFF_PX,
    height: pageCanvasHeightPx,
    background: bookBindingGutterRightPageHighlightBackground(),
    mixBlendMode: 'screen',
  }
}

export function bookBindingSeamColumnLeftPx(spreadPageWidthPx: number): number {
  return spreadPageWidthPx - BINDING_SEAM_SHADOW_WIDTH_PX / 2
}

export function bookBindingGutterLightingOverlayStyle(pageCanvasHeightPx: number): CSSProperties {
  return {
    width: BINDING_SEAM_SHADOW_WIDTH_PX,
    height: pageCanvasHeightPx,
    transform: 'translateX(-50%)',
  }
}

/** @deprecated Prefer split gutter lighting layers */
export function bookBindingSeamShadowBackground(): string {
  return [
    bookBindingGutterLeftPageShadowBackground(),
    bookBindingGutterRightPageShadowBackground(),
  ].join(', ')
}

/** @deprecated Prefer split gutter lighting layers in BookSpreadFrame */
export function bookBindingSeamShadowLayerStyle(pageCanvasHeightPx: number): CSSProperties {
  return {
    ...bookBindingGutterLightingOverlayStyle(pageCanvasHeightPx),
    background: bookBindingSeamShadowBackground(),
    mixBlendMode: 'multiply',
  }
}
