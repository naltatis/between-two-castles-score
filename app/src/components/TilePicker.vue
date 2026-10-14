<script setup lang="ts">
import { computed, ref } from "vue";
import type { Tile, TileType } from "../game/types";
import { TYPE_COLOR, TYPE_LABEL } from "../icons";
import Icon from "./Icon.vue";
import Stone from "./Stone.vue";

import { TILE_LIST, TILES } from "../game/tiles";

const props = defineProps<{
  /** tile currently in the cell (undefined = empty cell) */
  current?: string;
  /** photo crop of the cell, when available */
  photo?: string;
  /** points the tile would score on this cell, and the change of the castle total */
  preview: (id: string) => { points: number; delta: number };
}>();
const cache = new Map<string, { points: number; delta: number }>();
const score = (id: string) => {
  if (!cache.has(id)) cache.set(id, props.preview(id));
  return cache.get(id)!;
};
const delta = computed(() => {
  const d = chosen.value && choice.value !== props.current ? score(choice.value).delta : 0;
  return d > 0 ? `+${d}` : d < 0 ? `−${-d}` : "";
});
const emit = defineEmits<{ select: [id: string]; remove: []; close: [] }>();

const cur = computed(() => (props.current ? TILES[props.current] : undefined));
/** the replacement is chosen first and applied with the swap button, never by a stray tap */
const choice = ref<string>("");
const chosen = computed(() => (choice.value ? TILES[choice.value] : undefined));
const name = (t: Tile) => t.nameDe ?? t.name;

const q = ref("");
const type = ref<TileType | "">("");
const TYPES = Object.keys(TYPE_LABEL).filter((t) => t !== "throne") as TileType[];

const list = computed<Tile[]>(() => {
  const s = q.value.trim().toLowerCase();
  return TILE_LIST.filter(
    (t) =>
      t.type !== "throne" &&
      (!type.value || t.type === type.value) &&
      (!s || t.name.toLowerCase().includes(s) || t.nameDe?.toLowerCase().includes(s)),
  );
});
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Plättchen wählen">
      <div class="handle" />
      <div class="swap">
        <img v-if="photo" class="shot" :src="photo" alt="Foto des Felds" />
        <div class="side">
          <div class="mini">
            <Stone v-if="cur" :tile="cur" :points="score(cur.id).points" />
            <div v-else class="nocard">leer</div>
          </div>
          <small>{{ cur ? name(cur) : "Feld leer" }}</small>
        </div>
        <Icon name="next" :size="22" :width="2.5" class="arrow" />
        <div class="side">
          <div v-if="chosen" :key="chosen.id" class="mini chosen">
            <Stone :tile="chosen" :points="score(chosen.id).points" />
            <span v-if="delta" class="delta" :class="{ neg: delta.startsWith('−') }">{{
              delta
            }}</span>
          </div>
          <div v-else class="mini"><div class="nocard">?</div></div>
          <small :class="{ strong: chosen }">{{ chosen ? name(chosen) : "unten wählen" }}</small>
        </div>
        <button type="button" class="icon-btn" aria-label="Schließen" @click="emit('close')">
          <Icon name="x" :size="22" />
        </button>
      </div>
      <div class="top">
        <Icon name="search" :size="18" />
        <input v-model="q" name="q" placeholder="Plättchen suchen" aria-label="Suchen" />
      </div>
      <div class="types">
        <button type="button" :class="{ on: type === '' }" @click="type = ''">alle</button>
        <button
          v-for="t in TYPES"
          :key="t"
          type="button"
          :class="{ on: type === t }"
          :style="{ '--c': TYPE_COLOR[t] }"
          @click="type = type === t ? '' : t"
        >
          {{ TYPE_LABEL[t][1] }}
        </button>
      </div>
      <div class="hint"><span class="chip num">3</span>Punkte auf diesem Feld</div>
      <div class="list">
        <button
          v-for="(t, i) in list"
          :key="t.id"
          type="button"
          class="item"
          :class="{ on: t.id === choice, cur: t.id === current }"
          :style="{ animationDelay: `${Math.min(i, 16) * 45}ms` }"
          :aria-pressed="t.id === choice"
          @click="choice = t.id === choice ? '' : t.id"
        >
          <span class="box"><Stone :tile="t" :points="score(t.id).points" /></span>
          <small>{{ t.nameDe ?? t.name }}</small>
        </button>
        <div v-if="!list.length" class="none">Nichts gefunden</div>
      </div>
      <div class="bottom">
        <button
          v-if="current !== undefined"
          type="button"
          class="btn secondary danger"
          @click="emit('remove')"
        >
          Entfernen
        </button>
        <button
          type="button"
          class="btn swapbtn"
          :disabled="!chosen || choice === current"
          @click="emit('select', choice)"
        >
          {{ cur ? "Tauschen" : "Einsetzen" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(24, 33, 27, 0.55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 10;
  animation: fade 300ms ease-out both;
}
.sheet {
  background: var(--bg);
  width: min(100%, 480px);
  height: 76dvh;
  display: flex;
  flex-direction: column;
  border-radius: 26px 26px 0 0;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.25);
  animation: sheet 620ms cubic-bezier(0.2, 0.9, 0.3, 1) 150ms both;
}
.handle {
  flex: none;
  width: 38px;
  height: 5px;
  margin: 8px auto 0;
  border-radius: 3px;
  background: var(--rail);
}
.swap {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 12px;
  border-bottom: 1px solid var(--border);
}
.swap .shot {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
  flex: none;
}
.arrow {
  flex: none;
  color: var(--muted);
}
.side {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}
.side small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.side .strong {
  font-weight: 700;
}
.mini {
  position: relative;
  width: 60px;
  height: 60px;
}
.mini.chosen {
  animation: pop 520ms var(--spring) both;
}
.mini.chosen :deep(.face) {
  outline: none;
  box-shadow:
    0 0 0 2px var(--bg),
    0 0 0 4.5px var(--cta);
}
.delta {
  position: absolute;
  right: -8px;
  top: -8px;
  min-width: 24px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: var(--green);
  color: #fff;
  font-weight: 700;
  font-size: 11px;
  display: grid;
  place-items: center;
  box-shadow: 0 0 0 2px var(--bg);
}
.delta.neg {
  background: #a01f2f;
}
.nocard {
  width: 100%;
  height: 100%;
  border: 2px dashed var(--dash);
  border-radius: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--muted);
}
.top {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 12px 8px;
  height: 44px;
  padding: 0 14px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: #fff;
  color: #8a937f;
}
.top input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  padding: 0;
  background: transparent;
  color: var(--text);
}
.types {
  flex: none;
  display: flex;
  gap: 6px;
  padding: 0 12px 10px;
  overflow-x: auto;
  scrollbar-width: none;
}
.types button {
  --c: var(--cta);
  flex: none;
  border: 1.5px solid var(--c);
  color: var(--c);
  background: #fff;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 600;
}
.types button.on {
  background: var(--c);
  color: #fff;
}
.hint {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px 8px;
  font-size: 12px;
  color: var(--muted);
}
.chip {
  min-width: 22px;
  height: 18px;
  padding: 0 5px;
  border-radius: 5px;
  background: var(--head-text);
  box-shadow: inset 0 0 0 1px var(--border);
  color: var(--head);
  font-family: var(--font-h);
  font-weight: 700;
  font-size: 13px;
  line-height: 19px;
  text-align: center;
}
.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-auto-rows: min-content;
  gap: 10px 8px;
  padding: 6px 12px 12px;
}
.item {
  border: 0;
  background: transparent;
  padding: 0;
  text-align: center;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  animation: pop 460ms var(--spring) 650ms both;
}
.item .box {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 25%;
  box-shadow: 0 2px 0 rgba(24, 33, 27, 0.08);
}
.item small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item.cur .box {
  box-shadow:
    0 0 0 2px var(--bg),
    0 0 0 3.5px var(--dash);
}
.item.on .box {
  box-shadow:
    0 0 0 2px var(--bg),
    0 0 0 5px var(--cta),
    0 12px 20px -8px rgba(24, 33, 27, 0.45);
  animation: bob 1.8s ease-in-out infinite;
}
.item.on small {
  font-weight: 700;
}
.none {
  grid-column: 1 / -1;
  padding: 20px;
  text-align: center;
  color: var(--muted);
}
.bottom {
  flex: none;
  display: flex;
  gap: 8px;
  padding: 10px 12px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border);
}
.bottom .btn {
  flex: 1;
  height: 50px;
  border-radius: 14px;
}
.bottom .swapbtn {
  flex: 1.4;
  font-size: 17px;
}
.bottom .btn:disabled {
  opacity: 0.45;
}
.danger {
  color: #a01f2f;
}
</style>
