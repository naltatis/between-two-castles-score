<script setup lang="ts">
import Icon from "../components/Icon.vue";
import type { Game } from "../game/types";

const props = defineProps<{ game: Game }>();
const emit = defineEmits<{ next: [] }>();

function remove(i: number) {
  props.game.players.splice(i, 1);
  props.game.castles.splice(i, 1);
}
</script>

<template>
  <div class="screen">
    <header class="head">
      <div class="h title">Neues Spiel</div>
      <div class="sub">Zwischen zwei Schlössern</div>
    </header>

    <main class="body">
      <div>
        <div class="section-title">Spieler</div>
        <div class="hint">In Sitzreihenfolge, im Uhrzeigersinn</div>
      </div>
      <div class="rows">
        <div v-for="(_, i) in game.players" :key="i" class="row">
          <span class="num">{{ i + 1 }}</span>
          <input
            v-model="game.players[i]"
            type="text"
            :name="`player-${i}`"
            placeholder="Name"
            :aria-label="`Name von Spieler ${i + 1}`"
            autocomplete="off"
          />
          <button
            v-if="game.players.length > 2"
            type="button"
            class="rm"
            :aria-label="`${game.players[i] || 'Spieler ' + (i + 1)} entfernen`"
            @click="remove(i)"
          >
            <Icon name="x" />
          </button>
        </div>
      </div>
      <button
        v-if="game.players.length < 7"
        type="button"
        class="add"
        @click="game.players.push('')"
      >
        <Icon name="userPlus" />Spieler hinzufügen
      </button>
    </main>

    <div class="foot">
      <button type="button" class="btn" @click="emit('next')">
        Auswerten<Icon name="next" :size="22" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.body {
  flex: 1;
  padding: 20px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hint {
  font-size: 13px;
  color: var(--muted);
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.row .num {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 16px;
  background: var(--dot);
  color: var(--head-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
}
.row input {
  flex: 1;
  min-width: 0;
  height: 48px;
  padding: 0 14px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  background: #fff;
  font-weight: 600;
  font-size: 17px;
}
.rm {
  width: 44px;
  height: 44px;
  flex: none;
  padding: 0;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
}
.add {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1.5px dashed var(--dash);
  border-radius: 10px;
  background: transparent;
  color: var(--link);
  font-weight: 700;
  font-size: 15px;
}
</style>
