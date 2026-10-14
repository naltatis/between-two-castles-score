import { onUnmounted, ref, watch } from "vue";

/** counts up from 0 (ease-out) the first time `target` is non-zero, then follows it directly */
export function useCountUp(target: () => number, delay = 0, duration = 1000) {
  const shown = ref(0);
  let raf = 0;
  let started = false;
  let done = false;
  watch(
    target,
    (v) => {
      if (done) shown.value = v;
      else if (v && !started) {
        started = true;
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
        const t0 = performance.now() + delay;
        const step = (now: number) => {
          const p = Math.min(1, Math.max(0, (now - t0) / duration));
          shown.value = Math.round(target() * (1 - (1 - p) ** 3));
          if (p < 1) raf = requestAnimationFrame(step);
          else finish();
        };
        raf = requestAnimationFrame(step);
      }
    },
    { immediate: true },
  );
  function finish() {
    done = true;
    shown.value = target();
  }
  onUnmounted(() => cancelAnimationFrame(raf));
  return shown;
}
