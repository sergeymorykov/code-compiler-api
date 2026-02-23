/**
 * Minimal single-file TAR (ustar) for putArchive. No external deps.
 * Layout: https://www.gnu.org/software/tar/manual/html_node/Standard.html
 */

const BLOCK = 512;

function padToBlock(b: Buffer): Buffer {
  const remainder = b.length % BLOCK;
  if (remainder === 0) return b;
  return Buffer.concat([b, Buffer.alloc(BLOCK - remainder)]);
}

function writeOctalField(buf: Buffer, offset: number, fieldLen: number, value: number): void {
  const octal = value.toString(8);
  const padded = octal.padStart(fieldLen - 1, "0");
  buf.write(padded, offset, fieldLen - 1, "ascii");
  buf[offset + fieldLen - 1] = 0;
}

function createUstarHeader(filename: string, size: number): Buffer {
  const h = Buffer.alloc(BLOCK, 0);

  // name (0, 100)
  h.write(filename, 0, Math.min(filename.length, 100), "utf8");
  // mode (100, 8)
  writeOctalField(h, 100, 8, 0o644);
  // uid (108, 8)
  writeOctalField(h, 108, 8, 1000);
  // gid (116, 8)
  writeOctalField(h, 116, 8, 1000);
  // size (124, 12)
  writeOctalField(h, 124, 12, size);
  // mtime (136, 12)
  writeOctalField(h, 136, 12, Math.floor(Date.now() / 1000));
  // typeflag (156, 1) — '0' = regular file
  h[156] = 0x30;
  // magic (257, 6) — "ustar\0"
  h.write("ustar\0", 257, 6, "ascii");
  // version (263, 2) — "00"
  h.write("00", 263, 2, "ascii");
  // uname (265, 32)
  h.write("runuser", 265, 7, "ascii");
  // gname (297, 32)
  h.write("runuser", 297, 7, "ascii");

  // checksum: fill field (148, 8) with spaces, then sum all bytes
  for (let i = 148; i < 156; i++) h[i] = 0x20;
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += h[i];
  const chk = sum.toString(8).padStart(6, "0");
  h.write(chk, 148, 6, "ascii");
  h[154] = 0;
  h[155] = 0x20;

  return h;
}

export function createTarBuffer(filename: string, content: string | Buffer): Buffer {
  const data = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  const header = createUstarHeader(filename, data.length);
  const eof = Buffer.alloc(BLOCK * 2, 0);
  return Buffer.concat([header, padToBlock(data), eof]);
}
