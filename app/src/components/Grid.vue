<script setup lang="ts">
import { computed } from "vue";
import { TILES } from "../game/tiles";
import type { Castle } from "../game/types";
import Stone from "./Stone.vue";
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
/** pop-in order: outward from the throne */
const delay = (p: { x: number; y: number }) => {
  const rank = [...props.castle.tiles]
    .map((q) => Math.hypot(q.x - 0.5, q.y))
    .sort((a, b) => a - b)
    .indexOf(Math.hypot(p.x - 0.5, p.y));
  return `${250 + rank * 60}ms`;
};
const label = (i: number) => {
  const p = props.castle.tiles[i]!;
  const t = TILES[p.tile];
  return `${t ? (t.nameDe ?? t.name) : "Unbekanntes Plättchen"}, ${props.perTile[i] ?? 0} Punkte`;
};
</script>

<template>
  <div class="scroll">
    <div class="grid" :style="{ '--cols': cols }">
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
        class="cell"
        :style="{ ...pos(p, TILES[p.tile]?.type === 'throne'), animationDelay: delay(p) }"
        :aria-label="label(i)"
        @click="emit('pick', p.x, p.y)"
      >
        <Stone
          :tile="TILES[p.tile]"
          :points="perTile[i]"
          :unsure="review.includes(`${p.x},${p.y}`)"
          :selected="isSel(p.x, p.y)"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.scroll {
  container-type: inline-size;
  overflow-x: auto;
  padding: 8px;
  border-radius: 20px;
  background: var(--board);
}
.grid {
  --cell: max(34px, min(56px, (100cqw - (var(--cols) - 1) * 4px) / var(--cols)));
  display: grid;
  grid-template-columns: repeat(var(--cols), var(--cell));
  grid-auto-rows: var(--cell);
  gap: 4px;
  justify-content: center;
}
.empty {
  border: 1.5px dashed var(--board-line);
  border-radius: 23%;
  cursor: pointer;
  animation: fade 400ms ease-out 200ms both;
}
.empty.ground {
  background: rgba(251, 251, 246, 0.35);
}
.empty.sel {
  outline: 3px solid var(--cta);
  outline-offset: 1px;
}
.cell {
  padding: 0;
  border: 0;
  background: none;
  animation: pop 520ms var(--spring) both;
}
</style>
