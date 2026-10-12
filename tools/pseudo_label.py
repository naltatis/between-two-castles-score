"""Nearest-neighbour pseudo-labels for crops without an OCR link; low-score ones go to a review sheet.
usage: python pseudo_label.py LABELED_DIR OUT_DIR"""
import sys, os, json, cv2, numpy as np
lab, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
S = 16; REF_HOLE = 1 / 1.229
def center(img, frac):
    h, w = img.shape[:2]; m = int(w * (1 - frac) / 2); n = int(h * (1 - frac) / 2); return img[n:h - n, m:w - m]
def feat(img):
    im = cv2.cvtColor(cv2.resize(center(img, REF_HOLE), (S, S), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB).astype(np.float32).reshape(-1)
    v = im - im.mean(); return v / (np.linalg.norm(v) + 1e-6)
linked = json.load(open(lab + '/linked.json')); done = {l['file'] for l in linked}
R, ids = [], []
for l in linked:
    img = cv2.imread(os.path.join(lab, l['file']))
    if img.shape[1] > img.shape[0] * 1.5: continue
    R.append(feat(img)); ids.append(l['tile'])
R = np.stack(R)
rows = []
for l in json.load(open(lab + '/labels.json')):
    if l['file'] in done: continue
    img = cv2.imread(os.path.join(lab, l['file']))
    if img.shape[1] > img.shape[0] * 1.5 or img.shape[0] > img.shape[1] * 1.2: continue  # thrones, cards
    sim = R @ feat(img); j = int(np.argmax(sim))
    rows.append({'file': l['file'], 'tile': ids[j], 'score': round(float(sim[j]), 3), 'ocr': l['name']})
rows.sort(key=lambda r: r['score'])
json.dump(rows, open(out + '/pseudo.json', 'w'), indent=0)
print(len(rows), 'unlinked crops; score quartiles', np.percentile([r['score'] for r in rows], [10, 25, 50, 75]).round(2))
# review sheet of the 60 lowest-scoring (likely tiles without references, or junk)
T = 200; low = rows[:60]; sheets = []
for r0 in range(0, len(low), 6):
    row = []
    for r in low[r0:r0 + 6]:
        im = cv2.resize(cv2.imread(os.path.join(lab, r['file'])), (T, T)); cell = np.zeros((T + 24, T, 3), np.uint8); cell[24:] = im
        cv2.putText(cell, f"{r['file'][4:12]} {r['score']:.2f}", (3, 17), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1); row.append(cell)
    while len(row) < 6: row.append(np.zeros((T + 24, T, 3), np.uint8))
    sheets.append(np.hstack(row))
cv2.imwrite(out + '/low.jpg', np.vstack(sheets), [cv2.IMWRITE_JPEG_QUALITY, 80])
