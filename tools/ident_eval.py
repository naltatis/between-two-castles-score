"""Stage 2 experiment: nearest-neighbour tile identification on small normalised thumbnails.
Leave-one-photo-out over the labelled reference crops. usage: python ident_eval.py LABELED_DIR [size]"""
import sys, os, json, re
import cv2, numpy as np
from collections import Counter, defaultdict

d = sys.argv[1]; S = int(sys.argv[2]) if len(sys.argv) > 2 else 24
labels = json.load(open(os.path.join(d, 'labels.json')))
norm = lambda n: re.sub(r'[^A-Z]', '', n.upper())
items = [(l['file'], norm(l['name'])) for l in labels if l['kind'] == 'tile' and l['conf'] >= 0.8 and len(norm(l['name'])) >= 4]
cnt = Counter(n for _, n in items)
items = [(f, n) for f, n in items if cnt[n] >= 2]  # need ≥2 samples to evaluate
print(len(items), 'crops', len(cnt), 'raw names', sum(1 for n in cnt if cnt[n] >= 2), 'names with >=2')

def feat(img, wide):
    im = cv2.resize(img, (S * (2 if wide else 1), S), interpolation=cv2.INTER_AREA)
    im = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    v = im.reshape(-1)
    v = (v - v.mean()) / (v.std() + 1e-6)
    return v / np.linalg.norm(v)

F, N, P = [], [], []
for f, n in items:
    img = cv2.imread(os.path.join(d, f)); wide = img.shape[1] > img.shape[0] * 1.5
    if wide: continue
    F.append(feat(img, False)); N.append(n); P.append(f.split('_')[1])
F = np.stack(F); N = np.array(N); P = np.array(P)
sim = F @ F.T
ok = top3 = tot = 0
conf = defaultdict(int)
for i in range(len(F)):
    mask = P != P[i]  # leave the same photo out
    if not mask.any(): continue
    idx = np.where(mask)[0]
    order = idx[np.argsort(-sim[i, idx])]
    tot += 1
    if N[order[0]] == N[i]: ok += 1
    else: conf[(N[i], N[order[0]])] += 1
    if N[i] in N[order[:3]]: top3 += 1
print(f'size {S}: top1 {ok}/{tot} = {ok/tot:.3f}, top3 {top3/tot:.3f}')
print('worst confusions', Counter(conf).most_common(8))
