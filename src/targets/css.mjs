// CSS custom properties named from token paths, with optional media overrides,
// an @layer wrapper, and a raw prelude before it.
// A component's type role (Material names it as a string on an md.comp *-font token, such as "label-large")
// becomes the five typescale variables it stands for.
// With the Material springs in the tokens, each also gets its linear() easing and settle time.
// With `scheme` ("dark" or "light", the base mode), the colour-scheme media override also applies wherever
// data-theme pins a mode, on the root or any element.
import { springVars } from "../motion.mjs";

const TYPE_PARTS = ["font", "size", "line-height", "weight", "tracking"];
const declare = (indent, declarations) => declarations.map((line) => `${indent}${line}`).join("\n");

export default {
  name: "css",
  async build({ tokens, media, mediaTokens, options }) {
    const { path = "src/styles/tokens.css", layer = "", prelude = "", scheme } = options;
    const other = scheme === "dark" ? "light" : "dark";
    const declarations = [];
    const base = new Map();
    const baseLetterSpacing = new Map();
    const paths = new Set(tokens.map((token) => token.path));
    for (const token of tokens) {
      if (token.type === "string" && token.path.startsWith("md.comp.") && token.path.endsWith("-font") && paths.has(`md.sys.typescale.${token.value}.font`)) {
        for (const part of TYPE_PARTS) declarations.push(`--${token.name.replace(/-font$/, `-${part}`)}: var(--md-sys-typescale-${token.value}-${part});`);
      } else declarations.push(`--${token.name}: ${token.value};`);
      base.set(token.path, String(token.value));
      if (token.typography?.letterSpacing !== undefined) {
        declarations.push(`--${token.name}-letter-spacing: ${token.typography.letterSpacing};`);
        baseLetterSpacing.set(token.path, token.typography.letterSpacing);
      }
    }
    for (const [name, value] of springVars(tokens)) declarations.push(`--${name}: ${value};`);
    const blocks = scheme
      ? [`:root, [data-theme] {\n${declare("  ", [`color-scheme: ${scheme};`, ...declarations])}\n}`]
      : [`:root {\n${declare("  ", declarations)}\n}`];
    for (const [query, files] of Object.entries(media)) {
      const overrides = [];
      for (const token of await mediaTokens(files)) {
        if (String(token.value) !== base.get(token.path)) overrides.push(`--${token.name}: ${token.value};`);
        if (token.typography && token.typography.letterSpacing !== baseLetterSpacing.get(token.path)) {
          overrides.push(`--${token.name}-letter-spacing: ${token.typography.letterSpacing};`);
        }
      }
      if (scheme && query.includes("prefers-color-scheme")) {
        const mode = [`color-scheme: ${other};`, ...overrides];
        blocks.push(`@media ${query} {\n  :root:not([data-theme="${scheme}"]) {\n${declare("    ", mode)}\n  }\n}`,
          `[data-theme="${other}"] {\n${declare("  ", mode)}\n}`);
      } else if (overrides.length) {
        blocks.push(`@media ${query} {\n  :root {\n${declare("    ", overrides)}\n  }\n}`);
      }
    }
    const body = blocks.join("\n\n");
    const wrapped = layer ? `@layer ${layer} {\n${body.split("\n").map((line) => line ? `  ${line}` : "").join("\n")}\n}` : body;
    return [{ path, content: `${prelude}${prelude && !prelude.endsWith("\n") ? "\n" : ""}${wrapped}\n` }];
  },
};
