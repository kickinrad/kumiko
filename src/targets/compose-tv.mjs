// Compose for TV output: Material Theme Builder's layout (Color.kt, Type.kt, Shape.kt, Tokens.kt) plus
// Motion.kt for androidx.tv.material3; the theme itself (Theme.kt) is hand-written by the app. Only what
// differs from tv-material or is the kit's own is here: its Shapes, card and focus defaults already equal the
// spec. TV's ColorScheme has no surface tiers and uses border roles, so every role is exported as a plain
// value and outline maps to border. The base mode comes first, the first media mode second.
// Reads the kit's <name>.layout.card-gap and .card-inset, <name>.tv.safe-margin, and any <name>.domain.* colours.
// Options: out (directory), package, title.
import { byPath, contrast } from '../color.mjs';
import { STYLES, typeScale } from '../type.mjs';
import { colorRoles, corners, need, needKit } from '../system.mjs';

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const pascal = (s) => { const c = camel(s); return c[0].toUpperCase() + c.slice(1); };
const kt = (hex) => `Color(0xFF${hex.slice(1).toUpperCase()})`;
// TV calls the outline roles border; the Kotlin vals follow the scheme's names.
const vname = (r) => camel({ outline: 'border', 'outline-variant': 'border-variant' }[r] ?? r);

// Every colour role of one mode, Material's and the kit's, as the tokens resolve it.
const modeColours = (tokens, name) => Object.fromEntries([
  ...colorRoles(tokens, name).map(({ role, value }) => [role, value]),
  // The domains (<name>.domain.<name>.<role>), resolved to that mode's hex: domainLightContainer and friends.
  ...tokens.filter((t) => t.type === 'color' && t.path.startsWith(`${name}.domain.`)).map((t) => [t.path.slice(name.length + 1).replaceAll('.', '-'), t.value]),
]);

// The pair an on-colour sits on, for the ratio comment: on-surface-* on the card layer, on-X on X.
const pairOf = (r) => r === 'on-surface' || r === 'on-surface-variant' || r === 'on-surface-muted' ? 'surface-container-low'
  : r === 'inverse-on-surface' ? 'inverse-surface' : r.endsWith('-fixed-variant') ? r.slice(3, -8) // on-X-fixed-variant sits on X-fixed
  : r.startsWith('on-') ? r.slice(3) : null;
const ratio = (c, r) => { const p = pairOf(r); if (p && !c[p]) throw new Error(`${r}: no ${p} to measure against`); return p ? `  // ${contrast(c[r], c[p]).toFixed(2)}:1 on ${p}` : ''; };

const colorKt = (c, dark, light) => [
  `package ${c.pkg}`, '',
  `// ${c.title} colours for Compose for TV. One value per Material role and mode; the surface tiers, fixed`,
  "// roles and the kit's own colours are here too, for what the TV ColorScheme cannot hold.",
  '// On-colours carry their WCAG ratio against the surface they sit on.',
  '', 'import androidx.compose.ui.graphics.Color', '',
  ...Object.keys(dark).flatMap((r) => [`val ${vname(r)}Dark = ${kt(dark[r])}${ratio(dark, r)}`, `val ${vname(r)}Light = ${kt(light[r])}${ratio(light, r)}`]),
  '',
].join('\n');

const typeKt = (c, tokens) => {
  const scale = typeScale(tokens); const styles = STYLES.map((s) => [s, scale[s]]);
  // A face is the first family of a stack: Kotlin name GoogleSansFlex, font resource google_sans_flex.
  const words = (stack) => stack.split(',')[0].trim().replace(/^["']|["']$/g, '').split(/\s+/);
  const faceName = (stack) => words(stack).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  const faceRes = (stack) => words(stack).join('_').toLowerCase();
  const faces = [...new Map(styles.map(([, v]) => [faceName(v.fontFamily), faceRes(v.fontFamily)])).entries()];
  // The faces are variable fonts; declare every hundred weight from 300 to 700 so an app's own
  // styles (a 700 clock, a 300 date) resolve without their own Font() list.
  const WEIGHTS = [300, 400, 500, 600, 700];
  const fonts = (n, res) => [
    `val ${n} = FontFamily(`,
    ...WEIGHTS.map((w) => `    Font(R.font.${res}, FontWeight.W${w}, variationSettings = FontVariation.Settings(FontVariation.weight(${w}))),`),
    ')'];
  const sp = (px) => `${Number.parseFloat(px)}.sp`;
  const ls = (px) => { const v = Number.parseFloat(px); return v < 0 ? `(${v}).sp` : `${v}.sp`; };
  return [
    `package ${c.pkg}`, '',
    `// ${c.title} type scale for Compose for TV.`,
    `// The faces are variable fonts expected at ${faces.map(([, res]) => `res/font/${res}.ttf`).join(' and ')}.`,
    '', 'import androidx.compose.ui.text.TextStyle', 'import androidx.compose.ui.text.font.Font',
    'import androidx.compose.ui.text.font.FontFamily', 'import androidx.compose.ui.text.font.FontVariation',
    'import androidx.compose.ui.text.font.FontWeight', 'import androidx.compose.ui.unit.sp', 'import androidx.tv.material3.Typography', '',
    ...faces.flatMap(([n, res]) => [...fonts(n, res), '']),
    `val ${c.title.replace(/\s+/g, '')}Typography = Typography(`,
    ...styles.flatMap(([s, v]) => [
      `    ${camel(s)} = TextStyle(`,
      `        fontFamily = ${faceName(v.fontFamily)},`,
      `        fontSize = ${sp(v.fontSize)},`,
      `        lineHeight = ${sp(v.lineHeight)},`,
      `        fontWeight = FontWeight.W${v.fontWeight},`,
      `        letterSpacing = ${ls(v.letterSpacing)},`,
      '    ),']),
    ')', '',
  ].join('\n');
};

const shapeKt = (c, tokens) => [
  `package ${c.pkg}`, '',
  `// ${c.title} corner values for Compose for TV.`,
  "// tv-material's default Shapes already use this scale, so the theme passes none; these dp values",
  '// are for components of our own (full is CircleShape).',
  '', 'import androidx.compose.ui.unit.dp', '',
  ...Object.entries(corners(tokens)).filter(([n]) => n !== 'full').map(([n, px]) => `val Corner${pascal(n)} = ${px}.dp`), '',
].join('\n');

// Layout, the TV safe margin, Material's state layers, the focus ring and motion, so an app's own
// components source them from the theme instead of their own constants. The TV takes the base scale:
// Android TV's density already sizes dp for ten feet.
const tokensKt = (c, tokens, name) => {
  const t = byPath(tokens);
  const get = (path) => { const tok = t.get(path); if (!tok) throw new Error(`Missing token ${path}`); return tok.value; };
  const dp = (path) => `${Number.parseInt(get(path), 10)}.dp`;
  const state = (n) => `${Number(get(`md.sys.state.${n}.state-layer-opacity`))}f`;
  // Material's easing as cubic-bezier(x1, y1, x2, y2) and durations in ms; the names drop M3's step numbers.
  const easing = (n) => `CubicBezierEasing(${get(`md.sys.motion.easing.${n}`).match(/[\d.]+/g).map((x) => `${Number(x)}f`).join(', ')})`;
  const ms = (n) => Number.parseInt(get(`md.sys.motion.duration.${n}`), 10);
  return [
    `package ${c.pkg}`, '',
    `// ${c.title} layout, safe margin, state layers and motion for Compose for TV.`,
    "// CardGap and CardInset are the cards spec; SafeMargin is the kit's TV edge; ChipHeight is the assist chip's and MenuElevation Material's level 3 (a menu's).",
    '// A state layer is the alpha of the content colour over a container. Motion is',
    "// Material's emphasized easing set and the short3, medium2 and long1 durations in ms.",
    '', 'import androidx.compose.animation.core.CubicBezierEasing', 'import androidx.compose.ui.unit.dp', '',
    `val CardGap = ${dp(`${name}.layout.card-gap`)}`,
    `val CardInset = ${dp(`${name}.layout.card-inset`)}`,
    `val SafeMargin = ${dp(`${name}.tv.safe-margin`)}`,
    `val FocusRingWidth = ${dp('md.sys.state.focus-indicator.thickness')}`,
    `val ChipHeight = ${dp('md.comp.assist-chip.container-height')}`,
    `val MenuElevation = ${dp('md.sys.elevation.level3')}`,
    '',
    ...['hover', 'focus', 'pressed', 'dragged'].map((n) => `const val State${pascal(n)} = ${state(n)}`),
    '',
    `val MotionEmphasized = ${easing('emphasized')}`,
    `val MotionEmphasizedDecelerate = ${easing('emphasized-decelerate')}`,
    `val MotionEmphasizedAccelerate = ${easing('emphasized-accelerate')}`,
    `const val DurationShort = ${ms('short3')}`,
    `const val DurationMedium = ${ms('medium2')}`,
    `const val DurationLong = ${ms('long1')}`,
    '',
  ].join('\n');
};

// Motion.kt: every Material duration and easing, and the Expressive and standard springs as SpringSpecs,
// in one object so an app's own animations name the system's values. Tokens.kt keeps three durations.
const motionKt = (c, tokens) => {
  const t = byPath(tokens); const paths = [...t.keys()].sort();
  const num = (v) => `${Number(v)}f`;
  const durations = paths.filter((p) => p.startsWith('md.sys.motion.duration.')).map((p) => `    const val Duration${pascal(p.split('.').at(-1))} = ${Number.parseInt(t.get(p).value, 10)}`);
  const easings = paths.filter((p) => p.startsWith('md.sys.motion.easing.')).map((p) => `    val Easing${pascal(p.split('.').at(-1))} = CubicBezierEasing(${t.get(p).value.match(/[\d.]+/g).map(num).join(', ')})`);
  const springs = paths.filter((p) => /^md\.sys\.motion\.spring\..*\.damping$/.test(p)).map((p) => {
    const base = p.replace(/\.damping$/, ''); const n = base.split('.').slice(4).map(pascal).join('');
    return `    val Spring${n} = spring<Float>(dampingRatio = ${num(t.get(p).value)}, stiffness = ${num(t.get(`${base}.stiffness`).value)})`;
  });
  return [
    `package ${c.pkg}`, '',
    `// ${c.title} motion for Compose for TV, from the vendored`,
    '// Material 3 motion tokens. Durations in ms, easings as CubicBezierEasing, and the',
    '// Expressive and standard springs as SpringSpecs (damping ratio, stiffness) on unit mass.',
    '', 'import androidx.compose.animation.core.CubicBezierEasing', 'import androidx.compose.animation.core.spring', '',
    'object Motion {', ...durations, '', ...easings, '', ...springs, '}', '',
  ].join('\n');
};

export default {
  name: 'compose-tv',
  async build(ctx) {
    needKit(ctx, 'compose-tv');
    const { tokens, media, mediaTokens, name, options } = ctx;
    const out = need(options, 'compose-tv', 'out');
    const title = options.title ?? name;
    const c = {
      pkg: need(options, 'compose-tv', 'package'), title,
    };
    const [, files] = Object.entries(media)[0];
    const light = modeColours(await mediaTokens(files), name);
    const dark = modeColours(tokens, name);
    return [
      { path: `${out}/Color.kt`, content: colorKt(c, dark, light) },
      { path: `${out}/Type.kt`, content: typeKt(c, tokens) },
      { path: `${out}/Shape.kt`, content: shapeKt(c, tokens) },
      { path: `${out}/Tokens.kt`, content: tokensKt(c, tokens, name) },
      { path: `${out}/Motion.kt`, content: motionKt(c, tokens) },
    ];
  },
};
