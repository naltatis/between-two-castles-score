"""regression check for detect.py on the 4 sample castles: run `.venv/bin/python test_detect.py`"""
import os, sys, tempfile, contextlib, io
import detect

IMG = os.path.join(os.path.dirname(__file__), '..', 'images')
EXPECTED = {  # file: (tiles, sideways, flipped, a few known cells)
    'IMG_0144': (21, False, False, [(0, 4), (-3, 0), (3, 1), (0, -2)]),
    'IMG_0145': (20, False, False, [(-4, 0), (4, 0), (1, -3), (2, 2)]),
    'IMG_0146': (21, True, True, [(1, 4), (1, -4), (3, 3), (2, 0)]),
    'IMG_0148': (21, True, False, [(2, 6), (4, 0), (-2, 0), (-1, 2)]),
}
out = tempfile.mkdtemp()
for name, (n, side, flip, cells) in EXPECTED.items():
    with contextlib.redirect_stdout(io.StringIO()):
        r = detect.detect(os.path.join(IMG, name + '.jpeg'), out)
    grid = {tuple(c) for c in r['grid']}
    assert r['cells'] == n, (name, r['cells'])
    assert (r['sideways'], r['flipped']) == (side, flip), (name, r['sideways'], r['flipped'])
    assert {(0, 0), (1, 0)} <= grid, name
    assert all(c in grid for c in cells), (name, [c for c in cells if c not in grid])
    print('ok', name, n, 'tiles')
