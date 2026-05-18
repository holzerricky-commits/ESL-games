import { useMemo, type CSSProperties } from 'react'

interface UseSpreadGutterOverlayStyleArgs {
  pageAreaSize: { w: number; h: number }
  /** Per-page layout width (clamped to viewport), same as `BookCanvasStage` cluster half-width */
  layoutSpreadPageWidth: number
  /** Integer CSS height aligned with `BookCanvasStage` / react-pdf Page output */
  pageCanvasHeightPx: number
}

/** Matches spread cluster sizing (overlap ~1.8% of rail width). */
const SPREAD_CLUSTER_OVERLAP_RATIO = 0.018

export function useSpreadGutterOverlayStyle({
  pageAreaSize,
  layoutSpreadPageWidth,
  pageCanvasHeightPx,
}: UseSpreadGutterOverlayStyleArgs): CSSProperties {
  return useMemo(() => {
    const { w: aw, h: ah } = pageAreaSize
    if (aw <= 0) {
      return { left: 0, top: 0, width: '100%', height: '100%' }
    }
    const overlapPx = aw * SPREAD_CLUSTER_OVERLAP_RATIO
    const clusterW = Math.max(0, Math.min(layoutSpreadPageWidth * 2 - overlapPx, aw))
    const clusterH = Math.min(pageCanvasHeightPx, ah * 0.996)
    return {
      left: '50%',
      top: '50%',
      width: clusterW,
      height: clusterH,
      transform: 'translate(-50%, -50%)',
    }
  }, [pageAreaSize, layoutSpreadPageWidth, pageCanvasHeightPx])
}
