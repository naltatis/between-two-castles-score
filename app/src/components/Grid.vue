<script setup lang="ts">
import { computed } from "vue";
import { TILES } from "../game/tiles";
import type { Castle } from "../game/types";
import { DIR_ROT, TYPE_COLOR } from "../icons";
import Glyph from "./Glyph.vue";
import Icon from "./Icon.vue";

const props = defineProps<{
  castle: Castle;
  perTile: number[];
  review: string[];
  /** cell currently being edited */
  selected?: { x: number; y: number } | null;
}>();
const isSel = (x: number, y: number) => props.selected?.x === x && props.selected?.y === y;
const emit = defineEmits<{ pick: [x: number, y: number] }>();

const bounds = computed(() => {
  const xs = props.castle.tiles.flatMap((p) =>
    TILES[p.tile]?.type === "throne" ? [p.x, p.x + 1] : [p.x],
  );
  const ys = props.castle.tiles.map((p) => p.y);
  return {
    minX: Math.min(-2, ...xs) - 1,
    maxX: Math.max(3, ...xs) + 1,
    minY: Math.min(-1, ...ys) - 1,
    maxY: Math.max(2, ...ys) + 1,
  };
});
const cols = computed(() => bounds.value.maxX - bounds.value.minX + 1);
const empties = computed(() => {
  const occ = new Set(
    props.castle.tiles.flatMap((p) =>
      TILES[p.tile]?.type === "throne" ? [`${p.x},${p.y}`, `${p.x + 1},${p.y}`] : [`${p.x},${p.y}`],
    ),
  );
  const out: { x: number; y: number }[] = [];
  for (let y = bounds.value.maxY; y >= bounds.value.minY; y--)
    for (let x = bounds.value.minX; x <= bounds.value.maxX; x++)
      if (!occ.has(`${x},${y}`)) out.push({ x, y });
  return out;
});
const pos = (p: { x: number; y: number }, wide = false) => ({
  gridColumn: `${p.x - bounds.value.minX + 1} / span ${wide ? 2 : 1}`,
  gridRow: `${bounds.value.maxY - p.y + 1}`,
});
const label = (i: number) => {
  const p = props.castle.tiles[i]!;
  const t = TILES[p.tile];
  return `${t ? (t.nameDe ?? t.name) : "Unbekanntes Plättchen"}, ${props.perTile[i] ?? 0} Punkte`;
};
</script>

<template>
  <div class="scroll">
    <div class="grid" :style="{ gridTemplateColumns: `repeat(${cols}, minmax(38px, 1fr))` }">
      <div
        v-for="e in empties"
        :key="`${e.x},${e.y}`"
        class="empty"
        :class="{ ground: e.y === 0, sel: isSel(e.x, e.y) }"
        :style="pos(e)"
        @click="emit('pick', e.x, e.y)"
      />
      <button
        v-for="(p, i) in castle.tiles"
        :key="i"
        type="button"
        class="tile"
        :class="{
          throne: TILES[p.tile]?.type === 'throne',
          unsure: review.includes(`${p.x},${p.y}`),
          unknown: !TILES[p.tile],
          sel: isSel(p.x, p.y),
        }"
        :style="{
          ...pos(p, TILES[p.tile]?.type === 'throne'),
          '--c': TILES[p.tile] ? TYPE_COLOR[TILES[p.tile]!.type] : '#9aa38c',
        }"
        :aria-label="label(i)"
        @click="emit('pick', p.x, p.y)"
      >
        <span class="banner" />
        <span v-if="TILES[p.tile]?.type === 'throne'" class="body h">
          <Icon name="crown" :size="13" :width="2.5" />Thron
        </span>
        <span v-else-if="TILES[p.tile]" class="body">
          <Glyph
            :name="TILES[p.tile]!.type"
            :size="18"
            :style="{ transform: `rotate(${DIR_ROT[TILES[p.tile]!.dir ?? ''] ?? 0}deg)` }"
          />
        </span>
        <span v-else class="body">?</span>
        <span class="badge">{{ review.includes(`${p.x},${p.y}`) ? "?" : perTile[i] }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.scroll {
  overflow-x: auto;
}
.grid {
  display: grid;
  grid-auto-rows: 38px;
  gap: 3px;
  min-width: 100%;
}
.empty {
  border: 1px dashed var(--rail);
  border-radius: 6px;
  cursor: pointer;
}
.empty.ground {
  background: var(--idle);
}
.tile {
  position: relative;
  padding: 0;
  border: 2px solid var(--border);
  border-radius: 6px;
  background: var(--card);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: var(--c);
}
.tile.unsure {
  border-color: var(--orange);
}
.sel {
  outline: 3px solid var(--cta);
  outline-offset: 1px;
}
.tile.unknown {
  border-style: dashed;
}
.banner {
  height: 11px;
  background: var(--c);
  flex: none;
}
.body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 3px;
  padding: 0 18px 0 5px;
  font-size: 11px;
  font-weight: 700;
}
.throne .body {
  justify-content: center;
  padding: 0 20px 0 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.badge {
  position: absolute;
  right: 2px;
  top: 11px;
  bottom: 0;
  margin: auto 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--text);
  color: var(--score);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.unsure .badge {
  background: var(--orange);
  color: #fff;
}
</style>
