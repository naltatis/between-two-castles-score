<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Icon from "../components/Icon.vue";
import { TILES } from "../game/tiles";
import type { Deco } from "../game/types";
import { DECO_LABEL, TYPE_LABEL } from "../icons";
import { recognize, type Recognition } from "../recognize";

const props = defineProps<{ title: string; photo: { canvas: HTMLCanvasElement; url: string } }>();
const emit = defineEmits<{ back: []; apply: [r: Recognition] }>();

const rec = ref<Recognition | null>(null);
const failed = ref(false);
/** error text when recognition crashed (device/browser problem, not a photo problem) */
const error = ref("");
const stage = ref("Foto übergeben");
const seconds = ref(0);
onMounted(async () => {
  const t0 = performance.now();
  const tick = setInterval(
    () => (seconds.value = Math.round((performance.now() - t0) / 1000)),
    500,
  );
  try {
    rec.value = await recognize(props.photo.canvas, "", (s) => (stage.value = s));
  } catch (e) {
    failed.value = true;
    error.value = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error("recognition failed", e);
  } finally {
    clearInterval(tick);
  }
});

const unsure = computed(() => rec.value?.cells.filter((c) => !c.tile || c.confidence < 0.8) ?? []);
const extent = computed(() => {
  const cells = rec.value?.cells ?? [];
  const xs = [0, 1, ...cells.map((c) => c.x)];
  const ys = [0, ...cells.map((c) => c.y)];
  return {
    cols: Math.max(...xs) - Math.min(...xs) + 1,
    rows: Math.max(...ys) - Math.min(...ys) + 1,
  };
});
const throneText = computed(() => {
  const t = rec.value?.throne?.tile ? TILES[rec.value.throne.tile] : undefined;
  if (!t) return "";
  const r = (k: string | undefined) => (k ? TYPE_LABEL[k as keyof typeof TYPE_LABEL][1] : "");
  return `${r(t.wants)} / ${r(t.wants2)} · ${DECO_LABEL[t.deco as Deco]}`;
});
const empty = computed(() => rec.value && !rec.value.cells.length && !rec.value.throne);
/** one line of diagnostics for phone reports */
const diag = computed(() => {
  const t = rec.value?.debug?.timing;
  if (!t) return "";
  const [w, h] = rec.value!.imageSize;
  const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
  return (
    `${w}×${h} · ${seconds.value} s · Suche ${s(t.locate)} · Erkennen ${s(t.classify)} · OpenCV ${s(t.cv)}` +
    (t.brute ? ` · ${t.brute}× Breitensuche` : "") +
    ` · JS ${rec.value!.debug?.jsMain ?? "?"}/${t.js} ms`
  );
});
const mid = (b: [number, number, number, number]) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
/** marker radius in image pixels (~10 px on a 358 px wide display) */
const mark = computed(() => ((rec.value?.imageSize[0] ?? 1000) / 358) * 10);
</script>

<template>
  <div class="screen dark">
    <div class="bar">
      <button type="button" class="icon-btn" aria-label="Neues Foto" @click="emit('back')">
        <Icon name="back" :size="22" />
      </button>
      <div class="grow">
        <div class="h title">{{ title }}</div>
      </div>
    </div>

    <div class="photo">
      <div class="wrap">
        <img :src="rec?.imageUrl ?? photo.url" alt="Fotografiertes Schloss" />
        <svg
          v-if="rec"
          class="overlay"
          :viewBox="`0 0 ${rec.imageSize[0]} ${rec.imageSize[1]}`"
          preserveAspectRatio="none"
        >
          <rect
            v-for="(c, i) in rec.cells"
            :key="i"
            :x="c.box[0]"
            :y="c.box[1]"
            :width="c.box[2] - c.box[0]"
            :height="c.box[3] - c.box[1]"
            :class="{ unsure: !c.tile || c.confidence < 0.8 }"
          />
          <rect
            v-if="rec.throne"
            class="throne"
            :x="rec.throne.box[0]"
            :y="rec.throne.box[1]"
            :width="rec.throne.box[2] - rec.throne.box[0]"
            :height="rec.throne.box[3] - rec.throne.box[1]"
          />
          <g
            v-for="(c, i) in unsure"
            :key="`u${i}`"
            class="mark"
            :style="{ fontSize: `${mark * 1.3}px` }"
          >
            <circle :cx="mid(c.box)[0]" :cy="mid(c.box)[1]" :r="mark" />
            <text :x="mid(c.box)[0]" :y="mid(c.box)[1]" :dy="mark * 0.45">?</text>
          </g>
        </svg>
      </div>
    </div>

    <div v-if="!rec && !failed" class="card wait">
      Erkennung läuft… <small>{{ stage }} · {{ seconds }} s</small>
    </div>
    <div v-else-if="failed || empty" class="card">
      <div class="row">
        <span class="ic q">?</span>
        <div>
          <b>{{ error ? "Erkennung abgebrochen" : "Kein Schloss erkannt" }}</b>
          <small v-if="error">{{ error }}</small>
          <small v-else
            >Ganzes Schloss von oben, Kanten parallel zum Bildrand – dann neues Foto</small
          >
        </div>
      </div>
    </div>
    <div v-else-if="rec" class="card">
      <div class="row">
        <span class="ic ok"><Icon name="check" :width="2.5" /></span>
        <div>
          <b>{{ rec.cells.length }} Plättchen gefunden</b>
          <small>{{ extent.cols }} Spalten, {{ extent.rows }} Stockwerke</small>
        </div>
      </div>
      <div class="row">
        <span class="ic" :class="rec.throne ? 'ok' : 'q'"><Icon name="crown" :width="2.25" /></span>
        <div>
          <b>{{ rec.throne ? "Thronsaal erkannt" : "Thronsaal nicht erkannt" }}</b>
          <small>{{
            rec.throne
              ? throneText || "Typ im nächsten Schritt wählen"
              : "Im nächsten Schritt wählen"
          }}</small>
        </div>
      </div>
      <div class="row">
        <span class="ic" :class="unsure.length ? 'q' : 'ok'">
          <template v-if="unsure.length">?</template><Icon v-else name="check" :width="2.5" />
        </span>
        <div>
          <b>{{ unsure.length }} Plättchen unsicher</b>
          <small>{{
            unsure.length ? "Im nächsten Schritt kurz bestätigen" : "Alles eindeutig erkannt"
          }}</small>
        </div>
      </div>
    </div>

    <div class="spacer" />
    <div class="foot">
      <button v-if="failed || empty" type="button" class="btn light" @click="emit('back')">
        Neues Foto
      </button>
      <template v-else>
        <small v-if="diag" class="diag">{{ diag }}</small>
        <button type="button" class="btn light" :disabled="!rec" @click="rec && emit('apply', rec)">
          Weiter zum Schloss
        </button>
        <button type="button" class="btn secondary" @click="emit('back')">Neues Foto</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.photo {
  position: relative;
  margin: 8px 16px 0;
  border-radius: 16px;
  overflow: hidden;
  background: #000;
  max-height: 45dvh;
  display: flex;
  justify-content: center;
}
.wrap {
  position: relative;
  display: inline-block;
}
.photo img {
  display: block;
  max-width: 100%;
  max-height: 45dvh;
  object-fit: contain;
}
.overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.overlay rect {
  fill: none;
  stroke: var(--green-light);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}
.overlay rect.unsure {
  stroke: var(--orange);
}
.overlay rect.throne {
  stroke: var(--score);
  stroke-width: 3;
}
.mark circle {
  fill: var(--orange);
}
.mark text {
  fill: #fff;
  font-family: var(--font-b);
  font-weight: 700;
  text-anchor: middle;
}
.card {
  margin: 16px 16px 0;
  background: var(--dark-card);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.card.wait {
  text-align: center;
  opacity: 0.8;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.row b {
  display: block;
  font-size: 16px;
}
.row small {
  font-size: 13px;
  opacity: 0.7;
}
.ic {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 18px;
}
.ic.ok {
  background: var(--green);
}
.ic.gold {
  background: var(--score);
  color: var(--dark);
}
.ic.q {
  background: var(--orange);
}
.foot {
  padding-top: 16px;
}
.diag {
  display: block;
  padding: 0 20px 8px;
  font-size: 11px;
  opacity: 0.6;
}
</style>
