<script setup lang="ts">
import { computed, ref } from "vue";
import type { Tile, TileType } from "../game/types";
import { TYPE_COLOR, TYPE_LABEL } from "../icons";
import Icon from "./Icon.vue";
import TileCard from "./Tile.vue";

import { TILE_LIST, TILES } from "../game/tiles";

const props = defineProps<{
  /** tile currently in the cell (undefined = empty cell) */
  current?: string;
  /** photo crop of the cell, when available */
  photo?: string;
}>();
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
      <div class="swap">
        <img v-if="photo" class="shot" :src="photo" alt="Foto des Felds" />
        <div class="side">
          <TileCard v-if="cur" :tile="cur" />
          <div v-else class="nocard">leer</div>
          <small>{{ cur ? name(cur) : "Feld leer" }}</small>
        </div>
        <Icon name="next" :size="22" :width="2.5" />
        <div class="side">
          <TileCard v-if="chosen" :tile="chosen" />
          <div v-else class="nocard">?</div>
          <small>{{ chosen ? name(chosen) : "unten wählen" }}</small>
        </div>
        <button type="button" class="icon-btn" aria-label="Schließen" @click="emit('close')">
          <Icon name="x" :size="22" />
        </button>
      </div>
      <div class="top">
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
      <div class="list">
        <button
          v-for="t in list"
          :key="t.id"
          type="button"
          class="item"
          :class="{ on: t.id === choice, cur: t.id === current }"
          :aria-pressed="t.id === choice"
          @click="choice = t.id === choice ? '' : t.id"
        >
          <TileCard :tile="t" />
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
          class="btn"
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
}
.sheet {
  background: var(--bg);
  width: min(100%, 480px);
  max-height: 72dvh;
  display: flex;
  flex-direction: column;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.2);
}
.swap {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 12px 6px;
  border-bottom: 1px solid var(--border);
}
.swap .shot {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
  flex: none;
}
.side {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  font-size: 11px;
}
.side :deep(.tile) {
  width: 64px;
}
.side small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nocard {
  width: 64px;
  height: 64px;
  border: 3px dashed var(--border);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--muted);
}
.top {
  flex: none;
  display: flex;
  gap: 6px;
  padding: 10px 12px 8px;
}
.top input {
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 14px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  background: #fff;
  font-size: 16px;
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
  --c: var(--muted);
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
.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 8px;
  padding: 4px 12px 12px;
}
.item {
  border: 0;
  background: transparent;
  padding: 0;
  text-align: center;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.item small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item.cur :deep(.tile) {
  outline: 2px dashed var(--muted);
}
.item.on :deep(.tile) {
  outline: 3px solid var(--cta);
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
  padding: 8px 12px 16px;
  border-top: 1px solid var(--border);
}
.bottom .btn {
  flex: 1;
}
.bottom .btn:disabled {
  opacity: 0.45;
}
.danger {
  color: #a01f2f;
}
</style>
