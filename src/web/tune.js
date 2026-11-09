// Tune: what theme.toml sets that a person changes, as controls. `controls` is the model (plain data, no markup),
// so any host can draw it; `tuneView` draws it in kumiko dev's panel (/_kumiko/panel). Groups take DTCG 2025.10's type names (color,
// fontFamily, dimension, duration); a control's label is its plain name and its theme.toml path is the detail.
import { contrast } from "../color.mjs";
import { fills, pairs } from "./foundations.js";

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const COLOR = "md.sys.color.";
// A palette colour's name as a label: "on-primary" reads "On primary".
export const label = (key) => key[0].toUpperCase() + key.slice(1).replaceAll("-", " ");
const find = (tokens, path) => tokens.find((token) => token.path === path)?.value;
// The pairs the kit holds (data.pairs, the build's contrast check: { fg, bg, min } by token path), else each Material
// role on its on-colour at the text floor.
const held = (data, tokens) => data.pairs ?? pairs(new Set(fills(data.name, tokens).keys())).map(([bg, fg]) => ({ fg: `${COLOR}${fg}`, bg: `${COLOR}${bg}`, min: 4.5 }));
// The pairs that hold one palette colour (by key), each { line, ratio, min, pass }: "On <colour>" when it is the text,
// "Under <colour>" when it is the ground, the other side named by the palette colour that fills it.
export const pairsOf = (data, tokens, key) => {
  const head = `${data.name}.palette.`;
  const names = fills(data.name, tokens);
  const colours = (path) => path.startsWith(head) ? [path.slice(head.length)] : names.get(path.slice(COLOR.length)) ?? [];
  const seen = new Set();
  return held(data, tokens).flatMap(({ fg, bg, min }) => {
    const [onIt, under] = [colours(fg).includes(key), colours(bg).includes(key)];
    if (!onIt && !under) return [];
    const other = (onIt ? colours(bg) : colours(fg))[0] ?? (onIt ? bg : fg).split(".").at(-1);
    const line = `${onIt ? "On" : "Under"} ${label(other)}`;
    if (seen.has(line)) return [];
    seen.add(line);
    const ratio = contrast(find(tokens, fg), find(tokens, bg));
    return [{ line, ratio, min, pass: ratio >= min }];
  });
};

// Material's face slots by the type roles that read them (md.ref.typeface.brand sets display, headline and title;
// plain sets body and label).
const FACES = { brand: "Display, headline and title", plain: "Body and label", mono: "Mono" };
// A dimension's group by what its path names; the rest are sizes.
const KIND = [["Radius", /corner|radius|shape|round/], ["Border", /border|stroke/], ["Spacing", /space|spacing|gap|padding|margin|inset|gutter/], ["Measure", /measure|width|container/]];
// A slider's range by unit: wide enough to explore, fine enough to land on a value.
const RANGE = { px: [0, 96, 1], rem: [0, 6, 0.125], em: [0, 6, 0.125], ch: [20, 120, 1], ms: [0, 1000, 10], s: [0, 2, 0.05] };
const split = (value) => String(value).match(/^(-?[\d.]+)([a-z]+)$/)?.slice(1);

// The controls for a mode: { group, items: [{ path, label, detail, kind, value, ... }] }. `edits` maps a theme.toml
// path to its edited value; a control's value is the edit, else what the kit has.
export const controls = (data, mode, edits = {}) => {
  const tokens = data.modes[mode];
  const base = data.modes[Object.keys(data.modes)[0]];
  const head = `${data.name}.palette.`;
  const groups = [];
  const colours = tokens.filter((token) => token.type === "color" && token.path.startsWith(head)).map((token) => {
    const key = token.path.slice(head.length);
    const path = `palette.${mode}.${key}`;
    return { path, label: label(key), detail: path, kind: "color", value: edits[path] ?? token.value, saved: token.value, pairs: pairsOf(data, tokens, key) };
  });
  if (colours.length) groups.push({ group: "Color", items: colours });
  const faces = Object.entries(data.tune?.faces ?? {}).filter(([face]) => FACES[face]).map(([face, family]) => {
    const path = `faces.${face}`;
    const saved = [family].flat().join(", ");
    return { path, label: FACES[face], detail: path, kind: "fontFamily", value: edits[path] ?? saved, saved };
  });
  if (faces.length) groups.push({ group: "Typography", items: faces });
  const sized = new Map();
  for (const tokenPath of data.tune?.tokens ?? []) {
    const token = base.find((each) => each.path === tokenPath);
    const parts = token && split(token.value);
    if (!parts || !RANGE[parts[1]]) continue;
    const path = `tokens.${tokenPath}`;
    const [min, max, step] = RANGE[parts[1]];
    const group = token.type === "duration" ? "Duration" : KIND.find(([, test]) => test.test(tokenPath))?.[0] ?? "Size";
    const value = split(edits[path] ?? token.value);
    (sized.get(group) ?? sized.set(group, []).get(group)).push({ path, label: label(tokenPath.split(".").slice(-2).join(" ").replace(new RegExp(`^${data.name} `), "")), detail: tokenPath, kind: token.type, value: Number(value[0]), unit: parts[1], saved: Number(parts[0]), min, max: Math.max(max, Number(parts[0]) * 2), step });
  }
  for (const group of ["Spacing", "Radius", "Border", "Measure", "Size", "Duration"]) if (sized.has(group)) groups.push({ group, items: sized.get(group) });
  return groups;
};

// The value theme.toml takes for a control's input.
export const valueOf = (item, input) => item.unit ? `${input}${item.unit}` : item.kind === "fontFamily" ? input.split(",").map((each) => each.trim()).filter(Boolean) : input.toLowerCase();

// A colour's status: its lowest pair against that pair's floor, and how many of its pairs fail. Every pair is in the
// title.
export const status = (item) => {
  if (!item.pairs?.length) return "";
  const failing = item.pairs.filter((pair) => !pair.pass);
  const worst = item.pairs.reduce((low, pair) => pair.ratio / pair.min < low.ratio / low.min ? pair : low);
  const all = item.pairs.map((pair) => `${pair.line}: ${pair.ratio.toFixed(2)}:1 (${pair.pass ? "passes" : "under"} ${pair.min}:1)`).join("\n");
  return `<span class="status${failing.length ? " fail" : ""}" title="${esc(all)}"><i aria-hidden="true">${failing.length ? "close" : "check"}</i>${failing.length ? `${failing.length} of ${item.pairs.length} fail · ${worst.ratio.toFixed(2)}:1` : `${worst.ratio.toFixed(2)}:1`}</span>`;
};

const input = (item) => {
  const at = `data-tune="${esc(item.path)}" id="${esc(item.path)}"`;
  if (item.kind === "color") return `<input type="color" ${at} value="${esc(item.value)}">`;
  if (item.kind === "fontFamily") return `<input type="text" ${at} value="${esc(item.value)}" list="tune-faces" spellcheck="false">`;
  return `<input type="range" ${at} min="${item.min}" max="${item.max}" step="${item.step}" value="${item.value}"><output for="${esc(item.path)}">${item.value}${item.unit}</output>`;
};

// The panel: `head` (the host's own controls, such as a mode switch) and the changes first (reset, save), then each group's controls. Each control: its input, its label and
// theme.toml path, a colour's contrast status, and its reset.
export const tuneView = (data, mode, { edits = {}, problem = "" } = {}, head = "") => {
  const groups = controls(data, mode, edits);
  const changed = Object.keys(edits);
  const faces = [...new Set(Object.values(data.tune?.faces ?? {}).flat().filter((family) => !/^(serif|sans-serif|monospace|system-ui|cursive)$/.test(family)))];
  return `<div data-tune-panel>
<div class="top">${head}<header data-changes><span>${changed.length ? `${changed.length} unsaved change${changed.length === 1 ? "" : "s"}` : "No changes"}</span>${changed.length ? '<button class="quiet" data-tune-reset>Reset all</button><button data-tune-save>Save to theme.toml</button>' : ""}</header></div>
${problem ? `<p class="problem" role="alert">${esc(problem)}</p>` : ""}
${groups.map(({ group, items }) => `<section><h2>${group}</h2>${items.map((item) => `<div class="tune ${item.kind}" data-item="${esc(item.path)}">${input(item)}<label for="${esc(item.path)}"><b>${esc(item.label)}</b><code>${esc(item.detail)}</code></label>${status(item)}<button class="icon" data-tune-undo="${esc(item.path)}" aria-label="Reset ${esc(item.label)}"${item.path in edits ? "" : " hidden"}><i aria-hidden="true">undo</i></button></div>`).join("")}</section>`).join("")}
<datalist id="tune-faces">${[...faces, ...GOOGLE].map((family) => `<option value="${esc(family)}">`).join("")}</datalist>
</div>`;
};

// Google Fonts families to start from (any family Google serves loads when typed).
const GOOGLE = ["Archivo", "Inter", "Lato", "Manrope", "Roboto", "Roboto Flex", "Source Sans 3", "Work Sans", "IBM Plex Sans", "Space Grotesk", "Schibsted Grotesk", "Unbounded", "Anybody", "Syncopate", "Michroma", "Darker Grotesque", "Bricolage Grotesque", "Fraunces", "Playfair Display", "DM Serif Display", "PT Mono", "JetBrains Mono", "IBM Plex Mono", "Azeret Mono", "Martian Mono", "Space Mono"];
