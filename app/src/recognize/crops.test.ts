/** diagnostic: dump the upright crops of selected cells to .vitest/crops/ for inspection */
import { commands } from "vite-plus/test/context";
import { describe, it } from "vite-plus/test";
import { locateTiles, warpQuad } from "./locate";

const WANT: Record<string, string[]> = {
  IMG_0148: ["0,3"],
  IMG_9692: ["0,1", "1,1"],
  IMG_9696: ["1,1", "2,0"],
  IMG_9698: ["2,0"],
};

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

describe("crop dump", () => {
  for (const [name, keys] of Object.entries(WANT)) {
    it(
      name,
      async () => {
        const id = await load(name);
        const loc = locateTiles({ w: id.width, h: id.height, d: id.data });
        if (!loc) return;
        for (const key of keys) {
          const cell = loc.cells.find((c) => `${c.x},${c.y}` === key);
          if (!cell) continue;
          const crop = warpQuad({ w: id.width, h: id.height, d: id.data }, cell.quad, 256);
          const c = document.createElement("canvas");
          c.width = c.height = 256;
          c.getContext("2d")!.putImageData(
            new ImageData(crop.d as Uint8ClampedArray<ArrayBuffer>, 256, 256),
            0,
            0,
          );
          const dataUrl = c.toDataURL("image/png");
          await commands.writeFile(
            `.vitest/crops/${name}_${key.replace(",", "_")}.png`,
            dataUrl.split(",")[1]!,
            "base64",
          );
        }
      },
      60_000,
    );
  }
});

describe("throne dump", () => {
  it("writes wide throne crops of all fixtures", async () => {
    const truth: Record<string, unknown> = await (await fetch("/test-fixtures/truth.json")).json();
    for (const name of Object.keys(truth)) {
      const id = await load(name);
      const img = { w: id.width, h: id.height, d: id.data };
      const loc = locateTiles(img);
      if (!loc) continue;
      const W = 768;
      const crop = warpQuad(img, loc.throne.quad, W, true);
      const c = document.createElement("canvas");
      c.width = crop.w;
      c.height = crop.h;
      c.getContext("2d")!.putImageData(
        new ImageData(crop.d as Uint8ClampedArray<ArrayBuffer>, crop.w, crop.h),
        0,
        0,
      );
      await commands.writeFile(
        `.vitest/crops/throne_${name}.png`,
        c.toDataURL("image/png").split(",")[1]!,
        "base64",
      );
    }
  }, 300_000);
});
