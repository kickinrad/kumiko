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

With a `kit`, `tokens --check` also validates the token sources (`tokens/*.tokens.json`, media files and `include` globs) against the official [DTCG 2025.10 format schema](https://www.designtokens.org/schemas/2025.10/format.json), vendored under `src/schema/2025.10/` (re-fetch with `node scripts/fetch-dtcg-schema.mjs`). Each error names the file and the path, e.g. `tokens/brand.tokens.json: $.color.ink.$value must be object`; a hex-string colour fails because 2025.10 colours are objects.

## Coverage and consumers

With a `kit`, every output module exports, beside `name` and `build`:

- `coverage: { native, emits: [{ what, why }], skips: [] }`: the platform layer the output feeds, what it writes and why native can't, and what native already covers. The build fails naming any target, built-in or project, that lacks it.
- `consumers: [{ name, file, tag, overrides? }]`: who reads the output. `file` is where the consumer records the kit version it reads (relative to the working directory, absolute, or `~/…`); `tag` is a regex whose first group is that version; `overrides` is the consumer's own override file, loaded after the generated output. The built-in outputs leave `consumers` empty; the kit adds its own in the config:

```js
kit: { name: "acme", consumers: { css: [{ name: "site", file: "site/package.json", tag: "\"acme\": \"(\\d+\\.\\d+\\.\\d+)\"", overrides: "site/overrides.css" }] } },
```

`tokens --check` then prints one line per consumer, the version it reads next to the kit's `VERSION` and marked `(behind)` when older, or `unreadable` when the file or tag is missing, plus `override: <path>` for each override file whether or not it exists. The report is information only and never fails the check. Without a `kit`, none of this runs.
