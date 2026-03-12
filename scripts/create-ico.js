/**
 * Creates a Windows .ico file from a source PNG.
 * ICO format: header + directory entries + PNG image data.
 * Includes 256x256, 128x128, 64x64, 48x48, 32x32, and 16x16 sizes.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const assetsDir = path.join(__dirname, '..', 'assets');
const sourcePng = path.join(assetsDir, 'icon.png');
const outputIco = path.join(assetsDir, 'icon.ico');

// Generate different sized PNGs using sips (macOS)
const sizes = [256, 128, 64, 48, 32, 16];
const pngBuffers = [];

for (const size of sizes) {
  const tmpFile = `/tmp/yielix-ico-${size}.png`;
  execSync(`sips -z ${size} ${size} "${sourcePng}" --out "${tmpFile}" 2>/dev/null`);
  pngBuffers.push(fs.readFileSync(tmpFile));
  fs.unlinkSync(tmpFile);
}

// Build ICO file
// ICO Header: 6 bytes
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);      // Reserved
header.writeUInt16LE(1, 2);      // Type: 1 = ICO
header.writeUInt16LE(sizes.length, 4); // Number of images

// Directory entries: 16 bytes each
const dirEntries = [];
let dataOffset = 6 + (16 * sizes.length); // After header + all directory entries

for (let i = 0; i < sizes.length; i++) {
  const entry = Buffer.alloc(16);
  const size = sizes[i];
  const pngData = pngBuffers[i];

  entry.writeUInt8(size >= 256 ? 0 : size, 0);  // Width (0 = 256)
  entry.writeUInt8(size >= 256 ? 0 : size, 1);  // Height (0 = 256)
  entry.writeUInt8(0, 2);                         // Color palette
  entry.writeUInt8(0, 3);                         // Reserved
  entry.writeUInt16LE(1, 4);                      // Color planes
  entry.writeUInt16LE(32, 6);                     // Bits per pixel
  entry.writeUInt32LE(pngData.length, 8);         // Size of image data
  entry.writeUInt32LE(dataOffset, 12);            // Offset to image data

  dirEntries.push(entry);
  dataOffset += pngData.length;
}

// Combine all parts
const ico = Buffer.concat([header, ...dirEntries, ...pngBuffers]);
fs.writeFileSync(outputIco, ico);

console.log(`Created ${outputIco} (${ico.length} bytes) with ${sizes.length} sizes: ${sizes.join(', ')}`);
