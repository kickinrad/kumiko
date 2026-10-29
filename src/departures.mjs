// A kit's departures.toml names every place it differs from Material, with the reason. Each record becomes a
// token in a layer above the baseline, and a difference from the baseline that no record names fails the build.
//   [[departure]] id, replaces (a Material token path), value (a DTCG $value), why
//   [[addition]]  id, adds (a new token path), type, value, why
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";

// The colour roles are the kit's palette, set by theme.toml, so they are not departures.
const COLOUR_ROLES = "md.sys.color.";
const KINDS = { departure: ["replaces"], addition: ["adds", "type"] };

export const readDepartures = async (root) => {
  let text;
  try { text = await readFile(join(root, "departures.toml"), "utf8"); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const file = Bun.TOML.parse(text);
  return Object.entries(KINDS).flatMap(([kind, [target, ...more]]) => (file[kind] ?? []).map((record, i) => {
    const id = record?.id;
    const name = typeof id === "string" && id ? `${kind} "${id}"` : `${kind} #${i + 1}`;
    for (const field of ["id", target, ...more, "why"]) {
      if (typeof record?.[field] !== "string" || !record[field]) throw new Error(`departures.toml: ${name} needs a text ${field}`);
    }
    if (record.value === undefined) throw new Error(`departures.toml: ${name} needs a value`);
    return { kind, id, path: record[target], type: record.type, value: record.value, why: record.why };
  }));
};

// The records as a DTCG token tree. A departure takes its type from the Material token it replaces.
export const departureLayer = (records, baseline, typeOf) => {
  const layer = {};
  for (const { kind, id, path, type, value, why } of records) {
    if (kind === "departure" && !baseline.has(path)) throw new Error(`departures.toml: departure "${id}" replaces ${path}, which is not a Material token`);
    if (kind === "addition" && baseline.has(path)) throw new Error(`departures.toml: addition "${id}" adds ${path}, which Material already has`);
    const parts = path.split(".");
    const leaf = parts.pop();
    const group = parts.reduce((node, part) => (node[part] ??= {}), layer);
    if (leaf in group) throw new Error(`departures.toml: ${path} is recorded twice (${kind} "${id}")`);
    group[leaf] = { $type: kind === "departure" ? typeOf(path) : type, $value: value, $description: why };
  }
  return layer;
};

// Lays one token tree over another; a token in the top tree replaces the one below.
export const overlay = (base, top) => {
  for (const [key, value] of Object.entries(top)) {
    if ("$value" in value || !(key in base)) base[key] = value;
    else overlay(base[key], value);
  }
  return base;
};

// tokens: the kit's resolved tokens; baseline: Material's alone, by path. A token with its own value, at a
// baseline path outside the colour roles, needs a record. What merely aliases a recorded token follows it.
export const checkDepartures = (tokens, baseline, records) => {
  const recorded = new Set(records.map((record) => record.path));
  const lines = [];
  for (const token of tokens) {
    const path = token.path.join(".");
    const base = baseline.get(path);
    if (!base || path.startsWith(COLOUR_ROLES) || recorded.has(path)) continue;
    if (isDeepStrictEqual(token.original.$value, base.original.$value) || isDeepStrictEqual(token.$value, base.$value)) continue;
    lines.push(`${path} is ${JSON.stringify(token.$value)} here and ${JSON.stringify(base.$value)} in Material; record it in departures.toml`);
  }
  if (lines.length) throw new Error(`Departures check failed:\n${lines.map((line) => `  ${line}`).join("\n")}`);
};
