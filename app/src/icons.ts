// Tabler outline icons v3.49 (viewBox 0 0 24 24, stroke) standing in for the symbols printed on the tiles.
import type { Deco, Tile, TileType } from "./game/types";

export const TYPE_COLOR: Record<TileType, string> = {
  food: "#d9a400",
  living: "#7b3fa0",
  utility: "#e0621c",
  outdoor: "#3f8f3a",
  sleeping: "#2a4fa0",
  corridor: "#9a9aa8",
  downstairs: "#4b4b55",
  activity: "#7a4a1f",
  secret: "#1aa08f",
  throne: "#a01f2f",
  tower: "#a01f2f",
  fountain: "#a01f2f",
  foyer: "#a01f2f",
  ballroom: "#a01f2f",
};

export const TYPE_LABEL: Record<TileType, [string, string]> = {
  food: ["Food", "Speise"],
  living: ["Living", "Wohn"],
  utility: ["Utility", "Wirtschaft"],
  outdoor: ["Outdoor", "Außen"],
  sleeping: ["Sleeping", "Schlaf"],
  corridor: ["Corridor", "Verbindung"],
  downstairs: ["Downstairs", "Keller"],
  activity: ["Activity", "Hobby"],
  secret: ["Secret", "Geheim"],
  throne: ["Throne", "Thronsaal"],
  tower: ["Tower", "Turm"],
  fountain: ["Fountain", "Brunnen"],
  foyer: ["Grand Foyer", "Foyer"],
  ballroom: ["Ballroom", "Ballsaal"],
};

/** SVG inner markup for a glyph, drawn in currentColor */
/** rotation (deg) that points the secret-room arrow in its direction; the glyph points right */
export const DIR_ROT: Record<string, number> = { right: 0, down: 90, left: 180, up: 270 };

export const GLYPH: Record<TileType | Deco | "specialty", string> = {
  food: '<path d="M8 21h8"/><path d="M12 16v5"/><path d="M17 5l1 6c0 3.012 -2.686 5 -6 5s-6 -1.988 -6 -5l1 -6"/><path d="M12 5m-5 0a5 2 0 1 0 10 0a5 2 0 1 0 -10 0"/>',
  living:
    '<path d="M12 10.941c2.333 -3.308 .167 -7.823 -1 -8.941c0 3.395 -2.235 5.299 -3.667 6.706c-1.43 1.408 -2.333 3.621 -2.333 5.588c0 3.704 3.134 6.706 7 6.706s7 -3.002 7 -6.706c0 -1.712 -1.232 -4.403 -2.333 -5.588c-2.084 3.353 -3.257 3.353 -4.667 2.235"/>',
  utility:
    '<path d="M11.414 10l-7.383 7.418a2.091 2.091 0 0 0 0 2.967a2.11 2.11 0 0 0 2.976 0l7.407 -7.385"/><path d="M18.121 15.293l2.586 -2.586a1 1 0 0 0 0 -1.414l-7.586 -7.586a1 1 0 0 0 -1.414 0l-2.586 2.586a1 1 0 0 0 0 1.414l7.586 7.586a1 1 0 0 0 1.414 0z"/>',
  outdoor:
    '<path d="M12 13l-2 -2"/><path d="M12 12l2 -2"/><path d="M12 21v-13"/><path d="M9.824 16a3 3 0 0 1 -2.743 -3.69a3 3 0 0 1 .304 -4.833a3 3 0 0 1 4.615 -3.707a3 3 0 0 1 4.614 3.707a3 3 0 0 1 .305 4.833a3 3 0 0 1 -2.919 3.695h-4z"/>',
  sleeping: '<path d="M4 12h6l-6 8h6"/><path d="M14 4h6l-6 8h6"/>',
  corridor:
    '<path d="M5 9h14a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1"/>',
  downstairs: '<g transform="matrix(-1 0 0 1 24 0)"><path d="M22 5h-5v5h-5v5h-5v5h-5"/></g>',
  activity:
    '<path d="M3 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M13 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M9 17v-13h10v13"/><path d="M9 8h10"/>',
  secret: '<path d="M5 12l14 0"/><path d="M13 18l6 -6"/><path d="M13 6l6 6"/>',
  throne: '<path d="M12 6l4 6l5 -4l-2 10h-14l-2 -10l5 4z"/>',
  tower:
    '<path d="M5 3h1a1 1 0 0 1 1 1v2h3v-2a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2h3v-2a1 1 0 0 1 1 -1h1a1 1 0 0 1 1 1v4.394a2 2 0 0 1 -.336 1.11l-1.328 1.992a2 2 0 0 0 -.336 1.11v7.394a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-7.394a2 2 0 0 0 -.336 -1.11l-1.328 -1.992a2 2 0 0 1 -.336 -1.11v-4.394a1 1 0 0 1 1 -1z"/><path d="M10 21v-5a2 2 0 1 1 4 0v5"/>',
  fountain:
    '<path d="M9 16v-5a2 2 0 1 0 -4 0"/><path d="M15 16v-5a2 2 0 1 1 4 0"/><path d="M12 16v-10a3 3 0 0 1 6 0"/><path d="M6 6a3 3 0 0 1 6 0"/><path d="M3 16h18v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-2z"/>',
  foyer:
    '<path d="M14 12v.01"/><path d="M3 21h18"/><path d="M6 21v-16a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v16"/>',
  ballroom:
    '<path d="M4 5h2"/><path d="M5 4v2"/><path d="M11.5 4l-.5 2"/><path d="M18 5h2"/><path d="M19 4v2"/><path d="M15 9l-1 1"/><path d="M18 13l2 -.5"/><path d="M18 19h2"/><path d="M19 18v2"/><path d="M14 16.518l-6.518 -6.518l-4.39 9.58a1 1 0 0 0 1.329 1.329l9.579 -4.39z"/>',
  specialty:
    '<path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/>',
  mirror: '<path d="M12 12m-6 0a6 9 0 1 0 12 0a6 9 0 1 0 -12 0"/>',
  painting:
    '<path d="M15 8h.01"/><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z"/><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5"/><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3"/>',
  swords:
    '<path d="M21 3v5l-11 9l-4 4l-3 -3l4 -4l9 -11z"/><path d="M5 13l6 6"/><path d="M14.32 17.32l3.68 3.68l3 -3l-3.365 -3.365"/><path d="M10 5.5l-2 -2.5h-5v5l3 2.5"/>',
  torch:
    '<path d="M14 21h-4c0 -4.364 -1 -7 -2 -11q 4 2 8 0c-1 4 -2 6.636 -2 11"/><path d="M11 2c0 2.5 -1 2.66 -1 4a1.9 1.9 0 0 0 2 2a1.87 1.87 0 0 0 2 -2c0 -1.41 -1 -3 -3 -4"/>',
};

export const DECO_LABEL: Record<Deco, string> = {
  mirror: "Spiegel",
  painting: "Gemälde",
  swords: "Schwerter",
  torch: "Fackel",
};

const roomDe = (t: string | undefined) =>
  t === "specialty"
    ? "Sonderraum"
    : TYPE_LABEL[t as TileType][1] + (t === "corridor" ? "sraum" : "raum");

/** German scoring rule of a tile, for the confirm card */
export function ruleDe(t: Tile): string {
  const per = t.per ?? 1;
  switch (t.type) {
    case "food":
      return `2 pro ${roomDe(t.wants)} ${
        t.axis === "horizontal"
          ? "links/rechts"
          : t.axis === "below2"
            ? "in den 2 Feldern darunter"
            : "darüber/darunter"
      }`;
    case "living":
      return `${per} pro ${roomDe(t.wants)} nebenan`;
    case "utility":
      return `1 pro ${roomDe(t.wants)} in der angrenzenden Gruppe`;
    case "outdoor":
      return `1 pro ${roomDe(t.wants)} im Schloss`;
    case "sleeping":
      return "4 wenn alle Raumtypen vorhanden, sonst 1";
    case "corridor":
      return `1 pro ${DECO_LABEL[t.wants as Deco]}-Nachbar`;
    case "downstairs":
      return `${per} pro ${roomDe(t.wants)} direkt darüber`;
    case "activity":
      return `1 pro Nachbar (max. 4), nur 1 falls ${roomDe(t.wants)} nebenan`;
    case "throne":
      return `2 pro ${roomDe(t.wants)} / ${roomDe(t.wants2)} auf den markierten Feldern`;
    case "tower":
      return "1 pro Raum darunter";
    case "fountain":
      return "5 Punkte";
    case "foyer":
      return "1 pro Nachbar";
    case "ballroom":
      return `1 pro ${roomDe(t.wants)} in den Nachbarschlössern`;
    case "secret":
      return `zählt wie der Raum ${{ up: "darüber", down: "darunter", left: "links", right: "rechts" }[t.dir!]}`;
    default:
      return "";
  }
}

/** Tabler-style UI icons (24px outline, stroke currentColor) */
export const ICON = {
  back: "M15 6l-6 6l6 6",
  next: "M9 6l6 6l-6 6",
  x: "M18 6l-12 12M6 6l12 12",
  check: "M5 12l5 5l10 -10",
  camera:
    "M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0",
  photo:
    "M15 8h.01M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3",
  crown: "M12 6l4 6l5 -4l-2 10h-14l-2 -10l5 4l4 -6",
  user: "M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2",
  userPlus: "M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0M16 19h6M19 16v6M6 21v-2a4 4 0 0 1 4 -4h4",
  users:
    "M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0 -3 -3.85",
  trophy:
    "M8 21l8 0M12 17l0 4M7 4l10 0M17 4v8a5 5 0 0 1 -10 0v-8M3 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M17 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
  castle:
    "M15 19v-2a3 3 0 0 0 -6 0v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-14h4v3h3v-3h4v3h3v-3h4v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1M3 11l18 0",
  edit: "M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4M13.5 6.5l4 4",
  search: "M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M21 21l-6 -6",
  copy: "M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1",
  focus:
    "M11.5 12a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0M5 12a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M12 3l0 2M3 12l2 0M12 19l0 2M19 12l2 0",
};
