/**
 * Generate simple YIELIX app icons as PNG files.
 * Creates icon.png (512x512), tray-icon.png (22x22 template).
 *
 * Uses raw PNG buffer creation (no external deps).
 * For production, replace these with proper designed icons.
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = (() => {
  // Simple PNG creator without dependencies
  // Creates a minimal valid PNG with the YIELIX brand color
  return {
    createCanvas: null // We'll use a different approach
  };
})();

// Minimal PNG file creator
function createPNG(width, height, pixelCallback) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT chunk - raw pixel data with zlib
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelCallback(x, y, width, height);
      const offset = y * (width * 4 + 1) + 1 + x * 4;
      rawData[offset] = r;
      rawData[offset + 1] = g;
      rawData[offset + 2] = b;
      rawData[offset + 3] = a;
    }
  }

  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

// CRC32 calculation
function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Brand color: #FF8B3D
const BRAND_R = 0xFF;
const BRAND_G = 0x8B;
const BRAND_B = 0x3D;

// Draw a rounded rectangle icon with "Y" letter
function drawIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = w * 0.42;
  const cornerRadius = w * 0.15;

  // Distance from center
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);

  // Rounded rectangle bounds
  const halfW = w * 0.45;
  const halfH = h * 0.45;

  // Check if inside rounded rectangle
  let inside = false;
  if (dx <= halfW - cornerRadius && dy <= halfH) {
    inside = true;
  } else if (dx <= halfW && dy <= halfH - cornerRadius) {
    inside = true;
  } else {
    // Check corners
    const cdx = Math.max(0, dx - (halfW - cornerRadius));
    const cdy = Math.max(0, dy - (halfH - cornerRadius));
    if (cdx * cdx + cdy * cdy <= cornerRadius * cornerRadius) {
      inside = true;
    }
  }

  if (!inside) return [0, 0, 0, 0];

  // Draw "Y" letter inside
  const relX = (x - cx) / (halfW * 0.7);
  const relY = (y - cy) / (halfH * 0.7);

  // Y shape: two diagonal lines meeting at center, one vertical line down
  const strokeWidth = 0.22;
  let isLetter = false;

  // Upper left diagonal (top-left to center)
  if (relY < 0.05) {
    const targetX = relY * 0.7; // negative x for negative y
    if (Math.abs(relX + 0.6 - (relY + 0.9) * 0.65) < strokeWidth) {
      isLetter = true;
    }
    // Upper right diagonal
    if (Math.abs(relX - 0.6 + (relY + 0.9) * 0.65) < strokeWidth) {
      isLetter = true;
    }
  }

  // Vertical stem (center to bottom)
  if (relY >= -0.05 && relY <= 0.9) {
    if (Math.abs(relX) < strokeWidth * 0.9) {
      isLetter = true;
    }
  }

  // Upper left arm
  if (relY >= -0.9 && relY <= 0.05) {
    const progress = (relY + 0.9) / 0.95;
    const expectedX = -0.6 + progress * 0.6;
    if (Math.abs(relX - expectedX) < strokeWidth) {
      isLetter = true;
    }
  }

  // Upper right arm
  if (relY >= -0.9 && relY <= 0.05) {
    const progress = (relY + 0.9) / 0.95;
    const expectedX = 0.6 - progress * 0.6;
    if (Math.abs(relX - expectedX) < strokeWidth) {
      isLetter = true;
    }
  }

  if (isLetter) {
    return [255, 255, 255, 255]; // White letter
  }

  return [BRAND_R, BRAND_G, BRAND_B, 255]; // Brand orange background
}

// Generate icons
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Main icon: 512x512
console.log('Generating 512x512 app icon...');
const icon512 = createPNG(512, 512, drawIcon);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), icon512);

// Tray icon: 32x32 (will be resized by Electron)
console.log('Generating 32x32 tray icon...');
const trayIcon = createPNG(32, 32, drawIcon);
fs.writeFileSync(path.join(assetsDir, 'tray-icon.png'), trayIcon);

// Also create smaller sizes for different platforms
console.log('Generating 64x64 icon...');
const icon64 = createPNG(64, 64, drawIcon);
fs.writeFileSync(path.join(assetsDir, 'icon-64.png'), icon64);

console.log('Generating 256x256 icon...');
const icon256 = createPNG(256, 256, drawIcon);
fs.writeFileSync(path.join(assetsDir, 'icon-256.png'), icon256);

console.log('Icons generated successfully in assets/');
