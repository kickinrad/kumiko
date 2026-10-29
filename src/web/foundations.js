// Foundations: the kit's values, read from the mode's tokens and drawn in the live theme's variables.
// Each item is { id, name, body(data, tokens) → html }; the colour maths are the engine's, in "../color.mjs".
import { bestOn, contrast } from "../color.mjs";

// A token's CSS variable, as the kit's css output names it.
const variable = (path) => `var(--${path.replaceAll(".", "-")})`;
const find = (tokens, path) => tokens.find((token) => token.path === path)?.value;
const under = (tokens, prefix) => tokens.filter((token) => token.path.startsWith(prefix) && !token.path.slice(prefix.length).includes("."));
const grid = (cells) => `<div class="grid">${cells.map((cell) => `<div class="s12 m6 l4">${cell}</div>`).join("")}</div>`;

// Colour, the view-only builder: the kit's palette, the Material roles in Material's groups with the palette
// colours that fill them, and each role on its on-colour with the ratio between them.
const COLOR = "md.sys.color.";
const AA = 4.5;
const GROUPS = [
  ["Primary", /^(on-)?primary(-container)?$/],
  ["Secondary", /^(on-)?secondary(-container)?$/],
  ["Tertiary", /^(on-)?tertiary(-container)?$/],
  ["Error", /^(on-)?error(-container)?$/],
  ["Surfaces and containers", /^(on-)?(surface|background)/],
  ["Outline", /^outline/],
  ["Inverse", /^inverse-/],
  ["Fixed", /-fixed/],
];

// Role to the names of every palette colour of its value, in the palette's order.
export const fills = (name, tokens) => {
  const palette = tokens.filter((token) => token.type === "color" && token.path.startsWith(`${name}.palette.`));
  return new Map(tokens.filter((token) => token.type === "color" && token.path.startsWith(COLOR)).map((token) => [
    token.path.slice(COLOR.length),
    palette.filter((colour) => colour.value.toLowerCase() === token.value.toLowerCase()).map((colour) => colour.path.slice(`${name}.palette.`.length)),
  ]));
};

// Every [background, text] pair of roles: a text role over the role it is named for, over the roles of its
// family (surface's dim, bright and containers; a fixed colour's dim) and, for a "variant", over the base.
export const pairs = (roles) => {
  const out = [];
  for (const text of roles) {
    const name = text === "inverse-on-surface" ? "inverse-surface" : text.startsWith("on-") ? text.slice(3) : undefined;
    if (!name) continue;
    const family = [name, name.replace(/-variant$/, ""), `${name}-dim`, ...(name === "surface" ? [...roles].filter((role) => /^surface-(bright|container)/.test(role)) : [])];
    for (const background of new Set(family)) if (roles.has(background)) out.push([background, text]);
  }
  return out;
};

export const colour = (data, tokens) => {
  const ink = (fill) => bestOn(fill, [find(tokens, `${COLOR}on-surface`), find(tokens, `${COLOR}surface`)])[0];
  const tile = (path, label, value, note) => `<div class="padding round" style="background: ${variable(path)}; color: ${ink(value)}"><b>${label}</b><br><small>${value}${note}</small></div>`;

  const palette = tokens.filter((token) => token.type === "color" && token.path.startsWith(`${data.name}.palette.`));
  const swatches = palette.length ? grid(palette.map((token) => tile(token.path, token.path.slice(`${data.name}.palette.`.length), token.value, ""))) : "<p>This kit declares no palette.</p>";

  const names = fills(data.name, tokens);
  const order = (role) => [role.replace(/^on-/, ""), role.startsWith("on-")];
  const grouped = new Map();
  for (const role of [...names.keys()].sort((a, b) => order(a)[0].localeCompare(order(b)[0]) || order(a)[1] - order(b)[1])) {
    const title = GROUPS.find(([, test]) => test.test(role))?.[0] ?? "Other";
    grouped.set(title, [...(grouped.get(title) ?? []), role]);
  }
  const roles = [...GROUPS.map(([title]) => title), "Other"].filter((title) => grouped.has(title)).map((title) => `<h3>${title}</h3>${grid(grouped.get(title).map((role) => {
    const filled = names.get(role);
    return tile(`${COLOR}${role}`, role, find(tokens, `${COLOR}${role}`), ` · ${filled.length ? filled.join(", ") : "no palette match"}`);
  }))}`).join("");

  const checked = pairs(new Set(names.keys())).map(([background, text]) => [background, text, contrast(find(tokens, `${COLOR}${text}`), find(tokens, `${COLOR}${background}`))]);
  const failing = checked.filter(([, , ratio]) => ratio < AA).length;
  const ratios = grid(checked.map(([background, text, ratio]) => `<div class="padding round"${ratio < AA ? " data-fail" : ""} style="background: ${variable(COLOR + background)}; color: ${variable(COLOR + text)}"><b>${background}</b><br><small>on ${text} · ${ratio.toFixed(2)}:1${ratio < AA ? ` · <i>warning</i> under ${AA}:1` : ""}</small></div>`));

  return `<h2>Palette</h2>${swatches}<h2>Roles</h2><p>Each role with the palette colours of its value.</p>${roles}<h2>Contrast</h2><p>Each role under its on-colour. ${failing} of ${checked.length} pairs are under ${AA}:1, the floor for text.</p>${ratios}`;
};

// Type: the 15 Material styles, a line each through the kit's variables.
const STYLES = ["display", "headline", "title", "body", "label"].flatMap((group) => ["large", "medium", "small"].map((size) => `${group}-${size}`));
export const type = (data, tokens) => `<p>Each line is set in its style's own variables.</p>${STYLES.map((style) => {
  const at = (part) => find(tokens, `md.sys.typescale.${style}.${part}`);
  const use = (part) => variable(`md.sys.typescale.${style}.${part}`);
  return `<div data-style="${style}"><small>${style} · ${at("size")} / ${at("line-height")} · ${at("weight")}</small><div style="font: ${use("weight")} ${use("size")}/${use("line-height")} ${use("font")}; letter-spacing: ${use("tracking")}">The quick brown fox jumps over the lazy dog</div></div>`;
}).join("")}`;

// The faces the type tokens name, one Google Fonts css2 link per family (so one unknown family fails alone), in
// the weights the type tokens use. A generic stack is not a family.
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|emoji|math|fangsong|ui-[a-z-]+)$/i;
export const fontLinks = (tokens) => {
  const families = tokens.filter((token) => token.type === "fontFamily" && token.path.startsWith("md.sys.typescale."))
    .flatMap((token) => String(token.value).split(",").map((family) => family.trim().replace(/^['"]|['"]$/g, "")))
    .filter((family) => family && !GENERIC.test(family));
  const weights = [...new Set(tokens.filter((token) => /^md\.sys\.typescale\.[^.]+\.weight$/.test(token.path)).map((token) => Number(token.value)))].sort((a, b) => a - b);
  return [...new Set(families)].map((family) => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replaceAll("%20", "+")}${weights.length ? `:wght@${weights.join(";")}` : ""}&display=swap`);
};

// Shape: the corner scale, smallest first.
export const shape = (data, tokens) => `<p>The corner scale, each box rounded by its variable.</p>${grid(under(tokens, "md.sys.shape.corner.")
  .filter((token) => token.type === "dimension")
  .sort((a, b) => Number.parseFloat(a.value) - Number.parseFloat(b.value))
  .map((token) => `<div class="small-height border padding" style="border-radius: ${variable(token.path)}"><b>${token.path.split(".").at(-1)}</b><br><small>${token.value}</small></div>`))}`;

// Motion: a dot on each track, moved by Replay over its duration and easing. A track holds its duration and
// easing in --dur and --ease; replay reads them from the live theme.
const track = (label, detail, duration, easing) => `<div class="row"><div class="min"><b>${label}</b><br><small>${detail}</small></div><div class="max" data-track style="--dur: ${variable(duration)}; --ease: ${variable(easing)}"><i class="circle primary"></i></div></div>`;
export const motion = (data, tokens) => {
  const durations = under(tokens, "md.sys.motion.duration.").filter((token) => token.type === "duration").sort((a, b) => Number.parseFloat(a.value) - Number.parseFloat(b.value));
  const easings = under(tokens, "md.sys.motion.easing.").filter((token) => token.type === "cubicBezier");
  const last = (token) => token.path.split(".").at(-1);
  return `<p><button data-replay><i>replay</i><span>Replay</span></button></p><p>Replay stands still when the system asks for reduced motion.</p>
<h2>Durations</h2>${durations.map((token) => track(last(token), token.value, token.path, "md.sys.motion.easing.standard")).join("")}
<h2>Easings</h2>${easings.map((token) => track(last(token), token.value, "md.sys.motion.duration.medium4", token.path)).join("")}`;
};
export const replay = (root) => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const lane of root.querySelectorAll("[data-track]")) {
    const dot = lane.querySelector("i");
    const style = getComputedStyle(lane);
    const duration = style.getPropertyValue("--dur").trim();
    dot.animate([{ transform: "translateX(0)" }, { transform: `translateX(${lane.clientWidth - dot.offsetWidth}px)` }], {
      duration: Number.parseFloat(duration) * (duration.endsWith("ms") ? 1 : 1000),
      easing: style.getPropertyValue("--ease").trim(),
    });
  }
};

// Tailwind: the kit's Tailwind output proved in a frame of its own (tailwind.html, which the playground writes),
// since Tailwind's reset would restyle this page. The page sets the frame's source with the mode.
export const tailwind = (data) => data.tailwind
  ? `<p>Utility classes on the kit's Tailwind output, in a frame so Tailwind's reset leaves this page alone. The frame follows the mode.</p><iframe data-frame="${data.tailwind}" class="responsive large-height border round" title="Tailwind"></iframe>`
  : "<p>This kit has no Tailwind output.</p>";

export default [
  { id: "colour", name: "Colour", body: colour },
  { id: "type", name: "Type", body: type },
  { id: "shape", name: "Shape", body: shape },
  { id: "motion", name: "Motion", body: motion },
  { id: "tailwind", name: "Tailwind", body: tailwind },
];
