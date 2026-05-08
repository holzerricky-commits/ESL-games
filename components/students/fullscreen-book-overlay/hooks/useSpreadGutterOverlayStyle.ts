import { useMemo, type CSSProperties } from 'react'

interface UseSpreadGutterOverlayStyleArgs {
  pageAreaSize: { w: number; h: number }
  spreadPageWidth: number
  pageAspectRatio: number
}

/** Matches legacy spread cluster sizing (overlap ~2.6% of rail width). */
const SPREAD_CLUSTER_OVERLAP_RATIO = 0.026

export function useSpreadGutterOverlayStyle({
  pageAreaSize,
  spreadPageWidth,
  pageAspectRatio,
}: UseSpreadGutterOverlayStyleArgs): CSSProperties {
  return useMemo(() => {
    const { w: aw, h: ah } = pageAreaSize
    if (aw <= 0) {
      return { left: 0, top: 0, width: '100%', height: '100%' }
    }
    const overlapPx = aw * SPREAD_CLUSTER_OVERLAP_RATIO
    const clusterW = Math.max(0, Math.min(spreadPageWidth * 2 - overlapPx, aw))
    const pageH = spreadPageWidth / pageAspectRatio
    const clusterH = Math.min(pageH, ah * 0.985)
    return {
      left: '50%',
      top: '50%',
      width: clusterW,
      height: clusterH,
      transform: 'translate(-50%, -50%)',
    }
  }, [pageAreaSize, spreadPageWidth, pageAspectRatio])
}
