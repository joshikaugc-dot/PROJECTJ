// Generates the extension's PNG icons without image dependencies.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function pixel(x, y) {
  // Rounded square with an indigo→violet gradient and a white "focus" mark.
  const r = 0.22;
  const inside = (() => {
    const cx = Math.min(Math.max(x, r), 1 - r);
    const cy = Math.min(Math.max(y, r), 1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  })();
  if (!inside) return [0, 0, 0, 0];
  const t = (x + y) / 2;
  let rgb = [99 + (124 - 99) * t, 102 + (58 - 102) * t, 241 + (237 - 241) * t];
  const dx = x - 0.5, dy = y - 0.5;
  const dot = dx * dx + dy * dy <= 0.09 * 0.09;
  const arm = (a, b) => Math.abs(a) <= 0.045 && Math.abs(b) >= 0.17 && Math.abs(b) <= 0.33;
  if (dot || arm(dx, dy) || arm(dy, dx)) rgb = [255, 255, 255];
  return [...rgb, 255];
}

function png(size) {
  const ss = 4;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const p = pixel((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
          acc[0] += p[0] * p[3]; acc[1] += p[1] * p[3]; acc[2] += p[2] * p[3]; acc[3] += p[3];
        }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const a = acc[3] / (ss * ss);
      raw[o] = a ? acc[0] / acc[3] : 0;
      raw[o + 1] = a ? acc[1] / acc[3] : 0;
      raw[o + 2] = a ? acc[2] / acc[3] : 0;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(new URL("../static/icons/", import.meta.url), { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(new URL(`../static/icons/icon-${size}.png`, import.meta.url), png(size));
}
console.log("icons written");
