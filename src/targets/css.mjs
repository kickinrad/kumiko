// CSS custom properties named from token paths, with optional media overrides,
// an @layer wrapper, and a raw prelude before it.
// A component's type role (Material names it as a string on an md.comp *-font token, such as "label-large")
// becomes the five typescale variables it stands for.
// With the Material springs in the tokens, each also gets its linear() easing and settle time.
// With `scheme` ("dark" or "light", the base mode), each colour that differs by mode is one light-dark() declaration
// on :root, which follows color-scheme where the variable is used; data-theme pins a mode on the root or any element
// by setting only color-scheme. A non-colour token that differs by mode keeps a media block and a data-theme pin.
import { springVars } from "../motion.mjs";
import { typeRole } from "../system.mjs";

const declare = (indent, declarations) => declarations.map((line) => `${indent}${line}`).join("\n");

export default {
  name: "css",
  async build({ tokens, media, mediaTokens, options }) {
    const { path = "src/styles/tokens.css", layer = "", prelude = "", scheme } = options;
    const other = scheme === "dark" ? "light" : "dark";
    const modeQuery = scheme && Object.keys(media).find((query) => query.includes("prefers-color-scheme"));
    const modeTokens = modeQuery ? await mediaTokens(media[modeQuery]) : [];
    const otherColour = new Map(modeTokens.filter((token) => token.type === "color").map((token) => [token.path, String(token.value)]));
    // light-dark() takes the light value first.
    const valueOf = (token) => {
      const [own, theirs] = [String(token.value), otherColour.get(token.path)];
      if (theirs === undefined || theirs === own) return own;
      return scheme === "dark" ? `light-dark(${theirs}, ${own})` : `light-dark(${own}, ${theirs})`;
    };
    const declarations = [];
    const base = new Map();
    const baseLetterSpacing = new Map();
    const paths = new Set(tokens.map((token) => token.path));
    for (const token of tokens) {
      const role = typeRole(token, paths);
      if (role) for (const [name, value] of role) declarations.push(`--${name}: ${value};`);
      else declarations.push(`--${token.name}: ${valueOf(token)};`);
      base.set(token.path, String(token.value));
      if (token.typography?.letterSpacing !== undefined) {
        declarations.push(`--${token.name}-letter-spacing: ${token.typography.letterSpacing};`);
        baseLetterSpacing.set(token.path, token.typography.letterSpacing);
      }
    }
    for (const [name, value] of springVars(tokens)) declarations.push(`--${name}: ${value};`);
    const blocks = [`:root {\n${declare("  ", [...(scheme ? [`color-scheme: ${scheme} ${other};`] : []), ...declarations])}\n}`];
    for (const [query, files] of Object.entries(media)) {
      const overrides = [];
      const bases = [];
      for (const token of query === modeQuery ? modeTokens : await mediaTokens(files)) {
        if (String(token.value) !== base.get(token.path) && !(query === modeQuery && token.type === "color")) {
          overrides.push(`--${token.name}: ${token.value};`);
          bases.push(`--${token.name}: ${base.get(token.path)};`);
        }
        if (token.typography && token.typography.letterSpacing !== baseLetterSpacing.get(token.path)) {
          overrides.push(`--${token.name}-letter-spacing: ${token.typography.letterSpacing};`);
          bases.push(`--${token.name}-letter-spacing: ${baseLetterSpacing.get(token.path)};`);
        }
      }
      if (query === modeQuery) {
        if (overrides.length) blocks.push(`@media ${query} {\n  :root:not([data-theme="${scheme}"]) {\n${declare("    ", overrides)}\n  }\n}`);
        blocks.push(`[data-theme="${scheme}"] {\n${declare("  ", [`color-scheme: ${scheme};`, ...bases])}\n}`,
          `[data-theme="${other}"] {\n${declare("  ", [`color-scheme: ${other};`, ...overrides])}\n}`);
      } else if (overrides.length) {
        blocks.push(`@media ${query} {\n  :root {\n${declare("    ", overrides)}\n  }\n}`);
      }
    }
    const body = blocks.join("\n\n");
    const wrapped = layer ? `@layer ${layer} {\n${body.split("\n").map((line) => line ? `  ${line}` : "").join("\n")}\n}` : body;
    return [{ path, content: `${prelude}${prelude && !prelude.endsWith("\n") ? "\n" : ""}${wrapped}\n` }];
  },
};
