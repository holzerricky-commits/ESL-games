import type { ImageAnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  downscaleImageFile,
  fitImageNormBox,
  type PasteImageOutcome,
  type PastedBoardImageResolution,
} from '@/lib/books/clipboard-image'

export type BoardImageLayout = {
  widthPx: number
  heightPx: number
  viewportHeightPx: number
  scrollTopPx: number
  anchorNorm: { x: number; y: number } | null
  sizingWidthPx?: number
  sizingViewportHeightPx?: number
}

export type EncodedBoardImage = {
  dataUrl: string
  naturalWidth: number
  naturalHeight: number
}

export type BuiltBoardImage = {
  cmd: ImageAnnotationCommand
  outcome: PasteImageOutcome
}

function newBoardImageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
}

export function buildImageCommandFromEncoded(
  encoded: EncodedBoardImage,
  layout: BoardImageLayout,
  alt = 'Dropped image',
): ImageAnnotationCommand {
  const box = fitImageNormBox(
    encoded.naturalWidth,
    encoded.naturalHeight,
    layout.widthPx,
    layout.heightPx,
    layout.viewportHeightPx,
    layout.scrollTopPx,
    {
      anchorNorm: layout.anchorNorm,
      sizingWidthPx: layout.sizingWidthPx,
      sizingViewportHeightPx: layout.sizingViewportHeightPx,
    },
  )
  return {
    kind: 'image',
    id: newBoardImageId(),
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    src: encoded.dataUrl,
    alt,
  }
}

export async function buildImageCommandFromFile(
  resolution: PastedBoardImageResolution,
  layout: BoardImageLayout,
  alt = 'Dropped image',
): Promise<BuiltBoardImage | null> {
  const encoded = await downscaleImageFile(resolution.file)
  if (!encoded) return null
  return {
    cmd: buildImageCommandFromEncoded(encoded, layout, alt),
    outcome: {
      ok: true,
      animated: resolution.animated,
      usedFrozenRasterFallback: resolution.usedFrozenRasterFallback,
    },
  }
}
