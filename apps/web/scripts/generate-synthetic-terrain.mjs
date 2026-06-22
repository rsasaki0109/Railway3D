import { writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const outputPath = fileURLToPath(new URL('../public/terrain/demo/0/0/0.png', import.meta.url));
const width = 256;
const height = 256;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(kind, data) {
  const type = Buffer.from(kind, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, data])), 0);
  return Buffer.concat([length, type, data, checksum]);
}

function writeTerrariumPixel(row, heightM) {
  const encoded = Math.round((heightM + 32768) * 256);
  row.push((encoded >> 16) & 0xff, (encoded >> 8) & 0xff, encoded & 0xff);
}

const rows = [];
for (let y = 0; y < height; y += 1) {
  const row = [0];
  for (let x = 0; x < width; x += 1) {
    const nx = x / (width - 1);
    const ny = y / (height - 1);
    const ridge = 42 + 22 * Math.sin(nx * Math.PI * 5.5 + ny * Math.PI * 1.5);
    const valley = 14 * Math.cos((nx - ny) * Math.PI * 7);
    const terrace = nx > 0.32 && nx < 0.68 && ny > 0.36 && ny < 0.7 ? 8 : 0;
    writeTerrariumPixel(row, ridge + valley + terrace);
  }
  rows.push(Buffer.from(row));
}

const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header.writeUInt8(8, 8);
header.writeUInt8(2, 9);
header.writeUInt8(0, 10);
header.writeUInt8(0, 11);
header.writeUInt8(0, 12);

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

await writeFile(outputPath, png);
console.log(`${outputPath.replace(`${dirname(outputPath)}/`, '')}: ${png.length} bytes`);
