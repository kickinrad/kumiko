# tokens

DTCG design tokens → CSS, WordPress `theme.json`, `DESIGN.md`, and more, as one binary.

```sh
mise use github:kickinrad/tokens
tokens          # build every target in tokens.config.mjs
tokens --check  # fail if a committed output is stale
```

```js
// tokens.config.mjs
export default {
  targets: ["css", "theme-json", "design-md"],
  media: { "(max-width: 850px)": ["tokens/responsive.tokens.json"] },
  include: ["vendor/*.tokens.json"], // optional silent base layer; tokens/ overrides it
  css: { path: "src/styles/tokens.css", layer: "base", prelude: "" },
};
```
