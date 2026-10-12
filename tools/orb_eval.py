"""Does ORB+RANSAC separate the right tile from the thumbnail shortlist? Uses the hole crops of the
castle photos (det4) and the reference ORB export. usage: python orb_eval.py LABELED_DIR DET_DIR TRUTH_JSON"""
import sys, os, json, cv2, numpy as np
sys.argv = ['x', sys.argv[1], sys.argv[2], sys.argv[3]]
lab, det, truth = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
exec(open(os.path.join(os.path.dirname(__file__) if '__file__' in dir() else '.', 'ident_castles3.py')).read().split('# ---- error analysis')[0].replace("for S, perchan, space in [(16, True, 'lab'), (16, False, 'rgb'), (12, True, 'lab'), (20, True, 'lab')]:\n    run(S, perchan, space, True)\nrun(16, True, 'lab', False)", ''))
SIZE, NF = 256, 300
orb = cv2.ORB_create(nfeatures=NF, scaleFactor=1.2, nlevels=8, edgeThreshold=15, patchSize=31, fastThreshold=10)
bf = cv2.BFMatcher(cv2.NORM_HAMMING)
# reference descriptors per tile (from the labelled crops, hole-centred, 256 px)
ref = {}
for t, img in refs:
    hole_img = cv2.resize(center(img, REF_HOLE), (SIZE, SIZE), interpolation=cv2.INTER_AREA)
    k, d = orb.detectAndCompute(cv2.cvtColor(hole_img, cv2.COLOR_BGR2GRAY), None)
    if d is None or len(k) < 20: continue
    ref.setdefault(t, []).append((np.float32([kp.pt for kp in k]), d))
R = np.stack([feat(center(img, REF_HOLE)) for _, img in refs]); ids = [t for t, _ in refs]
def inliers(pts_q, des_q, pts_r, des_r):
    if des_q is None or des_r is None or len(des_q) < 8 or len(des_r) < 8: return 0
    m = bf.knnMatch(des_q, des_r, k=2)
    good = [a for a, b in (p for p in m if len(p) == 2) if a.distance < 0.8 * b.distance]
    if len(good) < 8: return len(good) // 2
    src = np.float32([pts_q[g.queryIdx] for g in good]); dst = np.float32([pts_r[g.trainIdx] for g in good])
    H, mask = cv2.findHomography(src, dst, cv2.RANSAC, 6.0)
    return int(mask.sum()) if mask is not None else 0
rows = []
truth = {k: v['cells'] for k, v in truth.items()}
for name, cs in truth.items():
    p = os.path.join(det, name + '.json')
    if not os.path.exists(p): continue
    info = json.load(open(p)); rot = cv2.imread(os.path.join(det, name + '_aligned.jpg'))
    hs = holes(rot, info['tile_px']); k_crop = ((3 if info['sideways'] else 0) + (2 if info['flipped'] else 0)) % 4
    for cell, tid in cs.items():
        box = info['cells_px'].get(cell)
        if not box: continue
        a, c, e, d_ = box; cx, cy = (a + e) / 2, (c + d_) / 2
        cand = [h for h in hs if h[0] < cx < h[0] + h[2] and h[1] < cy < h[1] + h[3]]
        crop = rot[cand[0][1]:cand[0][1] + cand[0][3], cand[0][0]:cand[0][0] + cand[0][2]] if cand else center(rot[c:d_, a:e], 0.78)
        crop = cv2.resize(np.ascontiguousarray(np.rot90(crop, k_crop)), (SIZE, SIZE), interpolation=cv2.INTER_AREA)
        kq, dq = orb.detectAndCompute(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY), None)
        pq = np.float32([kp.pt for kp in kq]) if kq else None
        sim = R @ feat(crop)
        order = []
        for j in np.argsort(-sim):
            if ids[j] not in order: order.append(ids[j])
            if len(order) == 8: break
        scores = {t: max((inliers(pq, dq, pr, dr) for pr, dr in ref.get(t, [])), default=0) for t in order}
        best = max(scores, key=scores.get); bs = scores[best]
        second = max((v for t, v in scores.items() if t != best), default=0)
        tv = scores.get(tid, -1); hit = best == tid or (tid == 'ballroom' and best.startswith('ballroom'))
        rows.append((name[-4:], cell, tid, best, bs, second, tv, hit, order[0] == tid))
hits = sum(r[7] for r in rows); nn1 = sum(r[8] for r in rows)
print(f'cells {len(rows)}: ORB top-1 {hits}, thumbnail top-1 {nn1}')
print('best inliers when right: pct10/50', np.percentile([r[4] for r in rows if r[7]], [10, 50]), ' ratio best/second when right: pct10', np.percentile([r[4] / max(1, r[5]) for r in rows if r[7]], [10, 50]))
for r in rows:
    if not r[7]: print('  WRONG', r[:7])
print('low-margin right cases (ratio<1.5):', [(r[0], r[1], r[4], r[5]) for r in rows if r[7] and r[4] < 1.5 * max(1, r[5])][:12])
