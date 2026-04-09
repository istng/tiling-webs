'use strict';
// Generates build/icon.png, build/icon.ico, build/icon.icns
// Run once before packaging: yarn build:icons

const Jimp       = require('jimp');
const png2icons  = require('png2icons');
const fs         = require('fs');
const path       = require('path');

const BUILD = path.join(__dirname, '..', 'build');

// Pack R,G,B,A into a 32-bit unsigned int (RGBA byte order for jimp)
function rgba(r, g, b, a = 255) {
  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}

// Draw a filled rounded rectangle onto a Jimp image
function roundRect(img, x, y, w, h, r, color) {
  img.scan(x, y, w, h, function (px, py, idx) {
    const nearLeft  = px < x + r;
    const nearRight = px >= x + w - r;
    const nearTop   = py < y + r;
    const nearBot   = py >= y + h - r;
    if ((nearLeft || nearRight) && (nearTop || nearBot)) {
      const cx = nearLeft  ? x + r     : x + w - r;
      const cy = nearTop   ? y + r     : y + h - r;
      if ((px - cx) ** 2 + (py - cy) ** 2 > r * r) return;
    }
    this.bitmap.data.writeUInt32BE(color, idx);
  });
}

async function main() {
  const SZ  = 1024;
  const PAD = 80;
  const GAP = 48;
  const TW  = (SZ - PAD * 2 - GAP) / 2;   // ≈408
  const RAD = 56;

  const BG = rgba(0x0d, 0x11, 0x17);

  // Four tiles — slight variations of the brand purple to give depth
  const tiles = [
    { x: PAD,        y: PAD,        c: rgba(0x6e, 0x40, 0xc9) }, // top-left   (brand)
    { x: PAD+TW+GAP, y: PAD,        c: rgba(0x5a, 0x32, 0xa3) }, // top-right  (darker)
    { x: PAD,        y: PAD+TW+GAP, c: rgba(0x4f, 0x2d, 0x96) }, // bot-left   (darkest)
    { x: PAD+TW+GAP, y: PAD+TW+GAP, c: rgba(0x7c, 0x54, 0xd4) }, // bot-right  (lighter)
  ];

  const img = new Jimp(SZ, SZ, BG);
  for (const t of tiles) roundRect(img, t.x, t.y, TW, TW, RAD, t.c);

  fs.mkdirSync(BUILD, { recursive: true });

  const pngPath = path.join(BUILD, 'icon.png');
  await img.writeAsync(pngPath);
  console.log('  ✓ build/icon.png');

  const pngBuf = fs.readFileSync(pngPath);

  // Windows ICO (includes multiple sizes: 16,24,32,48,64,128,256)
  const ico = png2icons.createICO(pngBuf, png2icons.BILINEAR, 0, true, true);
  if (ico) {
    fs.writeFileSync(path.join(BUILD, 'icon.ico'), ico);
    console.log('  ✓ build/icon.ico');
  }

  // macOS ICNS
  const icns = png2icons.createICNS(pngBuf, png2icons.BILINEAR, 0);
  if (icns) {
    fs.writeFileSync(path.join(BUILD, 'icon.icns'), icns);
    console.log('  ✓ build/icon.icns');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
