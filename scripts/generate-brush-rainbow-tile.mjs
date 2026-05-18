/**
 * Writes a seamless horizontal rainbow BMP (512×512) for brush-pattern import.
 * Run: node scripts/generate-brush-rainbow-tile.mjs
 * Then: npx sharp-cli resize 192 192 -i public/brush-patterns/_rainbow-src.bmp -o public/brush-patterns/rainbow.png
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '../public/brush-patterns/_rainbow-src.bmp')

const WIDTH = 512
const HEIGHT = 512

function hslToRgb(h, s, l) {
  h /= 360
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h * 12) % 12
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ]
}

function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
  return n - Math.floor(n)
}

function pixelRgb(x, y) {
  const hue = (x / WIDTH) * 360
  let [r, g, b] = hslToRgb(hue, 0.94, 0.54)
  if (hash(x, y) > 0.992) {
    const spark = 0.65 + hash(x + 17, y + 31) * 0.35
    r = Math.min(255, Math.round(r + (255 - r) * spark))
    g = Math.min(255, Math.round(g + (255 - g) * spark))
    b = Math.min(255, Math.round(b + (255 - b) * spark))
  }
  return [r, g, b]
}

function writeBmp24(filePath, width, height, rgbAt) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4
  const pixelDataSize = rowSize * height
  const fileSize = 54 + pixelDataSize
  const buf = Buffer.alloc(fileSize)
  buf.write('BM', 0)
  buf.writeUInt32LE(fileSize, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(width, 18)
  buf.writeInt32LE(height, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(pixelDataSize, 34)

  let offset = 54
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = rgbAt(x, y)
      buf[offset++] = b
      buf[offset++] = g
      buf[offset++] = r
    }
    offset += rowSize - width * 3
  }
  fs.writeFileSync(filePath, buf)
}

writeBmp24(outPath, WIDTH, HEIGHT, pixelRgb)
console.log('Wrote', outPath)
