/**
 * Recognition benchmark: runs the real worker pipeline on every castle photo in test-fixtures
 * against the hand-checked ground truth and prints a per-photo table. Browser mode only.
 *
 * Metrics per photo: located (cells found that are real tiles / real tiles), false positives
 * (cells found that are not tiles), correct (identified tile right / real tiles found), confident
 * (confidence ≥ 0.8) and how many of those are right, throne variant right, wall time.
 */
import { describe, expect, it } from "vite-plus/test";
import { recognize } from "./index";

interface Truth {
  [photo: string]: { cells: Record<string, string>; ignore?: string[]; throne?: string };
}

const CONF = 0.8;

/** longest side the app would scan at (Scan.vue MAX); fixtures are 4000 px */
const MAX = 4000;

async function load(name: string): Promise<HTMLCanvasElement> {
  const blob = await (await fetch(`/test-fixtures/${name}.jpg`)).blob();
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

const truth: Truth = await (await fetch("/test-fixtures/truth.json")).json();
const names = Object.keys(truth);

interface Row {
  photo: string;
  tiles: number;
  located: number;
  falsePos: number;
  correct: number;
  confident: number;
  confidentOk: number;
  throne: string;
  method: string;
  ms: number;
  misses: string[];
  unsure: string[];
}

const rows: Row[] = [];

describe("recognition benchmark", () => {
  for (const name of names) {
    it(
      name,
      async () => {
        const t = truth[name]!;
        const ignore = new Set(t.ignore ?? []);
        const canvas = await load(name);
        const t0 = performance.now();
        const r = await recognize(canvas, name);
        const ms = Math.round(performance.now() - t0);
        const row: Row = {
          photo: name,
          tiles: Object.keys(t.cells).length,
          located: 0,
          falsePos: 0,
          correct: 0,
          confident: 0,
          confidentOk: 0,
          throne: t.throne
            ? r.throne?.tile === t.throne
              ? "ok"
              : (r.throne?.tile ?? "none")
            : "-",
          method:
            (r.debug?.method ?? "?") +
            (r.debug?.timing
              ? ` loc ${r.debug.timing.locate.toFixed(0)} cls ${r.debug.timing.classify.toFixed(0)} wasm ${r.debug.timing.cv.toFixed(0)}`
              : ""),
          ms,
          misses: [],
          unsure: [],
        };
        for (const cell of r.cells) {
          const key = `${cell.x},${cell.y}`;
          if (ignore.has(key)) continue;
          const want = t.cells[key];
          if (!want) {
            row.falsePos++;
            continue;
          }
          row.located++;
          const hit =
            cell.tile === want || (want === "ballroom" && !!cell.tile?.startsWith("ballroom"));
          if (hit) row.correct++;
          else
            row.misses.push(
              `${key} ${want}→${cell.tile ?? "?"} (${cell.confidence.toFixed(2)}; inl ${cell.score?.toFixed(0)} ratio ${cell.margin?.toFixed(2)}; rank ${cell.cands ? cell.cands.indexOf(want) : "?"})`,
            );
          if (cell.confidence >= CONF) {
            row.confident++;
            if (hit) row.confidentOk++;
          } else row.unsure.push(`${key} ${cell.tile} (${cell.confidence.toFixed(2)})`);
        }
        rows.push(row);
        // hard requirements: never a confident wrong read, never a missing/extra tile
        expect(row.confidentOk, `confident but wrong: ${row.misses.join("; ")}`).toBe(
          row.confident,
        );
        expect(row.located, "tiles located").toBe(row.tiles);
        expect(row.falsePos, "false positives").toBe(0);
      },
      60_000,
    );
  }

  it("summary", () => {
    const tot = rows.reduce(
      (a, r) => ({
        tiles: a.tiles + r.tiles,
        located: a.located + r.located,
        correct: a.correct + r.correct,
        confident: a.confident + r.confident,
        confidentOk: a.confidentOk + r.confidentOk,
        falsePos: a.falsePos + r.falsePos,
      }),
      { tiles: 0, located: 0, correct: 0, confident: 0, confidentOk: 0, falsePos: 0 },
    );
    const lines = rows.map(
      (r) =>
        `${r.photo}  tiles ${String(r.tiles).padStart(2)}  located ${String(r.located).padStart(2)}  fp ${r.falsePos}  correct ${String(r.correct).padStart(2)}  confident ${String(r.confident).padStart(2)}/${String(r.confidentOk).padStart(2)}  throne ${r.throne.padEnd(6)} ${r.method.padEnd(5)} ${String(r.ms).padStart(5)} ms` +
        (r.misses.length ? `\n      ${r.misses.join("\n      ")}` : "") +
        (r.unsure.length ? `\n      unsure: ${r.unsure.join(", ")}` : ""),
    );
    lines.push(
      `TOTAL     tiles ${tot.tiles}  located ${tot.located}  fp ${tot.falsePos}  correct ${tot.correct}  confident ${tot.confident}/${tot.confidentOk}` +
        `  → located ${((100 * tot.located) / tot.tiles).toFixed(1)} %, correct ${((100 * tot.correct) / tot.located).toFixed(1)} %, confident ${((100 * tot.confident) / tot.located).toFixed(1)} % (precision ${((100 * tot.confidentOk) / Math.max(1, tot.confident)).toFixed(1)} %)`,
    );
    console.log("\n" + lines.join("\n") + "\n");
    expect(rows.length).toBe(names.length);
  });
});
