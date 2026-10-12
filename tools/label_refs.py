"""Orient every crop by OCR (name banner on top) and record the read name.

usage: python label_refs.py CROPDIR OUTDIR
writes OUTDIR/<img>_<nn>.jpg (upright) and OUTDIR/labels.json: [{file, src, name, conf, kind}]
kind: 'tile' (name read), 'throne'/'card'/'unknown' (no name)
"""
import sys, os, glob, json, re
import cv2, numpy as np
from rapidocr_onnxruntime import RapidOCR

ocr = RapidOCR()
STOP = {'PRO', 'PER', 'ZZZ', 'IF', 'FALLS', 'CONNECTED', 'VERBUNDENEM', 'PRO VERBUNDENEM', 'PER CONNECTED'}


def read_band(img, k):
    r = np.ascontiguousarray(np.rot90(img, k))
    res, _ = ocr(r[: int(r.shape[0] * 0.2)])
    return res or []


def is_name(t):
    s = re.sub(r'[^A-ZÄÖÜ ]', '', t.upper()).strip()
    return len(s) >= 4 and s not in STOP and not re.fullmatch(r'(PRO|PER|ZZZ|IF|FALLS)( .*)?', s)


def orient(img, wide):
    rots = [0, 2] if wide else [0, 1, 2, 3]
    hints = {}
    for k in rots:
        res = read_band(img, k)
        names = [(t[1], t[2]) for t in res if is_name(t[1]) and t[2] > 0.6]
        if names:
            best = max(names, key=lambda n: n[1])
            return k, best[0], best[1], 'tile'
        if any(re.fullmatch(r'(pro|per)', t[1].strip().lower()) for t in res):
            hints[k] = 'rule'  # rule strip is at the top in this rotation → upside down
    for k, h in hints.items():
        return (k + 2) % 4 if not wide else (k + 2) % 4, '', 0.0, 'throne' if wide else 'unknown'
    return 0, '', 0.0, 'card' if img.shape[0] > img.shape[1] * 1.2 else 'unknown'


def main(cropdir, outdir):
    os.makedirs(outdir, exist_ok=True)
    out = []
    files = sorted(glob.glob(os.path.join(cropdir, 'IMG_*', '*.jpg')))
    for i, f in enumerate(files):
        img = cv2.imread(f)
        wide = img.shape[1] > img.shape[0] * 1.5
        k, name, conf, kind = orient(img, wide)
        up = np.ascontiguousarray(np.rot90(img, k))
        src = os.path.basename(os.path.dirname(f)) + '_' + os.path.basename(f)
        cv2.imwrite(os.path.join(outdir, src), up, [cv2.IMWRITE_JPEG_QUALITY, 90])
        out.append({'file': src, 'name': name, 'conf': round(conf, 2), 'kind': kind, 'rot': k})
        if i % 50 == 0:
            print(i, len(files), src, kind, name, flush=True)
            json.dump(out, open(os.path.join(outdir, 'labels.json'), 'w'), ensure_ascii=False, indent=0)
    json.dump(out, open(os.path.join(outdir, 'labels.json'), 'w'), ensure_ascii=False, indent=0)
    print('done', len(out))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
