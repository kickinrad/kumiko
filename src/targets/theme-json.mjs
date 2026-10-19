// WordPress theme.json: rewrites only settings.custom.designTokens, exposed as
// --wp--custom--design-tokens--<path segments>. The rest of the file is the theme's.
export const designTokens = (tokens) => {
  const values = {};
  for (const token of tokens) {
    let node = values;
    for (const part of token.segments.slice(0, -1)) node = node[part] ??= {};
    node[token.segments.at(-1)] = token.value;
    if (token.typography?.letterSpacing !== undefined) {
      node[`${token.segments.at(-1)}LetterSpacing`] = token.typography.letterSpacing;
    }
  }
  return values;
};

export default {
  name: "theme-json",
  async build({ tokens, options, readExisting }) {
    const { path = "theme.json" } = options;
    const current = await readExisting(path);
    const theme = current === undefined ? {} : JSON.parse(current);
    if (!theme || Array.isArray(theme) || typeof theme !== "object") throw new Error(`Invalid ${path}`);
    theme.$schema ??= "https://schemas.wp.org/trunk/theme.json";
    theme.version ??= 3;
    theme.settings ??= {};
    theme.settings.custom ??= {};
    theme.settings.custom.designTokens = designTokens(tokens);
    return [{ path, content: `${JSON.stringify(theme, null, 2)}\n` }];
  },
};
