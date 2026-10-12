/** URL of a recognition data file in public/. Resolved against the page, not the worker script:
 * with a relative base ("./") a worker would otherwise look next to itself in /assets/. */
let base = "";
export function setDataBase(url: string): void {
  base = url;
}
export function dataUrl(file: string): string {
  return base + file;
}
