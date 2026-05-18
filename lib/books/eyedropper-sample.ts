import { normalizeCustomHex } from '@/lib/books/annotation-custom-color'
import { captureElementToCanvas, domRectToCanvasCrop } from '@/lib/books/book-capture'

const SAMPLE_RADIUS = 2

function averageRgb(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
): string {
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || y < 0 || x >= width || y >= height) continue
      const i = (y * width + x) * 4
      const a = data[i + 3]!
      if (a < 8) continue
      r += data[i]!
      g += data[i + 1]!
      b += data[i + 2]!
      n++
    }
  }
  if (n === 0) return '#000000'
  return normalizeCustomHex(
    `#${[r / n, g / n, b / n]
      .map((v) => Math.round(v).toString(16).padStart(2, '0'))
      .join('')}`,
  )
}

/**
 * Sample visible color at a client point from a page capture root (PDF + ink + DOM notes).
 */
export async function sampleColorFromCaptureElement(
  captureEl: HTMLElement,
  clientX: number,
  clientY: number,
): Promise<string | null> {
  const rect = captureEl.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const localX = clientX - rect.left
  const localY = clientY - rect.top
  if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return null

  const canvas = await captureElementToCanvas(captureEl)
  const crop = domRectToCanvasCrop(
    canvas,
    { x: localX, y: localY, width: 1, height: 1 },
    rect.width,
    rect.height,
  )
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const sw = Math.max(1, crop.sw)
  const sh = Math.max(1, crop.sh)
  const data = ctx.getImageData(crop.sx, crop.sy, sw, sh).data
  const cx = Math.floor(sw / 2)
  const cy = Math.floor(sh / 2)
  return averageRgb(data, sw, sh, cx, cy, SAMPLE_RADIUS)
}
