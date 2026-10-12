import { PER_DECO_CARDS, PER_TYPE_CARDS } from "./bonus";
import { TILES } from "./tiles";
import type { Castle, CastleScore, Category, Deco, Dir, Game, RoomType, Tile } from "./types";
import { DECOS, ROOM_TYPES } from "./types";

const DIRS: Record<Dir, [number, number]> = {
  up: [0, 1],
  down: [0, -1],
  left: [-1, 0],
  right: [1, 0],
};
const CATEGORY_OF: Partial<Record<string, Category>> = {
  food: "food",
  living: "living",
  utility: "utility",
  outdoor: "outdoor",
  activity: "activity",
  sleeping: "sleeping",
  corridor: "corridor",
  downstairs: "downstairs",
  ballroom: "ballrooms",
  tower: "towers",
  fountain: "fountains",
  foyer: "foyers",
  throne: "throne",
};

/** Resolved view of one castle: occupancy map + effective tile per placement (secret rooms resolved). */
export class Board {
  readonly cells = new Map<string, number>();
  readonly eff: (Tile | null)[];
  readonly castle: Castle;

  constructor(castle: Castle) {
    this.castle = castle;
    castle.tiles.forEach((p, i) => {
      this.cells.set(`${p.x},${p.y}`, i);
      if (TILES[p.tile]?.type === "throne") this.cells.set(`${p.x + 1},${p.y}`, i);
    });
    this.eff = castle.tiles.map((_, i) => this.resolve(i, new Set()));
  }

  private resolve(i: number, seen: Set<number>): Tile | null {
    const tile = TILES[this.castle.tiles[i]!.tile];
    if (!tile) return null;
    if (tile.type !== "secret") return tile;
    if (seen.has(i)) return null; // two secret rooms pointing at each other
    seen.add(i);
    const [dx, dy] = DIRS[tile.dir!];
    const p = this.castle.tiles[i]!;
    const j = this.at(p.x + dx, p.y + dy);
    if (j === undefined) return null;
    const target = this.resolve(j, seen);
    return target && ROOM_TYPES.includes(target.type as RoomType) ? target : null;
  }

  at(x: number, y: number): number | undefined {
    return this.cells.get(`${x},${y}`);
  }
  type(i: number): string | undefined {
    return this.eff[i]?.type;
  }
  deco(i: number): Deco | undefined {
    return this.eff[i]?.deco;
  }
  /** cells occupied by placement i */
  own(i: number): [number, number][] {
    const p = this.castle.tiles[i]!;
    return TILES[p.tile]?.type === "throne"
      ? [
          [p.x, p.y],
          [p.x + 1, p.y],
        ]
      : [[p.x, p.y]];
  }
  /** cells around placement i (8- or 4-neighbourhood), excluding its own cells */
  ring(i: number, ortho = false): [number, number][] {
    const own = this.own(i);
    const ownKeys = new Set(own.map(([x, y]) => `${x},${y}`));
    const out = new Map<string, [number, number]>();
    for (const [x, y] of own)
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          if ((dx === 0 && dy === 0) || (ortho && dx !== 0 && dy !== 0)) continue;
          const k = `${x + dx},${y + dy}`;
          if (!ownKeys.has(k)) out.set(k, [x + dx, y + dy]);
        }
    return [...out.values()];
  }
  /** distinct placements around placement i */
  neighbours(i: number, ortho = false): number[] {
    const s = new Set<number>();
    for (const [x, y] of this.ring(i, ortho)) {
      const j = this.at(x, y);
      if (j !== undefined) s.add(j);
    }
    return [...s];
  }
  count(pred: (i: number) => boolean): number {
    return this.castle.tiles.reduce((n, _, i) => n + (pred(i) ? 1 : 0), 0);
  }
  countType(t: string): number {
    return this.count((i) => this.type(i) === t);
  }
  presentTypes(): Set<string> {
    return new Set(this.eff.filter((t): t is Tile => !!t).map((t) => t.type));
  }
  throneIndex(): number | undefined {
    const i = this.castle.tiles.findIndex((p) => TILES[p.tile]?.type === "throne");
    return i < 0 ? undefined : i;
  }
}

/** points scored by placement i for its own rule */
export function scoreTile(b: Board, i: number, opts: { neighbours: Board[] }): number {
  const t = b.eff[i];
  if (!t) return 0;
  const p = b.castle.tiles[i]!;
  const per = t.per ?? 1;
  switch (t.type) {
    case "food": {
      const spots: [number, number][] =
        t.axis === "horizontal"
          ? [
              [p.x - 1, p.y],
              [p.x + 1, p.y],
            ]
          : t.axis === "below2"
            ? [
                [p.x, p.y - 1],
                [p.x, p.y - 2],
              ]
            : [
                [p.x, p.y + 1],
                [p.x, p.y - 1],
              ];
      return 2 * spots.filter(([x, y]) => wanted(typeAt(b, x, y), t.wants)).length;
    }
    case "living":
      return per * b.neighbours(i).filter((j) => wanted(b.type(j), t.wants)).length;
    case "utility": {
      const seen = new Set<number>();
      const stack = b.neighbours(i, true).filter((j) => wanted(b.type(j), t.wants));
      while (stack.length) {
        const j = stack.pop()!;
        if (seen.has(j)) continue;
        seen.add(j);
        stack.push(...b.neighbours(j, true).filter((k) => wanted(b.type(k), t.wants)));
      }
      return seen.size;
    }
    case "outdoor":
      return b.count((j) => j !== i && wanted(b.type(j), t.wants));
    case "sleeping": {
      const present = b.presentTypes();
      const others = ROOM_TYPES.filter(
        (r) => r !== "sleeping", // S&S rule: 6 of 7 other types; equals "all 6" without activity rooms
      );
      const have = others.filter((r) => present.has(r)).length;
      return have >= 6 ? 4 : 1;
    }
    case "corridor":
      return b.neighbours(i).filter((j) => b.deco(j) === t.wants).length;
    case "downstairs":
      return (
        per *
        b.count(
          (j) =>
            b.castle.tiles[j]!.x === p.x &&
            (t.column === "both" ? b.castle.tiles[j]!.y !== p.y : b.castle.tiles[j]!.y > p.y) &&
            wanted(b.type(j), t.wants),
        )
      );
    case "activity": {
      if (b.neighbours(i).some((j) => b.type(j) === t.wants)) return 1;
      return Math.min(4, b.neighbours(i, true).length);
    }
    case "throne":
      return (
        2 *
        t.spots!.filter(([dx, dy]) => {
          const ty = typeAt(b, p.x + dx, p.y + dy);
          return ty === t.wants || ty === t.wants2;
        }).length
      );
    case "tower":
      return b.count((j) => b.own(j).some(([x, y]) => x === p.x && y < p.y));
    case "fountain":
      return 5;
    case "foyer":
      return b.neighbours(i).length;
    case "ballroom":
      return opts.neighbours.reduce((n, nb) => n + nb.countType(t.wants!), 0);
    default:
      return 0;
  }
}

function typeAt(b: Board, x: number, y: number): string | undefined {
  const j = b.at(x, y);
  return j === undefined ? undefined : b.type(j);
}
function isSpecialty(t: string | undefined): boolean {
  return t === "throne" || t === "tower" || t === "fountain" || t === "foyer" || t === "ballroom";
}
/** does a room of type `ty` satisfy a tile that wants `wants`? */
function wanted(ty: string | undefined, wants: string | undefined): boolean {
  return wants === "specialty" ? isSpecialty(ty) : ty === wants;
}

export function scoreBonusCard(b: Board, id: string, opts: { neighbours: Board[] }): number {
  const perType = PER_TYPE_CARDS[id];
  if (perType) return 2 * b.countType(perType);
  const perDeco = PER_DECO_CARDS[id];
  if (perDeco) return b.count((i) => b.deco(i) === perDeco);
  const ys = b.castle.tiles.map((p) => p.y);
  const xs = b.castle.tiles.flatMap((_, i) => b.own(i).map(([x]) => x));
  const throne = b.throneIndex();
  switch (id) {
    case "room-types":
      return [...b.presentTypes()].filter((t) => t !== "throne" && t !== "secret").length;
    case "attendants":
      return 4 * b.castle.attendants.length;
    case "below-ground":
      return b.count((i) => b.castle.tiles[i]!.y < 0);
    case "level-3":
      return b.count((i) => b.castle.tiles[i]!.y >= 2);
    case "height":
      return ys.length ? Math.max(...ys) - Math.min(...ys) + 1 : 0;
    case "width":
      return xs.length ? Math.max(...xs) - Math.min(...xs) + 1 : 0;
    case "surrounded":
      return 3 * b.count((i) => b.ring(i).every(([x, y]) => b.at(x, y) !== undefined));
    case "surrounded-ortho":
      return 2 * b.count((i) => b.ring(i, true).every(([x, y]) => b.at(x, y) !== undefined));
    case "specialty":
      return 2 * b.count((i) => isSpecialty(b.type(i)));
    case "throne-types": {
      if (throne === undefined) return 0;
      const p = b.castle.tiles[throne]!;
      // ponytail: assumed the 6 spaces are left, right and the 4 above; verify against the card
      const six: [number, number][] = [
        [-1, 0],
        [2, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
        [2, 1],
      ];
      const types = new Set(
        six
          .map(([dx, dy]) => typeAt(b, p.x + dx, p.y + dy))
          .filter((t) => t && ROOM_TYPES.includes(t as RoomType)),
      );
      return 2 * types.size;
    }
    case "throne-occupied":
      return throne === undefined
        ? 0
        : b.ring(throne).filter(([x, y]) => b.at(x, y) !== undefined).length;
    case "five-of-type":
      return 4 * ROOM_TYPES.filter((t) => b.countType(t) >= 5).length;
    case "three-of-type":
      return 2 * ROOM_TYPES.filter((t) => b.countType(t) >= 3).length;
    case "deco-set":
      return 3 * Math.min(...DECOS.map((d) => b.count((i) => b.deco(i) === d)));
    case "neighbor-specialty":
      return opts.neighbours.reduce((n, nb) => n + nb.count((i) => isSpecialty(nb.type(i))), 0);
    case "secret":
      return 2 * b.count((i) => TILES[b.castle.tiles[i]!.tile]?.type === "secret");
    default:
      return 0;
  }
}

export function scoreCastle(castle: Castle, opts: { neighbours: Castle[] }): CastleScore {
  const b = new Board(castle);
  const o = { neighbours: opts.neighbours.map((c) => new Board(c)) };
  const categories = Object.fromEntries(
    [
      "food",
      "living",
      "utility",
      "outdoor",
      "activity",
      "sleeping",
      "corridor",
      "downstairs",
      "ballrooms",
      "towers",
      "fountains",
      "foyers",
      "bonusCards",
      "attendants",
      "throne",
    ].map((c) => [c, 0]),
  ) as Record<Category, number>;
  const perTile = castle.tiles.map((_, i) => {
    const pts = scoreTile(b, i, o);
    const cat = CATEGORY_OF[b.type(i) ?? ""];
    if (cat) categories[cat] += pts;
    return pts;
  });
  for (const d of castle.attendants) categories.attendants += b.count((i) => b.deco(i) === d);
  const bonusCards = castle.bonusCards.map((id) => ({ id, points: scoreBonusCard(b, id, o) }));
  categories.bonusCards = bonusCards.reduce((n, c) => n + c.points, 0);
  const total = Object.values(categories).reduce((a, v) => a + v, 0);
  return { total, categories, perTile, bonusCards };
}

export interface PlayerResult {
  name: string;
  castles: [number, number];
  final: number;
  specialty: number;
  rank: number;
}

export function scoreGame(game: Game): { castles: CastleScore[]; players: PlayerResult[] } {
  const n = game.castles.length;
  const castles = game.castles.map((c, i) =>
    scoreCastle(c, {
      neighbours: n >= 3 ? [game.castles[(i + n - 1) % n]!, game.castles[(i + 1) % n]!] : [],
    }),
  );
  const players = game.players.map((name, i) => {
    const a = (i + n - 1) % n;
    const pair = [castles[a]!.total, castles[i]!.total] as [number, number];
    const specialty = [a, i].reduce(
      (s, k) =>
        s +
        new Board(game.castles[k]!).count((j) => isSpecialty(new Board(game.castles[k]!).type(j))),
      0,
    );
    return { name, castles: pair, final: Math.min(...pair), specialty, rank: 0 };
  });
  const key = (p: PlayerResult) => [p.final, Math.max(...p.castles), p.specialty];
  const order = [...players].sort((p, q) => {
    const a = key(p),
      b = key(q);
    for (let k = 0; k < 3; k++) if (a[k] !== b[k]) return b[k]! - a[k]!;
    return 0;
  });
  order.forEach((p, idx) => {
    p.rank =
      idx > 0 && key(order[idx - 1]!).join() === key(p).join() ? order[idx - 1]!.rank : idx + 1;
  });
  return { castles, players };
}
