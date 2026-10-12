"""Harvest extra reference crops from benchmark castle photos (Python detections in det dirs +
ground truth). Each crop is the tile's art hole (plus the usual 9 % margin like crop_refs output),
saved to OUT_DIR/<photo>_<x>_<y>.jpg and appended to OUT_DIR/linked.json with a `src` photo tag.
usage: python harvest_refs.py TRUTH_JSON OUT_DIR DET_DIR [DET_DIR ...]"""
import sys, os, json, glob, cv2, numpy as np
import crop_refs as C
truth, out = json.load(open(sys.argv[1])), sys.argv[2]; dets = sys.argv[3:]
os.makedirs(out, exist_ok=True)
def holes(rot, s):
    best = []
    for v_min in (100, 130, 160):
        for s_max in (80, 110, 140):
            m = C.ring_mask(rot, v_min, s_max); cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
            if hier is None: continue
            o = []
            for i, c in enumerate(cnts):
                if hier[0][i][3] == -1: continue
                x, y, w, h = cv2.boundingRect(c)
                if 0.55 * s < w < 1.05 * s and 0.55 * s < h < 1.05 * s and cv2.contourArea(c) > 0.7 * w * h: o.append((x, y, w, h))
            if len(o) > len(best): best = o
    return best
linked = []
for name, t in truth.items():
    cells = t['cells']
    for det in dets:
        p = os.path.join(det, name + '.json')
        if not os.path.exists(p): continue
        info = json.load(open(p)); rot = cv2.imread(os.path.join(det, name + '_aligned.jpg'))
        s = info['tile_px']; hs = holes(rot, s); k = ((3 if info['sideways'] else 0) + (2 if info['flipped'] else 0)) % 4
        n = 0
        for key, tid in cells.items():
            if tid == 'ballroom': continue
            box = info['cells_px'].get(key)
            if not box: continue
            a, c, e, d = box; cx, cy = (a + e) / 2, (c + d) / 2
            cand = [h for h in hs if h[0] < cx < h[0] + h[2] and h[1] < cy < h[1] + h[3]]
            if not cand: continue
            x, y, w, h = cand[0]; g = int(0.09 * h)
            x0, y0, x1, y1 = max(0, x - g), max(0, y - g), min(rot.shape[1], x + w + g), min(rot.shape[0], y + h + g)
            crop = np.ascontiguousarray(np.rot90(rot[y0:y1, x0:x1], k))
            if cv2.Laplacian(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var() < 60: continue  # blurry
            f = f'{name}_{key.replace(",", "_")}.jpg'; cv2.imwrite(os.path.join(out, f), crop, [cv2.IMWRITE_JPEG_QUALITY, 92])
            linked.append({'file': f, 'tile': tid, 'conf': 1.0, 'src': name}); n += 1
        print(name, n, 'crops'); break
json.dump(linked, open(os.path.join(out, 'linked.json'), 'w'), indent=0)
from collections import Counter
print(len(linked), 'harvested;', len(Counter(l['tile'] for l in linked)), 'tiles')
