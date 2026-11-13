// A kit's theme.toml sets contrast floors: [contrast] text and graphics. The build checks Material's own pairs at
// them (each on-colour on its colour, the fixed roles, on-surface on the page, the card and the top surface,
// outline on every surface), each derived mark group's pairs, and any pairs the kit lists; a named exception
// lowers one pair's floor, with a reason. Every pair is resolved in every mode, and a pair under its floor fails.
import { contrast } from "../color.mjs";

const sys = (role) => `md.sys.color.${role}`;
const ACCENTS = ["primary", "secondary", "tertiary", "error"];
const SURFACES = ["surface", "surface-dim", "surface-bright", "surface-container-lowest", "surface-container-low", "surface-container",
  "surface-container-high", "surface-container-highest"];
const TEXT = [
  ...["surface", "surface-container-low", "surface-container-highest"].map((bg) => ["on-surface", bg]),
  ["on-background", "background"], ["inverse-on-surface", "inverse-surface"],
  ...ACCENTS.flatMap((a) => [[`on-${a}`, a], [`on-${a}-container`, `${a}-container`]]),
  ...ACCENTS.slice(0, 3).flatMap((a) => [`on-${a}-fixed`, `on-${a}-fixed-variant`].flatMap((fg) => [[fg, `${a}-fixed`], [fg, `${a}-fixed-dim`]])),
];

// The pairs a theme's [contrast] asks for, from its floors, its derived mark group and its own list.
export const contrastPairs = ({ name, contrast: floors, derived }, tokens) => {
  const pairs = [];
  if (floors.text) pairs.push(...TEXT.map(([fg, bg]) => ({ fg: sys(fg), bg: sys(bg), min: floors.text })));
  if (floors.graphics) pairs.push(...SURFACES.map((bg) => ({ fg: sys("outline"), bg: sys(bg), min: floors.graphics })));
  const group = derived?.marks?.group;
  if (group && floors.graphics) {
    const head = `${name}.${group}.`;
    const items = [...new Set(tokens.filter((t) => t.path.startsWith(head)).map((t) => t.path.slice(head.length).split(".")[0]))];
    const has = (path) => tokens.some((t) => t.path === path);
    for (const item of items) {
      const at = (key) => `${head}${item}.${key}`;
      if (has(at("on-container")) && has(at("container"))) pairs.push({ fg: at("on-container"), bg: at("container"), min: floors.graphics });
      if (has(at("mark"))) pairs.push(...["surface", "surface-container-low", "surface-container-highest"].map((bg) => ({ fg: at("mark"), bg: sys(bg), min: floors.graphics })));
    }
  }
  pairs.push(...floors.pairs);
  for (const { fg, bg, min } of floors.exceptions) {
    const pair = pairs.find((each) => each.fg === fg && each.bg === bg);
    if (!pair) throw new Error(`theme.toml: [contrast] exception ${fg} on ${bg} is not a pair the build checks`);
    pair.min = min;
  }
  return pairs;
};

// An opaque colour as the build writes it (#rrggbb), else undefined.
export const toHex = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/.test(value) ? value : undefined;

// Returns each pair under its floor, one line each (none when the theme sets no floors).
export const checkContrast = async (pairs, { tokens, media, mediaTokens }) => {
  if (pairs === undefined) return [];
  const modes = [["base", tokens]];
  for (const [query, files] of Object.entries(media)) modes.push([query, await mediaTokens(files)]);
  const failures = [];
  for (const [mode, set] of modes) {
    const byPath = new Map(set.map((token) => [token.path, token]));
    for (const { fg, bg, min } of pairs) {
      const colours = [fg, bg].map((path) => {
        const token = byPath.get(path);
        if (!token) failures.push(`${path} is not a token (${mode})`);
        else if (token.type !== "color" || !toHex(token.value)) failures.push(`${path} is not an opaque colour (${mode})`);
        else return toHex(token.value);
        return undefined;
      });
      if (colours.includes(undefined)) continue;
      const ratio = contrast(...colours);
      if (ratio < min) failures.push(`${fg} (${colours[0]}) on ${bg} (${colours[1]}) is ${ratio.toFixed(2)}:1 in ${mode}, under the ${min}:1 floor`);
    }
  }
  return [...new Set(failures)];
};
