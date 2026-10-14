<script setup lang="ts">
import { computed, ref } from "vue";
import Glyph from "../components/Glyph.vue";
import Grid from "../components/Grid.vue";
import Icon from "../components/Icon.vue";
import Stone from "../components/Stone.vue";
import TilePicker from "../components/TilePicker.vue";
import { useCountUp } from "../countUp";
import { scoreCastle } from "../game/score";
import { TILE_LIST, TILES } from "../game/tiles";
import type { Castle, CastleScore, Category, TileType } from "../game/types";
import { DECO_LABEL, ruleDe, TYPE_COLOR, TYPE_LABEL } from "../icons";

const props = defineProps<{
  title: string;
  castle: Castle;
  score: CastleScore;
  review: string[];
  /** photo crop per cell ("x,y"), when the castle was scanned in this session */
  crops?: Record<string, string>;
  /** neighbouring castles, for scoring candidates in the picker */
  neighbours: Castle[];
}>();
const total = useCountUp(() => props.score.total, 400, 1500);
const emit = defineEmits<{ back: []; next: []; "update:review": [keys: string[]] }>();

const THRONES = TILE_LIST.filter((t) => t.type === "throne");
// dev only: dump the corrected castle in test-fixtures/truth.json format (photo name by hand)
const DEV = import.meta.env.DEV;
function exportFixture() {
  const cells: Record<string, string> = {};
  let throne: string | undefined;
  for (const p of props.castle.tiles) {
    if (TILES[p.tile]?.type === "throne") throne = p.tile;
    else cells[`${p.x},${p.y}`] = p.tile;
  }
  const blob = new Blob([JSON.stringify({ cells, throne }, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${props.title.replace(/\W+/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
const throneIndex = computed(() =>
  props.castle.tiles.findIndex((p) => TILES[p.tile]?.type === "throne"),
);
const throneId = computed(() => props.castle.tiles[throneIndex.value]?.tile ?? "");
function setThrone(id: string) {
  if (throneIndex.value >= 0) props.castle.tiles[throneIndex.value]!.tile = id;
  else props.castle.tiles.unshift({ x: 0, y: 0, tile: id });
}
const throneLabel = (id: string) => {
  const t = TILES[id]!;
  const r = (k: string | undefined) => TYPE_LABEL[k as TileType][1];
  return `${r(t.wants)} / ${r(t.wants2)} · ${DECO_LABEL[t.deco!]}`;
};

// editing
const pick = ref<{ x: number; y: number } | null>(null);
const indexAt = (x: number, y: number) =>
  props.castle.tiles.findIndex(
    (p) => p.y === y && (p.x === x || (TILES[p.tile]?.type === "throne" && p.x + 1 === x)),
  );
const pickIndex = computed(() => (pick.value ? indexAt(pick.value.x, pick.value.y) : -1));
function onPick(x: number, y: number) {
  const i = indexAt(x, y);
  if (i >= 0 && TILES[props.castle.tiles[i]!.tile]?.type === "throne") return;
  pick.value = { x, y };
}
function settle(x: number, y: number) {
  emit(
    "update:review",
    props.review.filter((k) => k !== `${x},${y}`),
  );
}
function place(id: string) {
  if (pickIndex.value >= 0) props.castle.tiles[pickIndex.value]!.tile = id;
  else props.castle.tiles.push({ ...pick.value!, tile: id });
  settle(pick.value!.x, pick.value!.y);
  pick.value = null;
}
/** what a candidate tile would score on the picked cell, and how it changes the castle total */
function preview(id: string) {
  const i = pickIndex.value;
  const tiles = props.castle.tiles.map((p) => ({ ...p }));
  if (i >= 0) tiles[i]!.tile = id;
  else tiles.push({ ...pick.value!, tile: id });
  const s = scoreCastle({ ...props.castle, tiles }, { neighbours: props.neighbours });
  return { points: s.perTile[i >= 0 ? i : tiles.length - 1]!, delta: s.total - props.score.total };
}
function remove() {
  props.castle.tiles.splice(pickIndex.value, 1);
  settle(pick.value!.x, pick.value!.y);
  pick.value = null;
}

// confirm card for the next uncertain cell
const current = computed(() => {
  for (const k of props.review) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    const i = indexAt(x, y);
    if (i >= 0) return { x, y, i, tile: TILES[props.castle.tiles[i]!.tile] };
  }
  return null;
});
const reviewTotal = ref(props.review.length);

// legend
const CAT: Partial<Record<Category, TileType>> = {
  food: "food",
  living: "living",
  utility: "utility",
  outdoor: "outdoor",
  activity: "activity",
  sleeping: "sleeping",
  corridor: "corridor",
  downstairs: "downstairs",
  ballrooms: "ballroom",
  towers: "tower",
  fountains: "fountain",
  foyers: "foyer",
  throne: "throne",
};
const stats = computed(() => {
  const rows = (Object.keys(props.score.categories) as Category[])
    .filter((c) => props.score.categories[c] > 0)
    .map((c) => {
      const t = CAT[c];
      return {
        key: c,
        label: t ? TYPE_LABEL[t][1] : c === "bonusCards" ? "Bonus" : "Bedienstete",
        color: t ? TYPE_COLOR[t] : "#56614f",
        type: t,
        value: props.score.categories[c],
      };
    })
    .sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r) => ({ ...r, width: `${Math.round((r.value / max) * 100)}%` }));
});
</script>

<template>
  <div class="screen">
    <div class="bar solid">
      <button type="button" class="icon-btn" aria-label="Zurück zum Foto" @click="emit('back')">
        <Icon name="back" :size="22" />
      </button>
      <div class="grow">
        <div class="h title">{{ title }}</div>
        <div class="sub">
          {{ castle.tiles.length }} Plättchen<template v-if="review.length">
            · {{ review.length }} zu prüfen</template
          >
        </div>
      </div>
      <div class="total">
        <b class="num">{{ total }}</b
        ><small>Punkte</small>
      </div>
    </div>

    <main class="body">
      <Grid
        :castle="castle"
        :per-tile="score.perTile"
        :review="review"
        :selected="pick"
        @pick="onPick"
      />

      <label class="throne">
        <Icon name="crown" :size="16" :width="2.5" />
        <span>Thronsaal</span>
        <select :value="throneId" @change="setThrone(($event.target as HTMLSelectElement).value)">
          <option v-for="t in THRONES" :key="t.id" :value="t.id">{{ throneLabel(t.id) }}</option>
        </select>
      </label>

      <div v-if="stats.length" class="legend">
        <div class="lhead h">Punkte nach Raumtyp</div>
        <div v-for="(s, i) in stats" :key="s.key" class="stat">
          <span class="ico" :style="{ color: s.color }"
            ><Glyph v-if="s.type" :name="s.type" :size="12"
          /></span>
          <span class="lbl">{{ s.label }}</span>
          <span class="track"
            ><span
              :style="{
                width: s.width,
                background: s.color,
                animationDelay: `${1100 + i * 70}ms`,
              }"
          /></span>
          <b class="num">{{ s.value }}</b>
        </div>
      </div>

      <div v-if="current" class="confirm">
        <div class="chead">
          <span class="q">?</span>
          <span
            >Unsicher erkannt · {{ reviewTotal - review.length + 1 }} von {{ reviewTotal }}</span
          >
        </div>
        <div class="cbody">
          <img
            v-if="crops?.[`${current.x},${current.y}`]"
            class="shot"
            :src="crops[`${current.x},${current.y}`]"
            alt="Foto des Felds"
          />
          <div class="cardbox">
            <Stone
              :tile="current.tile"
              :points="current.tile ? score.perTile[current.i] : undefined"
            />
          </div>
          <div class="ctext">
            <template v-if="current.tile">
              <b>{{ current.tile.nameDe ?? current.tile.name }}</b>
              <small>
                {{ TYPE_LABEL[current.tile.type][1]
                }}<template v-if="current.tile.deco">
                  · {{ DECO_LABEL[current.tile.deco] }}</template
                >
                · {{ ruleDe(current.tile) }}
              </small>
            </template>
            <template v-else>
              <b>Nicht erkannt</b>
              <small>Plättchen wählen oder Feld leer lassen</small>
            </template>
          </div>
        </div>
        <div class="cbtns">
          <template v-if="current.tile">
            <button type="button" class="ok" @click="settle(current.x, current.y)">
              <Icon name="check" :size="18" :width="2.5" />Passt
            </button>
            <button type="button" class="alt" @click="pick = { x: current.x, y: current.y }">
              Anderes Plättchen
            </button>
          </template>
          <template v-else>
            <button type="button" class="ok" @click="pick = { x: current.x, y: current.y }">
              Plättchen wählen
            </button>
            <button
              type="button"
              class="alt"
              @click="
                pick = { x: current.x, y: current.y };
                remove();
              "
            >
              Leer lassen
            </button>
          </template>
        </div>
      </div>
    </main>

    <div class="foot">
      <button type="button" class="btn" @click="emit('next')">
        Weiter: Bedienstete &amp; Bonus
      </button>
      <button v-if="DEV" type="button" class="btn dashed" @click="exportFixture">
        Als Testfall exportieren
      </button>
    </div>

    <TilePicker
      v-if="pick"
      :current="pickIndex >= 0 ? castle.tiles[pickIndex]!.tile : undefined"
      :photo="crops?.[`${pick.x},${pick.y}`]"
      :preview="preview"
      @select="place"
      @remove="remove"
      @close="pick = null"
    />
  </div>
</template>

<style scoped>
.body {
  flex: 1;
  padding: 14px 12px 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.throne {
  animation: rise 450ms ease-out 900ms both;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}
.throne svg {
  color: #a01f2f;
}
.throne select {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 10px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: #fff;
  color: var(--text);
  font-weight: 600;
}
.legend {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px 16px;
  padding: 0 2px;
  animation: rise 450ms ease-out 1000ms both;
}
.lhead {
  grid-column: 1 / -1;
  font-size: 12px;
  color: var(--muted);
  padding-bottom: 1px;
}
.stat {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 15px;
  font-size: 11px;
}
.ico {
  width: 12px;
  display: flex;
  flex: none;
}
.lbl {
  width: 58px;
  flex: none;
  color: var(--muted);
  white-space: nowrap;
}
.track {
  flex: 1;
  min-width: 0;
  height: 8px;
  border-radius: 4px;
  background: #dfe3d2;
  display: flex;
  overflow: hidden;
}
.track span {
  border-radius: 4px;
  transform-origin: left;
  animation: grow 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.stat b {
  width: 16px;
  flex: none;
  text-align: right;
}
.confirm {
  background: #fff;
  border: 2px solid var(--orange);
  border-radius: 18px;
  padding: 12px 14px;
  animation: rise 500ms var(--spring) 1500ms both;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.chead {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
}
.q {
  background: var(--orange);
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  width: 20px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  animation: wiggle 2.4s ease-in-out 2.2s infinite;
}
.cbody {
  display: flex;
  gap: 10px;
}
.shot {
  width: 72px;
  height: 72px;
  flex: none;
  border-radius: 14px;
  object-fit: cover;
}
.cardbox {
  width: 72px;
  height: 72px;
  flex: none;
}
.ctext {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ctext b {
  font-size: 16px;
}
.ctext small {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.3;
  text-wrap: pretty;
}
.cbtns {
  display: flex;
  gap: 8px;
}
.cbtns button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 44px;
  border-radius: 12px;
  border: 0;
  font-size: 15px;
  transition: transform 140ms var(--spring);
}
.cbtns button:active {
  transform: scale(0.94);
}
.cbtns .ok {
  background: var(--green);
  color: #fff;
  font-weight: 700;
}
.cbtns .alt {
  background: transparent;
  border: 1.5px solid var(--border);
  font-weight: 600;
}
</style>
