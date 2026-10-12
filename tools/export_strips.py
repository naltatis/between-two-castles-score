"""Export rule-strip templates for throne rooms and ballrooms (variants differ only by the icons in
the strip). Matching = normalized cross-correlation of the template over the strip in a
colour-weighted YCbCr space (Y halved). usage: python export_strips.py VARIANTS_DIR OUT_DIR"""
import sys, os, json, cv2, numpy as np
d, out = sys.argv[1], sys.argv[2]; REF_HOLE = 1 / 1.229; HS = 24
TPL = {'throne': (0.28, 0.56), 'ballroom': (0.22, 0.52)}
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
    h, w = hole_img.shape[:2]; b = hole_img[int(h * 0.78):h, int(w * 0.12):int(w * 0.98)]
    r0, r1 = strip_rows(b); s = b[r0:r1]
    return cv2.resize(s, (int(s.shape[1] * HS / s.shape[0]), HS), interpolation=cv2.INTER_AREA)
def ycc(bgr):
    f = bgr.astype(np.float32); B, G, R = f[..., 0], f[..., 1], f[..., 2]
    Y = 0.299 * R + 0.587 * G + 0.114 * B
    return np.dstack([0.5 * Y, B - Y, R - Y])
def template(bd, kind):
    x0, x1 = TPL[kind]; w = bd.shape[1]; return bd[int(HS * 0.12):int(HS * 0.88), int(w * x0):int(w * x1)]
labels = {}
for f in ('throne_labels.json', 'ballroom_labels.json'): labels.update(json.load(open(os.path.join(d, f))))
items = []
for f, tid in sorted(labels.items()):
    kind = 'throne' if tid.startswith('throne') else 'ballroom'; bd = ycc(band(hole(cv2.imread(os.path.join(d, f)))))
    items.append((f, tid, kind, bd, template(bd, kind)))
ok = 0; wrong = []
for i, (f, tid, kind, bd, _) in enumerate(items):
    best, bid = -2, None
    for j, (_, tid2, kind2, _, tpl) in enumerate(items):
        if i == j or kind != kind2 or tpl.shape[1] > bd.shape[1]: continue
        s = float(cv2.matchTemplate(bd, tpl, cv2.TM_CCOEFF_NORMED).max())
        if s > best: best, bid = s, tid2
    ok += bid == tid
    if bid != tid: wrong.append((tid, bid))
print('YCbCr NCC LOO', ok, '/', len(items), wrong)
if __name__ == '__main__' and len(sys.argv) > 2:
    entries, blobs, off = [], [], 0
    for f, tid, kind, _, tpl in items:
        q = np.clip(np.round(tpl), -127, 127).astype(np.int8); blobs.append(q.tobytes())
        entries.append({'id': tid, 'kind': kind, 'w': int(tpl.shape[1]), 'h': int(tpl.shape[0]), 'offset': off}); off += q.size
    open(os.path.join(out, 'strips.bin'), 'wb').write(b''.join(blobs))
    json.dump({'hs': HS, 'entries': entries}, open(os.path.join(out, 'strips.json'), 'w'))
    print('written', len(entries), 'templates,', off // 1024, 'KB')
