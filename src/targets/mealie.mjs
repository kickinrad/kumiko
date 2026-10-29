// Mealie output: the theme files for Mealie (v3.x), from the kit's palette (<name>.palette.*, per mode).
// The base mode is Mealie's dark theme, the first media mode its light one.
//
// Mealie exposes seven colour slots per mode as THEME_LIGHT_* / THEME_DARK_* environment variables
// (mealie/core/settings/themes.py) and serves them to the frontend from /api/app/about/theme. Backgrounds
// are not configurable there. Every slot is a Vuetify theme colour that Mealie uses as a solid fill (app bar,
// buttons, chips, alerts). Vuetify picks the text colour on each fill itself: white or black by APCA
// (vuetify/src/util/colorUtils.ts hasLightForeground). The env file reproduces that choice and records the
// WCAG ratio so the mapping can be checked without a browser.
//
// The CSS overlay is the second tier: served through a reverse proxy that injects it into Mealie's index.html,
// it overrides Vuetify's theme variables, so it can set the backgrounds, the text on each fill and the app bar,
// which the env file cannot. The env file stays the fallback for clients that bypass the proxy.
//
// Options: out (path prefix: <out>.env and <out>.css), title, modes (the two mode names, base first),
// and palette: the kit's palette colours Mealie's slots take.
//   palette.slots    { primary, accent, secondary, success, info, warning, error }: the env file's fills
//   palette.overlay  the same seven keys: the overlay's fills
//   palette.layers   five colours, darkest first: background, surface, base, raised, border
//   palette.text, palette.muted   the text colour and the quieter one (on surface-variant)
//   palette.stars    the rating stars' colour
import { basename } from 'node:path';
import { contrast, linear } from '../color.mjs';
import { need, needKit } from '../system.mjs';

const SLOT_KEYS = ['primary', 'accent', 'secondary', 'success', 'info', 'warning', 'error'];
// What Mealie uses each slot for, as the comments say; the overlay's primary and secondary differ.
const ENV_USE = {
  primary: 'app bar, filled buttons, active nav, brand',
  accent: 'secondary action buttons, chips, sidebar badge',
  secondary: 'meal-plan note button',
  success: 'success alerts and chips',
  info: 'info alerts and chips',
  warning: 'warning alerts and chips',
  error: 'error alerts, destructive actions',
};
const OVERLAY_USE = { ...ENV_USE, primary: 'app bar brand, filled buttons, active nav', secondary: 'meal-plan note, scale and unit buttons' };

const channels = (hex) => hex.match(/[0-9a-f]{2}/gi).map((c) => Number.parseInt(c, 16) / 255);
// APCA as shipped in Vuetify 4.1.2 (packages/vuetify/src/util/color/APCA.ts), which Mealie v3.29
// uses. The constants differ from the current SAPC 0.98G release, so they are copied,
// not derived: a mid cyan takes black text here and white under 0.98G.
const apcaY = (hex) => {
  const [r, g, b] = channels(hex).map((v) => v ** 2.4);
  return 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
};
const apca = (text, bg) => {
  const blkThrs = 0.03;
  const blkClmp = 1.45;
  const loConThresh = 0.078;
  const loConFactor = 12.82051282051282;
  const loConOffset = 0.06;
  const loClip = 0.001;
  const clamp = (y) => (y <= blkThrs ? y + (blkThrs - y) ** blkClmp : y);
  const yt = clamp(apcaY(text));
  const yb = clamp(apcaY(bg));
  if (Math.abs(yb - yt) < 0.0005) return 0;
  if (yb > yt) {
    const sapc = (yb ** 0.55 - yt ** 0.58) * 1.25;
    return (sapc < loClip ? 0 : sapc < loConThresh ? sapc - sapc * loConFactor * loConOffset : sapc - loConOffset) * 100;
  }
  const sapc = (yb ** 0.62 - yt ** 0.57) * 1.25;
  return (sapc > -loClip ? 0 : sapc > -loConThresh ? sapc - sapc * loConFactor * loConOffset : sapc + loConOffset) * 100;
};
const vuetifyForeground = (fill) => {
  const white = Math.abs(apca('#ffffff', fill));
  const black = Math.abs(apca('#000000', fill));
  return white > Math.min(black, 50) ? '#ffffff' : '#000000';
};
const level = (ratio) => (ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA-large' : 'Fail');

const triplet = (hex) => channels(hex).map((v) => Math.round(v * 255)).join(',');
const hexOf = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
// sRGB <-> CIELAB, as vuetify/src/util/color/transformSRGB.ts and transformCIELAB.ts.
const toXYZ = (hex) => {
  const [r, g, b] = channels(hex).map(linear);
  return [
    0.4124 * r + 0.3576 * g + 0.1805 * b,
    0.2126 * r + 0.7152 * g + 0.0722 * b,
    0.0193 * r + 0.1192 * g + 0.9505 * b,
  ];
};
const fromXYZ = ([x, y, z]) => {
  const gamma = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  return [
    3.2406 * x - 1.5372 * y - 0.4986 * z,
    -0.9689 * x + 1.8758 * y + 0.0415 * z,
    0.0557 * x - 0.204 * y + 1.057 * z,
  ].map((c) => Math.round(clamp01(gamma(c)) * 255));
};
const delta = 6 / 29;
const labForward = (t) => (t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta ** 2) + 4 / 29);
const labReverse = (t) => (t > delta ? t ** 3 : 3 * delta ** 2 * (t - 4 / 29));
const toLAB = ([x, y, z]) => {
  const fy = labForward(y);
  return [116 * fy - 16, 500 * (labForward(x / 0.95047) - fy), 200 * (fy - labForward(z / 1.08883))];
};
const fromLAB = ([l, a, b]) => {
  const ln = (l + 16) / 116;
  return [labReverse(ln + a / 500) * 0.95047, labReverse(ln), labReverse(ln - b / 200) * 1.08883];
};
const shift = (hex, amount) => {
  const lab = toLAB(toXYZ(hex));
  lab[0] += amount * 10;
  return hexOf(fromXYZ(fromLAB(lab)));
};

// Mealie asks Vuetify for three lighter and three darker variations of every slot and of `background`
// (frontend/app/plugins/theme.ts) and uses them by name: the search dialog toolbar is primary-lighten-1, the
// loader primary-lighten-2, the app-bar search field primary-darken-1, the rating stars secondary-lighten-3,
// and so on. The accent variations reproduce Vuetify's lighten()/darken() (CIELAB L ± 10 per step); the
// background variations step through the layers instead, because depth is layers, not hue.
const VARIATIONS = 3;

const envFile = (c, palette) => {
  const lines = [
    `# ${c.title} for Mealie.`,
    `# Light mode = ${c.modes.light}, dark mode = ${c.modes.dark}. Mealie reads these at startup; recreate the container after changes.`,
    '# Comments give the palette token and the contrast of the text Vuetify places on the fill.',
  ];
  for (const [mode, variant] of [['LIGHT', 'light'], ['DARK', 'dark']]) {
    lines.push('', `# ${mode}: ${c.title} ${c.modes[variant]}`);
    for (const slot of SLOT_KEYS) {
      const token = c.palette.slots[slot];
      const fill = palette[variant][token];
      const fg = vuetifyForeground(fill);
      const ratio = contrast(fg, fill);
      lines.push(`# ${token}; ${ENV_USE[slot]}; ${fg === '#ffffff' ? 'white' : 'black'} text ${ratio.toFixed(2)}:1 ${level(ratio)}`);
      lines.push(`THEME_${mode}_${slot.toUpperCase()}=${fill}`);
    }
  }
  return `${lines.join('\n')}\n`;
};

const cssFile = (c, palette) => {
  const { layers, text, muted, stars } = c.palette;
  const [darkest, bar, base, raised, border] = layers;
  const surfaces = { background: darkest, surface: bar, 'surface-bright': raised, 'surface-light': raised, 'surface-variant': raised };
  const backgroundVariations = { lighten: [bar, base, raised], darken: [darkest, darkest, darkest] };
  const lines = [
    `/* ${c.title} for Mealie: full-look overlay. */`,
    `/* Served by a reverse proxy that injects <link rel="stylesheet" href="/${basename(c.out)}.css"> into the Mealie index.html. */`,
  ];
  for (const variant of ['light', 'dark']) {
    const p = palette[variant];
    // Text on a fill: the mode's text colour, or its darkest or base layer, whichever reads best.
    const onFill = (fill) => [p[text], p[darkest], p[base]].map((hex) => ({ c: hex, ratio: contrast(hex, fill) })).sort((a, b) => b.ratio - a.ratio)[0];
    const nameOf = (hex) => Object.keys(p).find((k) => p[k] === hex);
    const pair = (name, fill, note) => {
      const fg = onFill(fill);
      lines.push(`  --v-theme-${name}: ${triplet(fill)}; /* ${note} */`);
      lines.push(`  --v-theme-on-${name}: ${triplet(fg.c)}; /* ${nameOf(fg.c)} on it ${fg.ratio.toFixed(2)}:1 ${level(fg.ratio)} */`);
    };
    const theme = variant;
    lines.push('', `/* ${theme}: ${c.title} ${c.modes[variant]} */`, `html .v-theme--${theme} {`, `  color-scheme: ${theme};`);
    for (const [role, token] of Object.entries(surfaces)) {
      lines.push(`  --v-theme-${role}: ${triplet(p[token])}; /* ${token} */`);
      const on = role === 'surface-variant' ? muted : text;
      lines.push(`  --v-theme-on-${role}: ${triplet(p[on])}; /* ${on} */`);
    }
    const rows = SLOT_KEYS.map((slot) => ({ slot, token: c.palette.overlay[slot], fill: p[c.palette.overlay[slot]] }));
    for (const r of rows) pair(r.slot, r.fill, `${r.token}; ${OVERLAY_USE[r.slot]}`);
    lines.push('  /* variations, as Vuetify derives them (CIELAB L ± 10 per step) */');
    for (const r of rows) {
      for (let i = 1; i <= VARIATIONS; i += 1) pair(`${r.slot}-lighten-${i}`, shift(r.fill, i), `${r.token} lighten ${i}`);
      for (let i = 1; i <= VARIATIONS; i += 1) {
        if (r.slot === 'primary' && i === 1) {
          // The app-bar search field; it sits on the surface-coloured app bar below, so it takes the next layer.
          pair('primary-darken-1', p[raised], `${raised}; app-bar search field`);
        } else {
          pair(`${r.slot}-darken-${i}`, shift(r.fill, -i), `${r.token} darken ${i}`);
        }
      }
    }
    lines.push('  /* background variations step through the layers */');
    for (const [dir, tokens] of Object.entries(backgroundVariations)) {
      tokens.forEach((token, i) => pair(`background-${dir}-${i + 1}`, p[token], token));
    }
    lines.push(
      `  --v-border-color: ${triplet(p[border])}; /* ${border} */`,
      '  --v-border-opacity: 1;',
      '}',
      `/* App bar: a title bar on ${bar}, not a band of primary. */`,
      `html .v-theme--${theme} .v-app-bar.bg-primary {`,
      `  background-color: ${p[bar]} !important; /* ${bar} */`,
      `  color: ${p[text]} !important; /* ${text} */`,
      '}',
      `/* Rating stars are ${stars}: the card stars (Mealie's .star spans) and the v-rating on the recipe page, both coloured secondary. */`,
      `html .v-theme--${theme} .star.text-secondary,`,
      `html .v-theme--${theme} .v-rating .text-secondary,`,
      `html .v-theme--${theme} .v-rating .text-secondary-lighten-3 {`,
      `  color: ${p[stars]} !important; /* ${stars} */`,
      '}',
      '/* Filled inputs sit one layer above their card. */',
      `html .v-theme--${theme} .v-field--variant-solo-filled .v-field__overlay,`,
      `html .v-theme--${theme} .v-field--variant-filled .v-field__overlay {`,
      `  background: ${p[raised]} !important; /* ${raised} */`,
      '  opacity: 1;',
      '}',
    );
  }
  return `${lines.join('\n')}\n`;
};

export default {
  name: 'mealie',
  async build(ctx) {
    needKit(ctx, 'mealie');
    const { tokens, media, mediaTokens, name, options } = ctx;
    const out = need(options, 'mealie', 'out');
    const [dark, light] = need(options, 'mealie', 'modes');
    const given = need(options, 'mealie', 'palette');
    for (const key of ['slots', 'overlay']) for (const slot of SLOT_KEYS) need(given[key] ?? {}, `mealie palette.${key}`, slot);
    for (const key of ['layers', 'text', 'muted', 'stars']) need(given, 'mealie palette', key);
    if (given.layers.length !== 5) throw new Error('mealie option "palette.layers" needs five colours');
    const head = `${name}.palette.`;
    const colours = (set) => Object.fromEntries(set.filter((t) => t.path.startsWith(head) && t.path.split('.').length === 3)
      .map((t) => [t.path.slice(head.length), t.value]));
    const [, files] = Object.entries(media)[0];
    const palette = { dark: colours(tokens), light: colours(await mediaTokens(files)) };
    for (const [variant, set] of Object.entries(palette)) {
      for (const key of [...Object.values(given.slots), ...Object.values(given.overlay), ...given.layers, given.text, given.muted, given.stars]) {
        if (!set[key]) throw new Error(`mealie: the ${variant} palette has no colour "${key}"`);
      }
    }
    const c = {
      out, title: options.title ?? name, modes: { dark, light }, palette: given,
    };
    return [
      { path: `${out}.env`, content: envFile(c, palette) },
      { path: `${out}.css`, content: cssFile(c, palette) },
    ];
  },
};
