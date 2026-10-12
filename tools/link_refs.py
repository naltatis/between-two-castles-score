"""Link OCR-labelled crops to tile ids: direct/fuzzy name match per crop, cluster canonical as fallback.
usage: python link_refs.py TILES_JSON LABELED_DIR → LABELED_DIR/linked.json"""
import json, re, sys, difflib
from collections import Counter
tiles = json.load(open(sys.argv[1])); d = sys.argv[2]
norm = lambda n: re.sub(r'[^A-Z0-9]', '', n.upper().replace('Ä','A').replace('Ö','O').replace('Ü','U').replace('ß','SS').replace('Ê','E'))
byname = {}
for t in tiles:
    byname.setdefault(norm(t['name']), t['id'])
    if 'nameDe' in t: byname[norm(t['nameDe'])] = t['id']
byname['ESCAPEROOM'] = 'escape-room-activity'
byname['VESTIBULE'] = 'vestibule-corridor'  # the living-room Vestibule is printed 'Diele'
byname['BALLROOM'] = 'ballroom'  # variant decided later from the icon
canon = json.load(open(d + '/name_map.json'))
cache = {}
def link(n):
    if n in cache: return cache[n]
    r = byname.get(n)
    if not r and len(n) >= 5:
        m = difflib.get_close_matches(n, list(byname), n=1, cutoff=0.8)
        r = byname[m[0]] if m else None
    if not r and canon.get(n): r = byname.get(canon[n]) or link(canon[n])
    cache[n] = r
    return r
out = []
for l in json.load(open(d + '/labels.json')):
    n = norm(l['name'])
    tid = link(n) if n else None
    # the corridor and the activity Escape Room share their printed name: decide by reference sheet
    if n == 'ESCAPEROOM':
        tid = 'escape-room' if l['file'][:8] in ('IMG_0214', 'IMG_0215', 'IMG_0235') else 'escape-room-activity'
    if tid: out.append({'file': l['file'], 'tile': tid, 'conf': l['conf']})
json.dump(out, open(d + '/linked.json', 'w'), indent=0)
cnt = Counter(o['tile'] for o in out)
ids = [t['id'] for t in tiles]
print('linked', len(out), 'tiles covered', len([i for i in ids if cnt[i]]), 'of', len(ids))
print('missing:', [i for i in ids if not cnt[i]])
print('1-2 samples:', [(i, cnt[i]) for i in ids if 0 < cnt[i] <= 2])
