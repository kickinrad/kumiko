// Tailwind v4 output: one @theme inline block mapping Tailwind's namespaces onto the kit's runtime CSS
// variables (the `css` output's file), so a utility reads the kit's variable where it is used and follows
// every mode like everything else. Every value is one variable; the lists come from the tokens, so the file
// grows with the kit. Breakpoints and shadows stay Tailwind's: a breakpoint must be a literal width, and a
// kit has no one variable per shadow.
// Options: path (the file), css (the kit's runtime CSS file, named in the header), title.
import { byPath } from '../color.mjs';
import { colorRoles, need, needKit } from '../system.mjs';

const v = (path) => `var(--${path.replaceAll('.', '-')})`;
// Tailwind's text sub-keys and the type scale part each reads.
const TEXT = { '': 'size', '--line-height': 'line-height', '--letter-spacing': 'tracking', '--font-weight': 'weight' };

export default {
  name: 'tailwind',
  async build(ctx) {
    needKit(ctx, 'tailwind');
    const { tokens, name, version, options } = ctx;
    const path = need(options, 'tailwind', 'path');
    const css = need(options, 'tailwind', 'css');
    const { title = name } = options;
    const paths = [...byPath(tokens).keys()];
    const under = (prefix) => paths.filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
    const colors = colorRoles(tokens, name).map(({ role, varName }) => [`color-${role}`, `var(--${varName})`]);
    const roles = [...new Set(under('md.sys.typescale.').map((p) => p.split('.')[0]))].sort();
    const corners = under('md.sys.shape.corner.').filter((c) => !c.includes('.') && !/-(top|start|end|bottom)$/.test(c)).sort();
    const easings = under('md.sys.motion.easing.').filter((e) => !e.includes('.')).sort();
    const lines = [
      ...colors,
      ['font-sans', v('md.ref.typeface.plain')], ['font-brand', v('md.ref.typeface.brand')],
      ['font-mono', v(`${name}.typeface.mono`)], ['font-icon', v(`${name}.typeface.icon`)],
      ...roles.flatMap((r) => Object.entries(TEXT).map(([sub, part]) => [`text-${r}${sub}`, v(`md.sys.typescale.${r}.${part}`)])),
      ...corners.map((c) => [`radius-${c}`, v(`md.sys.shape.corner.${c}`)]),
      ...easings.map((e) => [`ease-${e}`, v(`md.sys.motion.easing.${e}`)]),
      ['default-transition-duration', v('md.sys.motion.duration.short3')],
      ['default-transition-timing-function', v('md.sys.motion.easing.standard')],
    ];
    const content = [
      `/* ${title} for Tailwind v4 · kit ${version}..`,
      ` * Load after @import "tailwindcss" and the kit's ${css}; the mode is the kit's (data-theme). */`,
      '@theme inline {',
      ...lines.map(([n, value]) => `  --${n}: ${value};`),
      '}',
      '',
    ].join('\n');
    return [{ path, content }];
  },
};
