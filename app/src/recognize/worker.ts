/// <reference lib="webworker" />
/** Recognition pipeline off the main thread: locate tiles → warp each to an upright crop → identify. */
import { detect, holeForCell, type Rgba } from "./detect";
import { confidence, identify, loadRefs, shortlist, type Refs } from "./identify";
import { locateTiles, warpQuad } from "./locate";
import { identifyVariant, loadStrips, type Strips } from "./strips";
import { loadCv, loadOrbRefs, verify, type OrbRefs } from "./verify";

export interface WorkerCell {
  x: number;
  y: number;
  box: [number, number, number, number];
  tile?: string;
  confidence: number;
  /** raw match quality for calibration */
  score?: number;
  margin?: number;
  /** benchmark only: shortlist considered by verification */
  cands?: string[];
  /** small upright crop of the art hole for the review UI */
  crop?: Rgba;
}
export interface WorkerResult {
  w: number;
  h: number;
  /** image pixels the boxes refer to (transferred) */
  pixels: ArrayBuffer;
  tilePx: number;
  cells: WorkerCell[];
  throne?: { box: [number, number, number, number]; tile?: string };
  /** which localisation produced the result */
  method: "holes" | "grid";
}

const CROP = 256;
const THUMB = 96;

/** box-downsample an RGBA crop to THUMB px (square crops only) */
function thumb(src: Rgba): Rgba {
  const n = THUMB,
    k = src.w / n;
  const d = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let r = 0,
        g = 0,
        b = 0,
        c = 0;
      for (let sy = Math.floor(y * k); sy < Math.floor((y + 1) * k); sy++)
        for (let sx = Math.floor(x * k); sx < Math.floor((x + 1) * k); sx++) {
          const i = (sy * src.w + sx) * 4;
          r += src.d[i]!;
          g += src.d[i + 1]!;
          b += src.d[i + 2]!;
          c++;
        }
      const o = (y * n + x) * 4;
      d[o] = r / c;
      d[o + 1] = g / c;
      d[o + 2] = b / c;
      d[o + 3] = 255;
    }
  return { w: n, h: n, d };
}

/** pixels of `box` rotated by rot×90° counter-clockwise (numpy rot90 convention) so castle-up is up */
export function cropRgba(img: Rgba, box: [number, number, number, number], rot: number): Rgba {
  const [l, t, r, b] = box;
  const w = r - l,
    h = b - t;
  const ow = rot % 2 ? h : w,
    oh = rot % 2 ? w : h;
  const d = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let ox: number, oy: number;
      switch (rot) {
        case 1:
          ox = y;
          oy = w - 1 - x;
          break;
        case 2:
          ox = w - 1 - x;
          oy = h - 1 - y;
          break;
        case 3:
          ox = h - 1 - y;
          oy = x;
          break;
        default:
          ox = x;
          oy = y;
      }
      const si = ((t + y) * img.w + l + x) * 4,
        di = (oy * ow + ox) * 4;
      d[di] = img.d[si]!;
      d[di + 1] = img.d[si + 1]!;
      d[di + 2] = img.d[si + 2]!;
      d[di + 3] = 255;
    }
  return { w: ow, h: oh, d };
}

let refs: Promise<Refs> | null = null;
let strips: Promise<Strips> | null = null;
let cvReady: Promise<unknown> | null = null;
let orbRefs: Promise<OrbRefs> | null = null;

const SHORTLIST = 32;
/** inliers needed for full confidence, and the lead over the runner-up */
const INLIERS_FULL = 60;
const RATIO_FULL = 2.0;
/** below this many inliers the shortlist probably missed the tile */
const WEAK = 30;

function classify(
  R: Refs,
  ST: Strips,
  crop: Rgba,
  x: number,
  y: number,
  box: WorkerCell["box"],
  ctx?: { cv: unknown; orb: OrbRefs },
  exclude = "",
): WorkerCell {
  const m = identify(R, crop, exclude);
  let tile = m.tile,
    conf = confidence(m);
  if (tile.startsWith("ballroom")) {
    // the 8 variants share their art and differ only by the strip icon: pre-select the variant,
    // fixed 0.5 so the user always confirms it
    const v = identifyVariant(ST, crop, "ballroom");
    return { x, y, box, tile: v?.tile ?? "ballroom-activity", confidence: 0.5 };
  }
  if (ctx) {
    // thumbnail shortlist → keypoint verification decides and sets the confidence
    const cands = shortlist(R, crop, SHORTLIST, exclude);
    let v = verify(ctx.cv, ctx.orb, crop, cands, exclude);
    if (v && v.inliers < WEAK) {
      // shortlist missed: the thumbnail is blind to some lighting/framing combos; brute-force
      // the rest (≈1 s once in a while is cheaper than a wrong read)
      const rest = [...ctx.orb.byTile.keys()].filter((id) => !cands.includes(id));
      const v2 = verify(ctx.cv, ctx.orb, crop, rest, exclude);
      if (v2 && v2.inliers > v.inliers) {
        cands.push(...rest);
        v = { ...v2, second: Math.max(v2.second, v.inliers) };
      }
    }
    if (v) {
      tile = v.tile;
      const ratio = v.inliers / Math.max(1, v.second);
      conf = Math.min(1, v.inliers / INLIERS_FULL) * Math.min(1, (ratio - 1) / (RATIO_FULL - 1));
      return {
        x,
        y,
        box,
        tile,
        confidence: Math.max(0, conf),
        score: v.inliers,
        margin: ratio,
        cands: exclude ? cands : undefined,
      };
    }
  }
  return { x, y, box, tile: tile || undefined, confidence: conf, score: m.score, margin: m.margin };
}

/** per-tile quads → upright crops (primary path) */
function runHoles(
  img: Rgba,
  R: Refs,
  ST: Strips,
  ctx?: { cv: unknown; orb: OrbRefs },
  exclude = "",
): WorkerResult | null {
  const loc = locateTiles(img);
  if (!loc || loc.cells.length < 2) return null;
  const cells = loc.cells.map((c, i) => {
    progress(`Plättchen erkennen ${i + 1}/${loc.cells.length}`);
    const crop = warpQuad(img, c.quad, CROP);
    return { ...classify(R, ST, crop, c.x, c.y, c.box, ctx, exclude), crop: thumb(crop) };
  });
  const v = identifyVariant(ST, warpQuad(img, loc.throne.quad, CROP, true), "throne");
  return {
    w: img.w,
    h: img.h,
    pixels: img.d.buffer as ArrayBuffer,
    tilePx: loc.tilePx,
    cells,
    throne: { box: loc.throne.box, tile: v?.tile },
    method: "holes",
  };
}

/** global grid + axis-aligned crops (fallback for photos where the rings don't segment) */
function runGrid(
  img: Rgba,
  R: Refs,
  ST: Strips,
  ctx?: { cv: unknown; orb: OrbRefs },
  exclude = "",
): WorkerResult | null {
  const d = detect(img);
  if (!d) return null;
  const rect = d.image;
  let throneBox: [number, number, number, number] | undefined;
  const cells: WorkerCell[] = [];
  for (const c of d.cells) {
    if (c.y === 0 && (c.x === 0 || c.x === 1)) {
      throneBox = throneBox
        ? [
            Math.min(throneBox[0], c.box[0]),
            Math.min(throneBox[1], c.box[1]),
            Math.max(throneBox[2], c.box[2]),
            Math.max(throneBox[3], c.box[3]),
          ]
        : [...c.box];
      continue;
    }
    const hole = holeForCell(rect, c.box, d.tilePx);
    let art: [number, number, number, number];
    if (hole) art = [hole.x, hole.y, hole.x + hole.w, hole.y + hole.h];
    else {
      const m = ((c.box[2] - c.box[0]) * 0.11) | 0;
      art = [c.box[0] + m, c.box[1] + m, c.box[2] - m, c.box[3] - m];
    }
    const crop = cropRgba(rect, art, d.rot);
    cells.push({ ...classify(R, ST, crop, c.x, c.y, c.box, ctx, exclude), crop: thumb(crop) });
  }
  let throne: WorkerResult["throne"];
  if (throneBox) {
    const hole = holeForCell(rect, throneBox, d.tilePx, true);
    const art: [number, number, number, number] = hole
      ? [hole.x, hole.y, hole.x + hole.w, hole.y + hole.h]
      : throneBox;
    const v = identifyVariant(ST, cropRgba(rect, art, d.rot), "throne");
    throne = { box: throneBox, tile: v?.tile };
  }
  return {
    w: rect.w,
    h: rect.h,
    pixels: rect.d.buffer as ArrayBuffer,
    tilePx: d.tilePx,
    cells,
    throne,
    method: "grid",
  };
}

/** stage report for the UI (also the only diagnostics we get from a phone) */
const progress = (stage: string) => self.postMessage({ progress: stage });

self.addEventListener(
  "message",
  async (ev: MessageEvent<{ w: number; h: number; pixels: ArrayBuffer; exclude?: string }>) => {
    progress("Referenzdaten laden");
    refs ??= loadRefs();
    strips ??= loadStrips();
    cvReady ??= loadCv();
    orbRefs ??= loadOrbRefs();
    const { w, h, pixels, exclude = "" } = ev.data;
    const img: Rgba = { w, h, d: new Uint8ClampedArray(pixels) };
    const R = await refs;
    const ST = await strips;
    progress("OpenCV starten");
    let ctx: { cv: unknown; orb: OrbRefs } | undefined;
    try {
      ctx = { cv: await cvReady, orb: await orbRefs };
    } catch (e) {
      console.warn("keypoint verification unavailable", e);
      progress(`OpenCV nicht verfügbar: ${e instanceof Error ? e.message : String(e)}`);
    }
    progress("Plättchen suchen");
    const res = runHoles(img, R, ST, ctx, exclude) ?? runGrid(img, R, ST, ctx, exclude);
    if (!res) {
      self.postMessage(null);
      return;
    }
    self.postMessage(res, [res.pixels]);
  },
);
