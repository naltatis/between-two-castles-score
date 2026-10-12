"""Export the identification reference table: 16×16 RGB z-scored thumbnails of every linked crop.
usage: python export_refs.py LABELED_DIR OUT_DIR → OUT_DIR/refs.bin (int8, n×768) + OUT_DIR/refs.json (ids)"""
import sys, os, json
import cv2, numpy as np
SRCS, out = sys.argv[1:-1], sys.argv[-1]
S = 16
L = [dict(l, _dir=d) for d in SRCS for l in json.load(open(d + '/linked.json'))]
rows, ids, srcs = [], [], []
for l in L:
    img = cv2.imread(os.path.join(l['_dir'], l['file']))
    if img.shape[1] > img.shape[0] * 1.5:
        continue  # thrones: not identified by thumbnail
    h, w = img.shape[:2]  # keep only the art hole: the crops hold hole + 9% margin scaled by 0.96
    m, n = int(w * (1 - 0.8 / 1.229) / 2), int(h * (1 - 0.8 / 1.229) / 2)  # central 80 % of the hole
    im = cv2.cvtColor(cv2.resize(img[n:h - n, m:w - m], (S, S), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB)
    v = im.astype(np.float32).reshape(-1)
    v = (v - v.mean()) / (v.std() + 1e-6)
    rows.append(np.clip(np.round(v * 40), -127, 127).astype(np.int8))
    ids.append(l['tile']); srcs.append(l.get('src', ''))
np.stack(rows).tofile(os.path.join(out, 'refs.bin'))
json.dump({'size': S, 'ids': ids, 'srcs': srcs}, open(os.path.join(out, 'refs.json'), 'w'))
print(len(ids), 'rows,', os.path.getsize(os.path.join(out, 'refs.bin')) // 1024, 'KB')
