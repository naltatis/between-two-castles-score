<script setup lang="ts">
import { computed, ref } from "vue";
import Glyph from "../components/Glyph.vue";
import Icon from "../components/Icon.vue";
import BonusCard from "../components/BonusCard.vue";
import { BONUS_CARDS } from "../game/bonus";
import { Board, scoreBonusCard } from "../game/score";
import type { CastleScore, Deco, Game } from "../game/types";
import { DECOS } from "../game/types";
import { DECO_LABEL } from "../icons";

const props = defineProps<{ title: string; game: Game; index: number; score: CastleScore }>();
const emit = defineEmits<{ back: []; finish: [] }>();

const castle = computed(() => props.game.castles[props.index]!);
const board = computed(() => new Board(castle.value));
const neighbours = computed(() => {
  const n = props.game.castles.length;
  return n >= 3
    ? [
        props.game.castles[(props.index + n - 1) % n]!,
        props.game.castles[(props.index + 1) % n]!,
      ].map((c) => new Board(c))
    : [];
});

// attendants
const decoCount = (d: Deco) => board.value.count((i) => board.value.deco(i) === d);
const attendantCount = (d: Deco) => castle.value.attendants.filter((a) => a === d).length;
function cycle(d: Deco) {
  const n = (attendantCount(d) + 1) % 3;
  castle.value.attendants = [
    ...castle.value.attendants.filter((a) => a !== d),
    ...Array<Deco>(n).fill(d),
  ];
}
const attendantSub = (d: Deco) => {
  const n = attendantCount(d);
  const rooms = `${decoCount(d)} Räume`;
  return n === 0 ? "keiner" : n === 2 ? `${rooms} ×2` : rooms;
};

// bonus cards
const all = ref(false);
const pts = computed(() =>
  Object.fromEntries(
    BONUS_CARDS.map((c) => [
      c.id,
      scoreBonusCard(board.value, c.id, { neighbours: neighbours.value }),
    ]),
  ),
);
const cards = computed(() => {
  const on = castle.value.bonusCards;
  const chosen = on.map((id) => BONUS_CARDS.find((c) => c.id === id)!).filter(Boolean);
  // full list keeps its fixed order so cards don't jump when toggled
  return all.value ? BONUS_CARDS : chosen;
});
function toggle(id: string) {
  const i = castle.value.bonusCards.indexOf(id);
  if (i >= 0) castle.value.bonusCards.splice(i, 1);
  else castle.value.bonusCards.push(id);
}
</script>

<template>
  <div class="screen">
    <div class="bar solid">
      <button type="button" class="icon-btn" aria-label="Zurück zum Schloss" @click="emit('back')">
        <Icon name="back" :size="22" />
      </button>
      <div class="grow">
        <div class="h title">{{ title }}</div>
        <div class="sub">Was liegt im Thronsaal und darunter?</div>
      </div>
      <div class="total">
        <b class="num">{{ score.total }}</b
        ><small>Punkte</small>
      </div>
    </div>

    <main class="body">
      <section>
        <div class="shead">
          <span class="section-title">Königliche Bedienstete</span>
          <b>+{{ score.categories.attendants }}</b>
        </div>
        <div class="atts">
          <button
            v-for="d in DECOS"
            :key="d"
            type="button"
            class="att"
            :class="{ on: attendantCount(d) }"
            :aria-label="`${DECO_LABEL[d]}: ${attendantSub(d)}`"
            @click="cycle(d)"
          >
            <Glyph :name="d" :size="24" />
            <span class="lbl">{{ DECO_LABEL[d] }}</span>
            <span class="sub">{{ attendantSub(d) }}</span>
          </button>
        </div>
        <div class="hint">Antippen = 1 Bediensteter, nochmal = 2, nochmal = keiner.</div>
      </section>

      <section>
        <div class="shead">
          <span class="section-title">Bonuskarten</span>
          <b>+{{ score.categories.bonusCards }}</b>
        </div>
        <div class="cards">
          <button
            v-for="c in cards"
            :key="c.id"
            type="button"
            class="card"
            :aria-label="`${c.textDe ?? c.text}, ${pts[c.id]} Punkte`"
            :aria-pressed="castle.bonusCards.includes(c.id)"
            @click="toggle(c.id)"
          >
            <BonusCard :card="c" :selected="castle.bonusCards.includes(c.id)" :points="pts[c.id]" />
          </button>
        </div>
        <div v-if="!cards.length" class="hint">Noch keine Bonuskarte gewählt.</div>
        <button type="button" class="btn dashed" @click="all = !all">
          <Icon name="search" :size="18" />{{
            all ? "Nur gewählte Karten zeigen" : `Alle ${BONUS_CARDS.length} Karten durchsuchen`
          }}
        </button>
      </section>
    </main>

    <div class="foot">
      <button type="button" class="btn" @click="emit('finish')">
        Schloss abschließen · {{ score.total }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.body {
  flex: 1;
  padding: 16px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.shead {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.shead b {
  font-size: 13px;
}
.atts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.att {
  height: 76px;
  border: 2px solid var(--border);
  border-radius: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0;
}
.att.on {
  border-color: var(--cta);
  background: var(--sel);
}
.att .lbl {
  font-size: 12px;
  font-weight: 600;
}
.att .sub {
  font-size: 11px;
  color: var(--muted);
}
.hint {
  font-size: 12px;
  color: var(--muted);
}
.cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.card {
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
}
.on .box {
  border-color: var(--cta);
  background: var(--cta);
}
.on .pts {
  color: var(--text);
}
</style>
