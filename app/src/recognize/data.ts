/** Recognition data files, bundled as hashed assets so a build is self-consistent: a deploy can
 * never pair an old worker with new data, and the files cache as immutable. */
import orbJson from "./data/orb.json?url";
import refsBin from "./data/refs.bin?url";
import refsJson from "./data/refs.json?url";
import refsOrb from "./data/refs.orb?url";
import stripsBin from "./data/strips.bin?url";
import stripsJson from "./data/strips.json?url";

const FILES = {
  "orb.json": orbJson,
  "refs.bin": refsBin,
  "refs.json": refsJson,
  "refs.orb": refsOrb,
  "strips.bin": stripsBin,
  "strips.json": stripsJson,
} as const;

export function dataUrl(file: keyof typeof FILES): string {
  return FILES[file];
}
