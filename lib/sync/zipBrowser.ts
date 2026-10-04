// Dependency-free ZIP reader/writer for the browser (and Node >= 18 for tests).
//  - reader : handles store (0) + deflate (8) written by the offline dashboard (lib/zip.ts), verifies CRC-32
//  - writer : store-only (PDFs/images are already compressed), same layout the dashboard's restore expects
// Uses DecompressionStream("deflate-raw"): Chrome/Edge 80+, Safari 16.4+, Firefox 113+.

export type ZipItem = { name: string; data: Uint8Array };

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function inflateRaw(raw: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Reads every file entry. Throws on a damaged / encrypted / zip64 file, or when a checksum does not match. */
export async function readZipBrowser(source: Blob): Promise<ZipItem[]> {
  const buf = new Uint8Array(await source.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Not a valid zip file.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: ZipItem[] = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("Damaged zip (central directory).");
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (flags & 1) throw new Error("Encrypted zip files are not supported.");
    if (name.endsWith("/")) continue;
    if (dv.getUint32(lho, true) !== 0x04034b50) throw new Error("Damaged zip (local header).");
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    const raw = buf.subarray(start, start + csize);
    let data: Uint8Array;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = await inflateRaw(raw);
    else throw new Error(`Unsupported zip compression (${method}).`);
    if (crc32(data) !== crc) throw new Error(`Checksum mismatch in ${name}.`);
    out.push({ name, data });
  }
  return out;
}

/** Store-only zip. Total must stay below 4 GB (no zip64). */
export function writeZipStore(items: ZipItem[]): Blob {
  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: BlobPart[] = [];
  let offset = 0;
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const it of items) {
    const name = enc.encode(it.name);
    const crc = crc32(it.data);
    if (it.data.length > 0xfffffffe) throw new Error(`File too large for the zip format: ${it.name}`);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
    local.setUint16(10, time, true); local.setUint16(12, date, true); local.setUint32(14, crc, true);
    local.setUint32(18, it.data.length, true); local.setUint32(22, it.data.length, true); local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
    parts.push(local.buffer, name, it.data as BlobPart);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
    cd.setUint16(12, time, true); cd.setUint16(14, date, true); cd.setUint32(16, crc, true);
    cd.setUint32(20, it.data.length, true); cd.setUint32(24, it.data.length, true); cd.setUint16(28, name.length, true); cd.setUint32(42, offset, true);
    central.push(cd.buffer, name);
    offset += 30 + name.length + it.data.length;
  }
  if (items.length > 0xfffe) throw new Error("Too many files for one zip.");
  const cdSize = central.reduce((n, p) => n + (p instanceof ArrayBuffer ? p.byteLength : (p as Uint8Array).length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, items.length, true); end.setUint16(10, items.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
}

export async function sha256Hex(data: Uint8Array | Blob): Promise<string> {
  const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}
