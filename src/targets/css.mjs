// CSS custom properties named from token paths, with optional media overrides,
// an @layer wrapper, and a raw prelude before it.
export default {
  name: "css",
  async build({ tokens, media, mediaTokens, options }) {
    const { path = "src/styles/tokens.css", layer = "", prelude = "" } = options;
    const lines = [];
    const base = new Map();
    const baseLetterSpacing = new Map();
    for (const token of tokens) {
      lines.push(`  --${token.name}: ${token.value};`);
      base.set(token.path, String(token.value));
      if (token.typography?.letterSpacing !== undefined) {
        lines.push(`  --${token.name}-letter-spacing: ${token.typography.letterSpacing};`);
        baseLetterSpacing.set(token.path, token.typography.letterSpacing);
      }
    }
    const blocks = [`:root {\n${lines.join("\n")}\n}`];
    for (const [query, files] of Object.entries(media)) {
      const overrides = [];
      for (const token of await mediaTokens(files)) {
        if (String(token.value) !== base.get(token.path)) overrides.push(`    --${token.name}: ${token.value};`);
        if (token.typography && token.typography.letterSpacing !== baseLetterSpacing.get(token.path)) {
          overrides.push(`    --${token.name}-letter-spacing: ${token.typography.letterSpacing};`);
        }
      }
      if (overrides.length) blocks.push(`@media ${query} {\n  :root {\n${overrides.join("\n")}\n  }\n}`);
    }
    const body = blocks.join("\n\n");
    const wrapped = layer ? `@layer ${layer} {\n${body.split("\n").map((line) => line ? `  ${line}` : "").join("\n")}\n}` : body;
    return [{ path, content: `${prelude}${prelude && !prelude.endsWith("\n") ? "\n" : ""}${wrapped}\n` }];
  },
};
