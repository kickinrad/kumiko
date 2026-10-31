// The playground: one page on the kit's generated web outputs, so the kit shows itself on its own theme.
// Writes into options.path: index.html (fixed, names no kit), the engine's client (src/web: playground.js and a
// module per destination, with color.mjs, the engine's colour maths, beside them) and tokens.json (the kit's name,
// version, tokens per mode and notes: the only per-kit data the page reads).
// Options: path (a directory), css and beer (the kit's css and beer outputs, as the config gives them), and
// optionally tailwind (the kit's Tailwind output): with it the page also writes tailwind.html, which proves
// the output in a frame of its own (Tailwind's reset would restyle the page) and tokens.json names it.
import { join, relative, resolve } from "node:path";
import cards from "../web/cards.js" with { type: "text" };
import components from "../web/components.js" with { type: "text" };
import foundations from "../web/foundations.js" with { type: "text" };
import pages from "../web/pages.js" with { type: "text" };
import playground from "../web/playground.js" with { type: "text" };
import tailwind from "../web/tailwind.html" with { type: "text" };
import { need, needKit } from "../system.mjs";

const BEER = "https://cdn.jsdelivr.net/npm/beercss/dist/cdn";
// The client's modules; each imports the colour maths from "../color.mjs" in the source and "./color.mjs" beside the page.
const CLIENT = { "playground.js": playground, "foundations.js": foundations, "components.js": components, "cards.js": cards, "pages.js": pages };
// Tailwind's browser build reads @import "tailwindcss" even inside a comment, and then draws nothing.
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const attribute = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Each token on its own line, so a change to one token is one line of diff.
const lines = (tokens) => `[\n${tokens.map(({ path, value, type, description, derived }) => `      ${JSON.stringify({ path, value, type, description, derived })}`).join(",\n")}\n    ]`;

export default {
  name: "playground",
  async build(ctx) {
    needKit(ctx, "playground");
    const { tokens, media, mediaTokens, options, readExisting, built, root, name, version, modes = { base: "base", media: {} } } = ctx;
    const dir = need(options, "playground", "path");
    const href = (option) => relative(resolve(dir), resolve(need(options, "playground", option)));
    const css = href("css");
    const beer = href("beer");
    const notes = await readExisting(join(root, "notes.md"));
    // The Tailwind output as this run made it (list it before the playground), else the file on disk.
    const output = options.tailwind && (built(options.tailwind) ?? (await readExisting(options.tailwind)));
    if (options.tailwind && output === undefined) throw new Error(`playground option "tailwind" names ${options.tailwind}, which no output built and is not a file`);

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
      ...(output === undefined ? [] : [`"tailwind": "tailwind.html"`]),
      ...(notes === undefined ? [] : [`"notes": ${JSON.stringify(notes)}`]),
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
