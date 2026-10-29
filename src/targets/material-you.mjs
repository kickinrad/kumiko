// Material You output: the static theme file Nerwyn's Material You Theme for Home Assistant reads
// (github.com/Nerwyn/material-you-theme, "Build Your Own Theme"). The first block holds every md.sys.color role
// twice, `-light` from the first media mode and `-dark` from the base mode, as `rgb(r g b)`. The second, on html,
// holds the kit's own tokens and Material's typefaces, shape, type scale, motion and state, for cards that read
// them; HA sets a theme's variables inline on html, so where the theme names one too, its value wins.
// A colour that differs between the modes is picked by HA's mode (byMode), not light-dark(): HA leaves
// color-scheme to the OS, so light-dark() follows the OS, not HA.
// Options: path (the file to write), title.
import { byPath, rgb } from '../color.mjs';
import { need, needKit } from '../system.mjs';

const SELECTOR = ':host, html, body, ha-card';
const ROLE = 'md.sys.color.';
const MATERIAL = ['md.ref.typeface.', 'md.sys.shape.', 'md.sys.typescale.', 'md.sys.motion.', 'md.sys.state.'];
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
  async build({ tokens, media, mediaTokens, options, name, version }) {
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
    const value = ({ path: p, value: v }) => {
      const l = light.get(p)?.value ?? v;
      return l !== v && HEX.test(l) && HEX.test(v) ? byMode(l, v, dark.get(`${ROLE}surface`).value) : v;
    };
    const content = [
      '/*',
      `${options.title ?? name} for Material You Theme · version ${version}`,
      'The static theme file Material You Theme reads (github.com/Nerwyn/material-you-theme, "Build Your Own Theme"):',
      'every Material 3 colour role, light (-light) and dark (-dark), then the kit\'s own values.',
      '*/',
      '',
      `${SELECTOR} {`,
      ...roles.flatMap((p) => [role(p, 'light', light.get(p).value), role(p, 'dark', dark.get(p).value)]),
      '}',
      '',
      'html {',
      ...shared.map((t) => `  --${t.path.replaceAll('.', '-')}: ${value(t)};`),
      '}',
      '',
    ].join('\n');
    return [{ path, content }];
  },
};
