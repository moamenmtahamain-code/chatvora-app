/**
 * Generates icon.ico from icon-512x512.png
 * Run: node electron/generate-icon.js
 *
 * ICO format wraps raw PNG data (Windows Vista+ supports PNG inside ICO).
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'frontend', 'public', 'icons', 'icon-512x512.png');
const destWin = path.join(__dirname, '..', 'frontend', 'public', 'icons', 'icon.ico');

if (!fs.existsSync(src)) {
  console.error('Source PNG not found at', src);
  process.exit(1);
}

const pngData = fs.readFileSync(src);
const pngSize = pngData.length;

// ICO header: reserved(2) + type(2) + count(2)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);      // reserved
header.writeUInt16LE(1, 2);      // type = ICO
header.writeUInt16LE(1, 4);      // count = 1

// ICO directory entry: 16 bytes
const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0);          // width (0 = 256)
entry.writeUInt8(0, 1);          // height (0 = 256)
entry.writeUInt8(0, 2);          // colors
entry.writeUInt8(0, 3);          // reserved
entry.writeUInt16LE(1, 4);       // color planes
entry.writeUInt16LE(32, 6);      // bits per pixel
entry.writeUInt32LE(pngSize, 8); // size of image data
entry.writeUInt32LE(22, 12);     // offset (6 + 16 = 22)

const ico = Buffer.concat([header, entry, pngData]);
fs.writeFileSync(destWin, ico);
console.log(`Generated icon.ico (${ico.length} bytes) at ${destWin}`);
