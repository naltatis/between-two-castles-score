<script setup lang="ts">
import type { Tile } from "../game/types";
import { DIR_ROT, TYPE_COLOR } from "../icons";
import Glyph from "./Glyph.vue";
import Icon from "./Icon.vue";

/** a tile as a game piece: type colour, white symbol, points on a cream base. Fills its parent box. */
defineProps<{
  tile?: Tile;
  points?: number | string;
  unsure?: boolean;
  selected?: boolean;
}>();
</script>

<template>
  <div class="stone">
    <div
      class="face"
      :class="{ unsure, selected }"
      :style="{ '--c': tile ? TYPE_COLOR[tile.type] : 'var(--dash)' }"
    >
      <span v-if="tile?.type === 'throne'" class="sym h throne">
        <Icon name="crown" class="crown" :width="2.25" />Thron
      </span>
      <span v-else class="sym">
        <Glyph
          v-if="tile"
          :name="tile.type"
          class="glyph"
          :style="{ transform: `rotate(${DIR_ROT[tile.dir ?? ''] ?? 0}deg)` }"
        />
        <template v-else>?</template>
      </span>
      <span v-if="unsure || points !== undefined" class="band num">{{
        unsure ? "?" : points
      }}</span>
    </div>
  </div>
</template>

<style scoped>
.stone {
  container-type: size;
  width: 100%;
  height: 100%;
}
.face {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 25cqmin;
  overflow: hidden;
  background: var(--c);
  color: #fff;
  display: flex;
  flex-direction: column;
}
.face.unsure {
  overflow: visible;
  animation: ring 1.6s ease-out 1.4s infinite;
}
.face.selected {
  outline: 3px solid var(--cta);
  outline-offset: 1px;
}
.sym {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 34cqmin;
}
.glyph {
  width: 40cqmin;
  height: 40cqmin;
}
.throne {
  gap: 0.3em;
  font-size: 23cqmin;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.crown {
  width: 1.4em;
  height: 1.4em;
}
.band {
  flex: none;
  height: 37cqmin;
  background: var(--head-text);
  color: var(--head);
  font-family: var(--font-h);
  font-weight: 700;
  font-size: 28cqmin;
  line-height: 38cqmin;
  text-align: center;
}
/* the unsure ring needs overflow visible, so the band rounds its own bottom corners */
.unsure .band {
  background: var(--orange);
  color: #fff;
  border-radius: 0 0 25cqmin 25cqmin;
}
</style>
