// The playground: one page on the kit's generated web outputs, so the kit shows itself on its own theme.
// Writes into options.path index.html, one file that opens from disk: its shell names no kit, and it carries the
// kit's data (name, version, title, tokens per mode, notes and examples), the engine's client
// (src/web, bundled into one script with color.mjs, the engine's colour maths) and its styles.
// Options: path (a directory). The styles are Beer's (the installed release, its own font files left out), then the
// config's css and beer outputs as this run made them (list both before the playground). Beer's script is that release's from its CDN, and the
// icon face comes from Google Fonts. With a tailwind output (listed before the playground) it also writes
// tailwind.html, which proves the output in a frame of its own (Tailwind's reset would restyle the page).
// theme.toml's icon, a Material Symbol name, is the kit's mark in the top app bar ("style" otherwise). Optional:
// examples, the project's own entry files (src/web/examples.js), read at build and carried in the page.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import tailwind from "../web/tailwind.html" with { type: "text" };
import { need, needKit } from "../system.mjs";
import { iconLink } from "../web/foundations.js";

// Beer's stylesheet, installed with the engine (the binary carries Beer's dist/cdn folder as assets). Its shapes are
// SVG files beside it, which the page carries as data; its font faces point at icon fonts beside it too, which the
// page loads from Google Fonts instead.
const beerFile = (file) => Bun.embeddedFiles.find((each) => basename(each.name) === file) ?? Bun.file(join(dirname(Bun.resolveSync("beercss/dist/cdn/beer.min.css", import.meta.dir)), file));
// Returns the stylesheet as the page carries it, and the release it names.
const beerCss = async () => {
  const source = await beerFile("beer.min.css").text();
  const release = source.match(/beercss@([^/]+)\//)?.[1];
  if (!release) throw new Error("playground: the installed Beer stylesheet names no release");
  let css = source.replace(/@font-face\{[^}]*\}/g, "");
  for (const file of new Set(css.match(/(?<=url\()[\w-]+\.svg(?=\))/g))) css = css.replaceAll(`url(${file})`, `url("data:image/svg+xml,${encodeURIComponent(await beerFile(file).text())}")`);
  return { css, release };
};
// The client as one script: a page opened from disk cannot import modules beside it. Bundled from a scratch copy, so
// the binary's embedded sources and a checkout's files take the same path.
const bundle = async (client, color) => {
  const dir = mkdtempSync(join(tmpdir(), "kumiko-playground-"));
  try {
    for (const [file, text] of client) writeFileSync(join(dir, file), text.replaceAll('"../color.mjs"', '"./color.mjs"'));
    writeFileSync(join(dir, "color.mjs"), color);
    const result = await Bun.build({ entrypoints: [join(dir, "playground.js")], target: "browser", format: "esm" });
    if (!result.success) throw new Error(`playground: the client did not bundle\n${result.logs.join("\n")}`);
    // The bundler marks each module with its path from here; the scratch copy's name changes every run.
    return (await result.outputs[0].text()).replace(/^\/\/ \S*kumiko-playground-[^/]+\//gm, "// ");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
// The client's modules; each imports the colour maths from "../color.mjs" in the source and "./color.mjs" beside the page.
const CLIENT = ["playground.js", "edit.js", "examples.js", "foundations.js", "components.js", "cards.js", "pages.js"];
// A source file as text. The engine imports some of them as modules too (color.mjs, and the specimens the
// claude-design output reads), and the bundler cannot embed a module as text beside importing it, so the binary
// carries them as assets (mise.toml: --asset); from source each is the file.
const source = (path) => (Bun.embeddedFiles.find((file) => basename(file.name) === basename(path)) ?? Bun.file(new URL(path, import.meta.url))).text();
// Tailwind's browser build reads @import "tailwindcss" even inside a comment, and then draws nothing.
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const attribute = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// Text inside a <style> or <script> element: only its closing tag could end it early.
const inline = (text) => text.replace(/<\/(style|script)/gi, "<\\/$1");
// The kit's notes as HTML (Bun's CommonMark): the leading level-one heading names the document, and the item's own
// title already does, so it goes.
const notesHtml = (text) => Bun.markdown.html(text.replace(/^\s*# [^\n]*\n/, ""));

// Each token on its own line, so a change to one token is one line of diff.
const lines = (tokens) => `[\n${tokens.map(({ path, value, type, description, derived }) => `      ${JSON.stringify({ path, value, type, description, derived })}`).join(",\n")}\n    ]`;

export default {
  name: "playground",
  async build(ctx) {
    needKit(ctx, "playground");
    const { tokens, media, mediaTokens, options, config, readExisting, built, root, name, version, theme, modes = { base: "base", media: {} } } = ctx;
    const dir = need(options, "playground", "path");
    // A sibling output's file, as its own options name it.
    const sibling = (target) => config.targets.includes(target) ? need(config[target] ?? {}, target, "path") : undefined;
    // A sibling output's text as this run made it.
    const made = (target) => {
      const path = sibling(target);
      if (!path) throw new Error(`playground needs the ${target} output in the config`);
      const text = built(path);
      if (text === undefined) throw new Error(`playground: list the ${target} output before it`);
      return text;
    };
    const [css, beer] = [made("css"), made("beer")];
    const { css: beerStyles, release } = await beerCss();
    const iconFace = (tokens.find((token) => token.path === `${name}.typeface.icon`)?.value ?? "Material Symbols Outlined").split(",")[0].trim().replace(/^["']|["']$/g, "");
    const notes = await readExisting(join(root, "notes.md"));
    const icon = theme?.icon;
    // The project's example entries, each with the path from the page to its folder (an entry's paths are its own).
    if (options.examples !== undefined && (!Array.isArray(options.examples) || options.examples.some((each) => typeof each !== "string"))) throw new Error('playground option "examples" must be a list of paths');
    const entries = await Promise.all((options.examples ?? []).map(async (path) => {
      const text = await readExisting(path);
      if (text === undefined) throw new Error(`playground: no example entry at ${path}`);
      try {
        return { base: `${relative(dir, dirname(path)) || "."}/`, entry: JSON.parse(text) };
      } catch (error) {
        throw new Error(`playground: ${path} is not valid JSON (${error.message})`);
      }
    }));
    // The Tailwind output as this run made it (list it before the playground).
    const tailwindPath = sibling("tailwind");
    const output = tailwindPath && built(tailwindPath);
    if (tailwindPath && output === undefined) throw new Error("playground: list the tailwind output before it");

    // The tokens the css output carries: Material's own component tokens only where that stylesheet writes them.
    const carried = new Set(tokens.filter((token) => !(token.builtin && token.path.startsWith("md.comp.")) || css.includes(`--${token.name}:`)).map((token) => token.path));
    const byMode = [[modes.base, tokens.filter((token) => carried.has(token.path))]];
    for (const [query, files] of Object.entries(media)) byMode.push([modes.media[query] ?? query, (await mediaTokens(files)).filter((token) => carried.has(token.path))]);

    const color = await source("../color.mjs");
    const client = await Promise.all(CLIENT.map(async (file) => [file, await source(`../web/${file}`)]));
    const fields = [
      `"name": ${JSON.stringify(name)}`,
      `"version": ${JSON.stringify(version)}`,
      `"title": ${JSON.stringify(ctx.title ?? name)}`,
      `"modes": {\n${byMode.map(([mode, each]) => `    ${JSON.stringify(mode)}: ${lines(each)}`).join(",\n")}\n  }`,
      ...(theme?.colours ? [`"editor": ${JSON.stringify({
        palette: Object.fromEntries(Object.entries(theme.colours).map(([mode, colours]) => [mode, Object.fromEntries(Object.entries(colours).map(([key, colour]) => [key, colour.hex]))])),
        roles: Object.fromEntries(Object.entries(theme.roles).map(([role, modes]) => [role, Object.fromEntries(Object.entries(modes).map(([mode, choice]) => [mode, choice.from === mode ? choice.name : `${choice.from}.${choice.name}`]))])),
        faces: theme.faces,
        variableNames: Object.fromEntries(tokens.map((token) => [token.path, token.name])),
        faceUses: Object.fromEntries(["brand", "plain", "mono", "icon"].map((face) => {
          const path = { brand: "md.ref.typeface.brand", plain: "md.ref.typeface.plain", mono: `${name}.typeface.mono`, icon: `${name}.typeface.icon` }[face];
          return [face, tokens.filter((token) => token.alias === path).map((token) => token.path)];
        })),
        tokens: Object.fromEntries(theme.values.filter(([, token]) => typeof token.$value === "number" || typeof token.$value === "string" && !/^\{[^{}]+\}$/.test(token.$value) || token.$value?.unit).map(([path, token]) => [path, token.$value?.unit ? `${token.$value.value}${token.$value.unit}` : token.$value])),
        tokenMeta: Object.fromEntries(theme.values.map(([path, token]) => [path, { ...(token.$type ? { type: token.$type } : {}), ...(token.$description ? { why: token.$description } : {}) }])),
      })}`] : []),
      ...(icon === undefined ? [] : [`"icon": ${JSON.stringify(icon)}`]),
      ...(output === undefined ? [] : [`"tailwind": "tailwind.html"`]),
      ...(notes === undefined ? [] : [`"notes": ${JSON.stringify(notesHtml(notes))}`]),
      ...(entries.length ? [`"examples": ${JSON.stringify(entries)}`] : []),
    ];
    const data = `{\n${fields.map((field) => `  ${field}`).join(",\n")}\n}\n`;
    const script = await bundle(client, color);
    const page = [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>Playground</title>",
      `<link rel="stylesheet" href="${attribute(iconLink(iconFace))}">`,
      `<style>@layer beer {\n${inline(beerStyles)}\n}</style>`,
      `<style>\n${inline(css)}</style>`,
      `<style>\n${inline(beer)}</style>`,
      "</head>",
      "<body>",
      '<div id="app"></div>',
      `<script type="module" src="https://cdn.jsdelivr.net/npm/beercss@${release}/dist/cdn/beer.min.js"></script>`,
      `<script type="application/json" id="kit">\n${inline(data)}</script>`,
      `<script type="module">\n${inline(script)}</script>`,
      "</body>",
      "</html>",
      "",
    ].join("\n");
    return [
      { path: join(dir, "index.html"), content: page },
      ...(output === undefined ? [] : [{ path: join(dir, "tailwind.html"), content: tailwind.replace("{{css}}", () => inline(css)).replace("{{tailwind}}", () => withoutComments(output)) }]),
    ];
  },
};
