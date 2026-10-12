<script setup lang="ts">
import { computed } from "vue";
import Icon from "../components/Icon.vue";
import type { scoreGame } from "../game/score";
import type { Game } from "../game/types";

const props = defineProps<{ game: Game; result: ReturnType<typeof scoreGame> }>();
const emit = defineEmits<{ back: []; edit: [i: number]; newGame: [] }>();

const allDone = computed(() => props.game.castles.every((c) => c.done));
const rows = computed(() => [...props.result.players].sort((a, b) => a.rank - b.rank));
const winners = computed(() => rows.value.filter((p) => p.rank === 1));
const pairName = (i: number) =>
  `${props.game.players[i]} & ${props.game.players[(i + 1) % props.game.players.length]}`;

const tieNote = computed(() => {
  const r = rows.value;
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1]!,
      b = r[i]!;
    if (a.final !== b.final) continue;
    if (a.rank === b.rank) return `${a.name} und ${b.name} teilen sich Platz ${a.rank}.`;
    const why =
      Math.max(...a.castles) !== Math.max(...b.castles)
        ? `${a.name}s stärkeres Schloss entscheidet.`
        : `${a.name} hat mehr Sonderräume.`;
    return `${a.name} und ${b.name} liegen gleich; ${why}`;
  }
  return "";
});
</script>

<template>
  <div class="screen">
    <header class="head big">
      <div class="row">
        <button type="button" class="icon-btn" aria-label="Zur Übersicht" @click="emit('back')">
          <Icon name="back" :size="22" />
        </button>
        <div class="h title">{{ allDone ? "Endwertung" : "Zwischenstand" }}</div>
      </div>
      <div class="winner">
        <span class="crown"><Icon name="crown" :size="36" /></span>
        <div>
          <div class="sub">
            {{
              allDone
                ? "Baumeister des Königs"
                : `${game.castles.filter((c) => c.done).length} von ${game.castles.length} Schlössern gewertet`
            }}
          </div>
          <div class="h wname">
            {{ winners.map((w) => w.name).join(" & ") }} · {{ winners[0]?.final }}
          </div>
        </div>
      </div>
    </header>

    <main class="body">
      <section class="table">
        <div class="trow thead">
          <span /><span>Spieler</span><span class="r">links</span><span class="r">rechts</span
          ><span class="r">Wertung</span>
        </div>
        <div v-for="p in rows" :key="p.name" class="trow" :class="{ win: p.rank === 1 }">
          <span class="h rank">{{ p.rank }}</span>
          <span class="pname">{{ p.name }}</span>
          <span class="num r" :class="{ dim: p.castles[0] !== p.final }">{{ p.castles[0] }}</span>
          <span class="num r" :class="{ dim: p.castles[1] !== p.final }">{{ p.castles[1] }}</span>
          <span class="num h r final">{{ p.final }}</span>
        </div>
        <div class="note">
          Die Wertung ist das schwächere der zwei Schlösser (schwarz). {{ tieNote }}
        </div>
      </section>

      <section>
        <div class="section-title">Schlösser</div>
        <div class="castles">
          <button
            v-for="(c, i) in game.castles"
            :key="i"
            type="button"
            class="ccard"
            @click="emit('edit', i)"
          >
            <span class="cp">{{ pairName(i) }}</span>
            <span class="h num ct">{{ result.castles[i]!.total }}</span>
            <span class="cn">{{ c.tiles.length }} Plättchen{{ c.done ? "" : " · offen" }}</span>
          </button>
        </div>
      </section>
    </main>

    <div class="foot">
      <button type="button" class="btn" @click="emit('newGame')">Neues Spiel</button>
    </div>
  </div>
</template>

<style scoped>
.head.big {
  padding: 12px 20px 24px;
  gap: 14px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: -8px;
}
.row .title {
  font-size: 18px;
}
.winner {
  display: flex;
  align-items: center;
  gap: 16px;
}
.crown {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--score);
  color: var(--score-text);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.wname {
  font-size: 32px;
  line-height: 1;
  margin-top: 2px;
}
.body {
  flex: 1;
  padding: 20px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.trow {
  display: grid;
  grid-template-columns: 28px 1fr 48px 48px 60px;
  gap: 8px;
  align-items: center;
  padding: 12px;
  border-radius: 12px;
  background: #fff;
  border: 2px solid var(--border);
}
.trow.thead {
  padding: 0 12px;
  background: transparent;
  border: 0;
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.trow.win {
  background: var(--sel);
  border-color: var(--sel-border);
}
.r {
  text-align: right;
}
.rank {
  font-size: 18px;
  color: var(--muted);
}
.pname {
  font-weight: 700;
  font-size: 17px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trow .num {
  font-size: 15px;
}
.dim {
  color: var(--dash);
}
.final {
  font-size: 24px;
}
.note {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.4;
  padding: 2px 4px 0;
}
.castles {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ccard {
  flex: 1 1 30%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px;
  border-radius: 12px;
  background: #fff;
  border: 1.5px solid var(--border);
  text-align: left;
}
.cp,
.cn {
  font-size: 12px;
  color: var(--muted);
}
.cn {
  font-size: 11px;
}
.ct {
  font-size: 26px;
  line-height: 1;
}
</style>
