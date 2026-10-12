/**
 * Stage 2: identify a tile crop by nearest neighbour over 16×16 RGB z-scored thumbnails of
 * reference photos (public/refs.bin + refs.json, built by tools/export_refs.py).
 * ponytail: 97.9% leave-one-photo-out on the reference sheets; upgrade to a trained classifier if
 * real castle photos fall clearly below that.
 */
import { dataUrl } from "./data";

const SIZE = 16;
const DIM = SIZE * SIZE * 3;

export interface Refs {
  ids: string[];
  /** source photo of harvested references ('' for the reference sheets) */
  srcs: string[];
  vecs: Float32Array; // n × DIM, unit length
}

let refsPromise: Promise<Refs> | null = null;

export function loadRefs(): Promise<Refs> {
  refsPromise ??= (async () => {
    const [meta, bin] = await Promise.all([
      fetch(dataUrl("refs.json")).then(
        (r) => r.json() as Promise<{ ids: string[]; srcs?: string[] }>,
      ),
      fetch(dataUrl("refs.bin")).then((r) => r.arrayBuffer()),
    ]);
    const q = new Int8Array(bin);
    const n = meta.ids.length;
    const vecs = new Float32Array(n * DIM);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = 0; k < DIM; k++) {
        const v = q[i * DIM + k]!;
        vecs[i * DIM + k] = v;
        s += v * v;
      }
      const inv = 1 / (Math.sqrt(s) || 1);
      for (let k = 0; k < DIM; k++) vecs[i * DIM + k]! *= inv;
    }
    return { ids: meta.ids, srcs: meta.srcs ?? meta.ids.map(() => ""), vecs };
  })();
  return refsPromise;
}

/** z-scored, unit-length 16×16 RGB thumbnail of a crop (area averaging, like OpenCV INTER_AREA) */
export function thumbnail(src: { w: number; h: number; d: Uint8ClampedArray }): Float32Array {
  // central 80 % only: framing differences at the border must not move the embedding
  const w = src.w,
    h = src.h,
    d = src.d;
  const mx = Math.floor(w * 0.1),
    my = Math.floor(h * 0.1),
    cw = w - 2 * mx,
    ch = h - 2 * my;
  const v = new Float32Array(DIM);
  for (let ty = 0; ty < SIZE; ty++) {
    const y0 = my + Math.floor((ty * ch) / SIZE),
      y1 = Math.max(y0 + 1, my + Math.floor(((ty + 1) * ch) / SIZE));
    for (let tx = 0; tx < SIZE; tx++) {
      const x0 = mx + Math.floor((tx * cw) / SIZE),
        x1 = Math.max(x0 + 1, mx + Math.floor(((tx + 1) * cw) / SIZE));
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const p = (y * w + x) * 4;
          r += d[p]!;
          g += d[p + 1]!;
          b += d[p + 2]!;
          n++;
        }
      const o = (ty * SIZE + tx) * 3;
      v[o] = r / n;
      v[o + 1] = g / n;
      v[o + 2] = b / n;
    }
  }
  let mean = 0;
  for (let k = 0; k < DIM; k++) mean += v[k]!;
  mean /= DIM;
  let sq = 0;
  for (let k = 0; k < DIM; k++) {
    v[k] = v[k]! - mean;
    sq += v[k]! * v[k]!;
  }
  const inv = 1 / (Math.sqrt(sq) || 1);
  for (let k = 0; k < DIM; k++) v[k]! *= inv;
  return v;
}

export interface Match {
  tile: string;
  /** cosine similarity of the best reference */
  score: number;
  /** best score minus best score of a different tile; large = unambiguous */
  margin: number;
}

export function identify(
  refs: Refs,
  crop: { w: number; h: number; d: Uint8ClampedArray },
  exclude = "",
): Match {
  const v = thumbnail(crop);
  const n = refs.ids.length;
  let best = -2,
    bestId = "";
  const perTile = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    if (exclude && refs.srcs[i] === exclude) continue;
    let s = 0;
    const o = i * DIM;
    for (let k = 0; k < DIM; k++) s += refs.vecs[o + k]! * v[k]!;
    const id = refs.ids[i]!;
    if (s > (perTile.get(id) ?? -2)) perTile.set(id, s);
    if (s > best) {
      best = s;
      bestId = id;
    }
  }
  let second = -2;
  for (const [id, s] of perTile) if (id !== bestId && s > second) second = s;
  return { tile: bestId, score: best, margin: best - second };
}

/** the k most similar distinct tiles by thumbnail, best first */
export function shortlist(
  refs: Refs,
  crop: { w: number; h: number; d: Uint8ClampedArray },
  k: number,
  exclude = "",
): string[] {
  const v = thumbnail(crop);
  const n = refs.ids.length;
  const perTile = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    if (exclude && refs.srcs[i] === exclude) continue;
    let s = 0;
    const o = i * DIM;
    for (let j = 0; j < DIM; j++) s += refs.vecs[o + j]! * v[j]!;
    const id = refs.ids[i]!;
    if (s > (perTile.get(id) ?? -2)) perTile.set(id, s);
  }
  return [...perTile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map((e) => e[0]);
}

/** map a match to a confidence in [0,1] for the review flow.
 * Calibrated leave-one-out on 861 reference crops: at margin ≥ 0.064 (confidence 0.8) about
 * 99.7 % of reads are right; the score itself adds little once the margin is known. */
export function confidence(m: Match): number {
  if (m.score < 0.5) return 0;
  return Math.min(1, Math.max(0, m.margin / 0.08));
}
