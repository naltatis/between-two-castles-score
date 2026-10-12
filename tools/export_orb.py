"""Export ORB keypoints + descriptors of every linked reference crop at the canonical 256 px hole
size (the app warps each located tile to the same size). usage: python export_orb.py LABELED_DIR OUT_DIR
Writes OUT_DIR/refs.orb (binary) + OUT_DIR/orb.json (index)."""
import sys, os, json, struct, cv2, numpy as np
SRCS, out = sys.argv[1:-1], sys.argv[-1]
SIZE, NFEAT = 256, 300
REF_HOLE = 1 / 1.229
orb = cv2.ORB_create(nfeatures=NFEAT, scaleFactor=1.2, nlevels=8, edgeThreshold=15, patchSize=31, fastThreshold=10)
L = [dict(l, _dir=d) for d in SRCS for l in json.load(open(os.path.join(d, 'linked.json')))]
entries, blobs, off = [], [], 0
for l in L:
    img = cv2.imread(os.path.join(l['_dir'], l['file']))
    h, w = img.shape[:2]
    if w > h * 1.5: continue
    m, n = int(w * (1 - REF_HOLE) / 2), int(h * (1 - REF_HOLE) / 2)
    hole = cv2.resize(img[n:h - n, m:w - m], (SIZE, SIZE), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(hole, cv2.COLOR_BGR2GRAY)
    kps, des = orb.detectAndCompute(gray, None)
    if des is None or len(kps) < 20: continue
    pts = np.array([[k.pt[0], k.pt[1]] for k in kps], np.float32)
    blob = pts.tobytes() + des.tobytes()
    entries.append({'id': l['tile'], 'n': len(kps), 'offset': off, 'src': l.get('src', '')}); blobs.append(blob); off += len(blob)
open(os.path.join(out, 'refs.orb'), 'wb').write(b''.join(blobs))
json.dump({'size': SIZE, 'entries': entries}, open(os.path.join(out, 'orb.json'), 'w'))
from collections import Counter
c = Counter(e['id'] for e in entries)
print(len(entries), 'refs,', off // 1024, 'KB; kp per ref median', int(np.median([e['n'] for e in entries])), '; tiles', len(c))
