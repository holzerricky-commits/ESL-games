import type { CSSProperties } from 'react'

/** Tiled fractal noise — reads as fine leather grain at small cover insets. */
const LEATHER_GRAIN_SVG = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <filter id="grain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.62 0.34" numOctaves="4" seed="11" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0"/>
    </filter>
    <rect width="100%" height="100%" fill="#7a7a7a" filter="url(#grain)"/>
  </svg>`,
)}")`

/** Base hardcover fill + worn-leather lighting and grain. */
export function hardcoverLeatherCoverStyle(baseColor: string): CSSProperties {
  return {
    backgroundColor: baseColor,
    backgroundImage: [
      'radial-gradient(ellipse 110% 75% at 18% 6%, rgba(255,255,255,0.12) 0%, transparent 55%)',
      'radial-gradient(ellipse 90% 65% at 82% 96%, rgba(0,0,0,0.24) 0%, transparent 52%)',
      'linear-gradient(165deg, rgba(255,255,255,0.06) 0%, transparent 38%, rgba(0,0,0,0.14) 100%)',
      LEATHER_GRAIN_SVG,
    ].join(', '),
    backgroundSize: 'cover, cover, cover, 160px 160px',
    backgroundRepeat: 'no-repeat, no-repeat, no-repeat, repeat',
  }
}

/** Cross-hatch crease lines blended over the grain. */
export function hardcoverLeatherOverlayStyle(): CSSProperties {
  return {
    backgroundImage: [
      'repeating-linear-gradient(104deg, rgba(0,0,0,0.055) 0 1px, transparent 1px 4px)',
      'repeating-linear-gradient(14deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 5px)',
    ].join(', '),
    opacity: 0.5,
    mixBlendMode: 'overlay',
  }
}
