// Claude Design: the kit as the files of a Claude Design System artifact, written under options.path/project/
// (publish that folder to the artifact). README.md is notes.md without its title, plus the kit's exceptions;
// tokens.json is the type's list-shaped tokens, one theme per mode; tokens.css is the same values compiled the way
// the page compiles them; components/bundle.css is Beer CSS (in its layer) with the css and beer outputs; each
// playground specimen is a components/<Name>/preview.html with its README.md, and Cover is drawn from the colour
// roles and the corner scale. The artifact's index (project/design-system.json) is the publisher's, not written here.
// Options: path (a directory). Needs the css and beer outputs, listed before it.
import { join } from "node:path";
import beerCss from "beercss/dist/cdn/beer.min.css" with { type: "text" };
import { version as beerVersion } from "beercss/package.json";
import specimens from "../web/components.js";
import { fontLinks } from "../web/foundations.js";
import { text } from "../header.mjs";
import { need, needKit } from "../system.mjs";

const BEER_JS = `https://cdn.jsdelivr.net/npm/beercss@${beerVersion}/dist/cdn/beer.min.js`;
// Beer's icon face, with the axes its fill and weight classes move.
const SYMBOLS = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap";
const pascal = (text) => text.split(/[^A-Za-z0-9]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join("");
const label = (mode) => mode[0].toUpperCase() + mode.slice(1);
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const LENGTH = /^-?\d*\.?\d+(px|rem|em|%)?$/;
const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The colours the page shows: every colour but Material's component tokens, which the roles already name.
const shown = (token) => token.type === "color" && !token.path.startsWith("md.comp.") && NAME.test(token.name);
const usage = (token) => token.description ?? (token.path.startsWith("md.sys.color.") ? `Material 3's ${token.segments.at(-1)} role.`
  : token.path.startsWith("md.ref.palette.") ? `Material 3's ${token.segments.at(-1).replace(/(\d+)$/, " palette, tone $1")}.` : undefined);
const entry = (name, value, note) => ({ name, value, ...(note && { usage: note }) });

// Material's typescale: md.sys.typescale.<style>.<font|size|line-height|weight|tracking>, one type style each,
// grouped by role (display, headline, title, body, label) and keyed to the family its font token aliases.
const typescale = (tokens) => {
  const styles = new Map();
  for (const token of tokens) {
    const match = token.path.match(/^md\.sys\.typescale\.([^.]+)\.(font|size|line-height|weight|tracking)$/);
    if (!match) continue;
    const style = styles.get(match[1]) ?? styles.set(match[1], {}).get(match[1]);
    style[match[2]] = token;
  }
  const families = {};
  const groups = new Map();
  for (const [name, props] of styles) {
    if (!props.size) continue;
    const key = props.font?.alias?.split(".").at(-1) ?? "sans";
    if (props.font) families[key] = String(props.font.value);
    const role = name.split("-")[0];
    const group = groups.get(role) ?? groups.set(role, { name: label(role), family: key, styles: [] }).get(role);
    group.styles.push({
      name, ...(key !== group.family && { family: key }), fontSize: String(props.size.value),
      ...(props["line-height"] && { lineHeight: String(props["line-height"].value) }),
      ...(props.weight && { fontWeight: Number(props.weight.value) }),
      ...(props.tracking && LENGTH.test(String(props.tracking.value)) && { letterSpacing: String(props.tracking.value) }),
    });
  }
  // Largest first, as Material lists the roles.
  const size = (group) => Number.parseFloat(group.styles[0].fontSize);
  return { fonts: [], families, groups: [...groups.values()].sort((a, b) => size(b) - size(a)) };
};

// The other families the page reads, from the token paths: spacing, the corner scale, the state-layer opacities.
const family = (tokens, test) => tokens.filter((token) => test(token) && NAME.test(token.name) && LENGTH.test(String(token.value)))
  .slice(0, 60).map((token) => entry(token.name, String(token.value), token.description));

// The kit's exceptions: a description on a Material path says why the kit differs (derived tokens say what they are).
const exceptions = (tokens) => {
  const groups = new Map();
  for (const token of tokens) {
    if (!token.path.startsWith("md.") || !token.description || token.derived) continue;
    const group = token.path.split(".").slice(0, 3).join(".");
    (groups.get(group) ?? groups.set(group, []).get(group)).push(token);
  }
  return [...groups].map(([group, each]) => `### ${group}\n\n${each.map((token) => `- \`${token.path}\`: ${token.description}`).join("\n")}\n`).join("\n");
};

// The cover: the name over the ground, the accent roles as blocks cut by the corner scale, a dot grid at 16px.
const cover = (title, tagline) => {
  const blocks = [
    ["primary", 480, 24, 288, 156, "extra-large"], ["tertiary", 784, 24, 152, 72, "large"], ["secondary", 784, 108, 152, 72, "large"],
    ["primary-container", 480, 196, 136, 68, "full"], ["surface-container-highest", 632, 196, 304, 68, "large"],
  ];
  const dots = [];
  for (let x = 800; x <= 928; x += 16) for (let y = 212; y <= 248; y += 16) dots.push(`<circle class="dot" cx="${x}" cy="${y}" r="2"/>`);
  return [
    `<div style="position:relative;width:960px;height:288px;background:var(--md-sys-color-surface);overflow:hidden">`,
    `<svg width="960" height="288" viewBox="0 0 960 288" style="position:absolute;inset:0" aria-hidden="true">`,
    "<!-- blocks: primary 288x156, tertiary and secondary 152x72, primary-container 136x68, surface-container-highest 304x68",
    "     arrangement: one slab with two satellites over a strip of two, right of x = 480",
    "     pattern: a dot grid at 16px, four steps of Material's 4px grid",
    "     radii: md.sys.shape.corner extra-large, large and full -->",
    `<style>${blocks.map(([role]) => `.${role}{fill:var(--md-sys-color-${role})}`).join("")}.dot{fill:var(--md-sys-color-on-surface-variant)}</style>`,
    ...blocks.map(([role, x, y, w, h, corner]) => `<rect class="${role}" x="${x}" y="${y}" width="${w}" height="${h}" style="rx:${corner === "full" ? `${h / 2}px` : `var(--md-sys-shape-corner-${corner})`}"/>`),
    ...dots,
    "</svg>",
    `<div style="position:absolute;left:40px;bottom:36px;max-width:420px">`,
    `<div style="font-family:var(--md-sys-typescale-display-large-font);font-size:64px;line-height:.95;color:var(--md-sys-color-on-surface)">${esc(title)}</div>`,
    ...(tagline ? [`<div style="margin-top:12px;font-size:14px;color:var(--md-sys-color-on-surface-variant)">${esc(tagline)}</div>`] : []),
    "</div></div>",
  ].join("\n");
};

const card = (group, height) => `<!-- @dsCard${group ? ` group="${group}"` : ""} height=${height} -->`;

export default {
  name: "claude-design",
  async build(ctx) {
    needKit(ctx, "claude-design");
    const { tokens, media, mediaTokens, options, config, readExisting, built, root, title, name, version, modes = { base: "base", media: {} } } = ctx;
    // The page shows an HTML comment in markdown as text; a link reference is markdown's own comment.
    const markdown = (content) => `[//]: # (${text({ name, version }, "claude-design")})\n\n${content}`;
    const namespace = pascal(title).replace(/^\d+/, "");
    const dir = join(need(options, "claude-design", "path"), "project");
    const sibling = (target) => {
      const path = config.targets.includes(target) && config[target]?.path;
      const content = path && built(path);
      if (content === undefined || !path) throw new Error(`claude-design needs the ${target} output, listed before it`);
      return content;
    };
    const [kitCss, kitBeer] = [sibling("css"), sibling("beer")];

    // One theme per mode, ids as the css output pins them (data-theme), else the mode's own name.
    const scheme = config.css?.scheme;
    const other = Object.entries(media);
    if (other.length > 1) throw new Error("claude-design shows at most two modes");
    const themes = [{ id: scheme ?? modes.base, name: label(modes.base) }];
    const values = new Map(tokens.filter(shown).map((token) => [token.name, { [themes[0].id]: String(token.value) }]));
    for (const [query, files] of other) {
      const mode = modes.media[query] ?? query;
      const id = scheme ? (scheme === "dark" ? "light" : "dark") : mode;
      themes.push({ id, name: label(mode) });
      for (const token of await mediaTokens(files)) {
        if (shown(token) && values.has(token.name) && String(token.value) !== values.get(token.name)[themes[0].id]) values.get(token.name)[id] = String(token.value);
      }
    }
    const notes = new Map(tokens.map((token) => [token.name, usage(token)]));
    const data = {
      name: title, version: 1,
      color: { themes, tokens: [...values].map(([name, value]) => entry(name, Object.keys(value).length > 1 ? value : value[themes[0].id], notes.get(name))) },
      type: typescale(tokens),
      spacing: { tokens: family(tokens, (token) => token.type === "dimension" && token.segments.some((part) => /^(space|spacing|gap|padding|margin)$/.test(part))) },
      radius: { tokens: family(tokens, (token) => token.type === "dimension" && token.path.startsWith("md.sys.shape.corner.")) },
      opacity: { tokens: family(tokens, (token) => token.type === "number" && /opacity$/.test(token.path) && !token.path.startsWith("md.comp.")) },
    };
    for (const key of ["spacing", "radius", "opacity"]) if (!data[key].tokens.length) delete data[key];

    // tokens.css as the page compiles it: colours per theme, the other families on :root, a class per type style.
    const declare = (pairs) => pairs.map(([name, value]) => `  --${name}: ${value};`).join("\n");
    const css = [
      `/* ${title} — generated from tokens.json */`,
      `:root, [data-theme="${themes[0].id}"] {\n${declare(data.color.tokens.map(({ name, value }) => [name, typeof value === "string" ? value : value[themes[0].id]]))}\n}`,
      ...themes.slice(1).map(({ id }) => `[data-theme="${id}"] {\n${declare(data.color.tokens.filter(({ value }) => typeof value === "object" && value[id]).map(({ name, value }) => [name, value[id]]))}\n}`),
      `:root {\n${declare([...["spacing", "radius", "opacity"].flatMap((key) => (data[key]?.tokens ?? []).map(({ name, value }) => [name, value])),
        ...Object.entries(data.type.families).map(([key, stack]) => [`font-${key}`, stack])])}\n}`,
      ...data.type.groups.flatMap((group) => group.styles.map((style) => `.${style.name} { font-family: var(--font-${style.family ?? group.family}); font-size: ${style.fontSize};${style.lineHeight ? ` line-height: ${style.lineHeight};` : ""}${style.fontWeight ? ` font-weight: ${style.fontWeight};` : ""}${style.letterSpacing ? ` letter-spacing: ${style.letterSpacing};` : ""} }`)),
      "",
    ].join("\n");

    // The faces from Google Fonts (a face it does not serve simply fails to load), then Beer in its layer, Beer's own
    // icon font falling back to its CDN copy, then the kit's outputs over it.
    const bundle = [
      ...[...fontLinks(tokens), SYMBOLS].map((href) => `@import url("${href}");`),
      `@layer beer {\n${beerCss.trim()}\n}`,
      kitCss.trim(),
      kitBeer.trim(),
      "",
    ].join("\n");

    const notesMd = (await readExisting(join(root, "notes.md"))) ?? "";
    const body = notesMd.replace(/^# .*\n+/, "").trim();
    const listed = exceptions(tokens);
    const readme = `${body}${listed ? `\n\n## Exceptions to Material 3\n\nEach Material token the kit sets by hand, and why.\n\n${listed}` : "\n"}`;

    const page = (inner) => `<main class="responsive padding">\n${inner}\n</main>\n<script type="module" src="${BEER_JS}"></script>\n`;
    return [
      { path: join(dir, "README.md"), content: markdown(readme) },
      // The page runs previews only beside a bundle; the components are Beer's markup, so it holds no code.
      { path: join(dir, "components/bundle.js"), content: `window.${namespace} = {};\n` },
      { path: join(dir, "tokens.json"), content: `${JSON.stringify(data, null, 1)}\n` },
      { path: join(dir, "tokens.css"), content: css, lead: 1 },
      { path: join(dir, "components/bundle.css"), content: bundle },
      { path: join(dir, "components/Cover/preview.html"), content: `${card(undefined, 288)}\n${cover(title, ctx.theme?.tagline)}\n`, lead: 1 },
      ...specimens.flatMap((item) => [
        { path: join(dir, "components", pascal(item.id), "preview.html"), content: `${card(item.family, 240)}\n${page(item.specimen())}`, lead: 1 },
        { path: join(dir, "components", pascal(item.id), "README.md"), content: markdown(`# ${item.name}\n\nMaterial 3 ${item.name.toLowerCase()} in Beer's markup, on the kit's theme.\n\n- Markup: [Beer ${item.doc}.md](https://github.com/beercss/beercss/blob/main/docs/${item.doc}.md)\n${item.m3 ? `- Guidance: [Material 3](https://m3.material.io/${item.m3.includes("/") ? item.m3 : `components/${item.m3}/overview`})\n` : ""}`) },
      ]),
    ];
  },
};
