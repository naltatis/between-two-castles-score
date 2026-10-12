# Zwischen zwei Schlössern – Wertung

Fan-made scoring app for *Between Two Castles of Mad King Ludwig* (German edition, with Secrets & Soirées),
replacing the discontinued "Mad King's Steward" iOS app. Photograph a finished castle, confirm the few
uncertain tiles, add attendants and bonus cards, and get the score. Non-commercial, not affiliated with
Stonemaier Games or Feuerland Spiele. Tiles are rendered as simplified colour/symbol cards; no publisher
artwork is included (the recognition data in `app/public` is derived descriptors, not images).

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
→ `export_refs.py` / `export_orb.py` / `export_strips.py` (write `app/public/refs.*`, `orb.*`, `strips.*`).
`build_tiles.py` generates `app/src/data/tiles.json`.

```sh
cd tools && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt rapidocr_onnxruntime
```

## Deployment

`Dockerfile`: build the app, serve `dist/` with stock nginx. CI (`.github/workflows/ci.yml`) runs check, unit tests
and build on every push and publishes `ghcr.io/naltatis/between-two-castles-score:latest` from `main`.

- Local: `docker compose up -d --build` → http://localhost:8090
- Unraid: add a container from `ghcr.io/naltatis/between-two-castles-score:latest`, map port 80 to a free host port.
  Over plain http the camera input and scanning work; only the offline cache (service worker) needs https.
