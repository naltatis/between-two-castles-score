"""Castle identification with hole-based framing: for every grid cell find the tile's art hole
(enclosed by its cream/blue ring) in the rectified photo and crop exactly that, like the references.
usage: python ident_castles3.py LABELED_DIR DET_DIR TRUTH_JSON"""
import sys, os, json, cv2, numpy as np
import detect as D, crop_refs as C
lab, det, truth = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
L = json.load(open(lab + '/linked.json'))
REF_HOLE = 1 / 1.229  # the labelled crops hold hole + 9% margin, scaled by 0.96
def center(img, frac):
    h, w = img.shape[:2]; m = int(w * (1 - frac) / 2); n = int(h * (1 - frac) / 2)
    return img[n:h - n, m:w - m]
def feat(img, S=16, perchan=True, space='lab'):
    im = cv2.resize(img, (S, S), interpolation=cv2.INTER_AREA)
    if space == 'lab': im = cv2.cvtColor(im, cv2.COLOR_BGR2LAB)
    im = im.astype(np.float32)
    if perchan: im = (im - im.reshape(-1, 3).mean(0)) / (im.reshape(-1, 3).std(0) + 1e-6)
    v = im.reshape(-1); v = v - v.mean(); return v / (np.linalg.norm(v) + 1e-6)
refs = [(l['tile'], cv2.imread(os.path.join(lab, l['file']))) for l in L]
refs = [(t, img) for t, img in refs if img.shape[1] < img.shape[0] * 1.5]

def holes(rot, s):
    """art holes in the rectified castle image: rings = cream|blue, holes = enclosed regions of ~tile size"""
    best = []
    for v_min in (100, 130, 160):
        for s_max in (80, 110, 140):
            m = C.ring_mask(rot, v_min, s_max)
            cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
            out = []
            if hier is None: continue
            for i, c in enumerate(cnts):
                if hier[0][i][3] == -1: continue
                x, y, w, h = cv2.boundingRect(c)
                if 0.55 * s < w < 1.05 * s and 0.55 * s < h < 1.05 * s and cv2.contourArea(c) > 0.7 * w * h:
                    out.append((x, y, w, h))
            if len(out) > len(best): best = out
    return best

def run(S, perchan, space, use_holes):
    R = np.stack([feat(center(img, REF_HOLE), S, perchan, space) for _, img in refs]); ids = [t for t, _ in refs]
    ok = tot = 0; found = 0
    for name, cs in truth.items():
        info = json.load(open(os.path.join(det, name + '.json'))) if os.path.exists(os.path.join(det, name + '.json')) else None
        rot = cv2.imread(os.path.join(det, name + '_aligned.jpg'))
        s = info['tile_px']; hs = holes(rot, s) if use_holes else []
        rotk = (1 if info['sideways'] else 0) * 3 % 4 + (2 if info['flipped'] else 0)
        k_crop = ((3 if info['sideways'] else 0) + (2 if info['flipped'] else 0)) % 4
        for cell, tid in cs.items():
            box = info['cells_px'].get(cell)
            if not box: continue
            a, c, e, d = box
            crop = None
            if use_holes:
                cx, cy = (a + e) / 2, (c + d) / 2
                cand = [h for h in hs if h[0] < cx < h[0] + h[2] and h[1] < cy < h[1] + h[3]]
                if cand:
                    x, y, w, h = cand[0]; crop = rot[y:y + h, x:x + w]; found += 1
            if crop is None:
                crop = center(rot[c:d, a:e], 0.78)
            crop = np.rot90(crop, k_crop)
            sim = R @ feat(crop, S, perchan, space); j = int(np.argmax(sim)); bid = ids[j]
            tot += 1; ok += bid == tid or (tid == 'ballroom' and bid.startswith('ballroom'))
    print(f'S={S} perchan={perchan} {space} holes={use_holes}: {ok}/{tot} = {ok/tot:.2f} (holes found {found})', flush=True)
for S, perchan, space in [(16, True, 'lab'), (16, False, 'rgb'), (12, True, 'lab'), (20, True, 'lab')]:
    run(S, perchan, space, True)
run(16, True, 'lab', False)

# ---- error analysis + ensemble / augmentation ----
def aug(img):
    h, w = img.shape[:2]
    out = [img]
    for dx, dy in ((0.06, 0), (-0.06, 0), (0, 0.06), (0, -0.06)):
        x0 = int(max(0, dx * w)); y0 = int(max(0, dy * h)); x1 = int(w + min(0, dx * w)); y1 = int(h + min(0, dy * h))
        out.append(img[y0:y1, x0:x1])
    m = int(w * 0.05); out.append(img[m:h - m, m:w - m])
    return out
def run2(augment):
    feats = []
    for t, img in refs:
        base = center(img, REF_HOLE)
        for v in (aug(base) if augment else [base]):
            feats.append((t, feat(v, 16, True, 'lab'), feat(v, 16, False, 'rgb')))
    ids = [t for t, _, _ in feats]; A = np.stack([a for _, a, _ in feats]); B = np.stack([b for _, _, b in feats])
    ok = tot = 0; errs = []
    for name, cs in truth.items():
        info = json.load(open(os.path.join(det, name + '.json'))); rot = cv2.imread(os.path.join(det, name + '_aligned.jpg'))
        hs = holes(rot, info['tile_px']); k_crop = ((3 if info['sideways'] else 0) + (2 if info['flipped'] else 0)) % 4
        for cell, tid in cs.items():
            box = info['cells_px'].get(cell)
            if not box: continue
            a, c, e, d = box; cx, cy = (a + e) / 2, (c + d) / 2
            cand = [h for h in hs if h[0] < cx < h[0] + h[2] and h[1] < cy < h[1] + h[3]]
            crop = rot[cand[0][1]:cand[0][1] + cand[0][3], cand[0][0]:cand[0][0] + cand[0][2]] if cand else center(rot[c:d, a:e], 0.78)
            crop = np.rot90(crop, k_crop)
            sim = A @ feat(crop, 16, True, 'lab') + B @ feat(crop, 16, False, 'rgb')
            j = int(np.argmax(sim)); bid = ids[j]
            hit = bid == tid or (tid == 'ballroom' and bid.startswith('ballroom'))
            tot += 1; ok += hit
            if not hit:
                tr = [k for k, i in enumerate(ids) if i == tid]
                errs.append(f"{name[-4:]}:{cell} {tid}->{bid} hole={bool(cand)} rank={int((sim > sim[tr].max()).sum()) if tr else 'noref'}")
    print(f'ensemble augment={augment}: {ok}/{tot} = {ok/tot:.2f}'); print('\n'.join(errs))
run2(False); run2(True)
