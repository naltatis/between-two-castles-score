import type { Deco, RoomType } from "./types";

export interface BonusCard {
  id: string;
  text: string;
  textDe?: string;
  expansion?: boolean;
  /** points per match, as printed in the star */
  per: number;
  /** glyph names shown under the star (room types, decorations, specialty) */
  icons?: string[];
  /** short label when no glyph fits */
  label?: string;
}

export const BONUS_CARDS: BonusCard[] = [
  {
    id: "room-types",
    per: 1,
    label: "Raumtyp",
    text: "1 per different regular and specialty room type (throne excluded)",
    textDe: "1 pro unterschiedlichem Raumtyp",
  },
  {
    id: "attendants",
    per: 4,
    label: "Bediensteter",
    text: "4 per royal attendant in your throne room",
    textDe: "4 pro königlichem Bediensteten",
  },
  {
    id: "downstairs",
    per: 2,
    icons: ["downstairs"],
    text: "2 per downstairs room",
    textDe: "2 pro Kellerraum",
  },
  {
    id: "sleeping",
    per: 2,
    icons: ["sleeping"],
    text: "2 per sleeping room",
    textDe: "2 pro Schlafraum",
  },
  {
    id: "below-ground",
    per: 1,
    label: "Raum unter Tage",
    text: "1 per room below ground level (specialty rooms included)",
    textDe: "1 pro Raum in einem unterirdischen Stockwerk",
  },
  {
    id: "level-3",
    per: 1,
    label: "Raum ab 2. Stock",
    text: "1 per room on level 3 and higher (specialty rooms included)",
    textDe: "1 pro Raum in Stockwerk 2 oder höher",
  },
  { id: "living", per: 2, icons: ["living"], text: "2 per living room", textDe: "2 pro Wohnraum" },
  { id: "food", per: 2, icons: ["food"], text: "2 per food room", textDe: "2 pro Speiseraum" },
  {
    id: "height",
    per: 1,
    label: "Stockwerk",
    text: "1 per row of your castle",
    textDe: "1 pro Stockwerk",
  },
  {
    id: "width",
    per: 1,
    label: "Spalte",
    text: "1 per column of your castle",
    textDe: "1 pro Spalte",
  },
  {
    id: "outdoor",
    per: 2,
    icons: ["outdoor"],
    text: "2 per outdoor room",
    textDe: "2 pro Außenraum",
  },
  {
    id: "corridor",
    per: 2,
    icons: ["corridor"],
    text: "2 per corridor room",
    textDe: "2 pro Verbindungsraum",
  },
  {
    id: "surrounded",
    per: 3,
    label: "rundum umschlossen",
    text: "3 per room fully surrounded (throne can count)",
    textDe: "3 pro vollständig umschlossenem Raum",
  },
  {
    id: "surrounded-ortho",
    per: 2,
    label: "4 Nachbarn",
    text: "2 per room with above, below, left and right occupied (throne can count)",
    textDe: "2 pro Raum mit allen 4 Nachbarfeldern belegt",
  },
  {
    id: "utility",
    per: 2,
    icons: ["utility"],
    text: "2 per utility room",
    textDe: "2 pro Wirtschaftsraum",
  },
  {
    id: "specialty",
    per: 2,
    icons: ["specialty"],
    text: "2 per specialty room (throne included)",
    textDe: "2 pro Sonderraum inkl. Thronsaal",
  },
  {
    id: "throne-types",
    per: 2,
    icons: ["throne"],
    label: "Typ am Thron",
    text: "2 per different regular room type in the 6 spaces around the throne room",
    textDe: "2 pro Raumtyp in den 6 Feldern um den Thronsaal",
  },
  {
    id: "throne-occupied",
    per: 1,
    icons: ["throne"],
    label: "Feld am Thron",
    text: "1 per occupied space around the throne room",
    textDe: "1 pro belegtem Feld um den Thronsaal",
  },
  {
    id: "five-of-type",
    per: 4,
    label: "5× ein Typ",
    text: "4 per regular room type with 5+ tiles",
    textDe: "4 pro Raumtyp mit mindestens 5 Plättchen",
  },
  {
    id: "three-of-type",
    per: 2,
    label: "3× ein Typ",
    text: "2 per regular room type with 3+ tiles",
    textDe: "2 pro Raumtyp mit mindestens 3 Plättchen",
  },
  {
    id: "deco-set",
    per: 3,
    icons: ["mirror", "painting", "swords", "torch"],
    label: "Set",
    text: "3 per set of all 4 wall hangings",
    textDe: "3 pro Set aus allen 4 Wandschmuck-Arten",
    expansion: true,
  },
  {
    id: "mirror",
    per: 1,
    icons: ["mirror"],
    text: "1 per mirror",
    textDe: "1 pro Spiegel",
    expansion: true,
  },
  {
    id: "swords",
    per: 1,
    icons: ["swords"],
    text: "1 per swords",
    textDe: "1 pro Schwerter",
    expansion: true,
  },
  {
    id: "painting",
    per: 1,
    icons: ["painting"],
    text: "1 per painting",
    textDe: "1 pro Gemälde",
    expansion: true,
  },
  {
    id: "torch",
    per: 1,
    icons: ["torch"],
    text: "1 per torch",
    textDe: "1 pro Fackel",
    expansion: true,
  },
  {
    id: "activity",
    per: 2,
    icons: ["activity"],
    text: "2 per activity room",
    textDe: "2 pro Hobbyraum",
    expansion: true,
  },
  {
    id: "neighbor-specialty",
    per: 1,
    icons: ["specialty"],
    label: "bei Nachbarn",
    text: "1 per specialty room in the two adjacent castles",
    textDe: "1 pro Sonderraum in den Nachbarschlössern",
    expansion: true,
  },
  {
    id: "secret",
    per: 2,
    icons: ["secret"],
    text: "2 per secret room",
    textDe: "2 pro Geheimraum",
    expansion: true,
  },
];

export const PER_TYPE_CARDS: Partial<Record<string, RoomType>> = {
  downstairs: "downstairs",
  sleeping: "sleeping",
  living: "living",
  food: "food",
  outdoor: "outdoor",
  corridor: "corridor",
  utility: "utility",
  activity: "activity",
};
export const PER_DECO_CARDS: Partial<Record<string, Deco>> = {
  mirror: "mirror",
  swords: "swords",
  painting: "painting",
  torch: "torch",
};
