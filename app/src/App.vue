<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { neighboursOf, scoreGame } from "./game/score";
import { TILE_LIST, TILES } from "./game/tiles";
import type { Castle, Game } from "./game/types";
import type { Recognition } from "./recognize";
import CastleGrid from "./screens/CastleGrid.vue";
import Detect from "./screens/Detect.vue";
import Extras from "./screens/Extras.vue";
import Overview from "./screens/Overview.vue";
import Players from "./screens/Players.vue";
import Results from "./screens/Results.vue";
import Scan from "./screens/Scan.vue";

const KEY = "btc-game";
const THRONES = TILE_LIST.filter((t) => t.type === "throne");

function newCastle(): Castle {
  return {
    name: "",
    tiles: [{ x: 0, y: 0, tile: THRONES[0]!.id }],
    attendants: [],
    bonusCards: [],
  };
}
function load(): Game {
  try {
    const g = JSON.parse(localStorage.getItem(KEY) ?? "null") as Game | null;
    if (g?.players?.length && g.castles?.length === g.players.length) return g;
  } catch {
    /* corrupt storage: start fresh */
  }
  return { players: ["", "", ""], castles: [newCastle(), newCastle(), newCastle()] };
}

const game = reactive<Game>(load());
watch(game, (g) => localStorage.setItem(KEY, JSON.stringify(g)), { deep: true });

type Screen = "players" | "overview" | "scan" | "detect" | "grid" | "extras" | "results";
const screen = ref<Screen>(game.players.some(Boolean) ? "overview" : "players");
const sel = ref(0);
const castle = computed(() => game.castles[sel.value]!);
const result = computed(() => scoreGame(game));
const pairName = (i: number) =>
  `${game.players[i]} & ${game.players[(i + 1) % game.players.length]}`;

/** photo + recognition live only in memory */
const photo = ref<{ canvas: HTMLCanvasElement; url: string } | null>(null);
const recognition = ref<Recognition | null>(null);
/** cells ("x,y") still to be confirmed on the grid screen */
const review = ref<string[]>([]);
/** photo crop per cell ("x,y") for the review UI */
const crops = ref<Record<string, string>>({});

function startGame() {
  game.players = game.players.map((p, i) => p.trim() || `Spieler ${i + 1}`);
  while (game.castles.length < game.players.length) game.castles.push(newCastle());
  game.castles.length = game.players.length;
  screen.value = "overview";
}
function newGame() {
  if (!confirm("Neues Spiel? Alle Schlösser werden gelöscht.")) return;
  game.castles = game.players.map(() => newCastle());
  screen.value = "players";
}
function scan(i: number) {
  sel.value = i;
  photo.value = null;
  recognition.value = null;
  screen.value = "scan";
}
function edit(i: number) {
  sel.value = i;
  photo.value = null;
  review.value = [];
  crops.value = {};
  screen.value = "grid";
}
function onPhoto(p: { canvas: HTMLCanvasElement; url: string }) {
  photo.value = p;
  recognition.value = null;
  screen.value = "detect";
}
function throneId() {
  return castle.value.tiles.find((p) => p.y === 0 && p.x === 0)?.tile ?? THRONES[0]!.id;
}
function apply(r: Recognition) {
  castle.value.tiles = [
    { x: 0, y: 0, tile: r.throne?.tile ?? throneId() },
    ...r.cells.map((c) => ({ x: c.x, y: c.y, tile: c.tile ?? "" })),
  ];
  review.value = r.cells
    .filter((c) => !c.tile || !TILES[c.tile] || c.confidence < 0.8)
    .map((c) => `${c.x},${c.y}`);
  crops.value = Object.fromEntries(
    r.cells.filter((c) => c.cropUrl).map((c) => [`${c.x},${c.y}`, c.cropUrl!]),
  );
  screen.value = "grid";
}
function finish() {
  castle.value.done = true;
  // results only once every castle is scored; otherwise back to the table overview
  screen.value = game.castles.every((c) => c.done) ? "results" : "overview";
}
</script>

<template>
  <Players v-if="screen === 'players'" :game="game" @next="startGame" />
  <Overview
    v-else-if="screen === 'overview'"
    :game="game"
    :scores="result.castles"
    @players="screen = 'players'"
    @results="screen = 'results'"
    @scan="scan"
    @edit="edit"
    @new-game="newGame"
  />
  <Scan
    v-else-if="screen === 'scan'"
    :title="pairName(sel)"
    :sub="'Schloss fotografieren'"
    @back="screen = 'overview'"
    @photo="onPhoto"
  />
  <Detect
    v-else-if="screen === 'detect' && photo"
    :title="pairName(sel)"
    :photo="photo"
    @back="screen = 'scan'"
    @apply="apply"
  />
  <CastleGrid
    v-else-if="screen === 'grid'"
    :title="pairName(sel)"
    :castle="castle"
    :score="result.castles[sel]!"
    :review="review"
    @update:review="review = $event"
    :crops="crops"
    :neighbours="neighboursOf(game, sel)"
    @back="screen = 'scan'"
    @next="screen = 'extras'"
  />
  <Extras
    v-else-if="screen === 'extras'"
    :title="pairName(sel)"
    :game="game"
    :index="sel"
    :score="result.castles[sel]!"
    @back="screen = 'grid'"
    @finish="finish"
  />
  <Results
    v-else-if="screen === 'results'"
    :game="game"
    :result="result"
    @back="screen = 'overview'"
    @edit="edit"
    @new-game="newGame"
  />
</template>
