import { describe, expect, it } from "vite-plus/test";
import { Board, scoreBonusCard, scoreCastle, scoreGame } from "./score";
import type { Castle, Placement } from "./types";

const P = (x: number, y: number, tile: string): Placement => ({ x, y, tile });

/** Base rulebook p.13 "Castle Exemplar", 62 points */
const exemplar: Castle = {
  name: "Exemplar",
  attendants: ["torch"],
  bonusCards: [],
  tiles: [
    P(0, 0, "throne-utility-sleeping"),
    P(-2, 0, "hall-of-portraits"),
    P(-1, 0, "taxidermy-showroom"),
    P(2, 0, "hall-of-puzzled-floors"),
    P(0, -1, "laboratory"),
    P(-2, 1, "echo-chamber"),
    P(-1, 1, "kings-chambers"),
    P(0, 1, "game-storage"),
    P(1, 1, "reading-room"),
    P(2, 1, "fountain"),
    P(-2, 2, "salon"),
    P(-1, 2, "wine-room"),
    P(0, 2, "drawing-room"),
    P(1, 2, "firewood-storage"),
    P(-2, 3, "fireplace"),
    P(-1, 3, "midnight-room"),
    P(0, 3, "grand-foyer"),
    P(-1, 4, "hibernation-chamber"),
    P(0, 4, "broom-closet"),
    P(-1, 5, "tower"),
  ],
};

describe("base game example castle", () => {
  const s = scoreCastle(exemplar, { neighbours: [] });
  it("scores 62 with the printed breakdown", () => {
    expect(s.categories).toEqual({
      food: 4,
      living: 8,
      utility: 4,
      outdoor: 5,
      activity: 0,
      sleeping: 12,
      corridor: 4,
      downstairs: 2,
      ballrooms: 0,
      towers: 5,
      fountains: 5,
      foyers: 6,
      bonusCards: 0,
      attendants: 7,
      throne: 0,
    });
    expect(s.total).toBe(62);
  });
  it("scores individual rooms as printed", () => {
    const pts = Object.fromEntries(exemplar.tiles.map((p, i) => [p.tile, s.perTile[i]]));
    expect(pts).toMatchObject({
      "wine-room": 4,
      fireplace: 1,
      salon: 2,
      "drawing-room": 1,
      "reading-room": 2,
      "taxidermy-showroom": 2,
      "broom-closet": 2,
      "game-storage": 2,
      "firewood-storage": 5,
      "echo-chamber": 2,
      "hall-of-portraits": 0,
      "hall-of-puzzled-floors": 2,
      laboratory: 2,
      tower: 5,
      "grand-foyer": 6,
      "throne-utility-sleeping": 0,
    });
  });
  it("throne room scores its two spots", () => {
    const c: Castle = {
      ...exemplar,
      tiles: [P(0, 0, "throne-utility-sleeping"), P(1, 1, "game-storage"), P(2, 0, "broom-closet")],
    };
    expect(scoreCastle(c, { neighbours: [] }).categories.throne).toBe(4);
  });
  it("bonus cards", () => {
    const b = new Board(exemplar);
    const o = { neighbours: [] };
    expect(scoreBonusCard(b, "room-types", o)).toBe(10); // 7 regular + tower, fountain, foyer
    expect(scoreBonusCard(b, "attendants", o)).toBe(4);
    expect(scoreBonusCard(b, "sleeping", o)).toBe(6);
    expect(scoreBonusCard(b, "below-ground", o)).toBe(1);
    expect(scoreBonusCard(b, "level-3", o)).toBe(10);
    expect(scoreBonusCard(b, "height", o)).toBe(7);
    expect(scoreBonusCard(b, "width", o)).toBe(5);
    expect(scoreBonusCard(b, "specialty", o)).toBe(8);
    expect(scoreBonusCard(b, "three-of-type", o)).toBe(6); // living 5, sleeping 3, corridor 3
    expect(scoreBonusCard(b, "five-of-type", o)).toBe(4);
    expect(scoreBonusCard(b, "surrounded", o)).toBe(9); // wine room, king's chambers, game storage
    expect(scoreBonusCard(b, "surrounded-ortho", o)).toBe(12); // wine, drawing, king's, game storage, midnight, reading
    expect(scoreBonusCard(b, "throne-occupied", o)).toBe(7);
    expect(scoreBonusCard(b, "torch", o)).toBe(7);
    expect(scoreBonusCard(b, "deco-set", o)).toBe(3 * 2); // mirror 2, painting 4, swords 3, torch 7
  });
});

/** Expansion rulebook p.5 example (fragment without throne) */
const expansionExample: Castle = {
  name: "Expansion",
  attendants: [],
  bonusCards: [],
  tiles: [
    P(0, 1, "horseshoe-pit"),
    P(1, 1, "tent-room"),
    P(2, 1, "ball-storage"),
    P(3, 1, "vestibule-corridor"),
    P(0, 0, "painting-room"),
    P(1, 0, "lounge"),
    P(2, 0, "singers-chamber"),
    P(3, 0, "behind-the-bookcase"),
    P(4, 0, "ballroom-activity"),
  ],
};

describe("expansion example", () => {
  const left: Castle = {
    name: "L",
    attendants: [],
    bonusCards: [],
    tiles: [P(0, 0, "throne-living-corridor"), P(2, 0, "painting-room")],
  };
  const right: Castle = {
    name: "R",
    attendants: [],
    bonusCards: [],
    tiles: [
      P(0, 0, "throne-living-corridor"),
      P(2, 0, "singers-chamber"),
      P(-1, 0, "painting-room"),
    ],
  };
  const s = scoreCastle(expansionExample, { neighbours: [left, right] });
  it("scores each room as printed", () => {
    const pts = Object.fromEntries(expansionExample.tiles.map((p, i) => [p.tile, s.perTile[i]]));
    expect(pts).toEqual({
      "horseshoe-pit": 3,
      "tent-room": 1,
      "ball-storage": 2,
      "vestibule-corridor": 2,
      "painting-room": 2,
      lounge: 2,
      "singers-chamber": 1,
      "behind-the-bookcase": 3,
      "ballroom-activity": 3,
    });
  });
  it("secret room counts as its copied type", () => {
    const b = new Board(expansionExample);
    expect(b.countType("activity")).toBe(3);
    expect(scoreBonusCard(b, "secret", { neighbours: [] })).toBe(2);
    expect(scoreBonusCard(b, "activity", { neighbours: [] })).toBe(6);
  });
  it("secret rooms pointing at nothing, at specialty rooms or at each other score 0", () => {
    const c: Castle = {
      ...expansionExample,
      tiles: [
        P(0, 0, "fountain"),
        P(1, 0, "behind-the-bookcase"),
        P(2, 0, "behind-the-bookcase"),
        P(5, 5, "behind-the-bookcase"),
      ],
    };
    const b = new Board(c);
    expect(b.eff.slice(1)).toEqual([null, null, null]);
  });
  it("sleeping rooms score 4 with 6 of the 7 other types", () => {
    const c: Castle = {
      ...expansionExample,
      tiles: [...expansionExample.tiles, P(0, 2, "laboratory")],
    };
    const b = new Board(c);
    expect(b.presentTypes().size).toBe(8);
    expect(scoreCastle(c, { neighbours: [] }).categories.sleeping).toBe(4);
  });
});

describe("game", () => {
  it("player score is the lower castle; ties broken by higher castle then specialty rooms", () => {
    const a: Castle = {
      name: "a",
      attendants: [],
      bonusCards: [],
      tiles: [P(0, 0, "throne-living-corridor"), P(2, 0, "fountain")],
    }; // 5
    const b: Castle = {
      name: "b",
      attendants: [],
      bonusCards: [],
      tiles: [P(0, 0, "throne-living-corridor"), P(2, 0, "fountain"), P(3, 0, "fountain")],
    }; // 10
    const c: Castle = {
      name: "c",
      attendants: [],
      bonusCards: [],
      tiles: [P(0, 0, "throne-living-corridor")],
    }; // 0
    const g = scoreGame({ players: ["Ann", "Bob", "Cy"], castles: [a, b, c] });
    expect(g.castles.map((s) => s.total)).toEqual([5, 10, 0]);
    expect(g.players.map((p) => [p.name, p.final, p.rank])).toEqual([
      ["Ann", 0, 3],
      ["Bob", 5, 1],
      ["Cy", 0, 2],
    ]);
  });
});

describe("specialty neighbours", () => {
  const castle = (tiles: Castle["tiles"]): Castle => ({
    name: "t",
    tiles,
    attendants: [],
    bonusCards: [],
  });
  it("Kronenvorrat counts the connected throne room", () => {
    const c = castle([
      { x: 0, y: 0, tile: "throne-living-sleeping" },
      { x: 1, y: 1, tile: "crown-storage" },
    ]);
    expect(scoreCastle(c, { neighbours: [] }).perTile[1]).toBe(1);
  });
  it("Belagerungsvorrat scores the throne room below it", () => {
    const c = castle([
      { x: 0, y: 0, tile: "throne-living-sleeping" },
      { x: 0, y: 1, tile: "siege-food-storage" },
    ]);
    expect(scoreCastle(c, { neighbours: [] }).perTile[1]).toBe(2);
  });
  it("Blumengarten and Rüstkammer count specialty rooms", () => {
    const c = castle([
      { x: 0, y: 0, tile: "throne-living-sleeping" },
      { x: 2, y: 0, tile: "tower" },
      { x: -1, y: 0, tile: "flower-garden" },
      { x: 0, y: -1, tile: "armory" },
    ]);
    const s = scoreCastle(c, { neighbours: [] });
    expect(s.perTile[2]).toBe(2); // throne + tower anywhere
    expect(s.perTile[3]).toBe(2); // 2 per specialty room above in the column: the throne
  });
});
