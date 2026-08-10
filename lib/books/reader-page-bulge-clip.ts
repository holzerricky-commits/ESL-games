/** Maximum tuck at the binding gutter (spine-side of each page). */
export const READER_PAGE_BULGE_SPINE_DIP_PX = 14

/** Milder tuck at the outer fore-edge of each page. */
export const READER_PAGE_BULGE_FORE_EDGE_DIP_PX = 4

/** Where the page arch is highest (least cut) — % of half-page width from the spine. */
export const READER_PAGE_BULGE_PEAK_PERCENT = 25

/** How sharply the arch drops off near the gutter (higher = more dip at spine only). */
export const READER_PAGE_BULGE_SPINE_CURVE_POWER = 3

/** @deprecated Alias of `READER_PAGE_BULGE_SPINE_DIP_PX` (symmetric arches used one dip). */
export const READER_PAGE_BULGE_PEAK_DIP_PX = READER_PAGE_BULGE_SPINE_DIP_PX

const BULGE_SAMPLE_PERCENTS = [0, 5, 10, 15, 20, 25, 35, 45, 55, 65, 75, 85, 95, 100] as const

/**
 * Arch profile: full tuck at the gutter, milder tuck at the fore-edge, flat peak at 25%.
 * `percentFromSpine` runs 0 at the binding → 100 at the outer edge.
 */
function computePageBulgeInset(percentFromSpine: number): number {
  const spineDip = READER_PAGE_BULGE_SPINE_DIP_PX
  const foreEdgeDip = READER_PAGE_BULGE_FORE_EDGE_DIP_PX
  const peakAt = READER_PAGE_BULGE_PEAK_PERCENT

  if (percentFromSpine <= peakAt) {
    const t = percentFromSpine / peakAt
    const falloff = 1 - t
    return spineDip * falloff ** READER_PAGE_BULGE_SPINE_CURVE_POWER
  }

  const t = (percentFromSpine - peakAt) / (100 - peakAt)
  return foreEdgeDip * t * t
}

/**
 * Full-width arch from spine toward fore-edge.
 * Each entry: [% along half-page from spine, px inset from flat top/bottom].
 */
export const READER_PAGE_BULGE_CURVE: ReadonlyArray<readonly [percentFromSpine: number, insetPx: number]> =
  BULGE_SAMPLE_PERCENTS.map(
    (p) => [p, Math.round(computePageBulgeInset(p))] as const,
  )

/** Paper fill behind page art — visible in clipped margin curves against the frame. */
export const READER_PAGE_PAPER_COLOR = '#FDFCFB'

function pageBulgeYOffset(
  insetPx: number,
  edge: 'top' | 'bottom',
  heightPx?: number,
): string {
  if (heightPx != null) {
    if (edge === 'top') return `${insetPx}px`
    return `${heightPx - insetPx}px`
  }
  if (edge === 'top') return `${insetPx}px`
  if (insetPx === 0) return '100%'
  return `calc(100% - ${insetPx}px)`
}

function joinPolygon(points: string[]): string {
  return `polygon(${points.join(', ')})`
}

/**
 * Page arch — full tuck at the gutter, milder tuck at the fore-edge, peak at 25%.
 */
export function readerPageBulgeClipPath(
  side: 'left' | 'right',
  heightPx?: number,
): string {
  const curve = READER_PAGE_BULGE_CURVE
  const y = (inset: number, edge: 'top' | 'bottom') =>
    pageBulgeYOffset(inset, edge, heightPx)

  if (side === 'right') {
    const top = curve.map(([p, inset]) => `${p}% ${y(inset, 'top')}`)
    const bottom = curve
      .slice()
      .reverse()
      .map(([p, inset]) => `${p}% ${y(inset, 'bottom')}`)
    return joinPolygon([...top, ...bottom])
  }

  const top = curve
    .slice()
    .reverse()
    .map(([p, inset]) => `${100 - p}% ${y(inset, 'top')}`)

  const bottom = curve.map(([p, inset]) => `${100 - p}% ${y(inset, 'bottom')}`)

  return joinPolygon([...top, ...bottom])
}

function pageBulgeHalfTopY(insetPx: number, heightPx: number): number {
  return insetPx
}

function pageBulgeHalfBottomY(insetPx: number, heightPx: number): number {
  if (insetPx === 0) return heightPx
  return heightPx - insetPx
}

/**
 * Page arch extended outward on the fore-edge for the page-stack fan zone.
 * Wrapper is `pageWidthPx + bleedPx` wide; bleed sits outside the page face.
 */
export function readerPageBulgeClipPathWithForeEdgeBleed(
  side: 'left' | 'right',
  pageWidthPx: number,
  heightPx: number,
  bleedPx: number,
): string {
  const curve = READER_PAGE_BULGE_CURVE
  const foreTopY = pageBulgeHalfTopY(READER_PAGE_BULGE_FORE_EDGE_DIP_PX, heightPx)
  const foreBottomY = pageBulgeHalfBottomY(READER_PAGE_BULGE_FORE_EDGE_DIP_PX, heightPx)

  if (side === 'left') {
    const topPage: string[] = []
    const bottomPage: string[] = []

    for (let i = curve.length - 1; i >= 0; i--) {
      const [p, inset] = curve[i]!
      const xPage = pageWidthPx * (1 - p / 100)
      const x = bleedPx + xPage
      topPage.push(`${x}px ${pageBulgeHalfTopY(inset, heightPx)}px`)
    }

    for (let i = 0; i < curve.length; i++) {
      const [p, inset] = curve[i]!
      const xPage = pageWidthPx * (1 - p / 100)
      const x = bleedPx + xPage
      bottomPage.push(`${x}px ${pageBulgeHalfBottomY(inset, heightPx)}px`)
    }

    return joinPolygon([
      `0px ${foreTopY}px`,
      `${bleedPx}px ${foreTopY}px`,
      ...topPage,
      ...bottomPage,
      `${bleedPx}px ${foreBottomY}px`,
      `0px ${foreBottomY}px`,
    ])
  }

  const topPage: string[] = []
  const bottomPage: string[] = []

  for (let i = 0; i < curve.length; i++) {
    const [p, inset] = curve[i]!
    const x = pageWidthPx * (p / 100)
    topPage.push(`${x}px ${pageBulgeHalfTopY(inset, heightPx)}px`)
  }

  for (let i = curve.length - 1; i >= 0; i--) {
    const [p, inset] = curve[i]!
    const x = pageWidthPx * (p / 100)
    bottomPage.push(`${x}px ${pageBulgeHalfBottomY(inset, heightPx)}px`)
  }

  const outerX = pageWidthPx + bleedPx

  return joinPolygon([
    ...topPage,
    `${outerX}px ${foreTopY}px`,
    `${outerX}px ${foreBottomY}px`,
    ...bottomPage,
  ])
}

export type ReaderSpreadBulgeClipOptions = {
  spineCenterPx?: number
  offsetXPx?: number
  offsetYPx?: number
}

export type BulgeEdgePoint = { x: number; y: number }

export type BulgeHorizontalEdgeOptions = {
  widthPx: number
  spineCenterPx: number
  edge: 'top' | 'bottom'
  heightPx: number
  dipScale?: number
}

/** Pixel points along the top or bottom bulge edge, left → right. */
export function bulgeHorizontalEdgePoints({
  widthPx,
  spineCenterPx,
  edge,
  heightPx,
  dipScale = 1,
}: BulgeHorizontalEdgeOptions): BulgeEdgePoint[] {
  const curve = READER_PAGE_BULGE_CURVE.map(
    ([p, inset]) => [p, inset * dipScale] as const,
  )
  const leftHalfW = spineCenterPx
  const rightHalfW = Math.max(0, widthPx - spineCenterPx)

  const y = (inset: number) => {
    if (edge === 'top') return inset
    if (inset === 0) return heightPx
    return heightPx - inset
  }

  const points: BulgeEdgePoint[] = []

  for (let i = curve.length - 1; i >= 0; i--) {
    const [p, inset] = curve[i]!
    const x = spineCenterPx - (p / 100) * leftHalfW
    points.push({ x, y: y(inset) })
  }

  for (let i = 1; i < curve.length; i++) {
    const [p, inset] = curve[i]!
    const x = spineCenterPx + (p / 100) * rightHalfW
    points.push({ x, y: y(inset) })
  }

  return points
}

export function readerSpreadBulgeClipPath(
  widthPx: number,
  heightPx: number,
  options: ReaderSpreadBulgeClipOptions = {},
): string {
  const offsetX = options.offsetXPx ?? 0
  const offsetY = options.offsetYPx ?? 0
  const spineX = options.spineCenterPx ?? widthPx / 2

  const x = (px: number) => `${px + offsetX}px`
  const yCss = (py: number) => (offsetY === 0 ? `${py}px` : `${py + offsetY}px`)

  const topPoints = bulgeHorizontalEdgePoints({
    widthPx,
    spineCenterPx: spineX,
    edge: 'top',
    heightPx,
  })
  const bottomPoints = bulgeHorizontalEdgePoints({
    widthPx,
    spineCenterPx: spineX,
    edge: 'bottom',
    heightPx,
  })

  const points: string[] = topPoints.map((pt) => `${x(pt.x)} ${yCss(pt.y)}`)

  for (let i = bottomPoints.length - 1; i >= 0; i--) {
    const pt = bottomPoints[i]!
    points.push(`${x(pt.x)} ${yCss(pt.y)}`)
  }

  return joinPolygon(points)
}
