// Beer CSS (github.com/beercss/beercss, MIT) themed by the kit: Beer's variables set from the kit's, so the
// kit's stylesheet decides the mode. Beer's own CSS is bundled as text, so the binary carries it and a
// release that adds or drops a colour role changes the output at the next build. Two values name kit tokens
// and are options; with one absent, Beer keeps its own.
import beerCss from "beercss/dist/cdn/beer.css" with { type: "text" };
import materialCss from "../web/material.css" with { type: "text" };

// Beer's colour roles: the variables of its light block, each a Material colour role of the same name.
const roles = () => {
  const block = beerCss.match(/:root,\s*body\.light\s*\{([^}]*)\}/)?.[1];
  if (!block) throw new Error("Beer's light colour block was not found; its CSS has changed shape");
  return [...block.matchAll(/--([a-z0-9-]+)\s*:/g)].map((match) => match[1]).sort();
};

const variable = (path) => `var(--${path.replaceAll(".", "-")})`;
// Beer's rem is body-large (16px), so its sizes land on Material's dp; its speeds 0.1 to 0.4s are Material's
// short2, short4, medium2 and medium4; --active is its state layer (the pressed opacity over on-surface),
// --overlay Material's scrim, --elevate1..3 elevation levels 1 to 3.
const shadow = (level, opacity) => `0 calc(var(--md-sys-elevation-level${level}) / 2) var(--md-sys-elevation-level${level}) color-mix(in srgb, var(--md-sys-color-shadow) calc(${opacity} * 100%), transparent)`;
const system = ({ iconFont, shadowOpacity }) => ({
  size: "var(--md-sys-typescale-body-large-size)",
  font: "var(--md-ref-typeface-plain)",
  ...(iconFont && { "font-icon": variable(iconFont) }),
  speed1: "var(--md-sys-motion-duration-short2)",
  speed2: "var(--md-sys-motion-duration-short4)",
  speed3: "var(--md-sys-motion-duration-medium2)",
  speed4: "var(--md-sys-motion-duration-medium4)",
  active: "color-mix(in srgb, var(--md-sys-color-on-surface) calc(var(--md-sys-state-pressed-state-layer-opacity) * 100%), transparent)",
  overlay: "color-mix(in srgb, var(--md-comp-scrim-container-color) calc(var(--md-comp-scrim-container-opacity) * 100%), transparent)",
  ...(shadowOpacity && Object.fromEntries([1, 2, 3].map((level) => [`elevate${level}`, shadow(level, variable(shadowOpacity))]))),
});

export default {
  name: "beer",
  async build({ tokens, options }) {
    const { path = "src/styles/beer.css", iconFont, shadowOpacity } = options;
    for (const named of [iconFont, shadowOpacity]) {
      if (named && !tokens.some((token) => token.path === named)) throw new Error(`beer option names ${named}, which is not a token`);
    }
    const content = [
      "/* Beer CSS themed by the kit: Beer's variables from the kit's. Load after Beer and the kit's css output; set",
      " * the mode the kit's way (data-theme), not with Beer's body classes. Load Beer in a cascade layer",
      " * (@import url(beer.min.css) layer(beer)) so the rules below win over its element reset. */",
      ":root, [data-theme], body.light, body.dark {",
      ...roles().map((role) => `  --${role}: var(--md-sys-color-${role});`),
      ...Object.entries(system({ iconFont, shadowOpacity })).map(([name, value]) => `  --${name}: ${value};`),
      "}",
      "",
      "/* Material sets buttons and chips in label-large, which Beer's own do not follow. */",
      ":is(button, .button, .chip) { font-family: var(--md-sys-typescale-label-large-font); font-weight: var(--md-sys-typescale-label-large-weight); letter-spacing: var(--md-sys-typescale-label-large-tracking); }",
      "",
      materialCss,
    ].join("\n");
    return [{ path, content }];
  },
};
