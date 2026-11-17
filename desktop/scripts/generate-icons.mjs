import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SIZE = 256;
const outDir = path.resolve(import.meta.dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });

// Draw clean 256x256 GAME BOOSTER PRO emblem (Navy #0B192C background, #1E3E62/#2E5077 shield, white & #38BDF8 chevron/arc)
const pixels = Buffer.alloc(SIZE * SIZE * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const idx = (y * SIZE + x) * 4;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
  pixels[idx + 3] = a;
}

function blendPixel(x, y, r, g, b, alpha) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const idx = (y * SIZE + x) * 4;
  const inv = 1 - alpha;
  pixels[idx] = Math.round(pixels[idx] * inv + r * alpha);
  pixels[idx + 1] = Math.round(pixels[idx + 1] * inv + g * alpha);
  pixels[idx + 2] = Math.round(pixels[idx + 2] * inv + b * alpha);
  pixels[idx + 3] = 255;
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // Rounded square mask (radius 36)
    const rx = Math.max(0, Math.abs(x - 127.5) - (127.5 - 36));
    const ry = Math.max(0, Math.abs(y - 127.5) - (127.5 - 36));
    const cornerDist = Math.hypot(rx, ry);
    if (cornerDist > 36) {
      setPixel(x, y, 0, 0, 0, 0);
      continue;
    }

    // Base dark navy #0B192C
    setPixel(x, y, 11, 25, 44, 255);

    const nx = (x - 128) / 100;
    const ny = (y - 128) / 100;

    // Geometric shield silhouette
    const inShieldTop = ny >= -0.78 && ny <= 0.12 && Math.abs(nx) <= 0.68 - Math.max(0, -ny - 0.52) * 0.25;
    const inShieldBottom = ny > 0.12 && ny <= 0.84 && Math.abs(nx) <= 0.68 * (1 - Math.pow((ny - 0.12) / 0.72, 1.35));
    if (inShieldTop || inShieldBottom) {
      // Split left/right subtle two-tone navy (#1E3E62 / #264B73)
      if (nx < 0) {
        setPixel(x, y, 30, 62, 98, 255);
      } else {
        setPixel(x, y, 38, 75, 115, 255);
      }

      // Shield border highlight
      const edgeLeft = Math.abs(nx) > 0.61 && ny <= 0.15;
      const edgeTop = ny < -0.71;
      if (edgeLeft || edgeTop) {
        blendPixel(x, y, 56, 189, 248, 0.35);
      }
    }

    // Upper speedometer arc
    const arcDx = x - 128;
    const arcDy = y - 106;
    const arcDist = Math.hypot(arcDx, arcDy);
    const arcAngle = Math.atan2(arcDy, arcDx);
    if (arcDist >= 34 && arcDist <= 42 && arcAngle >= -Math.PI * 0.92 && arcAngle <= -Math.PI * 0.08) {
      if (arcAngle > -Math.PI * 0.45) {
        setPixel(x, y, 56, 189, 248, 255); // #38BDF8 accent arc
      } else {
        setPixel(x, y, 255, 255, 255, 255); // Crisp white arc
      }
    }

    // Dual upward boost chevrons (white)
    const cx = Math.abs(x - 128);
    const cy1 = 112 + cx * 0.85;
    const cy2 = 136 + cx * 0.85;
    if (cx <= 50 && Math.abs(y - cy1) <= 6) {
      setPixel(x, y, 255, 255, 255, 255);
    } else if (cx <= 40 && Math.abs(y - cy2) <= 5) {
      setPixel(x, y, 186, 230, 253, 255);
    }
  }
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Encode PNG
const rawScanlines = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (1 + SIZE * 4);
  rawScanlines[rowStart] = 0; // filter type 0
  pixels.copy(rawScanlines, rowStart + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const pngBuffer = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  makeChunk('IHDR', ihdr),
  makeChunk('IDAT', zlib.deflateSync(rawScanlines, { level: 9 })),
  makeChunk('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync(path.join(outDir, 'icon.png'), pngBuffer);

// Encode Windows .ICO wrapping 256x256 PNG (Windows Vista/7/10/11 standard PNG-in-ICO)
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // Icon type
icoHeader.writeUInt16LE(1, 4); // Image count = 1

const icoEntry = Buffer.alloc(16);
icoEntry[0] = 0; // 0 represents 256px width
icoEntry[1] = 0; // 0 represents 256px height
icoEntry[2] = 0; // Color palette count
icoEntry[3] = 0; // Reserved
icoEntry.writeUInt16LE(1, 4); // Color planes
icoEntry.writeUInt16LE(32, 6); // Bits per pixel
icoEntry.writeUInt32LE(pngBuffer.length, 8);
icoEntry.writeUInt32LE(22, 12); // Offset = 6 + 16 = 22

fs.writeFileSync(path.join(outDir, 'icon.ico'), Buffer.concat([icoHeader, icoEntry, pngBuffer]));
console.log('Generated desktop/build/icon.png and desktop/build/icon.ico successfully.');
