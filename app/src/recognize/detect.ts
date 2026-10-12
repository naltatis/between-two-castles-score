/**
 * Stage 1: find the tile grid in a castle photo. Port of tools/detect.py (classic CV, no ML).
 *
 * Input: RGBA pixels of the photo (longest side ≤ ~3000 px). Output: the affine-rectified image,
 * tile size, and every tile cell with castle coordinates (throne at (0,0)+(1,0), y up) and its
 * pixel box in the rectified image. Cells are oriented so that castle-up is image-up.
 */

export interface Gray {
  w: number;
  h: number;
  d: Uint8Array; // 0/255 masks or 0..255 gray
}
export interface Rgba {
  w: number;
  h: number;
  d: Uint8ClampedArray;
}
export interface DetectedCell {
  x: number;
  y: number;
  /** [l, t, r, b] in rectified-image pixels */
  box: [number, number, number, number];
}
export interface Detection {
  image: Rgba; // rectified
  tilePx: number;
  cells: DetectedCell[]; // includes the throne as (0,0) and (1,0) separately
  /** rot90 count to apply to crops so castle-up is up */
  rot: number;
  throneBorder: number;
  nextBorder: number;
}

const L = 80; // min straight cream line length at 3000 px width

// ---------- colour masks ----------

function hsvMasks(img: Rgba) {
  const n = img.w * img.h;
  const cream = new Uint8Array(n);
  const blue = new Uint8Array(n);
  const gray = new Uint8Array(n);
  const d = img.d;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = d[p]!,
      g = d[p + 1]!,
      b = d[p + 2]!;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const s = max === 0 ? 0 : (255 * (max - min)) / max;
    gray[i] = (r * 77 + g * 150 + b * 29) >> 8;
    if (max > 150 && s < 90) cream[i] = 255;
    if (max > 120 && s > 60) {
      // hue in OpenCV degrees/2 (0..180)
      let hdeg = 0;
      const delta = max - min;
      if (delta > 0) {
        if (max === r) hdeg = 60 * (((g - b) / delta) % 6);
        else if (max === g) hdeg = 60 * ((b - r) / delta + 2);
        else hdeg = 60 * ((r - g) / delta + 4);
        if (hdeg < 0) hdeg += 360;
      }
      const hh = hdeg / 2;
      if (hh > 90 && hh < 115) blue[i] = 1;
    }
  }
  return { cream: { w: img.w, h: img.h, d: cream }, blue, gray };
}

// ---------- small array helpers ----------

/** morphological opening with a 1×k (vertical) or k×1 (horizontal) kernel on a 0/255 mask:
 * keeps only runs of ≥ k set pixels along that axis */
function openRuns(m: Gray, k: number, vertical: boolean): Gray {
  const { w, h } = m;
  const out = new Uint8Array(w * h);
  const outer = vertical ? w : h;
  const inner = vertical ? h : w;
  for (let o = 0; o < outer; o++) {
    let run = 0;
    for (let i = 0; i <= inner; i++) {
      const idx = vertical ? i * w + o : o * w + i;
      const on = i < inner && m.d[idx] !== 0;
      if (on) run++;
      else {
        if (run >= k) for (let j = i - run; j < i; j++) out[vertical ? j * w + o : o * w + j] = 255;
        run = 0;
      }
    }
  }
  return { w, h, d: out };
}

function colSums(m: Gray): Float64Array {
  const p = new Float64Array(m.w);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.d[y * m.w + x]) p[x]!++;
  return p;
}
function rowSums(m: Gray, x0 = 0, x1 = m.w): Float64Array {
  const p = new Float64Array(m.h);
  for (let y = 0; y < m.h; y++) {
    let s = 0;
    for (let x = x0; x < x1; x++) if (m.d[y * m.w + x]) s++;
    p[y] = s;
  }
  return p;
}
function colSumsRows(m: Gray, y0: number, y1: number): Float64Array {
  const p = new Float64Array(m.w);
  for (let y = y0; y < y1; y++) for (let x = 0; x < m.w; x++) if (m.d[y * m.w + x]) p[x]!++;
  return p;
}

function boxBlur(p: Float64Array, k: number): Float64Array {
  const n = p.length,
    r = k >> 1,
    out = new Float64Array(n);
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i]! + p[i]!;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - r),
      b = Math.min(n, i + r + 1);
    out[i] = (cum[b]! - cum[a]!) / (b - a);
  }
  return out;
}
function detrend(p: Float64Array, k: number): Float64Array {
  const b = boxBlur(p, k);
  return p.map((v, i) => v - b[i]!);
}
function autocorr(p: Float64Array, lo: number, hi: number): { lag: number; ratio: number } {
  const n = p.length;
  let ac0 = 0;
  for (let i = 0; i < n; i++) ac0 += p[i]! * p[i]!;
  let best = lo,
    bestV = -Infinity;
  for (let lag = lo; lag < Math.min(hi, n); lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += p[i]! * p[i + lag]!;
    if (s > bestV) {
      bestV = s;
      best = lag;
    }
  }
  return { lag: best, ratio: bestV / (ac0 + 1e-6) };
}
function gauss9(p: Float64Array): Float64Array {
  const k = [0.0276, 0.0663, 0.1238, 0.1802, 0.2042, 0.1802, 0.1238, 0.0663, 0.0276];
  const n = p.length,
    out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = -4; j <= 4; j++) s += p[Math.min(n - 1, Math.max(0, i + j))]! * k[j + 4]!;
    out[i] = s;
  }
  return out;
}
function argmax(p: ArrayLike<number>, a = 0, b = p.length): number {
  let best = a;
  for (let i = a + 1; i < b; i++) if (p[i]! > p[best]!) best = i;
  return best;
}

// ---------- geometry ----------

function downsample3(m: Gray): Gray {
  const w = Math.floor(m.w / 3),
    h = Math.floor(m.h / 3);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy = 0; dy < 3; dy++)
        for (let dx = 0; dx < 3; dx++) if (m.d[(y * 3 + dy) * m.w + x * 3 + dx]) s++;
      if (s >= 5) out[y * w + x] = 255;
    }
  return { w, h, d: out };
}

/** rotate a mask by `deg` around its centre (nearest neighbour) */
function rotateMask(m: Gray, deg: number): Gray {
  const { w, h } = m;
  const out = new Uint8Array(w * h);
  const c = Math.cos((deg * Math.PI) / 180),
    s = Math.sin((deg * Math.PI) / 180);
  const cx = w / 2,
    cy = h / 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // inverse map (OpenCV getRotationMatrix2D with positive angle = counter-clockwise)
      const dx = x - cx,
        dy = y - cy;
      const sx = Math.round(c * dx - s * dy + cx);
      const sy = Math.round(s * dx + c * dy + cy);
      if (sx >= 0 && sx < w && sy >= 0 && sy < h && m.d[sy * w + sx]) out[y * w + x] = 255;
    }
  return { w, h, d: out };
}

function periodicity(p: Float64Array): number {
  return autocorr(detrend(p, 101), 50, 170).ratio;
}

/** tilt of the vertical and of the horizontal tile borders: the rotation at which that
 * axis-aligned straight-line mask is most periodic */
function axisAngles(cream: Gray): [number, number] {
  const small = downsample3(cream);
  const kl = Math.floor(L / 3);
  const energy = (a: number): [number, number] => {
    const r = rotateMask(small, a);
    return [
      periodicity(colSums(openRuns(r, kl, true))),
      periodicity(rowSums(openRuns(r, kl, false))),
    ];
  };
  const coarse: number[] = [];
  for (let a = -45; a < 45; a += 1) coarse.push(a);
  const e = coarse.map(energy);
  const out: [number, number] = [0, 0];
  for (const k of [0, 1] as const) {
    const best = coarse[argmax(e.map((v) => v[k]))]!;
    const fine: number[] = [];
    for (let a = best - 1; a <= best + 1.001; a += 0.25) fine.push(a);
    out[k] = fine[argmax(fine.map((a) => energy(a)[k]))]!;
  }
  return out;
}

/** affine-rectify (rotation + shear) so both border families are axis aligned; bilinear */
function rectify(img: Rgba, av: number, ah: number): Rgba {
  const rad = (d: number) => (d * Math.PI) / 180;
  // image direction of vertical borders = inverse rotation of (0,1); of horizontal = inv rot of (1,0)
  // OpenCV rotation matrix R(a) = [[cos, sin],[-sin, cos]]; inverse = [[cos,-sin],[sin,cos]]
  const dv = [-Math.sin(rad(av)), Math.cos(rad(av))];
  const dh = [Math.cos(rad(ah)), Math.sin(rad(ah))];
  // T = inv([dh dv]) (columns)
  const det = dh[0]! * dv[1]! - dv[0]! * dh[1]!;
  const T = [dv[1]! / det, -dv[0]! / det, -dh[1]! / det, dh[0]! / det]; // row-major 2x2
  const { w, h } = img;
  const cx = w / 2,
    cy = h / 2;
  // forward: p' = T (p - c) + c  → inverse: p = Tinv (p' - c) + c, Tinv = [dh dv]
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = x - cx,
        dy = y - cy;
      const sx = dh[0]! * dx + dv[0]! * dy + cx;
      const sy = dh[1]! * dx + dv[1]! * dy + cy;
      const x0 = Math.floor(sx),
        y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) continue;
      const fx = sx - x0,
        fy = sy - y0;
      const o = (y * w + x) * 4;
      const i00 = (y0 * w + x0) * 4,
        i10 = i00 + 4,
        i01 = i00 + w * 4,
        i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        out[o + c] =
          img.d[i00 + c]! * (1 - fx) * (1 - fy) +
          img.d[i10 + c]! * fx * (1 - fy) +
          img.d[i01 + c]! * (1 - fx) * fy +
          img.d[i11 + c]! * fx * fy;
      }
      out[o + 3] = 255;
    }
  void T;
  return { w, h, d: out };
}

/** bounding box of the largest connected blob of (vertical|horizontal line masks) dilated by ~60 px */
function castleBbox(vl: Gray, hl: Gray): [number, number, number, number] {
  const f = 8;
  const w = Math.floor(vl.w / f),
    h = Math.floor(vl.h / f);
  const m = new Uint8Array(w * h);
  for (let y = 0; y < vl.h; y++)
    for (let x = 0; x < vl.w; x++) {
      const i = y * vl.w + x;
      if (vl.d[i] || hl.d[i])
        m[Math.min(h - 1, (y / f) | 0) * w + Math.min(w - 1, (x / f) | 0)] = 1;
    }
  // dilate by r cells (121 px kernel → 7 cells)
  const r = 7;
  const dil = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (m[y * w + x])
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            const yy = y + dy,
              xx = x + dx;
            if (yy >= 0 && yy < h && xx >= 0 && xx < w) dil[yy * w + xx] = 1;
          }
  // largest component
  const lab = new Int32Array(w * h).fill(-1);
  let best: [number, number, number, number] = [0, 0, w, h],
    bestArea = 0;
  const stack: number[] = [];
  for (let s0 = 0; s0 < w * h; s0++) {
    if (!dil[s0] || lab[s0] >= 0) continue;
    let area = 0,
      x0 = w,
      x1 = 0,
      y0 = h,
      y1 = 0;
    stack.push(s0);
    lab[s0] = s0;
    while (stack.length) {
      const p = stack.pop()!;
      const px = p % w,
        py = (p / w) | 0;
      area++;
      if (px < x0) x0 = px;
      if (px > x1) x1 = px;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const xx = px + dx,
          yy = py + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = yy * w + xx;
        if (dil[q] && lab[q] < 0) {
          lab[q] = s0;
          stack.push(q);
        }
      }
    }
    if (area > bestArea) {
      bestArea = area;
      best = [x0 * f, y0 * f, (x1 + 1) * f, (y1 + 1) * f];
    }
  }
  return best;
}

function gridLines(p: Float64Array, s: number, lo: number, hi: number): number[] {
  const sm = gauss9(p);
  const n = sm.length;
  const start = argmax(sm);
  const thr = sm[start]! * 0.15;
  const lines = [start];
  for (const d of [1, -1]) {
    let pos = start;
    for (;;) {
      let a = Math.floor(pos + d * s * 0.8),
        b = Math.floor(pos + d * s * 1.2);
      [a, b] = [Math.max(0, Math.min(a, b)), Math.min(n - 1, Math.max(a, b))];
      if (b - a < 3 || (d > 0 && a > hi + s) || (d < 0 && b < lo - s)) break;
      const k = argmax(sm, a, b);
      pos = sm[k]! > thr ? k : Math.floor(pos + d * s);
      lines.push(pos);
    }
  }
  return lines.sort((x, y) => x - y);
}

/** mean over the band of (max over the other axis) of a 0/255 mask */
function edgeCov(m: Gray, y0: number, y1: number, x0: number, x1: number, alongX: boolean): number {
  y0 = Math.max(0, y0);
  x0 = Math.max(0, x0);
  y1 = Math.min(m.h, y1);
  x1 = Math.min(m.w, x1);
  if (y1 <= y0 || x1 <= x0) return 0;
  let sum = 0,
    cnt = 0;
  if (alongX) {
    // max over x for each row, mean over rows
    for (let y = y0; y < y1; y++) {
      let mx = 0;
      for (let x = x0; x < x1; x++)
        if (m.d[y * m.w + x]) {
          mx = 1;
          break;
        }
      sum += mx;
      cnt++;
    }
  } else {
    for (let x = x0; x < x1; x++) {
      let mx = 0;
      for (let y = y0; y < y1; y++)
        if (m.d[y * m.w + x]) {
          mx = 1;
          break;
        }
      sum += mx;
      cnt++;
    }
  }
  return sum / cnt;
}

function stdRegion(
  g: Uint8Array,
  w: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let s = 0,
    s2 = 0,
    n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const v = g[y * w + x]!;
      s += v;
      s2 += v * v;
      n++;
    }
  if (!n) return 0;
  const mean = s / n;
  return Math.sqrt(Math.max(0, s2 / n - mean * mean));
}

// ---------- main ----------

export function detect(img: Rgba): Detection | null {
  const { cream } = hsvMasks(img);
  const [av, ah] = axisAngles(cream);
  const rot = rectify(img, av, ah);
  const { cream: cm, blue, gray } = hsvMasks(rot);
  const vl = openRuns(cm, L, true);
  const hl = openRuns(cm, L, false);
  const [x0, y0, x1, y1] = castleBbox(vl, hl);
  const px = detrend(colSumsRows(vl, y0, y1), 301);
  const py = detrend(rowSums(hl, x0, x1), 301);
  const s = Math.floor((autocorr(px, 150, 500).lag + autocorr(py, 150, 500).lag) / 2);
  const gx = gridLines(px, s, x0, x1);
  const gy = gridLines(py, s, y0, y1);
  const m = Math.floor(s * 0.1);
  const q = Math.floor(s / 5),
    r = Math.floor(s / 8);
  const W = rot.w,
    H = rot.h;
  const occ = new Set<string>();
  const key = (i: number, j: number) => `${i},${j}`;
  for (let j = 0; j < gy.length - 1; j++)
    for (let i = 0; i < gx.length - 1; i++) {
      const a = gx[i]!,
        c = gy[j]!,
        e = gx[i + 1]!,
        d = gy[j + 1]!;
      if (a < 0 || c < 0 || e > W || d > H) continue;
      const tex = stdRegion(gray, W, a + m, c + m, e - m, d - m);
      const edges =
        +(edgeCov(vl, c + q, d - q, a - r, a + r, true) > 0.5) +
        +(edgeCov(vl, c + q, d - q, e - r, e + r, true) > 0.5) +
        +(edgeCov(hl, c - r, c + r, a + q, e - q, false) > 0.5) +
        +(edgeCov(hl, d - r, d + r, a + q, e - q, false) > 0.5);
      if (edges >= 3 && tex > 25) occ.add(key(i, j));
    }
  // largest 4-connected component
  const seen = new Set<string>();
  let cells = new Set<string>();
  for (const start of occ) {
    if (seen.has(start)) continue;
    const grp = new Set<string>();
    const stack = [start];
    while (stack.length) {
      const p = stack.pop()!;
      if (seen.has(p) || !occ.has(p)) continue;
      seen.add(p);
      grp.add(p);
      const [i, j] = p.split(",").map(Number) as [number, number];
      stack.push(key(i + 1, j), key(i - 1, j), key(i, j + 1), key(i, j - 1));
    }
    if (grp.size > cells.size) cells = grp;
  }
  if (cells.size < 2) return null;
  const cellList = [...cells].map((k) => k.split(",").map(Number) as [number, number]);
  // throne = adjacent pair with the weakest cream border between them
  const border = (i: number, j: number, k: number, l: number) => {
    if (j === l) {
      const x = gx[Math.max(i, k)]!;
      return edgeCov(
        vl,
        gy[j]! + Math.floor(s / 5),
        gy[j + 1]! - Math.floor(s / 5),
        x - Math.floor(s / 6),
        x + Math.floor(s / 6),
        true,
      );
    }
    const y = gy[Math.max(j, l)]!;
    return edgeCov(
      hl,
      y - Math.floor(s / 6),
      y + Math.floor(s / 6),
      gx[i]! + Math.floor(s / 5),
      gx[i + 1]! - Math.floor(s / 5),
      false,
    );
  };
  const pairs: { b: number; a: [number, number]; c: [number, number] }[] = [];
  for (const [i, j] of cellList)
    for (const nb of [
      [i + 1, j],
      [i, j + 1],
    ] as [number, number][])
      if (cells.has(key(nb[0], nb[1])))
        pairs.push({ b: border(i, j, nb[0], nb[1]), a: [i, j], c: nb });
  if (!pairs.length) return null;
  pairs.sort((p, q2) => p.b - q2.b);
  const { b: weakest, a: ta, c: tb } = pairs[0]!;
  const nextBorder = pairs[1]?.b ?? 1;
  const sideways = ta[0] === tb[0];
  const toCastle = ([i, j]: [number, number]): [number, number] =>
    sideways ? [ta[1] + 1 - j, -(i - ta[0])] : [i - ta[0], -(j - ta[1])];
  let rel = cellList.map((c) => ({ xy: toCastle(c), ij: c }));
  const has = (x: number, y: number) => rel.some((e) => e.xy[0] === x && e.xy[1] === y);
  const blueRing = ([i, j]: [number, number]) => {
    const a = gx[i]!,
      c = gy[j]!,
      e = gx[i + 1]!,
      d = gy[j + 1]!;
    const wv = Math.max(2, Math.floor(s * 0.06));
    let sum = 0,
      cnt = 0;
    for (let y = c; y < d; y++)
      for (let x = a; x < e; x++) {
        if (y < c + wv || y >= d - wv || x < a + wv || x >= e - wv) {
          sum += blue[y * W + x]!;
          cnt++;
        }
      }
    return cnt ? sum / cnt : 0;
  };
  let votes = 0;
  for (const e of rel)
    if (blueRing(e.ij) > 0.25)
      votes += (has(e.xy[0], e.xy[1] + 1) ? -1 : 0) + (has(e.xy[0], e.xy[1] - 1) ? 1 : 0);
  if (votes === 0)
    votes = rel.filter((e) => e.xy[1] > 0).length - rel.filter((e) => e.xy[1] < 0).length;
  const flipped = votes < 0;
  if (flipped) rel = rel.map((e) => ({ xy: [1 - e.xy[0], -e.xy[1]], ij: e.ij }));
  const rotCount = ((sideways ? 3 : 0) + (flipped ? 2 : 0)) % 4;
  return {
    image: rot,
    tilePx: s,
    rot: rotCount,
    throneBorder: weakest,
    nextBorder,
    cells: rel.map((e) => ({
      x: e.xy[0],
      y: e.xy[1],
      box: [gx[e.ij[0]]!, gy[e.ij[1]]!, gx[e.ij[0] + 1]!, gy[e.ij[1] + 1]!],
    })),
  };
}

// ---------- art holes (for identification framing) ----------

export interface Hole {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** ring (cream or light-blue tile border) mask of a window of the image, cleaned like
 * tools/crop_refs.py: open 9×9 (drop bright speckles inside the art), close 5×5 (heal ring breaks) */
function ringMaskWindow(
  img: Rgba,
  x0: number,
  y0: number,
  w: number,
  h: number,
  vMin: number,
  sMax: number,
): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = ((y0 + y) * img.w + x0 + x) * 4;
      const r = img.d[p]!,
        g = img.d[p + 1]!,
        b = img.d[p + 2]!;
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (255 * (max - min)) / max;
      if (max > vMin && sat < sMax) out[y * w + x] = 1;
      else if (max > vMin - 20 && sat > 50 && max !== r) {
        const delta = max - min;
        const hdeg = max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
        if (hdeg > 170 && hdeg < 240) out[y * w + x] = 1;
      }
    }
  const o = minmax(minmax(out, w, h, 4, false), w, h, 4, true);
  return minmax(minmax(o, w, h, 2, true), w, h, 2, false);
}

const VARIANTS: [number, number][] = [
  [130, 110],
  [150, 90],
  [100, 80],
  [130, 140],
  [160, 110],
  [100, 110],
  [100, 140],
  [160, 80],
  [160, 140],
];

/** the art hole of one tile: the non-ring region around the cell centre, flood-filled inside a
 * window of the cell ± 20 %. Leaks through ring gaps hit the window edge and are rejected. */
export function holeForCell(
  img: Rgba,
  box: [number, number, number, number],
  tilePx: number,
  wide = false,
): Hole | null {
  const [wLo, wHi] = wide ? [1.5, 2.2] : [0.55, 1.05];
  // tiles can sit up to ~1/3 tile off the fitted grid line, so look in a generous window
  const pad = Math.round(tilePx * 0.4);
  const x0 = Math.max(0, box[0] - pad),
    y0 = Math.max(0, box[1] - pad);
  const x1 = Math.min(img.w, box[2] + pad),
    y1 = Math.min(img.h, box[3] + pad);
  const w = x1 - x0,
    h = y1 - y0;
  const cx = ((box[0] + box[2]) / 2 - x0) | 0,
    cy = ((box[1] + box[3]) / 2 - y0) | 0;
  for (const [vMin, sMax] of VARIANTS) {
    const ring = ringMaskWindow(img, x0, y0, w, h, vMin, sMax);
    // label connected non-ring regions; region 1 = exterior (touches the window edge)
    const lab = new Int32Array(w * h);
    const stats: { area: number; x0: number; x1: number; y0: number; y1: number; edge: boolean }[] =
      [];
    const stack: number[] = [];
    for (let s0 = 0; s0 < w * h; s0++) {
      if (ring[s0] || lab[s0]) continue;
      const id = stats.length + 1;
      const st = { area: 0, x0: w, x1: 0, y0: h, y1: 0, edge: false };
      stats.push(st);
      lab[s0] = id;
      stack.push(s0);
      while (stack.length) {
        const p = stack.pop()!;
        const px = p % w,
          py = (p / w) | 0;
        st.area++;
        if (px < st.x0) st.x0 = px;
        if (px > st.x1) st.x1 = px;
        if (py < st.y0) st.y0 = py;
        if (py > st.y1) st.y1 = py;
        if (px === 0 || py === 0 || px === w - 1 || py === h - 1) st.edge = true;
        if (px > 0 && !ring[p - 1] && !lab[p - 1]) {
          lab[p - 1] = id;
          stack.push(p - 1);
        }
        if (px < w - 1 && !ring[p + 1] && !lab[p + 1]) {
          lab[p + 1] = id;
          stack.push(p + 1);
        }
        if (py > 0 && !ring[p - w] && !lab[p - w]) {
          lab[p - w] = id;
          stack.push(p - w);
        }
        if (py < h - 1 && !ring[p + w] && !lab[p + w]) {
          lab[p + w] = id;
          stack.push(p + w);
        }
      }
    }
    // candidate: enclosed, tile-sized, closest to the cell centre
    let best: (typeof stats)[number] | null = null,
      bestD = Infinity;
    for (const st of stats) {
      const bw = st.x1 - st.x0 + 1,
        bh = st.y1 - st.y0 + 1;
      if (
        st.edge ||
        bw < wLo * tilePx ||
        bw > wHi * tilePx ||
        bh < 0.55 * tilePx ||
        bh > 1.05 * tilePx
      )
        continue;
      if (st.area < 0.55 * bw * bh) continue;
      const d = Math.hypot((st.x0 + st.x1) / 2 - cx, (st.y0 + st.y1) / 2 - cy);
      if (d < bestD) bestD = d;
      best = st;
    }
    if (best && bestD < tilePx * (wide ? 0.7 : 0.45))
      return {
        x: x0 + best.x0,
        y: y0 + best.y0,
        w: best.x1 - best.x0 + 1,
        h: best.y1 - best.y0 + 1,
      };
  }
  return null;
}

/** separable square min (erode) or max (dilate) filter of radius r on a 0/1 mask */
function minmax(m: Uint8Array, w: number, h: number, r: number, max: boolean): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = max ? 0 : 1;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        const s = xx < 0 || xx >= w ? (max ? 0 : 1) : m[y * w + xx]!;
        if (max ? s > v : s < v) v = s;
      }
      tmp[y * w + x] = v;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = max ? 0 : 1;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        const s = yy < 0 || yy >= h ? (max ? 0 : 1) : tmp[yy * w + x]!;
        if (max ? s > v : s < v) v = s;
      }
      out[y * w + x] = v;
    }
  return out;
}
