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

## A kit's `theme.toml`

With a `kit`, a hand-written `<kit root>/theme.toml` holds the kit's palette per mode (plain `#rrggbb` hex), which palette colour fills each Material colour role, and its faces:

```toml
name = "acme"                          # must equal kit.name in the config
default = "night"                      # the base mode
[media]
day = "(prefers-color-scheme: light)"  # every other mode and its media query
[palette.night]
ink = "#101418"
blue = "#7aa2f7"
[palette.day]
ink = "#f6f6f6"
blue = "#2e7de9"
[roles]
"md.sys.color.surface" = "ink"         # a token path to a palette colour, resolved per mode
"md.sys.color.primary" = "blue"
[faces]                                # brand, plain, mono, icon
brand = "Some Sans"
mono = "Some Mono"
```

`tokens` turns it into DTCG 2025.10 files (colours as `{ colorSpace, components, hex }` objects) beside the kit's other tokens: `<root>/tokens/theme.tokens.json` for the default mode (the palette under `<name>.palette.<colour>`, the faces under `<name>.font.<face>`, every role at its path) and `<root>/tokens/theme.<mode>.tokens.json` for each other mode (every role, in that mode's colour). They are build outputs, never hand-edited: `tokens --check` byte-compares and schema-checks them. The default file is an include layer above `include` and below the project's `tokens/`; each mode file joins the `media` set for its query. A role naming a colour a mode's palette lacks fails the build, naming the role, the colour and the mode. A kit with no `theme.toml` builds as before.
