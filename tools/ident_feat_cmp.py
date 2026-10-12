import sys, os, json, cv2, numpy as np
sys.argv = ['x', sys.argv[1], sys.argv[2], sys.argv[3]]
src = open('ident_castles3.py').read().split('# ---- error analysis')[0]
exec(src.replace("for S, perchan, space in [(16, True, 'lab'), (16, False, 'rgb'), (12, True, 'lab'), (20, True, 'lab')]:\n    run(S, perchan, space, True)\nrun(16, True, 'lab', False)", ''))
def run3(perchan, space):
    feats = [(t, feat(center(img, REF_HOLE), 16, perchan, space)) for t, img in refs]
    ids = [t for t, _ in feats]; A = np.stack([a for _, a in feats])
    errs = []; ok = tot = 0
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
            sim = A @ feat(crop, 16, perchan, space); j = int(np.argmax(sim)); bid = ids[j]
            hit = bid == tid or (tid == 'ballroom' and bid.startswith('ballroom')); tot += 1; ok += hit
            if not hit: errs.append(f"{name[-4:]}:{cell} {tid}->{bid} hole={bool(cand)}")
    print(f'{space} perchan={perchan}: {ok}/{tot}'); print('  ' + '\n  '.join(errs))
run3(False, 'rgb'); run3(True, 'lab'); run3(True, 'rgb')
