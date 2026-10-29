// The playground: one page on the kit's generated web outputs, so the kit shows itself on its own theme.
// Writes three files into options.path: index.html (fixed, names no kit), playground.js (the engine's client,
// src/web/playground.js with src/color.mjs joined in place of its import, so it is one module) and tokens.json
// (the kit's name, version, tokens per mode and notes: the only per-kit data the page reads).
// Options: path (a directory), css and beer (the kit's css and beer outputs, as the config gives them).
import { join, relative, resolve } from "node:path";
import clientSource from "../web/playground.js" with { type: "text" };
import { need, needKit } from "../system.mjs";

const BEER = "https://cdn.jsdelivr.net/npm/beercss/dist/cdn";
const COLOR_IMPORT = /^import \{[^}]*\} from "\.\.\/color\.mjs";\n/m;
const attribute = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Each token on its own line, so a change to one token is one line of diff.
const lines = (tokens) => `[\n${tokens.map(({ path, value, type, description }) => `      ${JSON.stringify({ path, value, type, description })}`).join(",\n")}\n    ]`;

export default {
  name: "playground",
  async build(ctx) {
    needKit(ctx, "playground");
    const { tokens, media, mediaTokens, options, readExisting, root, name, version, modes = { base: "base", media: {} } } = ctx;
    const dir = need(options, "playground", "path");
    const href = (option) => relative(resolve(dir), resolve(need(options, "playground", option)));
    const css = href("css");
    const beer = href("beer");
    const notes = await readExisting(join(root, "notes.md"));

    const byMode = [[modes.base, tokens]];
    for (const [query, files] of Object.entries(media)) byMode.push([modes.media[query] ?? query, await mediaTokens(files)]);

    // color.mjs is a module of the engine too, and the bundler cannot embed a module as text beside importing it,
    // so the binary carries it as an asset (mise.toml: --asset src/color.mjs); from source it is the file.
    const colorSource = await (Bun.embeddedFiles.find((file) => file.name === "color.mjs") ?? Bun.file(new URL("../color.mjs", import.meta.url))).text();
    const script = clientSource.replace(COLOR_IMPORT, () => colorSource);
    if (script === clientSource) throw new Error("playground: the client no longer imports color.mjs where the target joins it");
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
      ...(notes === undefined ? [] : [`"notes": ${JSON.stringify(notes)}`]),
    ];
    const data = `{\n${fields.map((field) => `  ${field}`).join(",\n")}\n}\n`;
    return [
      { path: join(dir, "index.html"), content: page },
      { path: join(dir, "playground.js"), content: script },
      { path: join(dir, "tokens.json"), content: data },
    ];
  },
};
