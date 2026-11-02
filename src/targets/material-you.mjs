// Material You output: the static theme file Nerwyn's Material You Theme for Home Assistant reads
// (github.com/Nerwyn/material-you-theme, "Build Your Own Theme"). The first block holds every md.sys.color role
// twice, `-light` from the first media mode and `-dark` from the base mode, as `rgb(r g b)`. The second, on html,
// holds the kit's own tokens and Material's typefaces, shape, elevation, type scale, motion (with each spring's
// linear() easing and settle time), state and components, for cards that read them; HA sets a theme's variables
// inline on html, so where the theme names one too, its value wins. A value that aliases one of these, or a colour
// role, is that variable, so it follows HA's mode and stays one line.
// A colour that differs between the modes is picked by HA's mode (byMode), not light-dark(): HA leaves
// color-scheme to the OS, so light-dark() follows the OS, not HA.
// Options: path (the file to write).
import { byPath, rgb } from '../color.mjs';
import { springVars } from '../motion.mjs';
import { need, needKit, typeRole } from '../system.mjs';

const SELECTOR = ':host, html, body, ha-card';
const ROLE = 'md.sys.color.';
const MATERIAL = ['md.ref.typeface.', 'md.sys.shape.', 'md.sys.elevation.', 'md.sys.typescale.', 'md.sys.motion.', 'md.sys.state.', 'md.comp.'];
const HEX = /^#[0-9a-f]{6}$/i;

// A colour by HA's mode: the theme's surface is light in a light mode and dark in a dark one (its red channel
// either side of the middle), so each channel steps from the dark value to the light one on it.
const byMode = (lightHex, darkHex, darkSurface) => {
  const [l, d] = [rgb(lightHex), rgb(darkHex)];
  const step = (i) => `calc(${d[i]} + ${l[i] - d[i]} * clamp(0, (r - 127.5) * 255, 1))`;
  return `rgb(from var(--md-sys-color-surface, ${darkSurface}) ${[0, 1, 2].map(step).join(' ')})`;
};

export default {
  name: 'material-you',
  async build({ tokens, media, mediaTokens, options, name, version, title }) {
    needKit({ name, version }, 'material-you');
    const path = need(options, 'material-you', 'path');
    const [, files] = Object.entries(media)[0] ?? [];
    if (!files) throw new Error('material-you needs a light mode: one media query in the config');
    const dark = byPath(tokens);
    const light = byPath(await mediaTokens(files));
    const roles = [...dark.keys()].filter((p) => p.startsWith(ROLE));
    const role = (p, mode, value) => `  --${p.replaceAll('.', '-')}-${mode}: rgb(${rgb(value).join(' ')});`;
    const kit = `${name}.`;
    const shared = [...dark.values()].filter(({ path: p }) => (p.startsWith(kit) && !p.startsWith(`${kit}palette.`)) || MATERIAL.some((m) => p.startsWith(m)));
    const emitted = new Set([...roles, ...shared.map((t) => t.path)]);
    const paths = new Set(dark.keys());
    // An alias stays a variable only when the light mode aliases the same token; otherwise its values are picked by mode.
    const value = ({ path: p, value: v, alias }) => {
      if (alias && emitted.has(alias) && light.get(p)?.alias === alias) return `var(--${alias.replaceAll('.', '-')})`;
      const l = light.get(p)?.value ?? v;
      return l !== v && HEX.test(l) && HEX.test(v) ? byMode(l, v, dark.get(`${ROLE}surface`).value) : v;
    };
    const content = [
      '/*',
      `${title} for Material You Theme`,
      'The static theme file Material You Theme reads (github.com/Nerwyn/material-you-theme, "Build Your Own Theme"):',
      'every Material 3 colour role, light (-light) and dark (-dark), then the kit\'s own values.',
      '*/',
      '',
      `${SELECTOR} {`,
      ...roles.flatMap((p) => [role(p, 'light', light.get(p).value), role(p, 'dark', dark.get(p).value)]),
      '}',
      '',
      'html {',
      ...shared.flatMap((t) => typeRole(t, paths)?.map(([n, v]) => `  --${n}: ${v};`) ?? [`  --${t.path.replaceAll('.', '-')}: ${value(t)};`]),
      ...springVars(tokens).map(([n, v]) => `  --${n}: ${v};`),
      '}',
      '',
    ].join('\n');
    return [{ path, content }];
  },
};
