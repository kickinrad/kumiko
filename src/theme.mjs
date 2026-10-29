// A kit's hand-written <root>/theme.toml becomes DTCG 2025.10 token files that feed the build as layers:
// <root>/tokens/theme.tokens.json for the default mode (palette, roles, faces) and
// <root>/tokens/theme.<mode>.tokens.json for each media mode (role values for that mode).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

// Brand and plain fill Material's own typeface slots; mono and icon sit under the kit's name.
const FACES = { brand: ["md", "ref", "typeface", "brand"], plain: ["md", "ref", "typeface", "plain"], mono: ["typeface", "mono"], icon: ["typeface", "icon"] };
const KEYS = ["name", "default", "media", "palette", "roles", "faces"];
const NONE = { include: [], media: {}, files: [] };

const fail = (message) => { throw new Error(`theme.toml: ${message}`); };
const isTable = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const table = (value, where) => { if (!isTable(value)) fail(`${where} must be a table`); return value; };
const text = (value, where) => { if (typeof value !== "string" || !value) fail(`${where} must be a non-empty string`); return value; };
// A DTCG name: no dot, braces or leading $; also safe in a file name. Never an Object.prototype key.
const tokenName = (value, where) => {
  if (["__proto__", "prototype", "constructor"].includes(value)) fail(`${where} "${value}" is not a valid name`);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(text(value, where))) fail(`${where} "${value}" is not a valid name`);
  return value;
};

const colour = (hex, where) => {
  if (typeof hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(hex)) fail(`${where} must be a six-digit hex like #7aa2f7, not ${JSON.stringify(hex)}`);
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
const render = (tree) => `${JSON.stringify(tree, null, 2)}\n`;

const validate = (toml, kitName) => {
  for (const key of Object.keys(toml)) if (!KEYS.includes(key)) fail(`unknown key "${key}" (expected ${KEYS.join(", ")})`);
  const name = tokenName(toml.name, "name");
  if (name !== kitName) fail(`name "${name}" does not match kit.name "${kitName}" in tokens.config.mjs`);
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
    const [from, colourName] = text(value, `role ${role}`).includes(".") ? value.split(".", 2) : [mode, value];
    if (!modes.includes(from)) fail(`role ${role} names mode "${from}", which has no [palette.${from}]`);
    if (!Object.hasOwn(colours[from], colourName)) fail(`role ${role} names colour "${colourName}", which the ${from} palette lacks`);
    return colours[from][colourName];
  };
  const given = table(toml.roles ?? {}, "roles");
  const roles = {};
  for (const [role, value] of Object.entries(given)) {
    if (isTable(value)) {
      if (!modes.includes(role)) fail(`[roles.${role}] names a mode with no [palette.${role}]`);
      continue;
    }
    role.split(".").forEach((part) => tokenName(part, `role ${role}`));
    roles[role] = Object.fromEntries(modes.map((mode) => [mode, pick(role, value, mode)]));
  }
  for (const mode of modes.filter((each) => isTable(given[each]))) {
    for (const [role, value] of Object.entries(given[mode])) {
      if (!roles[role]) fail(`[roles.${mode}] overrides ${role}, which [roles] doesn't set`);
      roles[role][mode] = pick(role, value, mode);
    }
  }
  const faces = table(toml.faces ?? {}, "faces");
  for (const [face, family] of Object.entries(faces)) {
    if (!Object.hasOwn(FACES, face)) fail(`unknown face "${face}" (expected ${Object.keys(FACES).join(", ")})`);
    (Array.isArray(family) && family.length ? family : [family]).forEach((each) => text(each, `face ${face}`));
  }
  return { name, modes, base, media, colours, roles, faces };
};

// kit is build.mjs's { root, name } (or {}): no kit or no theme.toml is no theme.
export const loadTheme = async ({ root, name } = {}) => {
  if (!root) return NONE;
  let source;
  try { source = await readFile(join(root, "theme.toml"), "utf8"); }
  catch (error) { if (error.code === "ENOENT") return NONE; throw error; }
  let toml;
  try { toml = Bun.TOML.parse(source); }
  catch (error) { fail(`not valid TOML (${error.message})`); }
  const theme = validate(table(toml, "the file"), name);

  // One mode's tokens: its palette and every role in its colour; the default mode adds the faces.
  const modeTree = (mode, faces = {}) => {
    const tree = Object.create(null);
    tree[theme.name] = { palette: Object.create(null) };
    for (const [key, value] of Object.entries(theme.colours[mode])) tree[theme.name].palette[key] = { $type: "color", $value: value };
    for (const [face, family] of Object.entries(faces)) {
      const path = FACES[face][0] === "md" ? FACES[face] : [theme.name, ...FACES[face]];
      put(tree, path, { $type: "fontFamily", $value: family });
    }
    for (const [role, values] of Object.entries(theme.roles)) {
      const path = role.split(".");
      put(tree, path, { $type: "color", $value: values[mode] });
    }
    return tree;
  };
  const baseFile = join(root, "tokens/theme.tokens.json");
  const files = [{ path: baseFile, content: render(modeTree(theme.base, theme.faces)) }];
  const media = {};
  for (const mode of theme.modes.filter((each) => each !== theme.base)) {
    const path = join(root, `tokens/theme.${mode}.tokens.json`);
    files.push({ path, content: render(modeTree(mode)) });
    (media[theme.media[mode]] ??= []).push(path);
  }
  return { include: [baseFile], media, files };
};

// The theme's media come first so the project's own blocks for the same query follow and win.
export const withMedia = (theme, media = {}) => {
  const merged = Object.fromEntries(Object.entries(theme.media).map(([query, files]) => [query, [...files]]));
  for (const [query, files] of Object.entries(media)) merged[query] = [...(merged[query] ?? []), ...files];
  return merged;
};

export const syncTheme = async (theme, { check = false } = {}) => {
  const stale = [];
  for (const { path, content } of theme.files) {
    if (check) {
      let existing;
      try { existing = await readFile(path, "utf8"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (existing !== content) stale.push(`${relative(process.cwd(), path)} is stale; run tokens`);
      continue;
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  if (stale.length) throw new Error(stale.join("\n"));
};
