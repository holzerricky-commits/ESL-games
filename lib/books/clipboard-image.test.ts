import { describe, expect, it } from 'vitest'

import {

  CLIPBOARD_GIF_MAX_BYTES,

  extractImageUrlFromClipboardHtml,

  extractImageUrlFromPlainText,

  fitImageNormBox,

  isBoardImageFile,

  isGifImageFile,

  looksLikeBoardPasteableImageUrl,

  readGifFileFromClipboardFiles,

  readImageFileFromDataTransfer,

  readImageFileFromClipboardData,

} from '@/lib/books/clipboard-image'



describe('clipboard-image', () => {

  it('fitImageNormBox centers in the visible viewport band when no anchor is set', () => {

    const box = fitImageNormBox(800, 600, 400, 2000, 300, 100)

    expect(box.w).toBeGreaterThan(0)

    expect(box.h).toBeGreaterThan(0)

    expect(box.x).toBeGreaterThanOrEqual(0)

    expect(box.y).toBeGreaterThanOrEqual(0)

    expect(box.x + box.w).toBeLessThanOrEqual(1.01)

    const centerY = (box.y + box.h / 2) * 2000

    expect(centerY).toBeGreaterThan(100)

    expect(centerY).toBeLessThan(100 + 300)

  })



  it('fitImageNormBox uses sizing reference width on narrower notebook boards', () => {

    const notebookBoardWidthPx = 400

    const wideBoardWidthPx = 800

    const box = fitImageNormBox(800, 600, notebookBoardWidthPx, 2000, 300, 0, {

      sizingWidthPx: wideBoardWidthPx,

      sizingViewportHeightPx: 600,

    })

    expect(box.w * notebookBoardWidthPx).toBeCloseTo(wideBoardWidthPx * 0.4, 0)

  })



  it('readImageFileFromClipboardData returns a file when an image item exists', () => {

    const file = new File([new Uint8Array([1, 2, 3])], 'test.png', { type: 'image/png' })

    const clipboard = {

      items: [

        {

          type: 'image/png',

          getAsFile: () => file,

        },

      ],

    } as unknown as DataTransfer

    expect(readImageFileFromClipboardData(clipboard)).toBe(file)

  })



  it('readImageFileFromClipboardData returns null when no image item exists', () => {

    const clipboard = {

      items: [

        {

          type: 'text/plain',

          getAsFile: () => null,

        },

      ],

    } as unknown as DataTransfer

    expect(readImageFileFromClipboardData(clipboard)).toBeNull()

  })



  it('readGifFileFromClipboardFiles returns gif from files list', () => {

    const gif = new File([], 'anim.gif', { type: 'image/gif' })

    const clipboard = {

      files: [gif],

      items: [],

    } as unknown as DataTransfer

    expect(readGifFileFromClipboardFiles(clipboard)).toBe(gif)

  })

  it('readImageFileFromDataTransfer returns PNG and JPEG files', () => {
    const png = new File([], 'board.png', { type: 'image/png' })
    const jpeg = new File([], 'photo.jpg', { type: 'image/jpeg' })
    const pngTransfer = { files: [png], items: [] } as unknown as DataTransfer
    const jpegTransfer = { files: [jpeg], items: [] } as unknown as DataTransfer

    expect(readImageFileFromDataTransfer(pngTransfer)).toBe(png)
    expect(readImageFileFromDataTransfer(jpegTransfer)).toBe(jpeg)
  })

  it('isBoardImageFile rejects non-image local files', () => {
    expect(isBoardImageFile(new File([], 'notes.txt', { type: 'text/plain' }))).toBe(false)
    expect(isBoardImageFile(new File([], 'picture.webp', { type: '' }))).toBe(true)
  })



  it('isGifImageFile detects gif mime type and file extension', () => {

    expect(isGifImageFile(new File([], 'photo.gif', { type: 'image/gif' }))).toBe(true)

    expect(isGifImageFile(new File([], 'photo.GIF', { type: '' }))).toBe(true)

    expect(isGifImageFile(new File([], 'photo.png', { type: 'image/png' }))).toBe(false)

  })



  it('extractImageUrlFromClipboardHtml pulls img src', () => {

    const html =

      '<meta charset="utf-8"><img src="https://media.giphy.com/media/abc123/giphy.gif" />'

    expect(extractImageUrlFromClipboardHtml(html)).toBe(

      'https://media.giphy.com/media/abc123/giphy.gif',

    )

  })



  it('extractImageUrlFromPlainText accepts giphy gif URLs', () => {

    expect(

      extractImageUrlFromPlainText('https://media.giphy.com/media/abc123/giphy.gif'),

    ).toBe('https://media.giphy.com/media/abc123/giphy.gif')

  })



  it('extractImageUrlFromPlainText rejects non-image URLs', () => {

    expect(extractImageUrlFromPlainText('https://example.com/page')).toBeNull()

  })



  it('looksLikeBoardPasteableImageUrl accepts tenor hosts', () => {

    expect(looksLikeBoardPasteableImageUrl('https://media.tenor.com/foo.gif')).toBe(true)

  })



  it('CLIPBOARD_GIF_MAX_BYTES allows larger animated pastes than static images', () => {

    expect(CLIPBOARD_GIF_MAX_BYTES).toBeGreaterThan(1_500_000)

  })

})


