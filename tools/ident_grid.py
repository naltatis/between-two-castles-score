"""Compare NN identification features, leave-one-photo-out on linked crops. usage: python ident_grid.py LABELED_DIR"""
import sys, os, json
import cv2, numpy as np
from collections import Counter
d = sys.argv[1]
L = [l for l in json.load(open(d + '/linked.json')) if l['tile'] != 'ballroom']
imgs = {l['file']: cv2.imread(os.path.join(d, l['file'])) for l in L}
L = [l for l in L if imgs[l['file']].shape[1] < imgs[l['file']].shape[0] * 1.5]
N = np.array([l['tile'] for l in L]); P = np.array([l['file'].split('_')[1] for l in L])
cnt = Counter(N); keep = np.array([cnt[n] >= 2 for n in N])

def feat(img, S, space, margin, gray):
    h, w = img.shape[:2]
    m = int(min(h, w) * margin)
    im = img[m:h - m, m:w - m]
    im = cv2.resize(im, (S, S), interpolation=cv2.INTER_AREA)
    if space == 'lab': im = cv2.cvtColor(im, cv2.COLOR_BGR2LAB)
    elif space == 'hsv': im = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    if gray: im = cv2.cvtColor(img if space == 'bgr' else img, cv2.COLOR_BGR2GRAY); im = cv2.resize(im[m:h-m, m:w-m], (S, S), interpolation=cv2.INTER_AREA)
    v = im.astype(np.float32).reshape(-1)
    v = (v - v.mean()) / (v.std() + 1e-6)
    return v / np.linalg.norm(v)

def evaluate(S, space, margin, gray=False):
    F = np.stack([feat(imgs[l['file']], S, space, margin, gray) for l in L])
    sim = F @ F.T
    ok = tot = 0
    for i in range(len(L)):
        if not keep[i]: continue
        mask = P != P[i]
        idx = np.where(mask)[0]
        j = idx[np.argmax(sim[i, idx])]
        tot += 1; ok += N[j] == N[i]
    return ok / tot, tot

print(len(L), 'crops')
for S, space, margin, gray in [(16,'lab',0,False),(16,'bgr',0,False),(16,'lab',0.08,False),(16,'bgr',0.08,False),(12,'lab',0.08,False),(20,'lab',0.08,False),(24,'lab',0.08,False),(16,'hsv',0.08,False),(16,'bgr',0.08,True),(32,'bgr',0.08,True)]:
    acc, tot = evaluate(S, space, margin, gray)
    print(f'S={S} {space} margin={margin} gray={gray}: {acc:.3f} (n={tot})', flush=True)
