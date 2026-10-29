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

With a `kit`, a build also writes `<root>/manifest.json`: the sha256 of every generated file by its path from the working directory, plus `"$inputs"`, a hash of the token files read and the engine version. `tokens --check` then fails, naming the path, on a generated file that no longer matches its hash, a leftover (listed, but no target writes it any more) or stale `$inputs`; a plain `tokens` deletes the leftovers the previous manifest listed. Without a `kit`, nothing changes.
