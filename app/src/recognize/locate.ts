/**
 * Hole-first tile localisation. Every tile's artwork is enclosed by a cream (or light-blue)
 * border ring; the enclosed regions are found directly, each gets its own centre, size and
 * angle, and a lattice anchored at the throne room (the one 2:1 region) assigns castle
 * coordinates. Tiles may be rotated a few degrees or sit off the grid line; nothing downstream
 * depends on a global grid. Each tile is then warped from its own quad to an upright square.
 */
import type { Rgba } from "./types";

export type Pt = [number, number];
export interface Region {
  cx: number;
  cy: number;
  /** side lengths along the region's own axes (long, short) */
  w: number;
  h: number;
  /** orientation of the long axis in radians */
  angle: number;
  /** corners in image pixels, order: top-left, top-right, bottom-right, bottom-left in the region frame */
  quad: [Pt, Pt, Pt, Pt];
  area: number;
}
export interface LocatedCell {
  x: number;
  y: number;
  quad: [Pt, Pt, Pt, Pt];
  box: [number, number, number, number];
  /** position inferred from neighbours (no hole of its own) */
  inferred?: boolean;
}
export interface Location {
  cells: LocatedCell[];
  throne: { quad: [Pt, Pt, Pt, Pt]; box: [number, number, number, number] };
  tilePx: number;
  /** lattice x axis (castle right) and y axis (castle up) as unit vectors in image coordinates */
  ax: Pt;
  ay: Pt;
}

// ---------- ring mask (0 = ring/table, 1 = inside-ring candidate) ----------

function ringMask(img: Rgba, vMin: number, sMax: number): Uint8Array {
  const n = img.w * img.h;
  const out = new Uint8Array(n);
  const d = img.d;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = d[p]!,
      g = d[p + 1]!,
      b = d[p + 2]!;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (255 * (max - min)) / max;
    if (max > vMin && sat < sMax) out[i] = 1;
    else if (max > vMin - 20 && sat > 50 && max !== r) {
      const delta = max - min;
      const hdeg = max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
      if (hdeg > 170 && hdeg < 240) out[i] = 1;
    }
  }
  // open 5×5 (bright speckles inside the art), close 3×3 (ring breaks) — radii for half resolution
  const o = minmax(minmax(out, img.w, img.h, 2, false), img.w, img.h, 2, true);
  return minmax(minmax(o, img.w, img.h, 1, true), img.w, img.h, 1, false);
}

/** ring mask relative to the local background: cream rings are brighter than their surroundings
 * even inside a shadow. v > k × box-mean(v) over a window of ~2 tiles, low saturation. */
function ringMaskLocal(img: Rgba, k: number, sMax: number, radius: number): Uint8Array {
  const { w, h } = img;
  const n = w * h;
  const v = new Float32Array(n);
  const sat = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = img.d[p]!,
      g = img.d[p + 1]!,
      b = img.d[p + 2]!;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    v[i] = max;
    sat[i] = max === 0 ? 0 : ((255 * (max - min)) / max) | 0;
  }
  // integral image for the box mean
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) {
      row += v[(y - 1) * w + x - 1]!;
      I[y * (w + 1) + x] = I[(y - 1) * (w + 1) + x]! + row;
    }
  }
  const out = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius),
      y1 = Math.min(h, y + radius + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius),
        x1 = Math.min(w, x + radius + 1);
      const sum =
        I[y1 * (w + 1) + x1]! -
        I[y0 * (w + 1) + x1]! -
        I[y1 * (w + 1) + x0]! +
        I[y0 * (w + 1) + x0]!;
      const mean = sum / ((y1 - y0) * (x1 - x0));
      const i = y * w + x;
      if (v[i]! > k * mean && v[i]! > 70 && sat[i]! < sMax) out[i] = 1;
    }
  }
  const o = minmax(minmax(out, w, h, 2, false), w, h, 2, true);
  return minmax(minmax(o, w, h, 1, true), w, h, 1, false);
}

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

export function halve(img: Rgba): Rgba {
  const w = img.w >> 1,
    h = img.h >> 1;
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const i00 = (y * 2 * img.w + x * 2) * 4,
        i10 = i00 + 4,
        i01 = i00 + img.w * 4,
        i11 = i01 + 4;
      for (let c = 0; c < 3; c++)
        d[o + c] = (img.d[i00 + c]! + img.d[i10 + c]! + img.d[i01 + c]! + img.d[i11 + c]!) >> 2;
      d[o + 3] = 255;
    }
  return { w, h, d };
}

// ---------- enclosed regions ----------

/** connected non-ring regions that do not touch the image edge, with an oriented bounding box */
function regions(
  ring: Uint8Array,
  w: number,
  h: number,
  minSide: number,
  maxSide: number,
): Region[] {
  const lab = new Int32Array(w * h);
  const out: Region[] = [];
  const stack: number[] = [];
  let id = 0;
  for (let s0 = 0; s0 < w * h; s0++) {
    if (ring[s0] || lab[s0]) continue;
    id++;
    const px: number[] = [];
    let edge = false,
      x0 = w,
      x1 = 0,
      y0 = h,
      y1 = 0;
    lab[s0] = id;
    stack.push(s0);
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w,
        y = (p / w) | 0;
      px.push(p);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (x > 0 && !ring[p - 1] && !lab[p - 1]) {
        lab[p - 1] = id;
        stack.push(p - 1);
      }
      if (x < w - 1 && !ring[p + 1] && !lab[p + 1]) {
        lab[p + 1] = id;
        stack.push(p + 1);
      }
      if (y > 0 && !ring[p - w] && !lab[p - w]) {
        lab[p - w] = id;
        stack.push(p - w);
      }
      if (y < h - 1 && !ring[p + w] && !lab[p + w]) {
        lab[p + w] = id;
        stack.push(p + w);
      }
    }
    const bw = x1 - x0 + 1,
      bh = y1 - y0 + 1;
    if (edge || bw < minSide || bh < minSide || bw > 2.6 * maxSide || bh > 1.3 * maxSide) continue;
    if (px.length < 0.35 * bw * bh) continue;
    // boundary pixels → PCA orientation → extents along the axes
    const bnd: Pt[] = [];
    for (const p of px) {
      const x = p % w,
        y = (p / w) | 0;
      if (
        x === 0 ||
        y === 0 ||
        x === w - 1 ||
        y === h - 1 ||
        lab[p - 1] !== id ||
        lab[p + 1] !== id ||
        lab[p - w] !== id ||
        lab[p + w] !== id
      )
        bnd.push([x, y]);
    }
    const r = orientedBox(bnd);
    if (!r) continue;
    r.area = px.length;
    out.push(r);
  }
  return out;
}

/** minimum-area-ish box: orientation from the boundary's dominant edge directions (mod 90°),
 * extents by projecting the boundary onto the axes */
function orientedBox(bnd: Pt[]): Region | null {
  if (bnd.length < 16) return null;
  let cx = 0,
    cy = 0;
  for (const [x, y] of bnd) {
    cx += x;
    cy += y;
  }
  cx /= bnd.length;
  cy /= bnd.length;
  // edge direction histogram over 90° (axis-symmetric): angle between consecutive boundary samples
  // is noisy; instead take the angle of each boundary point relative to the centre and fit a
  // square: the extents are minimal at the right rotation → search 0..90° in 1° steps, refine 0.25°
  const half = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a),
      s = Math.sin(a);
    let u0 = Infinity,
      u1 = -Infinity,
      v0 = Infinity,
      v1 = -Infinity;
    for (const [x, y] of bnd) {
      const dx = x - cx,
        dy = y - cy;
      const u = dx * c + dy * s,
        v = -dx * s + dy * c;
      if (u < u0) u0 = u;
      if (u > u1) u1 = u;
      if (v < v0) v0 = v;
      if (v > v1) v1 = v;
    }
    return { area: (u1 - u0) * (v1 - v0), u0, u1, v0, v1 };
  };
  let best = 0,
    bestA = Infinity;
  for (let deg = -45; deg < 45; deg += 1) {
    const a = half(deg).area;
    if (a < bestA) {
      bestA = a;
      best = deg;
    }
  }
  for (let deg = best - 1; deg <= best + 1; deg += 0.25) {
    const a = half(deg).area;
    if (a < bestA) {
      bestA = a;
      best = deg;
    }
  }
  const e = half(best);
  const a = (best * Math.PI) / 180;
  const c = Math.cos(a),
    s = Math.sin(a);
  const P = (u: number, v: number): Pt => [cx + u * c - v * s, cy + u * s + v * c];
  let w = e.u1 - e.u0,
    h = e.v1 - e.v0;
  let quad: [Pt, Pt, Pt, Pt] = [P(e.u0, e.v0), P(e.u1, e.v0), P(e.u1, e.v1), P(e.u0, e.v1)];
  let angle = a;
  if (h > w) {
    // make the long axis the first one
    [w, h] = [h, w];
    quad = [quad[1], quad[2], quad[3], quad[0]];
    angle = a + Math.PI / 2;
  }
  return { cx, cy, w, h, angle, quad, area: 0 };
}

function median(a: number[]): number {
  const s = a.slice().sort((x, y) => x - y);
  return s[s.length >> 1]!;
}

// ---------- lattice ----------

export interface LocateDebug {
  variants: number[];
  side: number;
  regions: { cx: number; cy: number; w: number; h: number; fill: number; used: boolean }[];
  rejected: string[];
  wide: string[];
  thrones: string[];
}

export function locateTiles(full: Rgba, debug?: LocateDebug): Location | null {
  const img = halve(full);
  const { w, h } = img;
  const minSide = Math.max(30, Math.round(Math.min(w, h) / 40));
  const maxSide = Math.round(Math.min(w, h) / 3);
  // union of the regions found by several thresholds (global and locally normalised); a region
  // already present (same centre, similar size) is kept once
  const best: Region[] = [];
  const add = (regs: Region[]) => {
    for (const r of regs) {
      const dup = best.find(
        (b) =>
          Math.hypot(b.cx - r.cx, b.cy - r.cy) < 0.3 * Math.min(b.h, r.h) &&
          Math.abs(b.w - r.w) < 0.35 * r.w,
      );
      if (!dup) best.push(r);
      else if (r.area > dup.area) best[best.indexOf(dup)] = r;
    }
  };
  for (const [vMin, sMax] of [
    [130, 110],
    [150, 90],
    [100, 80],
    [130, 140],
    [160, 110],
  ] as [number, number][]) {
    const regs = regions(ringMask(img, vMin, sMax), w, h, minSide, maxSide);
    debug?.variants.push(regs.length);
    add(regs);
  }
  for (const [k, sMax] of [
    [1.25, 110],
    [1.15, 140],
  ] as [number, number][]) {
    const regs = regions(
      ringMaskLocal(img, k, sMax, Math.round(minSide * 3)),
      w,
      h,
      minSide,
      maxSide,
    );
    debug?.variants.push(regs.length);
    add(regs);
  }
  const squares = best.filter((r) => r.w / r.h < 1.3 && r.area > 0.4 * r.w * r.h);
  if (squares.length < 3) return null;
  const side = median(squares.map((r) => (r.w + r.h) / 2));
  const tiles = squares.filter((r) => r.w > 0.7 * side && r.w < 1.3 * side && r.h > 0.7 * side);
  if (debug) {
    debug.side = side * 2;
    for (const r of best)
      debug.regions.push({
        cx: r.cx * 2,
        cy: r.cy * 2,
        w: r.w * 2,
        h: r.h * 2,
        fill: r.area / (r.w * r.h),
        used: tiles.includes(r),
      });
  }
  const thrones = best.filter(
    (r) => r.w / r.h > 1.6 && r.w / r.h < 2.5 && r.h > 0.7 * side && r.h < 1.3 * side,
  );
  debug?.wide.push(
    ...best
      .filter((r) => r.w / r.h >= 1.3)
      .map(
        (r) =>
          `${(r.w * 2).toFixed(0)}x${(r.h * 2).toFixed(0)} fill ${(r.area / (r.w * r.h)).toFixed(2)} at ${(r.cx * 2).toFixed(0)},${(r.cy * 2).toFixed(0)}`,
      ),
  );
  if (!thrones.length) return null;
  // throne = the 2:1 region whose art looks like the throne room (red carpet/curtains + blue
  // pillars); two ordinary tiles merged through a ring gap also form a 2:1 region
  const royal = (r: Region) => {
    let hit = 0,
      n = 0;
    const c = Math.cos(r.angle),
      sn = Math.sin(r.angle);
    for (let v = -0.4; v <= 0.4; v += 0.04)
      for (let u = -0.45; u <= 0.45; u += 0.02) {
        const x = Math.round(r.cx + u * r.w * c - v * r.h * sn),
          y = Math.round(r.cy + u * r.w * sn + v * r.h * c);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const p = (y * w + x) * 4;
        const R = img.d[p]!,
          G = img.d[p + 1]!,
          B = img.d[p + 2]!;
        n++;
        if ((R > 120 && R > G * 1.8 && R > B * 1.8) || (B > R + 30 && B > G + 10 && B > 90)) hit++;
      }
    return n ? hit / n : 0;
  };
  const scored = thrones.map((r) => ({ r, s: royal(r) })).sort((a, b) => b.s - a.s);
  debug?.thrones.push(
    ...scored.map(
      ({ r, s }) =>
        `${(r.w * 2).toFixed(0)}x${(r.h * 2).toFixed(0)} royal ${s.toFixed(2)} at ${(r.cx * 2).toFixed(0)},${(r.cy * 2).toFixed(0)}`,
    ),
  );
  if (scored[0]!.s < 0.12) return null;
  const th = scored[0]!.r;
  // lattice angle: median of all tile angles folded to (-45°, 45°] around the throne's long axis
  const fold = (a: number) => {
    let d = a - th.angle;
    while (d > Math.PI / 4) d -= Math.PI / 2;
    while (d <= -Math.PI / 4) d += Math.PI / 2;
    return d;
  };
  const angle = th.angle + median([0, ...tiles.map((r) => fold(r.angle))]);
  const ax: Pt = [Math.cos(angle), Math.sin(angle)];
  const ay: Pt = [Math.sin(angle), -Math.cos(angle)]; // castle up = image up when angle = 0
  // grow the grid from the throne by linking neighbours: tolerant to perspective and scale drift
  const sideOf = (r: Region) => (r === th ? r.h : (r.w + r.h) / 2);
  /** bonus cards and player aids are mostly white paper; tile art never is */
  const cardLike = (r: Region) => {
    let white = 0,
      n = 0;
    const c = Math.cos(r.angle),
      sn = Math.sin(r.angle);
    for (let v = -0.4; v <= 0.4; v += 0.05)
      for (let u = -0.4; u <= 0.4; u += 0.05) {
        const x = Math.round(r.cx + u * r.w * c - v * r.h * sn),
          y = Math.round(r.cy + u * r.w * sn + v * r.h * c);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const p = (y * w + x) * 4;
        const R = img.d[p]!,
          G = img.d[p + 1]!,
          B = img.d[p + 2]!;
        n++;
        if (Math.max(R, G, B) > 190 && Math.max(R, G, B) - Math.min(R, G, B) < 45) white++;
      }
    return n > 0 && white / n > 0.6;
  };
  const cardSet = new Set(tiles.filter(cardLike));
  const coord = new Map<Region, [number, number]>();
  const cellOf = new Map<string, Region>();
  const left: Region = { ...th, cx: th.cx - (ax[0] * side) / 2, cy: th.cy - (ax[1] * side) / 2 };
  const right: Region = { ...th, cx: th.cx + (ax[0] * side) / 2, cy: th.cy + (ax[1] * side) / 2 };
  coord.set(left, [0, 0]);
  coord.set(right, [1, 0]);
  cellOf.set("0,0", left);
  cellOf.set("1,0", right);
  const link = (maxStep: number, tol: number) => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const [from, [fx, fy]] of Array.from(coord)) {
        for (const r of tiles) {
          if (coord.has(r) || cardSet.has(r)) continue;
          const sAvg = (sideOf(from) + sideOf(r)) / 2;
          const dx = r.cx - from.cx,
            dy = r.cy - from.cy;
          const u = (dx * ax[0] + dy * ax[1]) / sAvg,
            v = (dx * ay[0] + dy * ay[1]) / sAvg;
          const ru = Math.round(u),
            rv = Math.round(v);
          const steps = Math.abs(ru) + Math.abs(rv);
          if (steps < 1 || steps > maxStep) continue;
          if (Math.abs(u - ru) > tol || Math.abs(v - rv) > tol) continue;
          const k = `${fx + ru},${fy + rv}`;
          if (cellOf.has(k)) continue;
          coord.set(r, [fx + ru, fy + rv]);
          cellOf.set(k, r);
          changed = true;
        }
      }
    }
  };
  link(1, 0.35);
  link(2, 0.3);
  link(1, 0.35);
  link(3, 0.3);
  link(1, 0.35);
  const blueRing = (r: Region) => {
    // fraction of blue in the band just outside each side of the art hole; a blue-bordered tile is
    // blue on every side, blue artwork spilling into the band is not
    const rw = Math.max(2, Math.round(side * 0.08));
    const c = Math.cos(r.angle),
      s = Math.sin(r.angle);
    const sides: [number, number][][] = [[], [], [], []];
    for (let t = -0.45; t <= 0.45; t += 0.03) {
      sides[0]!.push([t * r.w, -r.h / 2 - rw]);
      sides[1]!.push([t * r.w, r.h / 2 + rw]);
      sides[2]!.push([-r.w / 2 - rw, t * r.h]);
      sides[3]!.push([r.w / 2 + rw, t * r.h]);
    }
    let minFrac = 1;
    for (const pts of sides) {
      let blue = 0,
        n = 0;
      for (const [u, v] of pts) {
        const x = Math.round(r.cx + u * c - v * s),
          y = Math.round(r.cy + u * s + v * c);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const p = (y * w + x) * 4;
        const R = img.d[p]!,
          G = img.d[p + 1]!,
          B = img.d[p + 2]!;
        n++;
        if (B > R + 25 && B > 140 && G > 120) blue++;
      }
      minFrac = Math.min(minFrac, n ? blue / n : 0);
    }
    return minFrac;
  };
  /** the throne's cream rule strip lies at the bottom: mean saturation of the band along the
   * low-y edge (castle down) must be lower than along the high-y edge */
  const stripBelow = (sy: number) => {
    const c = Math.cos(th.angle),
      s = Math.sin(th.angle);
    const sat = (v: number) => {
      let sum = 0,
        n = 0;
      for (let u = -0.4; u <= 0.4; u += 0.02) {
        const x = Math.round(th.cx + u * th.w * c - v * th.h * s),
          y = Math.round(th.cy + u * th.w * s + v * th.h * c);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const p = (y * w + x) * 4;
        const R = img.d[p]!,
          G = img.d[p + 1]!,
          B = img.d[p + 2]!;
        const max = Math.max(R, G, B),
          min = Math.min(R, G, B);
        sum += max ? (max - min) / max : 0;
        n++;
      }
      return n ? sum / n : 0;
    };
    // v > 0 is image-down in the region frame; castle-down = -ay·sy direction. In the region
    // frame the ay axis maps to v = -1 (ay = [sin, -cos] is "up" for angle 0), so the band at
    // v = +0.42 is castle-down when sy = 1.
    const down = sat(0.42 * sy),
      up = sat(-0.42 * sy);
    return up - down; // positive when the low-saturation strip is on the castle-down side
  };
  const blueSet = new Set(tiles.filter((r) => blueRing(r) > 0.35));
  // orientation: mirror candidates (x sign × y sign); blue-bordered tiles never have a tile
  // above them, and castles have more rooms above ground than below
  let bestCells: Map<string, Region> | null = null,
    bestScore = -Infinity,
    bestSx = 1,
    bestSy = 1;
  for (const [sx, sy] of [
    [1, 1],
    [-1, -1],
  ] as [number, number][]) {
    {
      const cells = new Map<string, Region>();
      for (const [r, [x, y]] of coord) {
        if (r === left || r === right) continue;
        cells.set(`${sx === 1 ? x : 1 - x},${sy * y}`, r);
      }
      let violations = 0,
        above = 0,
        below = 0;
      for (const [k, r] of cells) {
        const [x, y] = k.split(",").map(Number) as [number, number];
        if (y > 0) above++;
        if (y < 0) below++;
        if (blueSet.has(r) && cells.has(`${x},${y + 1}`)) violations++;
      }
      const score = stripBelow(sy) * 400 - violations * 30 + (above - below);
      if (score > bestScore) {
        bestScore = score;
        bestCells = cells;
        bestSx = sx;
        bestSy = sy;
      }
    }
  }
  if (!bestCells) return null;
  // tiles whose art is as bright as the border (white halls, ice rooms) leave no hole: infer them
  // from their neighbours — a cell next to an assigned tile that is bright and shows a cream ring
  // around it is a tile. Castles are 4-connected, so this closes the gaps.
  const axc: Pt = [ax[0] * bestSx, ax[1] * bestSx];
  const ayc: Pt = [ay[0] * bestSy, ay[1] * bestSy];
  const inferred = new Set<string>();
  const looksLikeTile = (cx: number, cy: number, s0: number) => {
    // s0 is the art-hole side. Every tile has a thin dark frame line at the hole boundary
    // (a ≈ 0.5), darker than both the art inside and the ring outside, at the same distance all
    // along each side. Wood grain gives random dips, cards and paper none at all.
    const bright = (u: number, v: number) => {
      const x = Math.round(cx + (u * axc[0] + v * ayc[0]) * s0),
        y = Math.round(cy + (u * axc[1] + v * ayc[1]) * s0);
      if (x < 0 || y < 0 || x >= w || y >= h) return -1;
      const p = (y * w + x) * 4;
      return Math.max(img.d[p]!, img.d[p + 1]!, img.d[p + 2]!);
    };
    let sides = 0;
    for (const [du, dv] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const pos: number[] = [];
      let n = 0;
      for (let t = -0.3; t <= 0.3; t += 0.05) {
        let art = 0,
          ring = 0,
          dip = 255,
          at = 0,
          na = 0,
          nr = 0;
        for (let a = 0.36; a <= 0.64; a += 0.01) {
          const b = bright(du ? du * a : t, dv ? dv * a : t);
          if (b < 0) return false;
          if (a < 0.445) {
            art += b;
            na++;
          } else if (a > 0.565) {
            ring += b;
            nr++;
          } else if (b < dip) {
            dip = b;
            at = a;
          }
        }
        n++;
        if (ring / nr > 120 && dip < Math.min(art / na, ring / nr) - 35) pos.push(at);
      }
      if (pos.length / n < 0.6) continue;
      const m = pos.reduce((p, q) => p + q, 0) / pos.length;
      const sd = Math.sqrt(pos.reduce((p, q) => p + (q - m) * (q - m), 0) / pos.length);
      if (sd < 0.02) sides++;
    }
    return sides >= 3;
  };
  for (let pass = 0; pass < 1; pass++) {
    const add: [string, Region][] = [];
    for (const [k, r] of bestCells) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      const s0 = sideOf(r);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nk = `${x + dx},${y + dy}`;
        if (bestCells.has(nk) || (y + dy === 0 && (x + dx === 0 || x + dx === 1))) continue;
        if (add.some(([ak]) => ak === nk)) continue;
        const cx = r.cx + (dx * axc[0] + dy * ayc[0]) * s0,
          cy = r.cy + (dx * axc[1] + dy * ayc[1]) * s0;
        if (!looksLikeTile(cx, cy, s0)) continue;
        // quad = this tile's quad translated by one step
        const quad = r.quad.map(([qx, qy]) => [qx + cx - r.cx, qy + cy - r.cy] as Pt) as [
          Pt,
          Pt,
          Pt,
          Pt,
        ];
        add.push([nk, { ...r, cx, cy, quad, area: 0 }]);
      }
    }
    if (!add.length) break;
    for (const [k, r] of add) {
      bestCells.set(k, r);
      inferred.add(k);
    }
  }
  const axo: Pt = [ax[0] * bestSx, ax[1] * bestSx];
  const ayo: Pt = [ay[0] * bestSy, ay[1] * bestSy];
  // keep the 4-connected group that contains the throne
  const keys = new Set(bestCells.keys());
  keys.add("0,0");
  keys.add("1,0");
  const seen = new Set<string>();
  const stack = ["0,0"];
  while (stack.length) {
    const k = stack.pop()!;
    if (seen.has(k) || !keys.has(k)) continue;
    seen.add(k);
    const [x, y] = k.split(",").map(Number) as [number, number];
    stack.push(`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`);
  }
  // quads in full-resolution coordinates, corners ordered for an upright warp:
  // top-left is the corner at (-ax + ay) direction from the centre
  const upright = (r: Region): [Pt, Pt, Pt, Pt] => {
    const pts = r.quad.map(([x, y]) => [x * 2, y * 2] as Pt);
    const cx = r.cx * 2,
      cy = r.cy * 2;
    const key = (p: Pt, dirx: number, diry: number) =>
      (p[0] - cx) * (axo[0] * dirx + ayo[0] * diry) + (p[1] - cy) * (axo[1] * dirx + ayo[1] * diry);
    const pick = (dirx: number, diry: number) =>
      pts.reduce((a, b) => (key(b, dirx, diry) > key(a, dirx, diry) ? b : a));
    return [pick(-1, 1), pick(1, 1), pick(1, -1), pick(-1, -1)];
  };
  const bbox = (q: [Pt, Pt, Pt, Pt]): [number, number, number, number] => [
    Math.min(...q.map((p) => p[0])),
    Math.min(...q.map((p) => p[1])),
    Math.max(...q.map((p) => p[0])),
    Math.max(...q.map((p) => p[1])),
  ];
  const cells: LocatedCell[] = [];
  for (const [k, r] of bestCells) {
    if (!seen.has(k)) continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    const quad = upright(r);
    cells.push({ x, y, quad, box: bbox(quad), inferred: inferred.has(k) || undefined });
  }
  const tq = upright(th);
  return { cells, throne: { quad: tq, box: bbox(tq) }, tilePx: side * 2, ax: axo, ay: ayo };
}

// ---------- perspective warp ----------

/** homography mapping the unit square (0,0)-(1,1) onto quad (tl, tr, br, bl) */
function squareToQuad(q: [Pt, Pt, Pt, Pt]): number[] {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2,
    dx2 = x3 - x2,
    dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2,
    dy2 = y3 - y2,
    dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1 || 1e-9;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const hh = (dx1 * dy3 - dx3 * dy1) / det;
  return [
    x1 - x0 + g * x1,
    x3 - x0 + hh * x3,
    x0,
    y1 - y0 + g * y1,
    y3 - y0 + hh * y3,
    y0,
    g,
    hh,
    1,
  ];
}

/** warp the quad region of `img` to a size×size (or size*2 × size for wide) upright crop */
export function warpQuad(img: Rgba, q: [Pt, Pt, Pt, Pt], size: number, wide = false): Rgba {
  const ow = wide ? size * 2 : size,
    oh = size;
  const H = squareToQuad(q);
  const d = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++)
    for (let x = 0; x < ow; x++) {
      const u = (x + 0.5) / ow,
        v = (y + 0.5) / oh;
      const den = H[6]! * u + H[7]! * v + H[8]!;
      const sx = (H[0]! * u + H[1]! * v + H[2]!) / den;
      const sy = (H[3]! * u + H[4]! * v + H[5]!) / den;
      const x0 = Math.floor(sx),
        y0 = Math.floor(sy);
      const o = (y * ow + x) * 4;
      d[o + 3] = 255;
      if (x0 < 0 || y0 < 0 || x0 >= img.w - 1 || y0 >= img.h - 1) continue;
      const fx = sx - x0,
        fy = sy - y0;
      const i00 = (y0 * img.w + x0) * 4,
        i10 = i00 + 4,
        i01 = i00 + img.w * 4,
        i11 = i01 + 4;
      for (let c = 0; c < 3; c++)
        d[o + c] =
          img.d[i00 + c]! * (1 - fx) * (1 - fy) +
          img.d[i10 + c]! * fx * (1 - fy) +
          img.d[i01 + c]! * (1 - fx) * fy +
          img.d[i11 + c]! * fx * fy;
    }
  return { w: ow, h: oh, d };
}
