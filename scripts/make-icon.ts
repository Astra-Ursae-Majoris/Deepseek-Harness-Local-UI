// Generates assets/icon.png (256x256) with zero dependencies.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 256
const px = new Uint8Array(SIZE * SIZE * 4)

function setPx(x: number, y: number, r: number, g: number, b: number, a = 255): void {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
  const i = (y * SIZE + x) * 4
  px[i] = r
  px[i + 1] = g
  px[i + 2] = b
  px[i + 3] = a
}

// Rounded-square background (radius 56), deepseek blue (#416ecf).
const RADIUS = 56
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const cx = Math.min(Math.max(x, RADIUS), SIZE - 1 - RADIUS)
    const cy = Math.min(Math.max(y, RADIUS), SIZE - 1 - RADIUS)
    const dx = x - cx
    const dy = y - cy
    const inside = dx * dx + dy * dy <= RADIUS * RADIUS
    if (inside) setPx(x, y, 0x41, 0x6e, 0xcf)
  }
}

// White chat-bubble mark: rounded rect + tail, drawn as a filled ellipse pair.
function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x - cx) / rx
  const dy = (y - cy) / ry
  return dx * dx + dy * dy <= 1
}
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const bubble = inEllipse(x, y, 128, 122, 74, 52)
    const tail = inEllipse(x, y, 128 + 40, 122 + 34, 34, 24)
    if (bubble && !inEllipse(x, y, 128, 118, 64, 44)) setPx(x, y, 255, 255, 255)
    if (tail && !inEllipse(x, y, 128 + 40, 128, 28, 18)) setPx(x, y, 255, 255, 255)
  }
}

// PNG encode.
function crc32(buf: Uint8Array): number {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ ((c & 1) !== 0 ? 0xedb88320 : 0)
  }
  return ~c >>> 0
}
function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4))
for (let y = 0; y < SIZE; y++) {
  raw[y * (1 + SIZE * 4)] = 0
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4
    const o = y * (1 + SIZE * 4) + 1 + x * 4
    raw[o] = px[i] ?? 0
    raw[o + 1] = px[i + 1] ?? 0
    raw[o + 2] = px[i + 2] ?? 0
    raw[o + 3] = px[i + 3] ?? 0
  }
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])
const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'assets', 'icon.png')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, png)
console.log('icon written:', out, png.length, 'bytes')
