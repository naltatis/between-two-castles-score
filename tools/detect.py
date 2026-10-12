"""Phase 0 spike: find tiles + grid in a castle photo. Classic OpenCV, no ML.

usage: python detect.py IMG.jpeg [outdir]
writes <outdir>/<name>_grid.jpg (annotated), <outdir>/<name>_cells/<x>_<y>.jpg crops,
prints a JSON summary.
"""
import sys, json, os
import cv2, numpy as np

W = 3000  # working width
L = 80    # min straight cream line length (px) to count as a tile border


def load(path):
    img = cv2.imread(path)
    s = W / img.shape[1]
    return cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)


def cream_mask(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    _, s, v = cv2.split(hsv)
    return ((v > 150) & (s < 90)).astype(np.uint8) * 255


def detrend(p, k=301):
    return p - cv2.blur(p.reshape(-1, 1).astype(np.float32), (1, k)).ravel()


def axis_angles(cm):
    """tilt of the vertical and of the horizontal tile borders, each in (-45, 45]:
    the rotation at which that axis-aligned straight-line mask is most periodic"""
    small = cv2.resize(cm, None, fx=1 / 3, fy=1 / 3, interpolation=cv2.INTER_AREA)
    small = (small > 127).astype(np.uint8) * 255
    h, w = small.shape
    kl = L // 3
    kv = cv2.getStructuringElement(cv2.MORPH_RECT, (1, kl))
    kh = cv2.getStructuringElement(cv2.MORPH_RECT, (kl, 1))

    def periodicity(p):
        p = detrend(p, 101)
        ac = np.correlate(p, p, 'full')[len(p) - 1:]
        return ac[50:170].max() / (ac[0] + 1e-6)

    def energy(a):
        M = cv2.getRotationMatrix2D((w / 2, h / 2), a, 1)
        r = cv2.warpAffine(small, M, (w, h), flags=cv2.INTER_NEAREST)
        v = cv2.morphologyEx(r, cv2.MORPH_OPEN, kv).sum(axis=0) / 255.0
        hh = cv2.morphologyEx(r, cv2.MORPH_OPEN, kh).sum(axis=1) / 255.0
        return periodicity(v), periodicity(hh)

    coarse = np.arange(-45, 45, 1.0)
    e = np.array([energy(a) for a in coarse])
    out = []
    for k in (0, 1):
        best = coarse[int(np.argmax(e[:, k]))]
        fine = np.arange(best - 1, best + 1.01, 0.25)
        out.append(float(fine[int(np.argmax([energy(a)[k] for a in fine]))]))
    return out  # [angle making vertical borders vertical, angle making horizontal borders horizontal]


def align(img):
    """affine-rectify so both border families are axis aligned (rotation + shear).
    ponytail: affine only; strong perspective (non-parallel borders) needs a homography"""
    av, ah = axis_angles(cream_mask(img))
    h, w = img.shape[:2]
    Rv = cv2.getRotationMatrix2D((0, 0), av, 1)[:, :2]
    Rh = cv2.getRotationMatrix2D((0, 0), ah, 1)[:, :2]
    dir_v = np.linalg.inv(Rv) @ np.array([0.0, 1.0])  # image direction of vertical borders
    dir_h = np.linalg.inv(Rh) @ np.array([1.0, 0.0])  # image direction of horizontal borders
    T = np.linalg.inv(np.column_stack([dir_h, dir_v]))
    c = np.array([w / 2, h / 2])
    M = np.hstack([T, (c - T @ c).reshape(2, 1)])
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR), (av, ah)


def line_masks(cm):
    v = cv2.morphologyEx(cm, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, L)))
    h = cv2.morphologyEx(cm, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (L, 1)))
    return v, h


def castle_bbox(v, h):
    m = cv2.dilate(v | h, cv2.getStructuringElement(cv2.MORPH_RECT, (121, 121)))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    i = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    x, y, w, hh = stats[i, :4]
    return x, y, x + w, y + hh


def period(p, lo=150, hi=500):
    ac = np.correlate(p, p, 'full')[len(p) - 1:]
    return lo + int(np.argmax(ac[lo:hi]))


def grid_lines(p, s, lo, hi):
    """tile border positions: walk from the strongest peak in steps of ~s, snapping to peaks;
    one extra step past the bbox on each side (empty cells are dropped later)"""
    sm = cv2.GaussianBlur(p.astype(np.float32), (1, 9), 0).ravel()
    n = len(sm)
    start = int(np.argmax(sm))
    thr = sm[start] * 0.15
    lines = [start]
    for d in (1, -1):
        pos = start
        while True:
            a, b = int(pos + d * s * 0.8), int(pos + d * s * 1.2)
            a, b = max(0, min(a, b)), min(n - 1, max(a, b))
            if b - a < 3 or (d > 0 and a > hi + s) or (d < 0 and b < lo - s):
                break
            k = a + int(np.argmax(sm[a:b]))
            pos = k if sm[k] > thr else int(pos + d * s)
            lines.append(int(pos))
    return sorted(lines)


def components(occ):
    """4-connected groups of cells; returns the largest"""
    occ = set(occ)
    best = set()
    seen = set()
    for c in occ:
        if c in seen:
            continue
        grp, stack = set(), [c]
        while stack:
            p = stack.pop()
            if p in seen or p not in occ:
                continue
            seen.add(p)
            grp.add(p)
            i, j = p
            stack += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
        if len(grp) > len(best):
            best = grp
    return best


def border_strength(vl, hl, gx, gy, s, a, b):
    """fraction of the shared edge between cells a and b that carries a straight cream line"""
    (i, j), (k, l) = a, b
    if j == l:  # horizontal neighbours → vertical border at gx[max(i,k)]
        x = gx[max(i, k)]
        band = vl[gy[j] + s // 5: gy[j + 1] - s // 5, max(0, x - s // 6): x + s // 6]
        return float(band.max(axis=1).mean() / 255)
    y = gy[max(j, l)]
    band = hl[max(0, y - s // 6): y + s // 6, gx[i] + s // 5: gx[i + 1] - s // 5]
    return float(band.max(axis=0).mean() / 255)


def detect(path, outdir):
    img = load(path)
    rot, ang = align(img)
    cm = cream_mask(rot)
    vl, hl = line_masks(cm)
    x0, y0, x1, y1 = castle_bbox(vl, hl)
    px = detrend(vl[y0:y1].sum(axis=0) / 255.0)
    py = detrend(hl[:, x0:x1].sum(axis=1) / 255.0)
    s = (period(px) + period(py)) // 2
    gx = grid_lines(px, s, x0, x1)
    gy = grid_lines(py, s, y0, y1)
    gray = cv2.cvtColor(rot, cv2.COLOR_BGR2GRAY)
    m = int(s * 0.1)
    hsv = cv2.cvtColor(rot, cv2.COLOR_BGR2HSV)
    blue = ((hsv[..., 0] > 90) & (hsv[..., 0] < 115) & (hsv[..., 1] > 60) & (hsv[..., 2] > 120)).astype(np.uint8)

    def edge_cov(mask, y0_, y1_, x0_, x1_, axis):
        band = mask[max(0, y0_):y1_, max(0, x0_):x1_]
        return float(band.max(axis=axis).mean() / 255) if band.size else 0.0

    occ, info = {}, {}
    for j in range(len(gy) - 1):
        for i in range(len(gx) - 1):
            a, c, e, d = gx[i], gy[j], gx[i + 1], gy[j + 1]
            if a < 0 or c < 0 or e > gray.shape[1] or d > gray.shape[0]:
                continue
            tex = float(gray[c + m:d - m, a + m:e - m].std())
            q, r = s // 5, s // 8
            edges = sum(cov > 0.5 for cov in (
                edge_cov(vl, c + q, d - q, a - r, a + r, 1), edge_cov(vl, c + q, d - q, e - r, e + r, 1),
                edge_cov(hl, c - r, c + r, a + q, e - q, 0), edge_cov(hl, d - r, d + r, a + q, e - q, 0)))
            info[(i, j)] = (edges, tex)
            if edges >= 3 and tex > 25:  # cream border lines on 3+ sides = tile
                occ[(i, j)] = tex
    cells = components(occ)
    # throne room = the one pair of adjacent cells with no cream border between them
    pairs = []
    for (i, j) in cells:
        for nb in ((i + 1, j), (i, j + 1)):
            if nb in cells:
                pairs.append((border_strength(vl, hl, gx, gy, s, (i, j), nb), (i, j), nb))
    pairs.sort()
    weakest, ta, tb = pairs[0]
    second = pairs[1][0] if len(pairs) > 1 else 1.0
    sideways = ta[0] == tb[0]  # pair is vertical → castle is photographed sideways
    # grid coordinates relative to throne: throne cells (0,0),(1,0); +y = up
    def to_castle(c):
        i, j = c
        if sideways:  # castle-up = image-left: rotate 90° CW → top cell of the pair lands at x=1
            return (ta[1] + 1 - j, -(i - ta[0]))
        return (i - ta[0], -(j - ta[1]))
    rel = {to_castle(c): c for c in cells}
    k_up = 3 if sideways else 0  # rot90 count that makes castle-up point up, before any flip

    def blue_ring(c):
        """blue fraction of the outer border ring only (art inside tiles is often blue too)"""
        i, j = c
        cell = blue[gy[j]:gy[j + 1], gx[i]:gx[i + 1]]
        w = max(2, int(s * 0.06))
        ring = np.concatenate([cell[:w].ravel(), cell[-w:].ravel(), cell[:, :w].ravel(), cell[:, -w:].ravel()])
        return float(ring.mean())

    votes = 0.0
    for (x, y), c in rel.items():
        if blue_ring(c) > 0.25:
            votes += ((x, y + 1) in rel) * -1 + ((x, y - 1) in rel) * 1  # neighbour must be below
    if votes == 0:
        votes = sum(1 for (x, y) in rel if y > 0) - sum(1 for (x, y) in rel if y < 0)
    flipped = votes < 0
    if flipped:
        rel = {(1 - x, -y): c for (x, y), c in rel.items()}
    k_crop = (k_up + (2 if flipped else 0)) % 4
    # outputs
    name = os.path.splitext(os.path.basename(path))[0]
    cdir = os.path.join(outdir, f'{name}_cells')
    os.makedirs(cdir, exist_ok=True)
    vis = rot.copy()
    for x in gx:
        cv2.line(vis, (x, gy[0]), (x, gy[-1]), (255, 0, 0), 2)
    for y in gy:
        cv2.line(vis, (gx[0], y), (gx[-1], y), (255, 0, 0), 2)
    for (x, y), (i, j) in rel.items():
        a, c, e, d = gx[i], gy[j], gx[i + 1], gy[j + 1]
        col = (0, 0, 255) if (x, y) in ((0, 0), (1, 0)) else (0, 255, 0)
        cv2.rectangle(vis, (a + 6, c + 6), (e - 6, d - 6), col, 6)
        cv2.putText(vis, f"{x},{y}", (a + 20, c + 70), cv2.FONT_HERSHEY_SIMPLEX, 1.6, col, 4)
        crop = np.rot90(rot[c:d, a:e], k_crop)
        cv2.imwrite(os.path.join(cdir, f'{x}_{y}.jpg'), crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
    cv2.imwrite(os.path.join(outdir, f'{name}_grid.jpg'), vis, [cv2.IMWRITE_JPEG_QUALITY, 80])
    cv2.imwrite(os.path.join(outdir, f'{name}_aligned.jpg'), rot, [cv2.IMWRITE_JPEG_QUALITY, 85])
    out = {'file': name, 'angles': [round(a, 2) for a in ang], 'tile_px': int(s), 'sideways': sideways, 'flipped': bool(flipped), 'orient_votes': round(float(votes), 1),
           'cells': len(cells), 'rejected': len(occ) - len(cells), 'edges': {f'{i},{j}': v[0] for (i, j), v in info.items() if v[0] >= 2}, 'throne_border': round(weakest, 2),
           'next_border': round(second, 2), 'grid': sorted(rel),
           'cells_px': {f'{x},{y}': [int(gx[i]), int(gy[j]), int(gx[i + 1]), int(gy[j + 1])] for (x, y), (i, j) in rel.items()},
           'size_px': [rot.shape[1], rot.shape[0]]}
    print(json.dumps(out))
    return out


if __name__ == '__main__':
    out = sys.argv[2] if len(sys.argv) > 2 else '.'
    os.makedirs(out, exist_ok=True)
    detect(sys.argv[1], out)
