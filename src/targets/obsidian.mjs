// Obsidian output: a CSS snippet per mode for the Minimal theme, from the Material roles. Minimal's contract
// is eight accent slots, an interactive accent as HSL parts, three backgrounds, three UI tints, three text
// tiers, two highlights and the monospace face. The base mode comes first, the first media mode second.
// Reads the kit's own roles on-surface-muted, comment, yellow, orange, cyan and green (under <name>.color).
// Options: out (path prefix: <out>-<mode>.css), modes (the two mode names, base first), title,
// font (the monospace stack; default the kit's mono face).
import { byPath, contrast, hsl, rgb } from '../color.mjs';
import { need, needKit, rolePath } from '../system.mjs';

const SLOTS = { red: 'error', orange: 'orange', yellow: 'yellow', green: 'green', cyan: 'cyan', blue: 'primary', purple: 'tertiary', pink: 'secondary' };
// Minimal's text highlights: an accent at this alpha. A port value, not a Material state layer.
const HIGHLIGHT = 0.24;

const snippet = (tokens, name, { scope, mode, title, version, font, extra }) => {
  const role = (r) => byPath(tokens).get(rolePath(tokens, name, r)).value;
  const [ah, as, al] = hsl(role('primary'));
  const [bh, bs, bl] = hsl(role('surface-container'));
  const alpha = (r, a) => `rgba(${rgb(role(r)).join(', ')}, ${a})`;
  const ratio = (a, b) => `${contrast(role(a), role(b)).toFixed(2)}:1`;
  // Minimal's ui3 is the strong border; in a light mode the palette's overlay may be lighter than surface1.
  const [ui2, ui3] = ['surface-container-highest', 'comment'].sort((a, b) => contrast(role(a), role('surface-container')) - contrast(role(b), role('surface-container')));
  return [
    '/*',
    `${title} — ${mode}`,
    'Designed as a color + typography snippet for the Minimal theme by @kepano.',
    '',
    `Version ${version}`,
    'Requires: Minimal theme (https://github.com/kepano/obsidian-minimal) installed and active.',
    '',
    'Install: drop this file in YOUR_VAULT/.obsidian/snippets/ and enable',
    `         via Settings → Appearance → CSS snippets → ${title} ${mode}.`,
    '*/',
    '',
    `${scope} {`,
    '  /* Accent colors — 8-slot Minimal contract (secondary, teal, takes the pink slot) */',
    ...Object.entries(SLOTS).map(([slot, r]) => `  --color-${slot}-rgb: ${rgb(role(r)).join(', ')};  /* ${r} */`),
    '',
    ...Object.entries(SLOTS).map(([slot, r]) => `  --color-${slot}: ${role(r)};  /* ${r} */`),
    '',
    '  /* Interactive accent — primary */',
    `  --accent-h: ${ah};`, `  --accent-s: ${as}%;`, `  --accent-l: ${al}%;`,
    '',
    '  /* Base/UI/Text tiers — Material surface tiers and text roles */',
    `  --base-h: ${bh};`, `  --base-s: ${bs}%;`, `  --base-l: ${bl}%;`,
    '',
    `  --bg1: ${role('surface-container')};   /* surface-container — main editor bg */`,
    `  --bg2: ${role('surface-container-low')};   /* surface-container-low — panels/sidebar */`,
    `  --bg3: ${alpha('on-surface', 0.05)};`,
    '',
    `  --ui1: ${role('surface-container-high')};   /* surface-container-high — borders, dividers */`,
    `  --ui2: ${role(ui2)};   /* ${ui2} — raised surfaces, hover */`,
    `  --ui3: ${role(ui3)};   /* ${ui3} — strong borders (the stronger of the two against bg1) */`,
    '',
    `  --tx1: ${role('on-surface')};   /* on-surface, ${ratio('on-surface', 'surface-container')} on bg1 */`,
    `  --tx2: ${role('on-surface-variant')};   /* on-surface-variant, ${ratio('on-surface-variant', 'surface-container')} on bg1 */`,
    `  --tx3: ${role('on-surface-muted')};   /* on-surface-muted, ${ratio('on-surface-muted', 'surface-container')} on bg1 */`,
    '',
    `  --hl1: ${alpha('primary', HIGHLIGHT)};  /* primary highlight */`,
    `  --hl2: ${alpha('yellow', HIGHLIGHT)};  /* yellow — secondary highlight */`,
    '',
    '  /* Typography — monospace only; the body face stays Minimal\'s (Spectral), a local exception */',
    `  --font-monospace-theme: ${font};`,
    '}',
    '',
    ...extra,
    '',
  ].join('\n');
};

export default {
  name: 'obsidian',
  async build(ctx) {
    needKit(ctx, 'obsidian');
    const { tokens, media, mediaTokens, name, version, options } = ctx;
    const out = need(options, 'obsidian', 'out');
    const [baseName, otherName] = need(options, 'obsidian', 'modes');
    const { title = name } = options;
    const [, files] = Object.entries(media)[0];
    const other = await mediaTokens(files);
    const font = options.font ?? byPath(tokens).get(`${name}.typeface.mono`).value;
    const common = { title, version, font };
    const surface = (set, r) => byPath(set).get(`md.sys.color.${r}`).value;
    return [
      { path: `${out}-${baseName.toLowerCase()}.css`, content: snippet(tokens, name, { ...common, mode: baseName, scope: 'body.theme-dark',
        extra: ['/* Dark-black subvariant fallback — don\'t fight Minimal\'s ui1 override */', 'body.theme-dark.minimal-dark-black {', `  --ui1: ${surface(tokens, 'surface-container-low')};`, '}'] }) },
      { path: `${out}-${otherName.toLowerCase()}.css`, content: snippet(other, name, { ...common, mode: otherName, scope: 'body.theme-light',
        extra: ['/* Light-tonal subvariant — promote bg2 to bg1 */', 'body.theme-light.minimal-light-tonal {', `  --bg2: ${surface(other, 'surface-container')};`, '}'] }) },
    ];
  },
};
