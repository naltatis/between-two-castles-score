// Framework-free game model. Coordinates: throne room occupies (0,0) and (1,0); y grows upwards.

export type RoomType =
  | "food"
  | "living"
  | "utility"
  | "outdoor"
  | "sleeping"
  | "corridor"
  | "downstairs"
  | "activity";
export type SpecialtyType = "throne" | "tower" | "fountain" | "foyer" | "ballroom";
export type TileType = RoomType | SpecialtyType | "secret";
export type Deco = "mirror" | "painting" | "swords" | "torch";
export type Dir = "up" | "down" | "left" | "right";
export type Offset = [number, number];

export const ROOM_TYPES: RoomType[] = [
  "food",
  "living",
  "utility",
  "outdoor",
  "sleeping",
  "corridor",
  "downstairs",
  "activity",
];
export const SPECIALTY_TYPES: SpecialtyType[] = [
  "throne",
  "tower",
  "fountain",
  "foyer",
  "ballroom",
];
export const DECOS: Deco[] = ["mirror", "painting", "swords", "torch"];

export interface Tile {
  id: string;
  name: string; // as printed on the English tile
  nameDe?: string; // as printed on the German base-game tile
  type: TileType;
  deco?: Deco;
  /** points per match; defaults: food 2, downstairs/living 1 unless stated */
  per?: number;
  /** wanted room type (food/living/utility/outdoor/downstairs/ballroom/throne), wanted deco (corridor), unwanted type (activity) */
  wants?: RoomType | Deco | "specialty";
  /** throne room: second wanted type */
  wants2?: RoomType;
  /** food rooms: where the wanted rooms must be */
  axis?: "vertical" | "horizontal" | "below2";
  /** throne room: the two scoring spots, relative to the left half */
  spots?: [Offset, Offset];
  /** secret room arrow */
  dir?: Dir;
  /** downstairs: count the whole column instead of only above */
  column?: "both";
  /** promo tile with a special rule */
  promo?: boolean;
  /** German name not yet verified on a photo */
  deGuess?: boolean;
}

export interface Placement {
  x: number;
  y: number;
  tile: string;
}

export interface Castle {
  name: string;
  tiles: Placement[];
  attendants: Deco[];
  bonusCards: string[];
  /** scored & closed in the UI */
  done?: boolean;
}

export interface Game {
  players: string[];
  /** castles[i] sits between players[i] and players[i+1] (clockwise) */
  castles: Castle[];
}

export type Category =
  | "food"
  | "living"
  | "utility"
  | "outdoor"
  | "activity"
  | "sleeping"
  | "corridor"
  | "downstairs"
  | "ballrooms"
  | "towers"
  | "fountains"
  | "foyers"
  | "bonusCards"
  | "attendants"
  | "throne";

export interface CastleScore {
  total: number;
  categories: Record<Category, number>;
  /** points per placement, same order as castle.tiles */
  perTile: number[];
  bonusCards: { id: string; points: number }[];
}
