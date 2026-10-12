# Zwischen zwei Schlössern – Wertung

Fan-made scoring app for *Between Two Castles of Mad King Ludwig* (German edition, with Secrets & Soirées),
replacing the discontinued "Mad King's Steward" iOS app. Photograph a finished castle, confirm the few
uncertain tiles, add attendants and bonus cards, and get the score. Non-commercial, not affiliated with
Stonemaier Games or Feuerland Spiele. Tiles are rendered as simplified colour/symbol cards; no publisher
artwork is included (the recognition data in `app/src/recognize/data` is derived descriptors, not images).

## App (`app/`)

Static web app: Vite+, Vue 3, TypeScript. Deployed to GitHub Pages by `.github/workflows/pages.yml`.

```sh
cd app
npm ci
vp dev                                  # dev server
vp check --fix                          # lint + format + types
vp test --run --project unit            # scoring engine tests
vp test --run --project bench --silent=false   # recognition benchmark (Playwright/Chromium)
vp build
```

- `src/game/` – scoring engine (`score.ts`, rulebook examples in `score.test.ts`), tile data (`data/tiles.json`, throne rooms in `tiles.ts`), bonus cards.
- `src/recognize/` – recognition in a Web Worker: `locate.ts` finds the tiles (ring masks, throne-anchored grid), `identify.ts` shortlists by thumbnail, `verify.ts` decides with ORB keypoints + RANSAC (OpenCV.js), `strips.ts` picks throne/ballroom variants from the rule strip.
- `src/screens/` – Players → Overview → Scan → Detect → CastleGrid → Extras → Results.
- `test-fixtures/` – castle photos with hand-checked ground truth (`truth.json`) for the benchmark. Dev builds offer "Als Testfall exportieren" on the grid screen to add new ones.

## Tools (`tools/`)

Python/OpenCV scripts that build the recognition data from photos of the tiles (not in the repo):
`crop_refs.py` (cut tiles out of sheet photos) → `label_refs.py` (OCR the names) → `link_refs.py` (map to tile ids)
→ `export_refs.py` / `export_orb.py` / `export_strips.py` (write `refs.*`, `orb.*`, `strips.*` into `app/src/recognize/data/`).
`build_tiles.py` generates `app/src/data/tiles.json`.

```sh
cd tools && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt rapidocr_onnxruntime
```

## Deployment

GitHub Pages, from `.github/workflows/ci.yml` on every push to `main` after check, unit tests and build:
https://naltatis.github.io/between-two-castles-score/

Phones need https: iOS 26 Safari runs plain-http pages without its JIT, which makes recognition ~25× slower,
and the offline cache (service worker) only registers on https.
