/**
 * Variant identification for throne rooms and ballrooms. All 8 variants share the same artwork and
 * differ only by the icons in the rule strip at the bottom, so the strip is matched by normalized
 * cross-correlation against reference templates (public/strips.bin, built by tools/export_strips.py)
 * in a colour-weighted YCbCr space. ponytail: 92 % leave-one-out on the reference sheets; the result
 * is a pre-selection the user confirms, not a sure read.
 */
import { dataUrl } from "./data";
import type { Rgba } from "./types";

const HS = 24; // strip height in px after normalisation

interface Template {
  id: string;
  kind: "throne" | "ballroom";
  w: number;
  h: number;
  /** YCbCr (Y halved), row-major, 3 floats per pixel */
  d: Float32Array;
}
export interface Strips {
  templates: Template[];
}

let loading: Promise<Strips> | null = null;
export function loadStrips(): Promise<Strips> {
  loading ??= (async () => {
    const [meta, bin] = await Promise.all([
      fetch(dataUrl("strips.json")).then(
        (r) =>
          r.json() as Promise<{
            entries: {
              id: string;
              kind: "throne" | "ballroom";
              w: number;
              h: number;
              offset: number;
            }[];
          }>,
      ),
      fetch(dataUrl("strips.bin")).then((r) => r.arrayBuffer()),
    ]);
    const q = new Int8Array(bin);
    return {
      templates: meta.entries.map((e) => ({
        id: e.id,
        kind: e.kind,
        w: e.w,
        h: e.h,
        d: Float32Array.from(q.subarray(e.offset, e.offset + e.w * e.h * 3)),
      })),
    };
  })();
  return loading;
}

/** the rule strip of an upright tile crop, resized to HS px high, as YCbCr (Y halved) */
export function stripBand(crop: Rgba): { w: number; h: number; d: Float32Array } | null {
  // crop = art hole; band = its bottom 22 %, x 12..98 %
  const bx0 = Math.floor(crop.w * 0.12),
    bx1 = Math.floor(crop.w * 0.98),
    by0 = Math.floor(crop.h * 0.78),
    by1 = crop.h;
  const bw = bx1 - bx0,
    bh = by1 - by0;
  if (bw < 10 || bh < 6) return null;
  // row medians vs band median → rows belonging to the cream strip (longest run within 50)
  const rowMed: [number, number, number][] = [];
  const all: number[][] = [[], [], []];
  for (let y = 0; y < bh; y++) {
    const ch: number[][] = [[], [], []];
    for (let x = 0; x < bw; x++) {
      const p = ((by0 + y) * crop.w + bx0 + x) * 4;
      for (let c = 0; c < 3; c++) {
        ch[c]!.push(crop.d[p + c]!);
        all[c]!.push(crop.d[p + c]!);
      }
    }
    rowMed.push([median(ch[0]!), median(ch[1]!), median(ch[2]!)]);
  }
  const bg = [median(all[0]!), median(all[1]!), median(all[2]!)];
  let best: [number, number] = [0, 0],
    cur = -1;
  for (let y = 0; y <= bh; y++) {
    const ok =
      y < bh &&
      Math.hypot(rowMed[y]![0] - bg[0]!, rowMed[y]![1] - bg[1]!, rowMed[y]![2] - bg[2]!) < 50;
    if (ok && cur < 0) cur = y;
    if (!ok && cur >= 0) {
      if (y - cur > best[1] - best[0]) best = [cur, y];
      cur = -1;
    }
  }
  let [r0, r1] = best;
  if (r1 - r0 < 0.4 * bh) r0 = 0;
  r1 = bh;
  const sh = r1 - r0;
  const w = Math.max(8, Math.round((bw * HS) / sh));
  const out = new Float32Array(w * HS * 3);
  for (let ty = 0; ty < HS; ty++) {
    const y0 = r0 + Math.floor((ty * sh) / HS),
      y1 = Math.max(y0 + 1, r0 + Math.floor(((ty + 1) * sh) / HS));
    for (let tx = 0; tx < w; tx++) {
      const x0 = Math.floor((tx * bw) / w),
        x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * bw) / w));
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const p = ((by0 + y) * crop.w + bx0 + x) * 4;
          r += crop.d[p]!;
          g += crop.d[p + 1]!;
          b += crop.d[p + 2]!;
          n++;
        }
      r /= n;
      g /= n;
      b /= n;
      const Y = 0.299 * r + 0.587 * g + 0.114 * b;
      const o = (ty * w + tx) * 3;
      out[o] = 0.5 * Y;
      out[o + 1] = b - Y;
      out[o + 2] = r - Y;
    }
  }
  return { w, h: HS, d: out };
}

function median(a: number[]): number {
  const s = a.slice().sort((x, y) => x - y);
  return s[s.length >> 1]!;
}

/** max normalized cross-correlation (per-channel means, joint sums, like OpenCV TM_CCOEFF_NORMED) */
function ncc(img: { w: number; h: number; d: Float32Array }, t: Template): number {
  if (t.w > img.w || t.h > img.h) return -1;
  const tm = [0, 0, 0];
  const n = t.w * t.h;
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) tm[c]! += t.d[i * 3 + c]!;
  for (let c = 0; c < 3; c++) tm[c]! /= n;
  let tt = 0;
  const tz = new Float32Array(n * 3);
  for (let i = 0; i < n; i++)
    for (let c = 0; c < 3; c++) {
      const v = t.d[i * 3 + c]! - tm[c]!;
      tz[i * 3 + c] = v;
      tt += v * v;
    }
  let best = -1;
  for (let oy = 0; oy + t.h <= img.h; oy++)
    for (let ox = 0; ox + t.w <= img.w; ox++) {
      const im = [0, 0, 0];
      for (let y = 0; y < t.h; y++)
        for (let x = 0; x < t.w; x++) {
          const p = ((oy + y) * img.w + ox + x) * 3;
          im[0]! += img.d[p]!;
          im[1]! += img.d[p + 1]!;
          im[2]! += img.d[p + 2]!;
        }
      for (let c = 0; c < 3; c++) im[c]! /= n;
      let num = 0,
        ii = 0;
      for (let y = 0; y < t.h; y++)
        for (let x = 0; x < t.w; x++) {
          const p = ((oy + y) * img.w + ox + x) * 3,
            q = (y * t.w + x) * 3;
          for (let c = 0; c < 3; c++) {
            const v = img.d[p + c]! - im[c]!;
            num += v * tz[q + c]!;
            ii += v * v;
          }
        }
      const s = num / (Math.sqrt(ii * tt) || 1);
      if (s > best) best = s;
    }
  return best;
}

export function identifyVariant(
  strips: Strips,
  crop: Rgba,
  kind: "throne" | "ballroom",
): { tile: string; score: number } | null {
  const band = stripBand(crop);
  if (!band) return null;
  let best = -2,
    bestId = "";
  for (const t of strips.templates) {
    if (t.kind !== kind) continue;
    const s = ncc(band, t);
    if (s > best) {
      best = s;
      bestId = t.id;
    }
  }
  return bestId ? { tile: bestId, score: best } : null;
}
