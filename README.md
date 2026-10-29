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
  kit: { name: "acme", root: "design" }, // optional; targets also get ctx.root (absolute), ctx.version (from ./VERSION), ctx.name
  css: { path: "src/styles/tokens.css", layer: "base", prelude: "" },
};
```

`kit` is optional. When set, `name` is required, `root` is the kit folder relative to the config and defaults to `design`, and `VERSION` in the working directory must hold a semantic version. Every target's `ctx` then also carries `root`, `version` and `name`; without `kit` it carries none of them.
