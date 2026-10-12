/** Castle recognition from a photo. Coordinates follow the game model (throne at (0,0)/(1,0), y up). */
import type { WorkerResult } from "./worker";

export interface RecognizedCell {
  x: number;
  y: number;
  /** [left, top, right, bottom] in pixels of `imageUrl` */
  box: [number, number, number, number];
  tile?: string;
  confidence: number;
  score?: number;
  margin?: number;
  cands?: string[];
  /** small upright photo crop of the cell (data URL) */
  cropUrl?: string;
}
export interface Recognition {
  cells: RecognizedCell[];
  throne?: { box: [number, number, number, number]; tile?: string };
  imageSize: [number, number];
  /** rectified photo the boxes refer to (falls back to the original when absent) */
  imageUrl?: string;
  debug?: { method: string; tilePx: number };
}

let worker: Worker | null = null;

function runWorker(
  id: ImageData,
  exclude = "",
  onProgress?: (stage: string) => void,
): Promise<WorkerResult | null> {
  worker ??= new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const w = worker;
  return new Promise((resolve, reject) => {
    const onMessage = (ev: MessageEvent<WorkerResult | null | { progress: string }>) => {
      if (ev.data && "progress" in ev.data) {
        onProgress?.(ev.data.progress);
        return;
      }
      cleanup();
      resolve(ev.data);
    };
    const onError = (ev: ErrorEvent) => {
      cleanup();
      worker = null; // a crashed worker is replaced next time
      reject(ev.error ?? new Error(ev.message));
    };
    const cleanup = () => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    const pixels = id.data.buffer as ArrayBuffer;
    const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
    w.postMessage({ w: id.width, h: id.height, pixels, base, exclude }, [pixels]);
  });
}

/** `exclude`: benchmark only — ignore references harvested from this photo */
export async function recognize(
  canvas: HTMLCanvasElement,
  exclude = "",
  onProgress?: (stage: string) => void,
): Promise<Recognition> {
  const id = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
  const res = await runWorker(id, exclude, onProgress);
  if (!res) return { cells: [], imageSize: [canvas.width, canvas.height] };
  const rect = document.createElement("canvas");
  rect.width = res.w;
  rect.height = res.h;
  rect
    .getContext("2d")!
    .putImageData(new ImageData(new Uint8ClampedArray(res.pixels), res.w, res.h), 0, 0);
  const cells = res.cells.map(({ crop, ...c }) => {
    if (!crop) return c;
    const cv = document.createElement("canvas");
    cv.width = crop.w;
    cv.height = crop.h;
    cv.getContext("2d")!.putImageData(
      new ImageData(new Uint8ClampedArray(crop.d), crop.w, crop.h),
      0,
      0,
    );
    return { ...c, cropUrl: cv.toDataURL("image/jpeg", 0.8) };
  });
  return {
    cells,
    throne: res.throne,
    imageSize: [res.w, res.h],
    imageUrl: rect.toDataURL("image/jpeg", 0.8),
    debug: { method: res.method, tilePx: res.tilePx },
  };
}
