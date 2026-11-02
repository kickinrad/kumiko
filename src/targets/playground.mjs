// The playground: one page on the kit's generated web outputs, so the kit shows itself on its own theme.
// Writes into options.path: index.html (fixed, names no kit), the engine's client (src/web: playground.js and a
// module per destination, with color.mjs, the engine's colour maths, beside them) and tokens.json (the kit's name,
// version, tokens per mode and notes: the only per-kit data the page reads).
// Options: path (a directory). The page links the config's css and beer outputs by their paths; with a tailwind
// output (listed before the playground) it also writes tailwind.html, which proves the output in a frame of its own
// (Tailwind's reset would restyle the page), and tokens.json names it. theme.toml's icon, a Material Symbol name,
// is the kit's mark in the top app bar ("style" otherwise). Optional, by location only: examples (the apps' entry
// files, which the Examples destination fetches) and kits (other kits' playground directories, for the kit menu).
import { join, relative, resolve } from "node:path";
import cards from "../web/cards.js" with { type: "text" };
import components from "../web/components.js" with { type: "text" };
import foundations from "../web/foundations.js" with { type: "text" };
import pages from "../web/pages.js" with { type: "text" };
import playground from "../web/playground.js" with { type: "text" };
import examples from "../web/examples.js" with { type: "text" };
import tailwind from "../web/tailwind.html" with { type: "text" };
import { need, needKit } from "../system.mjs";

const BEER = "https://cdn.jsdelivr.net/npm/beercss/dist/cdn";
// The client's modules; each imports the colour maths from "../color.mjs" in the source and "./color.mjs" beside the page.
const CLIENT = { "playground.js": playground, "examples.js": examples, "foundations.js": foundations, "components.js": components, "cards.js": cards, "pages.js": pages };
// Tailwind's browser build reads @import "tailwindcss" even inside a comment, and then draws nothing.
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const attribute = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

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
    const href = (target) => {
      const path = sibling(target);
      if (!path) throw new Error(`playground needs the ${target} output in the config`);
      return relative(resolve(dir), resolve(path));
    };
    const css = href("css");
    const beer = href("beer");
    const notes = await readExisting(join(root, "notes.md"));
    const icon = theme?.icon;
    // The apps' example entries and the other kits' playgrounds, by location only: the page fetches them, so the
    // build never reads them.
    const located = (key) => {
      if (options[key] !== undefined && (!Array.isArray(options[key]) || options[key].some((each) => typeof each !== "string"))) throw new Error(`playground option "${key}" must be a list of paths`);
      return (options[key] ?? []).map((each) => relative(resolve(dir), resolve(each)));
    };
    const [entries, kits] = [located("examples"), located("kits").map((each) => `${each}/tokens.json`)];
    // The Tailwind output as this run made it (list it before the playground).
    const tailwindPath = sibling("tailwind");
    const output = tailwindPath && built(tailwindPath);
    if (tailwindPath && output === undefined) throw new Error("playground: list the tailwind output before it");

    const byMode = [[modes.base, tokens]];
    for (const [query, files] of Object.entries(media)) byMode.push([modes.media[query] ?? query, await mediaTokens(files)]);

    // color.mjs is a module of the engine too, and the bundler cannot embed a module as text beside importing it,
    // so the binary carries it as an asset (mise.toml: --asset src/color.mjs); from source it is the file.
    const color = await (Bun.embeddedFiles.find((file) => file.name === "color.mjs") ?? Bun.file(new URL("../color.mjs", import.meta.url))).text();
    const page = [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>Playground</title>",
      `<style>@import url("${BEER}/beer.min.css") layer(beer);</style>`,
      `<link rel="stylesheet" href="${attribute(css)}">`,
      `<link rel="stylesheet" href="${attribute(beer)}">`,
      "</head>",
      "<body>",
      '<div id="app"></div>',
      `<script type="module" src="${BEER}/beer.min.js"></script>`,
      '<script type="module" src="playground.js"></script>',
      "</body>",
      "</html>",
      "",
    ].join("\n");
    const fields = [
      `"name": ${JSON.stringify(name)}`,
      `"version": ${JSON.stringify(version)}`,
      `"modes": {\n${byMode.map(([mode, each]) => `    ${JSON.stringify(mode)}: ${lines(each)}`).join(",\n")}\n  }`,
      ...(icon === undefined ? [] : [`"icon": ${JSON.stringify(icon)}`]),
      ...(output === undefined ? [] : [`"tailwind": "tailwind.html"`]),
      ...(notes === undefined ? [] : [`"notes": ${JSON.stringify(notes)}`]),
      ...(entries.length ? [`"examples": ${JSON.stringify(entries)}`] : []),
      ...(kits.length ? [`"kits": ${JSON.stringify(kits)}`] : []),
    ];
    const data = `{\n${fields.map((field) => `  ${field}`).join(",\n")}\n}\n`;
    return [
      { path: join(dir, "index.html"), content: page },
      ...Object.entries(CLIENT).map(([file, source]) => ({ path: join(dir, file), content: source.replaceAll('"../color.mjs"', '"./color.mjs"') })),
      { path: join(dir, "color.mjs"), content: color },
      { path: join(dir, "tokens.json"), content: data },
      ...(output === undefined ? [] : [{ path: join(dir, "tailwind.html"), content: tailwind.replace("{{css}}", () => attribute(css)).replace("{{tailwind}}", () => withoutComments(output)) }]),
    ];
  },
};
