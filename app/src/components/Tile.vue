<script setup lang="ts">
import { computed } from "vue";
import type { Tile } from "../game/types";
import { GLYPH, TYPE_COLOR, DIR_ROT } from "../icons";
import Glyph from "./Glyph.vue";

const props = defineProps<{ tile: Tile; points?: number; wide?: boolean }>();

const SPECIALTY = new Set(["throne", "tower", "fountain", "foyer", "ballroom"]);
const BLUE_BORDER = new Set(["outdoor", "tower", "fountain"]);
const color = computed(() => TYPE_COLOR[props.tile.type]);
const border = computed(() => (BLUE_BORDER.has(props.tile.type) ? "#7cc0e8" : "#d8d2c0"));

/** scoring line: [prefix text, glyph, suffix text] */
const rule = computed<[string, keyof typeof GLYPH | null, string]>(() => {
  const t = props.tile;
  const w = t.wants as keyof typeof GLYPH | undefined;
  switch (t.type) {
    case "food":
      return [
        "2 pro",
        w!,
        t.axis === "horizontal"
          ? "links/rechts"
          : t.axis === "below2"
            ? "2× darunter"
            : "oben/unten",
      ];
    case "living":
      return [`${t.per ?? 1} pro`, w!, "angrenzend"];
    case "utility":
      return ["1 pro verbundenem", w!, ""];
    case "outdoor":
      return ["1 pro", w!, "im Schloss"];
    case "sleeping":
      return ["4 falls alle Typen // 1", null, ""];
    case "corridor":
      return ["1 pro", w!, "angrenzend"];
    case "downstairs":
      return [`${t.per ?? 1} pro`, w!, t.column === "both" ? "in der Spalte" : "darüber"];
    case "activity":
      return ["1 pro Nachbar // 1 falls", w!, "angrenzend"];
    case "throne":
      return ["2 pro", w!, `/ ${t.wants2}`];
    case "tower":
      return ["1 pro Raum darunter", null, ""];
    case "fountain":
      return ["5", null, ""];
    case "foyer":
      return ["1 pro angrenzendem Raum", null, ""];
    case "ballroom":
      return ["1 pro", w!, "in Nachbarschlössern"];
    case "secret":
      return ["kopiert", null, { up: "▲", down: "▼", left: "◀", right: "▶" }[t.dir!]!];
    default:
      return ["", null, ""];
  }
});
</script>

<template>
  <div class="tile" :class="{ wide }" :style="{ borderColor: border, '--c': color }">
    <div class="banner">
      <Glyph v-if="SPECIALTY.has(tile.type)" name="specialty" :size="12" />
      <span class="name">{{ tile.nameDe ?? tile.name }}</span>
      <Glyph v-if="tile.deco" :name="tile.deco" :size="12" />
    </div>
    <div class="body">
      <Glyph
        :name="tile.type"
        :size="wide ? 44 : 30"
        :style="{ transform: `rotate(${DIR_ROT[tile.dir ?? ''] ?? 0}deg)` }"
      />
    </div>
    <div class="rule">
      {{ rule[0] }}
      <Glyph v-if="rule[1]" :name="rule[1]" :size="11" />
      {{ rule[2] }}
    </div>
    <span v-if="points !== undefined" class="points">{{ points }}</span>
  </div>
</template>

<style scoped>
.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  aspect-ratio: 1;
  background: #f3eedf;
  border: 4px solid;
  border-radius: 6px;
  color: #333;
  font-size: 9px;
  overflow: hidden;
  box-sizing: border-box;
}
.tile.wide {
  aspect-ratio: 2 / 1;
}
.banner {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 4px;
  background: var(--c);
  color: #fff;
  font-weight: 700;
  font-size: 7px;
  line-height: 1.1;
  text-transform: uppercase;
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}
.body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c);
}
.rule {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 2px;
  background: #e5dcc0;
  color: #222;
  flex-wrap: wrap;
  line-height: 1.15;
  text-align: center;
  min-height: 2.4em;
}
.points {
  position: absolute;
  top: 18px;
  right: 3px;
  min-width: 18px;
  padding: 1px 4px;
  border-radius: 9px;
  background: #222;
  color: #ffd700;
  font-weight: 700;
  font-size: 11px;
  text-align: center;
}
</style>
