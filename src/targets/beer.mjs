// Beer CSS (github.com/beercss/beercss, MIT) themed by the kit: Beer's variables set from the kit's, so the
// kit's stylesheet decides the mode. Beer names its colour variables after Material's roles, so every
// md.sys.color role the kit has becomes one; Beer reads the ones it knows. Two values read the kit's own tokens,
// <name>.typeface.icon and <name>.elevation.shadow-opacity; with one absent, Beer keeps its own.
import materialCss from "../web/material.css" with { type: "text" };
import layoutCss from "../web/layout.css" with { type: "text" };

const roles = (tokens) => tokens.filter((token) => token.segments.length === 4 && token.path.startsWith("md.sys.color.")).map((token) => token.segments[3]).sort();

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
  async build({ tokens, options, name }) {
    const { path = "src/styles/beer.css" } = options;
    const own = (rest) => name && tokens.some((token) => token.path === `${name}.${rest}`) ? `${name}.${rest}` : undefined;
    const [iconFont, shadowOpacity] = [own("typeface.icon"), own("elevation.shadow-opacity")];
    const content = [
      "/* Beer CSS themed by the kit: Beer's variables from the kit's. Load after Beer and the kit's css output; set",
      " * the mode the kit's way (data-theme), not with Beer's body classes. Load Beer in a cascade layer",
      " * (@import url(beer.min.css) layer(beer)) so the rules below win over its element reset. */",
      ":root, [data-theme], body.light, body.dark {",
      ...roles(tokens).map((role) => `  --${role}: var(--md-sys-color-${role});`),
      ...Object.entries(system({ iconFont, shadowOpacity })).map(([name, value]) => `  --${name}: ${value};`),
      "}",
      "",
      "/* Material sets buttons and chips in label-large, which Beer's own do not follow. */",
      ":is(button, .button, .chip) { font-family: var(--md-sys-typescale-label-large-font); font-weight: var(--md-sys-typescale-label-large-weight); letter-spacing: var(--md-sys-typescale-label-large-tracking); }",
      "",
      materialCss,
      "",
      layoutCss,
    ].join("\n");
    return [{ path, content }];
  },
};
