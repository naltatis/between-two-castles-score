"""Cut individual tiles/cards out of reference-sheet photos (tiles laid out on a dark table).

usage: python crop_refs.py OUTDIR IMG.jpeg [...]
writes OUTDIR/<img>/<nn>.jpg (rectified crops) + OUTDIR/<img>_sheet.jpg (indexed contact sheet)
"""
import sys, os, json
import cv2, numpy as np

W = 3000


def ring_mask(img, v_min, s_max):
    """tile border rings: cream (bright, low saturation) or light blue (outdoor rooms, towers, fountains)"""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, sat, v = cv2.split(hsv)
    cream = (v > v_min) & (sat < s_max)
    blue = (h > 85) & (h < 120) & (sat > 50) & (v > v_min - 20)
    m = (cream | blue).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9)))  # drop bright art speckles
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))  # heal ring breaks
    return m


def best_quads(img):
    """ponytail: self-tuning thresholds — the setting that yields the most tile-shaped holes wins"""
    best = []
    for v_min in (100, 130, 160):
        for s_max in (80, 110, 140):
            q = quads(ring_mask(img, v_min, s_max), 100, 2900)  # close-ups: one tile may fill the frame
            if len(q) > len(best):
                best = q
    return best


def rect_of(c):
    (cx, cy), (w, h), ang = cv2.minAreaRect(c)
    if w < h:
        w, h, ang = h, w, ang + 90
    ang = ang % 180
    if ang > 90:
        ang -= 180
    return cx, cy, w, h, ang


def quads(mask, min_side, max_side):
    """tiles = holes of the cream mask (the art enclosed by a tile's cream ring) whose parent blob is mostly holes;
    bonus cards = outer cream blobs with card proportions that are mostly solid"""
    cnts, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hier is None:
        return []
    hole_area = {}
    for i, c in enumerate(cnts):
        p = hier[0][i][3]
        if p != -1:
            hole_area[p] = hole_area.get(p, 0) + cv2.contourArea(c)
    holes, cards = [], []
    for i, c in enumerate(cnts):
        cx, cy, w, h, ang = rect_of(c)
        p = hier[0][i][3]
        area = cv2.contourArea(c)
        if p == -1:
            outer_area = area + 1e-6
            if 1.25 < w / h < 1.6 and h > min_side and hole_area.get(i, 0) / outer_area < 0.5 and area > 0.8 * w * h:
                cards.append((cx, cy, w, h, ang))
            continue
        if h < min_side or h > max_side or area < 0.85 * w * h:
            continue
        parent_area = cv2.contourArea(cnts[p]) + 1e-6
        if hole_area.get(p, 0) / parent_area < 0.5:
            continue  # a hole inside a card or ornament, not a tile
        holes.append((cx, cy, w, h, ang))
    out = []
    if holes:
        side = np.median([q[3] for q in holes])
        for cx, cy, w, h, ang in holes:
            if not (0.8 * side < h < 1.25 * side):
                continue
            a = w / h
            if not (0.8 < a < 1.25 or 1.7 < a < 2.4):
                continue
            if a < 1.25:
                ang = (ang + 45) % 90 - 45
            g = 0.09 * h
            out.append(((cx, cy), (w + 2 * g, h + 2 * g), ang, a > 1.5))
    for cx, cy, w, h, ang in cards:
        out.append(((cx, cy), (w * 1.06, h * 1.06), ang, False))
    return out


def crop(full, scale, q, size=512):
    (cx, cy), (w, h), ang, wide = q
    cw, ch = (size * 2, size) if wide else (size, size)
    M = cv2.getRotationMatrix2D((cx * scale, cy * scale), ang, 1)
    M[0, 2] += cw / 2 - cx * scale
    M[1, 2] += ch / 2 - cy * scale
    s = min(cw / (w * scale), ch / (h * scale)) * 0.96
    M[:, :2] *= s
    M[0, 2] = M[0, 2] * s + cw / 2 * (1 - s)
    M[1, 2] = M[1, 2] * s + ch / 2 * (1 - s)
    return cv2.warpAffine(full, M, (cw, ch), flags=cv2.INTER_AREA)


def upright(c, wide, card=False):
    """rotate so the gold star sits at the bottom (tiles) / top (bonus cards);
    secret rooms have no star: their teal name banner goes to the top"""
    hsv = cv2.cvtColor(c, cv2.COLOR_BGR2HSV)

    def frac(im, lo, hi, smin, vmin):
        return float(((im[..., 0] >= lo) & (im[..., 0] <= hi) & (im[..., 1] > smin) & (im[..., 2] > vmin)).mean())

    def bands(k):
        r = np.rot90(hsv, k)
        hh, ww = r.shape[:2]
        x0, x1 = int(ww * 0.1), int(ww * 0.9)
        return r[int(hh * 0.04):int(hh * 0.22), x0:x1], r[int(hh * 0.78):int(hh * 0.96), x0:x1]

    rots = [0, 2] if wide else [0, 1, 2, 3]
    gold = {k: [frac(b, 12, 35, 110, 120) for b in bands(k)] for k in rots}
    if card:
        best = max(rots, key=lambda k: gold[k][0] - gold[k][1])
    elif max(max(g) for g in gold.values()) > 0.01:
        best = max(rots, key=lambda k: gold[k][1] - gold[k][0])
    else:
        teal = {k: [frac(b, 78, 100, 60, 80) for b in bands(k)] for k in rots}
        best = max(rots, key=lambda k: teal[k][0] - teal[k][1])
    return np.ascontiguousarray(np.rot90(c, best))


def process(path, outdir):
    full = cv2.imread(path)
    scale = full.shape[1] / W
    img = cv2.resize(full, (W, int(full.shape[0] / scale)), interpolation=cv2.INTER_AREA)
    found = best_quads(img)
    # sort reading order: rows by y (tolerance half a tile), then x
    if not found:
        return []
    med = np.median([q[1][1] for q in found])
    found.sort(key=lambda q: (round(q[0][1] / (med * 0.7)), q[0][0]))
    name = os.path.splitext(os.path.basename(path))[0]
    d = os.path.join(outdir, name)
    os.makedirs(d, exist_ok=True)
    crops = []
    for n, q in enumerate(found):
        is_card = q[1][0] / q[1][1] > 1.25 and not q[3]
        c = upright(crop(full, scale, q), q[3], is_card)
        cv2.imwrite(os.path.join(d, f'{n:02d}.jpg'), c, [cv2.IMWRITE_JPEG_QUALITY, 90])
        crops.append(c)
    # contact sheet: 6 per row, 230px, index label
    T = 230
    rows = []
    for r in range(0, len(crops), 6):
        row = []
        for j, c in enumerate(crops[r:r + 6]):
            cell = np.full((T + 24, T * (2 if c.shape[1] > c.shape[0] else 1), 3), 30, np.uint8)
            im = cv2.resize(c, (cell.shape[1], T))
            cell[24:] = im
            cv2.putText(cell, f'{name[-4:]}/{r + j:02d}', (4, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            row.append(cell)
        width = sum(x.shape[1] for x in row)
        rows.append(np.hstack(row) if len(row) else None)
    wmax = max(r.shape[1] for r in rows)
    rows = [np.hstack([r, np.full((r.shape[0], wmax - r.shape[1], 3), 30, np.uint8)]) for r in rows]
    cv2.imwrite(os.path.join(outdir, f'{name}_sheet.jpg'), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 80])
    return [{'n': n, 'px': int(q[1][1] * scale), 'wide': q[3]} for n, q in enumerate(found)]


if __name__ == '__main__':
    outdir = sys.argv[1]
    os.makedirs(outdir, exist_ok=True)
    summary = {}
    for p in sys.argv[2:]:
        r = process(p, outdir)
        summary[os.path.basename(p)] = r
        print(os.path.basename(p), len(r), 'tiles', 'median px', int(np.median([x['px'] for x in r])) if r else 0, 'wide', sum(x['wide'] for x in r))
    json.dump(summary, open(os.path.join(outdir, 'summary.json'), 'w'))
