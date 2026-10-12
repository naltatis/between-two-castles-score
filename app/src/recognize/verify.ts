/**
 * Keypoint verification of a tile crop against reference crops (OpenCV.js in the worker):
 * ORB features on the 256 px upright crop, Hamming matching with Lowe's ratio test against the
 * precomputed reference descriptors (public/refs.orb, built by tools/export_orb.py), RANSAC
 * homography; the score is the inlier count. Invariant to rotation, scale, moderate perspective
 * and lighting — exactly what the thumbnail nearest-neighbour is not.
 */
import cvModule from "@techstark/opencv-js";
import { dataUrl } from "./data";
import type { Rgba } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CV = any;

let cvPromise: Promise<CV> | null = null;
export function loadCv(): Promise<CV> {
  // Static import on purpose: the package is CommonJS and exports a Promise. The bundler's ESM
  // shim builds the namespace with Object.create(Promise.prototype), and a dynamic import() would
  // await that fake thenable and throw "then called on incompatible receiver".
  cvPromise ??= (async () => {
    const cv: unknown = cvModule;
    // the module exports a promise-like until the wasm is ready
    if (typeof (cv as { then?: unknown }).then === "function") return await (cv as Promise<CV>);
    if ((cv as { ready?: Promise<unknown> }).ready) await (cv as { ready: Promise<unknown> }).ready;
    return cv;
  })();
  return cvPromise;
}

export interface OrbRef {
  id: string;
  src: string;
  pts: Float32Array; // n×2
  des: Uint8Array; // n×32
}
export interface OrbRefs {
  byTile: Map<string, OrbRef[]>;
  size: number;
}

let refsPromise: Promise<OrbRefs> | null = null;
export function loadOrbRefs(): Promise<OrbRefs> {
  refsPromise ??= (async () => {
    const [meta, bin] = await Promise.all([
      fetch(dataUrl("orb.json")).then(
        (r) =>
          r.json() as Promise<{
            size: number;
            entries: { id: string; n: number; offset: number; src?: string }[];
          }>,
      ),
      fetch(dataUrl("refs.orb")).then((r) => r.arrayBuffer()),
    ]);
    const byTile = new Map<string, OrbRef[]>();
    for (const e of meta.entries) {
      const pts = new Float32Array(bin, e.offset, e.n * 2);
      const des = new Uint8Array(bin, e.offset + e.n * 8, e.n * 32);
      const list = byTile.get(e.id) ?? [];
      list.push({ id: e.id, src: e.src ?? "", pts, des });
      byTile.set(e.id, list);
    }
    return { byTile, size: meta.size };
  })();
  return refsPromise;
}

const NFEAT = 300;
/** inliers no wrong tile reaches (ponytail: tuned on the benchmark, max wrong seen ≈ 25) */
const SURE = 60;

export interface Features {
  pts: Float32Array;
  des: Uint8Array;
}

/** ORB keypoints + descriptors of an RGBA crop (expected 256 px square) */
export function features(cv: CV, crop: Rgba): Features | null {
  const src = cv.matFromImageData({ data: crop.d, width: crop.w, height: crop.h });
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  const orb = new cv.ORB(NFEAT, 1.2, 8, 15, 0, 2, cv.ORB_HARRIS_SCORE, 31, 10);
  const kp = new cv.KeyPointVector();
  const des = new cv.Mat();
  orb.detectAndCompute(gray, new cv.Mat(), kp, des);
  const n = kp.size();
  let out: Features | null = null;
  if (n >= 20) {
    const pts = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const p = kp.get(i).pt;
      pts[i * 2] = p.x;
      pts[i * 2 + 1] = p.y;
    }
    out = { pts, des: new Uint8Array(des.data.slice(0, n * 32)) };
  }
  src.delete();
  gray.delete();
  orb.delete();
  kp.delete();
  des.delete();
  return out;
}

/** RANSAC inlier count between query features and one reference */
export function inliers(cv: CV, q: Features, r: OrbRef): number {
  const nq = q.pts.length / 2,
    nr = r.pts.length / 2;
  if (nq < 8 || nr < 8) return 0;
  const dq = cv.matFromArray(nq, 32, cv.CV_8U, q.des);
  const dr = cv.matFromArray(nr, 32, cv.CV_8U, r.des);
  const bf = new cv.BFMatcher(cv.NORM_HAMMING, false);
  const matches = new cv.DMatchVectorVector();
  bf.knnMatch(dq, dr, matches, 2);
  const src: number[] = [],
    dst: number[] = [];
  for (let i = 0; i < matches.size(); i++) {
    const m = matches.get(i);
    if (m.size() < 2) continue;
    const a = m.get(0),
      b = m.get(1);
    if (a.distance < 0.8 * b.distance) {
      src.push(q.pts[a.queryIdx * 2]!, q.pts[a.queryIdx * 2 + 1]!);
      dst.push(r.pts[a.trainIdx * 2]!, r.pts[a.trainIdx * 2 + 1]!);
    }
  }
  dq.delete();
  dr.delete();
  bf.delete();
  matches.delete();
  const good = src.length / 2;
  if (good < 8) return good >> 1;
  const ms = cv.matFromArray(good, 1, cv.CV_32FC2, src);
  const md = cv.matFromArray(good, 1, cv.CV_32FC2, dst);
  const mask = new cv.Mat();
  const H = cv.findHomography(ms, md, cv.RANSAC, 6, mask);
  let n = 0;
  if (!H.empty()) for (let i = 0; i < mask.rows; i++) n += mask.data[i]!;
  ms.delete();
  md.delete();
  mask.delete();
  H.delete();
  return n;
}

export interface Verdict {
  tile: string;
  inliers: number;
  second: number;
}

/** best candidate by inliers over its references; `second` = best other candidate */
export function verify(
  cv: CV,
  refs: OrbRefs,
  crop: Rgba,
  candidates: string[],
  exclude = "",
): Verdict | null {
  const q = features(cv, crop);
  if (!q) return null;
  // candidates come best-first from the thumbnail shortlist; stop early once a clear winner
  // exists (ponytail: 90 inliers is far above anything a wrong tile reaches)
  const scored: { id: string; n: number }[] = [];
  let best = 0;
  for (const id of candidates) {
    let n = 0;
    for (const r of refs.byTile.get(id) ?? []) {
      if (exclude && r.src === exclude) continue;
      n = Math.max(n, inliers(cv, q, r));
      if (n >= SURE) break; // one convincing reference is enough for this tile
    }
    scored.push({ id, n });
    best = Math.max(best, n);
    // candidates come best-first from the thumbnail shortlist; a clear winner ends the search
    if (scored.length >= 3 && best >= SURE) break;
  }
  scored.sort((a, b) => b.n - a.n);
  if (!scored.length) return null;
  return { tile: scored[0]!.id, inliers: scored[0]!.n, second: scored[1]?.n ?? 0 };
}
