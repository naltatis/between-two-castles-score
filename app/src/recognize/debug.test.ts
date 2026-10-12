/** diagnostic: which truth cells the locator misses and what lies there instead */
import { describe, it } from "vite-plus/test";
import { locateTiles, type LocateDebug } from "./locate";

const truth: Record<string, { cells: Record<string, string> }> = await (
  await fetch("/test-fixtures/truth.json")
).json();

async function load(name: string) {
  const blob = await (await fetch(`/test-fixtures/${name}.jpg`)).blob();
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const g = c.getContext("2d")!;
  g.drawImage(bmp, 0, 0);
  return g.getImageData(0, 0, c.width, c.height);
}

describe("locate diagnostics", () => {
  for (const name of ["IMG_0145", "IMG_9694", "IMG_9695", "IMG_9698"]) {
    it(
      name,
      async () => {
        const id = await load(name);
        const dbg: LocateDebug = {
          variants: [],
          side: 0,
          regions: [],
          rejected: [],
          wide: [],
          thrones: [],
        };
        const loc = locateTiles({ w: id.width, h: id.height, d: id.data }, dbg);
        const lines = [
          `${name}: variants ${dbg.variants.join("/")} side ${dbg.side.toFixed(0)} regions ${dbg.regions.length} used ${dbg.regions.filter((r) => r.used).length}`,
        ];
        lines.push(`  thrones: ${dbg.thrones.join(" | ")}`);
        if (!loc) {
          lines.push("  no location");
        } else {
          const found = new Set(loc.cells.map((c) => `${c.x},${c.y}`));
          const th = loc.throne.box;
          const ox = (th[0] + th[2]) / 2 - (loc.ax[0] * loc.tilePx) / 2,
            oy = (th[1] + th[3]) / 2 - (loc.ax[1] * loc.tilePx) / 2;
          for (const [k] of Object.entries(truth[name]!.cells)) {
            if (found.has(k)) continue;
            const [x, y] = k.split(",").map(Number) as [number, number];
            const ex = ox + (x * loc.ax[0] + y * loc.ay[0]) * loc.tilePx,
              ey = oy + (x * loc.ax[1] + y * loc.ay[1]) * loc.tilePx;
            const near = dbg.regions
              .map((r) => ({ r, d: Math.hypot(r.cx - ex, r.cy - ey) / loc.tilePx }))
              .sort((a, b) => a.d - b.d)[0];
            lines.push(
              `  MISSING ${k}: nearest region ${near ? `${near.d.toFixed(2)} tiles away, ${near.r.w.toFixed(0)}x${near.r.h.toFixed(0)} fill ${near.r.fill.toFixed(2)} used=${near.r.used}` : "none"}`,
            );
          }
          lines.push(`  found: ${loc.cells.map((c) => `${c.x},${c.y}`).join(" ")}`);
          const extra = loc.cells.filter((c) => !truth[name]!.cells[`${c.x},${c.y}`]);
          if (extra.length)
            lines.push(
              `  EXTRA ${extra.map((c) => `${c.x},${c.y}${c.inferred ? "(inferred)" : ""} box ${c.box.map((v) => v.toFixed(0)).join(",")}`).join(" | ")}`,
            );
          lines.push(
            `  inferred: ${
              loc.cells
                .filter((c) => c.inferred)
                .map((c) => `${c.x},${c.y}`)
                .join(" ") || "-"
            }`,
          );
        }
        console.log(lines.join("\n"));
      },
      60_000,
    );
  }
});
