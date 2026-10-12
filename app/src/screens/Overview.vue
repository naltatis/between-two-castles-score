<script setup lang="ts">
import { computed } from "vue";
import Icon from "../components/Icon.vue";
import type { CastleScore, Game } from "../game/types";

const props = defineProps<{ game: Game; scores: CastleScore[] }>();
const emit = defineEmits<{
  players: [];
  results: [];
  scan: [i: number];
  edit: [i: number];
  newGame: [];
}>();

const doneCount = computed(() => props.game.castles.filter((c) => c.done).length);
</script>

<template>
  <div class="screen">
    <header class="head">
      <div class="h title">Zwischen zwei Schlössern</div>
      <div class="sub">
        {{ game.players.length }} Spieler · {{ doneCount }} von {{ game.castles.length }} Schlössern
        gewertet
      </div>
    </header>

    <main class="body">
      <div class="top">
        <div class="section-title">Tischrunde</div>
        <div class="links">
          <button type="button" @click="emit('players')">
            <Icon name="users" :size="18" />Spieler
          </button>
          <button type="button" @click="emit('results')">
            <Icon name="trophy" :size="18" />Zwischenstand
          </button>
        </div>
      </div>

      <div class="chain">
        <template v-for="(c, i) in game.castles" :key="i">
          <div class="player" :class="{ first: i === 0 }">
            <div class="railcol">
              <span class="rail" /><span class="dot"><Icon name="user" :size="18" /></span>
            </div>
            <div class="name">{{ game.players[i] }}</div>
          </div>
          <div class="castle">
            <div class="railcol"><span class="rail full" /></div>
            <div class="card">
              <div v-if="c.done" class="box score num">{{ scores[i]!.total }}</div>
              <div v-else class="box idle"><Icon name="castle" :size="24" /></div>
              <div class="info">
                <div class="cname">Schloss {{ i + 1 }}</div>
                <div class="state">
                  {{ c.done ? `gewertet · ${c.tiles.length} Plättchen` : "noch offen" }}
                </div>
              </div>
              <button
                v-if="c.done"
                type="button"
                class="edit"
                :aria-label="`Schloss ${i + 1} bearbeiten`"
                @click="emit('edit', i)"
              >
                <Icon name="edit" />
              </button>
              <button v-else type="button" class="cta" @click="emit('scan', i)">
                <Icon name="camera" />Scannen
              </button>
            </div>
          </div>
        </template>
        <div class="player last">
          <div class="railcol">
            <span class="rail" /><span class="dot"><Icon name="user" :size="18" /></span>
          </div>
          <div class="name">{{ game.players[0] }}</div>
        </div>
      </div>
    </main>

    <div class="foot center">
      <button type="button" class="btn ghost" @click="emit('newGame')">Neues Spiel</button>
    </div>
  </div>
</template>

<style scoped>
.body {
  flex: 1;
  padding: 12px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.links {
  display: flex;
  margin-right: -10px;
}
.links button {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 10px;
  border: 0;
  background: transparent;
  font-size: 14px;
  font-weight: 700;
  color: var(--link);
}
.chain {
  display: flex;
  flex-direction: column;
}
.player,
.castle {
  display: flex;
  gap: 12px;
}
.player {
  align-items: center;
  height: 40px;
}
.castle {
  align-items: stretch;
}
.railcol {
  position: relative;
  width: 32px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rail {
  position: absolute;
  left: 15px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--rail);
}
.player.first .rail {
  top: 20px;
}
.player.last .rail {
  bottom: 20px;
}
.rail.full {
  position: static;
  height: 100%;
}
.dot {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 16px;
  background: var(--dot);
  color: var(--dot-text);
  display: flex;
  align-items: center;
  justify-content: center;
}
.name {
  font-weight: 700;
  font-size: 18px;
}
.card {
  flex: 1;
  min-width: 0;
  margin: 4px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--card);
  border: 1.5px solid var(--border);
  border-radius: 12px;
  padding: 12px 12px 12px 14px;
}
.box {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.box.score {
  background: var(--score);
  color: var(--score-text);
  font-weight: 700;
  font-size: 18px;
}
.box.idle {
  background: var(--idle);
  color: var(--muted);
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cname {
  font-weight: 700;
  font-size: 16px;
}
.state {
  font-size: 13px;
  color: var(--muted);
}
.edit {
  width: 44px;
  height: 44px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  background: transparent;
  color: var(--text);
  padding: 0;
}
.cta {
  height: 44px;
  flex: none;
  padding: 0 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 10px;
  background: var(--cta);
  border: 0;
  color: var(--cta-text);
  font-weight: 700;
  font-size: 15px;
}
.foot.center {
  align-items: center;
  padding-top: 8px;
}
</style>
