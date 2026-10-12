/** ms for a fixed JS loop: ~10 ms with a JIT, hundreds of ms in an interpreter. Run on the main
 * thread and in the worker to tell "slow device" from "slow worker". */
export function jsSpeed(): number {
  const t = performance.now();
  const a = new Float32Array(1 << 16);
  let acc = 0;
  for (let k = 0; k < 200; k++) for (let i = 0; i < a.length; i++) acc += a[i]! += i & 7;
  return Math.round(performance.now() - t) + (acc === 1 ? 1 : 0);
}
