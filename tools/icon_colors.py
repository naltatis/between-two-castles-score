"""Rule-strip icon classification: the icons are coloured squares (~0.6 strip heights) right of the
gold star; classify each square by its box colour. usage: python icon_colors.py VARIANTS_DIR"""
import sys, os, json, cv2, numpy as np
d = sys.argv[1]; REF_HOLE = 1 / 1.229
def hole(img):
    h, w = img.shape[:2]; m, n = int(w * (1 - REF_HOLE) / 2), int(h * (1 - REF_HOLE) / 2); return img[n:h - n, m:w - m]
def classify(h, s, v):
    if 135 <= h <= 175 and s > 50: return 'living'
    if 95 <= h < 135 and s > 50: return 'sleeping'
    if 38 <= h < 95 and s > 50: return 'outdoor'
    if 17 <= h < 38 and s > 80 and v > 150: return 'food'
    if (h < 17 or h > 175) and s > 100 and v > 150: return 'utility'
    if v < 120 and s < 140: return 'activity' if 5 <= h < 25 and s > 40 else 'downstairs'
    if s < 70 and v >= 120: return 'corridor'
    return '?'
def strip_rows(b):
    """rows belonging to the cream strip: row median close to the band's median colour"""
    bg = np.median(b.reshape(-1, 3), axis=0)
    rm = np.median(b, axis=1); dist = np.linalg.norm(rm - bg, axis=1)
    ok = dist < 50
    # longest run of ok rows
    best, cur = (0, 0), None
    for i, o in enumerate(list(ok) + [False]):
        if o and cur is None: cur = i
        if not o and cur is not None:
            if i - cur > best[1] - best[0]: best = (cur, i)
            cur = None
    return best, bg
def icons(hole_img, kind, dbg=False):
    h, w = hole_img.shape[:2]
    b = hole_img[int(h * 0.78):h, int(w * 0.12):int(w * 0.98)]
    (r0, r1), bg = strip_rows(b)
    if r1 - r0 < 0.4 * b.shape[0]: r0, r1 = 0, b.shape[0]
    strip = b[r0:r1]; hs, ws = strip.shape[:2]
    dist = np.linalg.norm(strip.astype(np.float32) - bg, axis=2)
    non = (dist > 45).astype(np.uint8)
    non = cv2.morphologyEx(non, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n, lab, st, cen = cv2.connectedComponentsWithStats(non)
    hsv = cv2.cvtColor(strip, cv2.COLOR_BGR2HSV)
    sq = []
    for i in range(1, n):
        x, y, bw, bh, a = st[i]
        if bh < 0.42 * hs or bh > 1.0 * hs or bw < 0.35 * hs or bw > 1.3 * hs: continue
        med = np.median(hsv[lab == i].reshape(-1, 3), axis=0)
        sq.append((x, bw, bh, [int(v) for v in med]))
    sq.sort(key=lambda t: t[0])
    # star: first square-ish gold blob
    gi = next((k for k, t in enumerate(sq) if 8 <= t[3][0] <= 35 and t[3][1] > 50 and t[3][2] > 120), None)
    cand = sq[gi + 1:] if gi is not None else sq
    out = [classify(*t[3]) for t in cand]
    out = [c for c in out if c != '?']
    return out[:2 if kind == 'throne' else 1], (gi, [(int(t[0]), int(t[1]), int(t[2]), t[3]) for t in sq])
labels = {}
for f in ('throne_labels.json', 'ballroom_labels.json'): labels.update(json.load(open(os.path.join(d, f))))
ok = 0; bad = []
for f, tid in sorted(labels.items()):
    kind = 'throne' if tid.startswith('throne') else 'ballroom'
    got, info = icons(hole(cv2.imread(os.path.join(d, f))), kind)
    pred = kind + '-' + '-'.join(got)
    if pred == tid: ok += 1
    else: bad.append((f[4:12], tid, got, info))
print('accuracy', ok, '/', len(labels))
for b in bad[:16]: print(b)
for f in sorted(os.listdir(d)):
    if f.startswith('IMG_0204') and f.endswith('.jpg'): print(f, icons(hole(cv2.imread(os.path.join(d, f))), 'ballroom')[0])
