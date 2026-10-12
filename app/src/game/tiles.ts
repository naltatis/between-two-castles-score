import type { Tile } from "./types";

// 220 room tiles from data/tiles.json (built by tools/build_tiles.py) plus the 8 throne rooms below;
// ids are kebab-case English names.
import data from "../data/tiles.json";

// 8 throne rooms (spots relative to the left half; (1,1) = above the right half, (2,0) = right of the room)
const THRONES: Tile[] = [
  {
    id: "throne-utility-sleeping",
    name: "Throne Room",
    nameDe: "Thronsaal",
    type: "throne",
    deco: "torch",
    wants: "utility",
    wants2: "sleeping",
    spots: [
      [1, 1],
      [2, 0],
    ],
  },
  {
    id: "throne-corridor-downstairs",
    name: "Throne Room",
    nameDe: "Thronsaal",
    type: "throne",
    deco: "mirror",
    wants: "corridor",
    wants2: "downstairs",
    spots: [
      [0, -1],
      [1, -1],
    ],
  },
  {
    id: "throne-living-corridor",
    name: "Throne Room",
    nameDe: "Thronsaal",
    type: "throne",
    deco: "torch",
    wants: "living",
    wants2: "corridor",
    spots: [
      [-1, 0],
      [2, 0],
    ],
  },
  {
    id: "throne-living-sleeping",
    name: "Throne Room",
    nameDe: "Thronsaal",
    type: "throne",
    deco: "swords",
    wants: "living",
    wants2: "sleeping",
    spots: [
      [0, 1],
      [1, 1],
    ],
  },
  {
    id: "throne-utility-food",
    name: "Throne Room",
    nameDe: "Thronsaal",
    type: "throne",
    deco: "painting",
    wants: "utility",
    wants2: "food",
    spots: [
      [-1, 0],
      [2, 0],
    ],
  },
  {
    id: "throne-corridor-food",
    name: "Throne Room",
    nameDe: "Thronsaal",
    type: "throne",
    deco: "swords",
    wants: "corridor",
    wants2: "food",
    spots: [
      [0, 1],
      [1, 1],
    ],
  },
  {
    id: "throne-food-sleeping",
    name: "Throne Room",
    nameDe: "Thronsaal",
    type: "throne",
    deco: "mirror",
    wants: "food",
    wants2: "sleeping",
    spots: [
      [0, 1],
      [-1, 0],
    ],
  },
  {
    id: "throne-activity-outdoor",
    name: "Throne Room",
    nameDe: "Thronsaal",
    type: "throne",
    deco: "painting",
    wants: "activity",
    wants2: "outdoor",
    spots: [
      [-1, 0],
      [1, 1],
    ],
  },
];

const T: Tile[] = [...THRONES, ...(data as Tile[])];

export const TILES: Record<string, Tile> = Object.fromEntries(T.map((t) => [t.id, t]));
export const TILE_LIST = T;
