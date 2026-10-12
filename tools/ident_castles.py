"""Evaluate identification on real castle crops with shift/scale search. usage: python ident_castles.py DET_DIR TRUTH_JSON"""
import sys, os, json, cv2, numpy as np
S = 16
det, truth = sys.argv[1], json.load(open(sys.argv[2]))
ids = json.load(open('../app/public/refs.json'))['ids']
R = np.fromfile('../app/public/refs.bin', dtype=np.int8).reshape(len(ids), -1).astype(np.float32); R /= np.linalg.norm(R, axis=1, keepdims=True)
def feat(img):
    im = cv2.cvtColor(cv2.resize(img, (S, S), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB).astype(np.float32).reshape(-1)
    v = im - im.mean(); return v / (np.linalg.norm(v) + 1e-6)
def variants(img, shifts, scales):
    h, w = img.shape[:2]
    for sc in scales:
        cw, ch = w * sc, h * sc
        for dx in shifts:
            for dy in shifts:
                x0 = int((w - cw) / 2 + dx * w); y0 = int((h - ch) / 2 + dy * h)
                x0 = max(0, min(w - int(cw), x0)); y0 = max(0, min(h - int(ch), y0))
                yield img[y0:y0 + int(ch), x0:x0 + int(cw)]
for shifts, scales in [([0], [1.0]), ([-0.1, 0, 0.1], [1.0]), ([-0.12, -0.06, 0, 0.06, 0.12], [1.0]), ([-0.12, -0.06, 0, 0.06, 0.12], [0.85, 1.0]), ([-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15], [0.8, 0.9, 1.0])]:
    ok = tot = 0; wrong = []
    for name, cells in truth.items():
        for cell, tid in cells.items():
            f = os.path.join(det, f'{name}_cells', cell.replace(',', '_') + '.jpg')
            if not os.path.exists(f): continue
            img = cv2.imread(f)
            best, bid = -2, ''
            for v in variants(img, shifts, scales):
                sim = R @ feat(v); j = int(np.argmax(sim))
                if sim[j] > best: best, bid = float(sim[j]), ids[j]
            tot += 1
            if bid == tid or (tid == 'ballroom' and bid.startswith('ballroom')): ok += 1
            else: wrong.append(f'{name[-4:]}:{cell} {tid}->{bid}({best:.2f})')
    print(f'shifts={len(shifts)} scales={scales}: {ok}/{tot} = {ok/tot:.2f}', flush=True)
    if len(shifts) == 7: print(wrong)
