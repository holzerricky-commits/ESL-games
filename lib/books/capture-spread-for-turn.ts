import { toCanvas } from 'html-to-image'

/** Fast spread snapshot for turn animation (includes annotations in the DOM). */
export async function captureSpreadForTurn(el: HTMLElement): Promise<HTMLCanvasElement> {
  return toCanvas(el, {
    cacheBust: true,
    pixelRatio: 1,
  })
}
