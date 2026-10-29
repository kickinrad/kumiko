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

A kit may declare `contrast: [{ fg, bg, min }]` (token paths and a minimum ratio: 4.5 for text, 3 for marks). Every pair is resolved in the base tokens and in each `media` set, and a pair under its floor, or a path that is not a colour token, fails the build and `--check`, naming the pair, the mode, the ratio and the floor.
The colour maths (`luminance`, `contrast`, `mix`, `bestOn`, `stateLayer`, `textSafe`, `hsl`, `rgb`) live in `src/color.mjs`.

With a `kit`, `tokens --check` also validates the token sources (`tokens/*.tokens.json`, media files and `include` globs) against the official [DTCG 2025.10 format schema](https://www.designtokens.org/schemas/2025.10/format.json), vendored under `src/schema/2025.10/` (re-fetch with `node scripts/fetch-dtcg-schema.mjs`). Each error names the file and the path, e.g. `tokens/brand.tokens.json: $.color.ink.$value must be object`; a hex-string colour fails because 2025.10 colours are objects.
