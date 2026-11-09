// A kit's hand-written <root>/theme.toml: its palette per mode, the Material roles it fills from it, its faces,
// the other values it adds or changes, and the recipes and floors the build applies. The build reads it as token
// trees in memory, one for the base mode and one per other mode; nothing is written beside it.
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";

// Brand and plain fill Material's own typeface slots; mono and icon sit under the kit's name.
const FACES = { brand: ["md", "ref", "typeface", "brand"], plain: ["md", "ref", "typeface", "plain"], mono: ["typeface", "mono"], icon: ["typeface", "icon"] };
const KEYS = ["name", "title", "tagline", "icon", "default", "media", "palette", "roles", "faces", "tokens", "derived", "contrast", "mealie"];
const TYPES = ["dimension", "duration", "number", "fontWeight", "fontFamily", "string", "cubicBezier"];
const MATERIAL_ACCENTS = ["primary", "secondary", "tertiary", "error"];
const MEALIE_SLOTS = ["primary", "accent", "secondary", "success", "info", "warning", "error"];
export const NONE = { media: {}, modes: undefined };

const fail = (message) => { throw new Error(`theme.toml: ${message}`); };
const isTable = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const table = (value, where) => { if (!isTable(value)) fail(`${where} must be a table`); return value; };
const text = (value, where) => { if (typeof value !== "string" || !value) fail(`${where} must be a non-empty string`); return value; };
const list = (value, where) => { if (!Array.isArray(value) || value.some((each) => typeof each !== "string")) fail(`${where} must be a list of names`); return value; };
const ratio = (value, where) => { if (typeof value !== "number" || !(value >= 1)) fail(`${where} must be a contrast ratio, 1 or more`); return value; };
const only = (given, keys, where) => { for (const key of Object.keys(given)) if (!keys.includes(key)) fail(`${where}: unknown key "${key}" (expected ${keys.join(", ")})`); };
// A DTCG name: no dot, braces or leading $; also safe in a file name. Never an Object.prototype key.
const tokenName = (value, where) => {
  if (["__proto__", "prototype", "constructor"].includes(value)) fail(`${where} "${value}" is not a valid name`);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(text(value, where))) fail(`${where} "${value}" is not a valid name`);
  return value;
};
const tokenPath = (value, where) => { text(value, where).split(".").forEach((part) => tokenName(part, where)); return value; };

const colour = (hex, where) => {
  if (typeof hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(hex)) fail(`${where} must be a six-digit hex like #rrggbb, not ${JSON.stringify(hex)}`);
  const components = [1, 3, 5].map((at) => Math.round(parseInt(hex.slice(at, at + 2), 16) / 255 * 1e4) / 1e4);
  return { colorSpace: "srgb", components, hex: hex.toLowerCase() };
};

const put = (tree, path, token) => {
  let node = tree;
  for (const part of path.slice(0, -1)) {
    node[part] ??= Object.create(null);
    if ("$value" in node[part]) fail(`${path.join(".")} sits inside the token ${part}`);
    node = node[part];
  }
  const last = path.at(-1);
  if (Object.hasOwn(node, last)) fail(`${path.join(".")} is defined twice`);
  node[last] = token;
};

// One [tokens] value as a DTCG token. A length or a time is typed by its unit; an alias takes its target's type;
// a number or a plain string overriding a token keeps that token's type, and is a number or a string when new.
const UNIT = /^(-?\d*\.?\d+)([a-z%]+)$/;
const token = (path, given) => {
  const where = `[tokens] ${path}`;
  const entry = isTable(given) ? given : { value: given };
  only(entry, ["value", "type", "why"], where);
  const { value, type, why } = entry;
  if (value === undefined) fail(`${where} needs a value`);
  if (type !== undefined && !TYPES.includes(type)) fail(`${where}: type "${type}" is not one of ${TYPES.join(", ")}`);
  if (why !== undefined) text(why, `${where} why`);
  if (path.startsWith("md.") && why === undefined) fail(`${where} changes a Material value, so it needs a why`);
  const result = { $value: value };
  if (typeof value === "string" && !/^\{[^{}]+\}$/.test(value)) {
    const unit = value.match(UNIT);
    if (unit) {
      const kind = ["px", "rem", "em"].includes(unit[2]) ? "dimension" : ["ms", "s"].includes(unit[2]) ? "duration" : fail(`${where}: unknown unit "${unit[2]}" in ${value}`);
      result.$value = { value: Number(unit[1]), unit: unit[2] };
      result.$type = kind;
    }
  } else if (typeof value === "boolean" || (isTable(value))) fail(`${where}: a value is an alias, a length, a time, a number, a string or a list`);
  if (Array.isArray(value) && !type) fail(`${where}: a list needs a type (fontFamily or cubicBezier)`);
  if (type) result.$type = type;
  if (why) result.$description = why;
  return result;
};
// [tokens] nests as TOML allows, by tables or by quoted dotted keys: a table with a `value` is one token.
const tokens = (given, at = []) => Object.entries(given).flatMap(([key, value]) => {
  const path = [...at, ...key.split(".")];
  return isTable(value) && !("value" in value) ? tokens(value, path) : [[tokenPath(path.join("."), "[tokens] path"), value]];
});

const validate = (toml, kitName) => {
  only(toml, KEYS, "the file");
  const name = tokenName(toml.name, "name");
  if (name !== kitName) fail(`name "${name}" does not match kit.name "${kitName}" in kumiko.config.mjs`);
  const palette = table(toml.palette, "palette");
  const modes = Object.keys(palette);
  const base = text(toml.default, "default");
  if (!modes.includes(base)) fail(`default "${base}" has no [palette.${base}]`);
  const media = toml.media === undefined ? {} : table(toml.media, "media");
  for (const mode of Object.keys(media)) if (!modes.includes(mode)) fail(`[media] names "${mode}", which has no [palette.${mode}]`);
  const colours = {};
  for (const mode of modes) {
    tokenName(mode, "palette mode");
    if (mode !== base) text(media[mode], `[media] ${mode} (the media query for mode "${mode}")`);
    colours[mode] = Object.create(null);
    for (const [key, hex] of Object.entries(table(palette[mode], `[palette.${mode}]`))) {
      colours[mode][tokenName(key, `[palette.${mode}] colour`)] = colour(hex, `${mode}.${key}`);
    }
  }
  // A role names a colour: "blue" is the mode's own, "day.blue" that mode's in every mode. [roles.<mode>] overrides in one mode.
  const pick = (role, value, mode) => {
    const parts = text(value, `role ${role}`).split(".");
    if (parts.length > 2) fail(`role ${role} names "${value}"; a colour is "name" or "mode.name"`);
    const [from, colourName] = parts.length === 2 ? parts : [mode, value];
    if (!modes.includes(from)) fail(`role ${role} names mode "${from}", which has no [palette.${from}]`);
    if (!Object.hasOwn(colours[from], colourName)) fail(`role ${role} names colour "${colourName}", which the ${from} palette lacks`);
    return { name: colourName, value: colours[from][colourName] };
  };
  const given = table(toml.roles ?? {}, "roles");
  const roles = {};
  for (const [role, value] of Object.entries(given)) {
    if (isTable(value)) {
      if (!modes.includes(role)) fail(`[roles.${role}] names a mode with no [palette.${role}]`);
      continue;
    }
    tokenPath(role, `role ${role}`);
    roles[role] = Object.fromEntries(modes.map((mode) => [mode, pick(role, value, mode)]));
  }
  for (const mode of modes.filter((each) => isTable(given[each]))) {
    for (const [role, value] of Object.entries(given[mode])) {
      if (!Object.hasOwn(roles, role)) fail(`[roles.${mode}] overrides ${role}, which [roles] doesn't set`);
      roles[role][mode] = pick(role, value, mode);
    }
  }
  const faces = table(toml.faces ?? {}, "faces");
  for (const [face, family] of Object.entries(faces)) {
    if (!Object.hasOwn(FACES, face)) fail(`unknown face "${face}" (expected ${Object.keys(FACES).join(", ")})`);
    (Array.isArray(family) && family.length ? family : [family]).forEach((each) => text(each, `face ${face}`));
  }
  const values = tokens(table(toml.tokens ?? {}, "tokens")).map(([path, value]) => [path, token(path, value)]);

  let derived;
  if (toml.derived !== undefined) {
    const d = table(toml.derived, "derived");
    only(d, ["accents", "container-opacity", "marks"], "[derived]");
    const blend = d["container-opacity"];
    if (typeof blend !== "number" || blend <= 0 || blend >= 1) fail("[derived] container-opacity must be a fraction between 0 and 1");
    const marks = d.marks === undefined ? undefined : table(d.marks, "[derived] marks");
    if (marks) only(marks, ["group", "darker"], "[derived] marks");
    derived = {
      accents: [...MATERIAL_ACCENTS, ...list(d.accents ?? [], "[derived] accents")], custom: d.accents ?? [], fixed: MATERIAL_ACCENTS.slice(0, 3), blend,
      marks: marks && { group: tokenName(marks.group, "[derived] marks.group"), darker: list(marks.darker ?? [], "[derived] marks.darker") },
    };
  }

  let contrast;
  if (toml.contrast !== undefined) {
    const c = table(toml.contrast, "contrast");
    only(c, ["text", "graphics", "exceptions", "pairs"], "[contrast]");
    const pair = (each, where, needWhy) => {
      only(table(each, where), ["fg", "bg", "min", "why"], where);
      if (needWhy) text(each.why, `${where} why`);
      return { fg: tokenPath(each.fg, `${where} fg`), bg: tokenPath(each.bg, `${where} bg`), min: ratio(each.min, `${where} min`) };
    };
    contrast = {
      text: c.text === undefined ? undefined : ratio(c.text, "[contrast] text"),
      graphics: c.graphics === undefined ? undefined : ratio(c.graphics, "[contrast] graphics"),
      exceptions: (c.exceptions ?? []).map((each, i) => pair(each, `[contrast] exceptions[${i}]`, true)),
      pairs: (c.pairs ?? []).map((each, i) => pair(each, `[contrast] pairs[${i}]`, false)),
    };
  }

  let mealie;
  if (toml.mealie !== undefined) {
    const m = table(toml.mealie, "mealie");
    only(m, ["slots", "overlay", "stars"], "[mealie]");
    for (const key of ["slots", "overlay"]) {
      table(m[key], `[mealie] ${key}`);
      for (const slot of MEALIE_SLOTS) text(m[key][slot], `[mealie] ${key}.${slot}`);
    }
    mealie = { slots: m.slots, overlay: m.overlay, stars: text(m.stars, "[mealie] stars") };
  }

  const title = toml.title === undefined ? name : text(toml.title, "title");
  const icon = toml.icon === undefined ? undefined : text(toml.icon, "icon");
  const tagline = toml.tagline === undefined ? undefined : text(toml.tagline, "tagline");
  return { name, title, tagline, icon, modes, base, media, colours, roles, faces, values, derived, contrast, mealie };
};

// kit is build.mjs's { root, name } (or {}): no kit or no theme.toml is no theme. `given` (its text) stands in for the file.
export const loadTheme = async ({ root, name } = {}, given) => {
  if (!root) return NONE;
  let source = given;
  try { source ??= await readFile(join(root, "theme.toml"), "utf8"); }
  catch (error) { if (error.code === "ENOENT") return NONE; throw error; }
  const parse = (text, file) => {
    try { return table(Bun.TOML.parse(text), "the file"); }
    catch (error) { fail(`${file === "theme.toml" ? "" : `${file}: `}not valid TOML (${error.message})`); }
  };
  const toml = parse(source, "theme.toml");
  // `extends`: another theme's file beside this one (a copy of it at the version this kit builds on). Its modes,
  // palette and faces come first; this file's own add to them or change them.
  if (toml.extends !== undefined) {
    const file = join(root, text(toml.extends, "extends"));
    let base;
    try { base = parse(await readFile(file, "utf8"), file); }
    catch (error) { if (error.code === "ENOENT") fail(`extends: no theme at ${relative(".", file)}`); throw error; }
    toml.default ??= base.default;
    toml.media = { ...base.media, ...toml.media };
    toml.palette = Object.fromEntries([...new Set([...Object.keys(base.palette ?? {}), ...Object.keys(toml.palette ?? {})])]
      .map((mode) => [mode, { ...base.palette?.[mode], ...toml.palette?.[mode] }]));
    toml.faces = base.faces || toml.faces ? { ...base.faces, ...toml.faces } : undefined;
    if (toml.faces === undefined) delete toml.faces;
    delete toml.extends;
  }
  const theme = validate(toml, name);

  // One mode's tokens: its palette and every role in its colour; the base mode adds the faces and [tokens].
  const modeTree = (mode, base) => {
    const tree = Object.create(null);
    tree[theme.name] = Object.assign(Object.create(null), { palette: Object.create(null) });
    for (const [key, value] of Object.entries(theme.colours[mode])) tree[theme.name].palette[key] = { $type: "color", $value: value };
    if (base) {
      for (const [face, family] of Object.entries(theme.faces)) {
        const path = FACES[face][0] === "md" ? FACES[face] : [theme.name, ...FACES[face]];
        put(tree, path, { $type: "fontFamily", $value: family });
      }
      // One face for everything: plain follows brand when only brand is set.
      if (theme.faces.brand !== undefined && theme.faces.plain === undefined) put(tree, FACES.plain, { $type: "fontFamily", $value: "{md.ref.typeface.brand}" });
    }
    for (const [role, values] of Object.entries(theme.roles)) put(tree, role.split("."), { $type: "color", $value: values[mode].value });
    if (base) for (const [path, each] of theme.values) put(tree, path.split("."), each);
    return tree;
  };
  const others = theme.modes.filter((each) => each !== theme.base);
  return {
    ...theme,
    tree: modeTree(theme.base, true),
    // Each other mode under its media query: its tree, and its name.
    media: Object.fromEntries(others.map((mode) => [theme.media[mode], { tree: modeTree(mode, false), name: mode }])),
    // The mode names a target may show: the base mode's, and each other mode's by its media query.
    modes: { base: theme.base, media: Object.fromEntries(others.map((mode) => [theme.media[mode], mode])) },
    // The palette colour a role takes in a mode.
    roleColour: (role, mode) => theme.roles[role]?.[mode]?.name,
  };
};

// Each media query's layers: the theme's mode first, then the project's own files for that query, which win.
export const withMedia = (theme, media = {}) => {
  const merged = Object.fromEntries(Object.entries(theme.media).map(([query, { tree, name }]) => [query, [{ tree, file: `theme.toml (${name})`, strict: true }]]));
  for (const [query, files] of Object.entries(media)) merged[query] = [...(merged[query] ?? []), ...files.map((file) => ({ file, strict: true }))];
  return merged;
};
