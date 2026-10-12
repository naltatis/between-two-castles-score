"""Identification on castle crops: inner-art framing + normalisation variants. usage: python ident_castles2.py LABELED_DIR DET_DIR TRUTH_JSON"""
import sys, os, json, cv2, numpy as np
lab, det, truth = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
L = json.load(open(lab + '/linked.json'))
refs = []
for l in L:
    img = cv2.imread(os.path.join(lab, l['file']))
    if img.shape[1] > img.shape[0] * 1.5: continue
    refs.append((l['tile'], img))
def center(img, frac):
    h, w = img.shape[:2]; m = int(w * (1 - frac) / 2); n = int(h * (1 - frac) / 2)
    return img[n:h - n, m:w - m]
def feat(img, S, perchan, space):
    im = cv2.resize(img, (S, S), interpolation=cv2.INTER_AREA)
    if space == 'lab': im = cv2.cvtColor(im, cv2.COLOR_BGR2LAB)
    im = im.astype(np.float32)
    if perchan:
        im = (im - im.reshape(-1, 3).mean(0)) / (im.reshape(-1, 3).std(0) + 1e-6)
    v = im.reshape(-1); v = v - v.mean(); return v / (np.linalg.norm(v) + 1e-6)
cells = []
for name, cs in truth.items():
    for cell, tid in cs.items():
        f = os.path.join(det, f'{name}_cells', cell.replace(',', '_') + '.jpg')
        if os.path.exists(f): cells.append((tid, cv2.imread(f), f'{name[-4:]}:{cell}'))
for S, reffrac, castfrac, perchan, space in [(16, 1.0, 1.0, False, 'rgb'), (16, 0.81, 0.78, False, 'rgb'), (16, 0.81, 0.78, True, 'rgb'), (16, 0.81, 0.70, True, 'rgb'), (12, 0.81, 0.78, True, 'rgb'), (24, 0.81, 0.78, True, 'rgb'), (16, 0.81, 0.78, True, 'lab'), (16, 0.81, 0.78, False, 'lab')]:
    R = np.stack([feat(center(img, reffrac), S, perchan, space) for _, img in refs]); ids = [t for t, _ in refs]
    ok = 0; ranks = []
    for tid, img, key in cells:
        best, bid = -2, ''
        for sh in (0.70, 0.78, 0.86) if castfrac == 0.78 else (castfrac,):
            sim = R @ feat(center(img, sh), S, perchan, space); j = int(np.argmax(sim))
            if sim[j] > best: best, bid, simv = float(sim[j]), ids[j], sim
        hit = bid == tid or (tid == 'ballroom' and bid.startswith('ballroom'))
        ok += hit
        tr = [k for k, i in enumerate(ids) if i == tid or (tid == 'ballroom' and i.startswith('ballroom'))]
        ranks.append(int((simv > simv[tr].max()).sum()) if tr else 999)
    print(f'S={S} ref={reffrac} cast={castfrac} perchan={perchan} {space}: {ok}/{len(cells)} = {ok/len(cells):.2f}, median rank {int(np.median(ranks))}, top5 {np.mean([r<5 for r in ranks]):.2f}', flush=True)
