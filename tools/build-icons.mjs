/* ============================================================
   tools/build-icons.mjs — generate PNG app icons without dependencies
   Writes icons/icon-192.png, icon-512.png and icon-maskable-512.png.
   Run: node tools/build-icons.mjs
   ============================================================ */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

/* ---------- Minimal PNG encoder ---------- */

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

/**
 * Encode RGBA pixels as a PNG buffer.
 * @param {number} size square edge in pixels
 * @param {(x:number,y:number)=>[number,number,number,number]} shader
 */
function encodePng(size, shader) {
  const bytesPerRow = size * 4;
  const raw = Buffer.alloc((bytesPerRow + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (bytesPerRow + 1);
    raw[rowStart] = 0; // filter type 0 (None)
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = shader(x, y);
      const i = rowStart + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- Drawing helpers ---------- */

const mix = (a, b, t) => Math.round(a + (b - a) * Math.min(1, Math.max(0, t)));

/** Signed distance from a point to a rounded rectangle (negative = inside). */
function sdRoundRect(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

/** Antialiased coverage for a shape, sampled on a 3x3 grid. */
function coverage(px, py, distFn, samples = 3) {
  let hits = 0;
  const total = samples * samples;
  for (let sy = 0; sy < samples; sy += 1) {
    for (let sx = 0; sx < samples; sx += 1) {
      const x = px + (sx + 0.5) / samples - 0.5;
      const y = py + (sy + 0.5) / samples - 0.5;
      if (distFn(x, y) <= 0) hits += 1;
    }
  }
  return hits / total;
}

/**
 * The icon artwork: a purple gradient rounded square with a calendar glyph
 * and a check mark. `inset` shrinks the art so maskable icons keep a safe zone.
 */
function makeShader(size, { radiusRatio = 0.22, insetRatio = 0, glyphScale = 1, fullBleed = false } = {}) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const inset = s * insetRatio;
  // The background always bleeds to the edges; the inset shrinks only the art,
  // which is what the maskable safe zone requires.
  const bgHalf = s / 2;
  const boxHalf = fullBleed ? bgHalf - inset : bgHalf;
  const corner = fullBleed ? 0 : bgHalf * radiusRatio * 2;

  // Glyph geometry (a calendar: frame, header line, two hangers, check mark)
  const gw = (fullBleed ? bgHalf - inset : boxHalf) * 0.46 * glyphScale;
  const gh = gw * 1.1;
  const gx = cx;
  const gy = cy + boxHalf * 0.02;
  const stroke = Math.max(1.6, gw * 0.13);
  const checkW = gw * 0.72;

  const bgDist = (x, y) => sdRoundRect(x, y, cx, cy, bgHalf, bgHalf, corner);

  // Distance to a segment, used for strokes.
  const segDist = (x, y, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / len2;
    t = Math.min(1, Math.max(0, t));
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
  };

  const glyphDist = (x, y) => {
    // Outline, not a filled shape: the distance to the border ring.
    const frame = Math.abs(sdRoundRect(x, y, gx, gy, gw, gh, stroke * 1.4)) - stroke * 0.5;
    const header = segDist(x, y, gx - gw, gy - gh * 0.42, gx + gw, gy - gh * 0.42) - stroke * 0.5;
    const hangerL = segDist(x, y, gx - gw * 0.45, gy - gh * 1.12, gx - gw * 0.45, gy - gh * 0.78) - stroke * 0.5;
    const hangerR = segDist(x, y, gx + gw * 0.45, gy - gh * 1.12, gx + gw * 0.45, gy - gh * 0.78) - stroke * 0.5;
    const check = segDist(
      x, y,
      gx - checkW * 0.42, gy + gh * 0.22,
      gx - checkW * 0.08, gy + gh * 0.55,
    ) - stroke * 0.62;
    const check2 = segDist(
      x, y,
      gx - checkW * 0.08, gy + gh * 0.55,
      gx + checkW * 0.44, gy - gh * 0.24,
    ) - stroke * 0.62;
    return Math.min(frame, header, hangerL, hangerR, check, check2);
  };

  return (px, py) => {
    const bg = coverage(px, py, bgDist);

    // Diagonal gradient from #7b7bf5 to #4a4ac4
    const t = (px / s + py / s) / 2;
    let r = mix(0x7b, 0x4a, t);
    let g = mix(0x7b, 0x4a, t);
    let b = mix(0xf5, 0xc4, t);

    const ink = coverage(px, py, glyphDist);
    if (ink > 0) {
      r = mix(r, 0xff, ink);
      g = mix(g, 0xff, ink);
      b = mix(b, 0xff, ink);
    }

    return [r, g, b, Math.round(bg * 255)];
  };
}

/* ---------- Write the set ---------- */

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, opts: {} },
  { file: 'icon-512.png', size: 512, opts: {} },
  // Maskable icons get cropped to arbitrary shapes (circle, squircle, …), so
  // the background must bleed to every edge and the art stays inside the
  // inner ~62% safe zone that Android guarantees is never clipped.
  { file: 'icon-maskable-512.png', size: 512, opts: { fullBleed: true, insetRatio: 0.19, glyphScale: 1 } },
];

for (const { file, size, opts } of targets) {
  const png = encodePng(size, makeShader(size, opts));
  writeFileSync(join(OUT_DIR, file), png);
  console.log(`${file}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}

console.log('done');