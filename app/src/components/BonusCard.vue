<script setup lang="ts">
import type { BonusCard } from "../game/bonus";
import type { GLYPH } from "../icons";
import { TYPE_COLOR } from "../icons";
import Glyph from "./Glyph.vue";

defineProps<{ card: BonusCard; selected?: boolean; points?: number }>();
const color = (g: string) => (TYPE_COLOR as Record<string, string>)[g] ?? "#2b2520";
type GlyphName = keyof typeof GLYPH;
</script>

<template>
  <div class="bcard" :class="{ selected }">
    <svg class="star" viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M20 3l4.9 10 11 1.6-8 7.7 1.9 10.9L20 28l-9.8 5.2 1.9-10.9-8-7.7 11-1.6z"
        fill="#e0b24c"
        stroke="#9a6b12"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <text x="20" y="25" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">
        {{ card.per }}
      </text>
    </svg>
    <span class="pro">pro</span>
    <span v-if="card.icons?.length" class="icons">
      <Glyph
        v-for="g in card.icons"
        :key="g"
        :name="g as GlyphName"
        :size="card.icons.length > 2 ? 14 : 26"
        :style="{ color: color(g) }"
      />
    </span>
    <span v-if="card.label" class="label">{{ card.label }}</span>
    <span v-if="points !== undefined" class="pts">{{ points }}</span>
  </div>
</template>

<style scoped>
.bcard {
  position: relative;
  aspect-ratio: 3 / 4;
  border: 3px solid #d9622b;
  border-radius: 8px;
  background: #f6f1e6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px;
  box-sizing: border-box;
  color: #2b2520;
}
.bcard.selected {
  outline: 3px solid var(--cta);
  outline-offset: 1px;
}
.star {
  width: 38px;
  height: 38px;
}
.pro {
  font-size: 9px;
  line-height: 1;
}
.icons {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 100%;
}
.label {
  font-size: 9px;
  line-height: 1.1;
  text-align: center;
  font-weight: 600;
}
.pts {
  position: absolute;
  right: 3px;
  bottom: 3px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--text);
  color: var(--score);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.selected .pts {
  background: var(--cta);
  color: #fff;
}
</style>
