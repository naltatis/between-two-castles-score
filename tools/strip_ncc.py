"""Throne/ballroom variant by normalized cross-correlation of icon templates over the rule strip.
usage: python strip_ncc.py VARIANTS_DIR OUT_DIR"""
import sys, os, json, cv2, numpy as np
d, out = sys.argv[1], sys.argv[2]; REF_HOLE = 1 / 1.229; HS = 24
TPL = {'throne': (0.28, 0.56), 'ballroom': (0.22, 0.52)}  # icon x-range inside the band (fractions)
def hole(img):
    h, w = img.shape[:2]; m, n = int(w * (1 - REF_HOLE) / 2), int(h * (1 - REF_HOLE) / 2); return img[n:h - n, m:w - m]
def strip_rows(b):
    bg = np.median(b.reshape(-1, 3), axis=0); dist = np.linalg.norm(np.median(b, axis=1) - bg, axis=1); ok = dist < 50
    best, cur = (0, 0), None
    for i, o in enumerate(list(ok) + [False]):
        if o and cur is None: cur = i
        if not o and cur is not None:
            if i - cur > best[1] - best[0]: best = (cur, i)
            cur = None
    return best if best[1] - best[0] >= 0.4 * b.shape[0] else (0, b.shape[0])
def band(hole_img):
    """rule strip, scaled to HS px high, full width right of the hole's left 12 %"""
    h, w = hole_img.shape[:2]; b = hole_img[int(h * 0.78):h, int(w * 0.12):int(w * 0.98)]
    r0, r1 = strip_rows(b); s = b[r0:r1]
    return cv2.resize(s, (int(s.shape[1] * HS / s.shape[0]), HS), interpolation=cv2.INTER_AREA)
def template(bd, kind):
    x0, x1 = TPL[kind]; w = bd.shape[1]; return bd[int(HS * 0.12):int(HS * 0.88), int(w * x0):int(w * x1)]
labels = {}
for f in ('throne_labels.json', 'ballroom_labels.json'): labels.update(json.load(open(os.path.join(d, f))))
items = []
for f, tid in sorted(labels.items()):
    kind = 'throne' if tid.startswith('throne') else 'ballroom'; bd = band(hole(cv2.imread(os.path.join(d, f))))
    items.append((f, tid, kind, bd, template(bd, kind)))
# template sheet for a visual check
rows = [np.hstack([cv2.resize(t, (200, 40)), np.zeros((40, 4, 3), np.uint8)]) for _, _, _, _, t in items]
cv2.imwrite(os.path.join('/private/tmp/claude-501/-Users-michael-Lab-between-two-castles-score/967573cb-69a8-480b-ada6-7994dc18e4e8/scratchpad', 'tpl_sheet.jpg'), np.vstack([np.hstack(rows[i:i + 4]) if len(rows[i:i + 4]) == 4 else np.hstack(rows[i:i + 4] + [np.zeros((40, 204 * (4 - len(rows[i:i + 4])), 3), np.uint8)]) for i in range(0, len(rows), 4)]))
ok = 0; wrong = []
for i, (f, tid, kind, bd, _) in enumerate(items):
    best, bid = -2, None
    for j, (f2, tid2, kind2, _, tpl) in enumerate(items):
        if i == j or kind != kind2 or tpl.shape[1] > bd.shape[1] or tpl.shape[0] > bd.shape[0]: continue
        s = float(cv2.matchTemplate(bd, tpl, cv2.TM_CCOEFF_NORMED).max())
        if s > best: best, bid = s, tid2
    ok += bid == tid
    if bid != tid: wrong.append((f[4:12], tid, bid, round(best, 2)))
print('NCC LOO accuracy', ok, '/', len(items)); print(wrong[:12])
for f in sorted(os.listdir(d)):
    if f.startswith('IMG_0204') and f.endswith('.jpg'):
        bd = band(hole(cv2.imread(os.path.join(d, f)))); best, bid = -2, None
        for _, tid2, kind2, _, tpl in items:
            if kind2 != 'ballroom' or tpl.shape[1] > bd.shape[1]: continue
            s = float(cv2.matchTemplate(bd, tpl, cv2.TM_CCOEFF_NORMED).max())
            if s > best: best, bid = s, tid2
        print(f, '->', bid, round(best, 2))
