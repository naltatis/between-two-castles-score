/// <reference lib="webworker" />
/** Recognition pipeline off the main thread: locate tiles → warp each to an upright crop → identify. */
import { confidence, identify, loadRefs, shortlist, type Refs } from "./identify";
import { locateTiles, warpQuad } from "./locate";
import { jsSpeed } from "./probe";
import { identifyVariant, loadStrips, type Strips } from "./strips";
import type { Rgba } from "./types";
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
  /** downscaled view of the image the boxes refer to (boxes are in w×h coordinates) */
  preview: Rgba;
  tilePx: number;
  cells: WorkerCell[];
  throne?: { box: [number, number, number, number]; tile?: string };
  method: "holes";
  /** ms per stage (benchmark/diagnostics) + how often the shortlist missed and all tiles were tried */
  timing?: { locate: number; classify: number; cv: number; brute: number; js: number };
}

const CROP = 256;
const THUMB = 96;

const PREVIEW = 1280;

/** box-downsample an RGBA image to ow×oh */
function shrink(src: Rgba, ow: number, oh: number): Rgba {
  const kx = src.w / ow,
    ky = src.h / oh;
  const d = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++)
    for (let x = 0; x < ow; x++) {
      let r = 0,
        g = 0,
        b = 0,
        c = 0;
      for (let sy = Math.floor(y * ky); sy < Math.floor((y + 1) * ky); sy++)
        for (let sx = Math.floor(x * kx); sx < Math.floor((x + 1) * kx); sx++) {
          const i = (sy * src.w + sx) * 4;
          r += src.d[i]!;
          g += src.d[i + 1]!;
          b += src.d[i + 2]!;
          c++;
        }
      const o = (y * ow + x) * 4;
      d[o] = r / c;
      d[o + 1] = g / c;
      d[o + 2] = b / c;
      d[o + 3] = 255;
    }
  return { w: ow, h: oh, d };
}
function preview(img: Rgba): Rgba {
  const k = Math.min(1, PREVIEW / Math.max(img.w, img.h));
  return shrink(img, Math.round(img.w * k), Math.round(img.h * k));
}

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

let refs: Promise<Refs> | null = null;
let strips: Promise<Strips> | null = null;
let cvReady: Promise<unknown> | null = null;
let orbRefs: Promise<OrbRefs> | null = null;

const SHORTLIST = 32;
/** wasm matching time of the current photo, and brute-force fallbacks */
let cvMs = 0;
let brute = 0;
let js = 0;
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
    const tv = performance.now();
    let v = verify(ctx.cv, ctx.orb, crop, cands, exclude);
    if (v && v.inliers < WEAK) {
      // shortlist missed: the thumbnail is blind to some lighting/framing combos; brute-force
      // the rest (≈1 s once in a while is cheaper than a wrong read)
      brute++;
      const rest = [...ctx.orb.byTile.keys()].filter((id) => !cands.includes(id));
      const v2 = verify(ctx.cv, ctx.orb, crop, rest, exclude);
      if (v2 && v2.inliers > v.inliers) {
        cands.push(...rest);
        v = { ...v2, second: Math.max(v2.second, v.inliers) };
      }
    }
    cvMs += performance.now() - tv;
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

/** per-tile quads → upright crops */
function runHoles(
  img: Rgba,
  R: Refs,
  ST: Strips,
  ctx?: { cv: unknown; orb: OrbRefs },
  exclude = "",
): WorkerResult | null {
  const tl = performance.now();
  const loc = locateTiles(img);
  if (!loc || loc.cells.length < 2) return null;
  const t0 = performance.now();
  const cells = loc.cells.map((c, i) => {
    const per = i ? ((performance.now() - t0) / i / 1000).toFixed(1) : "";
    progress(`Plättchen ${i + 1}/${loc.cells.length}${per ? ` (${per} s/P)` : ""}`);
    const crop = warpQuad(img, c.quad, CROP);
    return { ...classify(R, ST, crop, c.x, c.y, c.box, ctx, exclude), crop: thumb(crop) };
  });
  const v = identifyVariant(ST, warpQuad(img, loc.throne.quad, CROP, true), "throne");
  return {
    w: img.w,
    h: img.h,
    preview: preview(img),
    tilePx: loc.tilePx,
    cells,
    throne: { box: loc.throne.box, tile: v?.tile },
    method: "holes",
    timing: { locate: t0 - tl, classify: performance.now() - t0, cv: cvMs, brute, js },
  };
}

/** stage report for the UI (also the only diagnostics we get from a phone) */
const progress = (stage: string) => self.postMessage({ progress: stage });

self.addEventListener(
  "message",
  async (ev: MessageEvent<{ w: number; h: number; pixels: ArrayBuffer; exclude?: string }>) => {
    js = jsSpeed();
    progress(`Referenzdaten laden · JS ${js} ms`);
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
    cvMs = 0;
    brute = 0;
    const res = runHoles(img, R, ST, ctx, exclude);
    if (!res) {
      self.postMessage(null);
      return;
    }
    self.postMessage(res, [res.preview.d.buffer as ArrayBuffer]);
  },
);
