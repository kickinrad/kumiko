// Vendors Google's generated androidx Compose Material 3 token files (Apache-2.0) as DTCG 2025.10 under material/,
// the engine's built-in Material baseline (`builtin:material` in a config's include, see src/material.mjs). References
// become aliases by name; a declaration or value form not listed here throws naming file:line.
//   bun scripts/vendor-m3.mjs [--sha <sha>]   write, at the manifest SHA unless given
//   bun scripts/vendor-m3.mjs --check         re-fetch at the manifest SHA, exit 1 naming any differing file
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Where the data lives, whatever the working directory.
const OUT = fileURLToPath(new URL('../material/', import.meta.url));
const REPO = 'androidx/androidx';
const M3_DIR = 'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens';
const TV_DIR = 'tv/tv-material/src/main/java/androidx/tv/material3';
// tv-material keeps its defaults in component code, not token files: [file, anchors in source order, token path].
// The value is what follows the last anchor on its line.
const TV = [
  ['Card.kt', ['object CardDefaults {', 'val ContainerShape ='], 'md.comp.tv-card.container-shape'],
  ['Card.kt', ['object CardDefaults {', 'fun scale(', 'focusedScale: Float ='], 'md.comp.tv-card.focused-scale'],
  ['Card.kt', ['object CardDefaults {', 'fun border(', 'focusedBorder: Border =', 'BorderStroke(width ='], 'md.comp.tv-card.focused-border-width'],
];
// Files that convert to nothing, and why.
const SKIP = {
  ColorSchemeKeyTokens: 'index-only enum: component files name its entries, which resolve to the colour scheme paths',
  ShapeKeyTokens: 'index-only enum: its entries resolve to the ShapeTokens paths',
  TypographyKeyTokens: 'index-only enum: a reference becomes the type role name',
  MotionSchemeKeyTokens: 'index-only enum, referenced by no token file',
  TypographyTokens: 'a class of TextStyles built from TypeScaleTokens, which is vendored',
};
// Files whose object is not named after the file. The path follows the object, Compose's own name for the component.
const OBJECT = { IconButtonTokens: 'StandardIconButtonTokens' };
const SYS = { ColorSchemeKeyTokens: 'md.sys.color', ColorDarkTokens: 'md.sys.color', ColorLightTokens: 'md.sys.color',
  PaletteTokens: 'md.ref.palette', TypefaceTokens: 'md.ref.typeface', ElevationTokens: 'md.sys.elevation' };
// System files whose member names split into a group and a name.
const SPLIT = {
  ShapeTokens: [/^(Corner(?:Value)?)(\w+)$/, (g, n) => `md.sys.shape.${kebab(g)}.${kebab(n)}`],
  TypeScaleTokens: [/^(\w+?)(Font|LineHeight|Size|Tracking|Weight)$/, (r, p) => `md.sys.typescale.${kebab(r)}.${kebab(p)}`],
  MotionTokens: [/^(Duration|Easing)(\w+?)(?:CubicBezier)?$/, (g, n) => `md.sys.motion.${kebab(g)}.${kebab(n)}`],
  StateTokens: [/^(\w+?)(StateLayerOpacity)$/, (s, p) => `md.sys.state.${kebab(s)}.${kebab(p)}`],
};
// Springs per motion scheme: SpringFastSpatialDamping → md.sys.motion.spring.<scheme>.fast.spatial.damping.
for (const scheme of ['Expressive', 'Standard']) SPLIT[`${scheme}MotionTokens`] = [/^Spring(\w+?)(Spatial|Effects)(Damping|Stiffness)$/,
  (...p) => `md.sys.motion.spring.${kebab(scheme)}.${p.map(kebab).join('.')}`];
SPLIT.ShapeKeyTokens = SPLIT.ShapeTokens;

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])|([A-Z])([A-Z][a-z])/g, (_, a, b, c, d) => `${a ?? c}-${b ?? d}`).toLowerCase();
const path = (obj, member, at) => {
  if (SYS[obj]) return `${SYS[obj]}.${kebab(member)}`;
  if (!SPLIT[obj]) return `md.comp.${kebab(obj.replace(/Tokens$/, ''))}.${kebab(member)}`;
  const [re, to] = SPLIT[obj]; const m = member.match(re);
  if (!m) throw new Error(`${at}: no path rule for ${obj}.${member}`);
  return to(...m.slice(1));
};

const N = String.raw`(-?\d+(?:\.\d+)?)f?`;
const px = (value) => ({ $type: 'dimension', $value: { value, unit: 'px' } });
const WEIGHT = { Thin: 100, ExtraLight: 200, Light: 300, Normal: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900 };
const FAMILY = { SansSerif: 'sans-serif', Serif: 'serif', Monospace: 'monospace', Cursive: 'cursive' };
// [pattern, (match, obj, member, at) => token]; first match wins.
const RULES = [
  [`${N}\\.(?:dp|sp)`, (m) => px(Number(m[1]))],
  [`(?:RoundedCornerShape|CornerSize)\\(${N}\\.dp\\)`, (m) => px(Number(m[1]))],
  ['CircleShape', () => px(9999)],
  ['RectangleShape', () => px(0)],
  [`RoundedCornerShape\\(topStart = ${N}\\.dp, topEnd = ${N}\\.dp, bottomEnd = ${N}\\.dp, bottomStart = ${N}\\.dp\\)`,
    (m) => ({ $type: 'string', $value: m.slice(1).map((n) => `${Number(n)}px`).join(' ') })],
  [N, (m, obj, member) => obj === 'MotionTokens' && member.startsWith('Duration')
    ? { $type: 'duration', $value: { value: Number(m[1]), unit: 'ms' } } : { $type: 'number', $value: Number(m[1]) }],
  [`CubicBezierEasing\\(${N}, ${N}, ${N}, ${N}\\)`, (m) => ({ $type: 'cubicBezier', $value: m.slice(1).map(Number) })],
  ['Color\\(red = (\\d+), green = (\\d+), blue = (\\d+)\\)',
    (m) => ({ $type: 'color', $value: `#${m.slice(1).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}` })],
  [`FontWeight\\.(${Object.keys(WEIGHT).join('|')})`, (m) => ({ $type: 'fontWeight', $value: WEIGHT[m[1]] })],
  [`FontFamily\\.(${Object.keys(FAMILY).join('|')})`, (m) => ({ $type: 'fontFamily', $value: FAMILY[m[1]] })],
  ['TypographyKeyTokens\\.(\\w+)', (m) => ({ $type: 'string', $value: kebab(m[1]) })],
  ['(\\w+Tokens)\\.(\\w+)', (m, _, __, at) => ({ $value: `{${path(m[1], m[2], at)}}` })],
  ['([A-Z]\\w*)', (m, obj, _, at) => ({ $value: `{${path(obj, m[1], at)}}` })],
].map(([re, to]) => [new RegExp(`^${re}$`), to]);

const value = (expr, obj, member, at) => {
  for (const [re, to] of RULES) { const m = expr.match(re); if (m) return { ...to(m, obj, member, at), $extensions: { 'com.kickinrad.material': { src: at } } }; }
  throw new Error(`${at}: unrecognised value for ${obj}.${member}: ${expr}`);
};
// The declaration at lines[i]: its name and expression, joined across lines until the parentheses close.
const DECL = /^(?:(?:private|internal) )?(?:inline val|const val|val) (\w+)(?:: [\w.]+)?(?: =(.*))?$/;
const declaration = (lines, i, at) => {
  const d = lines[i].trim().match(DECL);
  if (!d) throw new Error(`${at}: unrecognised declaration: ${lines[i].trim()}`);
  let expr = d[2] ?? ''; let end = i;
  const clean = () => expr.replace(/\s+/g, ' ').trim().replace(/^get\(\) =/, '').trim().replace(/\( /g, '(').replace(/,? \)/g, ')');
  const open = () => (expr.match(/\(/g) ?? []).length > (expr.match(/\)/g) ?? []).length;
  while (!clean() || open()) { if (++end >= lines.length) throw new Error(`${at}: unterminated declaration`); expr += ` ${lines[end]}`; }
  return { name: d[1], expr: clean(), end };
};
const put = (tree, p, token, at) => {
  const keys = p.split('.'); const leaf = keys.pop();
  const group = keys.reduce((o, k) => (o[k] ??= {}), tree);
  if (group[leaf]) throw new Error(`${at}: ${p} declared twice`);
  group[leaf] = token;
};

const object = (file) => { const stem = file.replace(/\.kt$/, ''); return OBJECT[stem] ?? stem; };

// One generated token file → its DTCG tree, or null for a file SKIP names.
export const convert = (file, kt) => {
  if (SKIP[file.replace(/\.kt$/, '')]) return null;
  const obj = object(file);
  const lines = kt.split('\n'); const tree = {}; let state = 'head';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim(); const at = `${file}:${i + 1}`;
    if (line === '' || line.startsWith('//')) continue;
    if (state === 'head' && line === `internal object ${obj} {`) state = 'body';
    else if (state === 'head' && /^(\/\*|\*|package |import )/.test(line)) continue;
    else if (state === 'body' && line === '}') state = 'tail';
    else if (state === 'body') { const d = declaration(lines, i, at); put(tree, path(obj, d.name, at), value(d.expr, obj, d.name, at), at); i = d.end; }
    else throw new Error(`${at}: unrecognised ${state === 'head' ? 'header' : 'trailer'}: ${line}`);
  }
  if (state !== 'tail') throw new Error(`${file}: no complete internal object ${obj}`);
  return tree;
};

// One tv-material default: the expression after the last anchor, each anchor found on a later line than the one before.
export const tvDefault = (file, kt, anchors) => {
  const lines = kt.split('\n'); let i = -1;
  for (const a of anchors) if ((i = lines.findIndex((l, j) => j > i && l.includes(a))) < 0) throw new Error(`${file}: no ${anchors.join(' > ')}`);
  const last = anchors.at(-1); const rest = lines[i].slice(lines[i].indexOf(last) + last.length);
  return value(rest.match(/^\s*((?:[^,()]|\([^()]*\))+)/)?.[1].trim() ?? '', file.replace(/\.kt$/, ''), last, `${file}:${i + 1}`);
};

const fetchText = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.text(); };
const json = (o) => `${JSON.stringify(o, null, 2)}\n`;
const head = (sha, dir, files) => ({ $schema: 'https://www.designtokens.org/schemas/2025.10/format.json',
  $description: `Generated by scripts/vendor-m3.mjs from ${REPO}@${sha} ${dir}: ${files.join(', ')} (Apache-2.0, The Android Open Source Project). Do not edit.` });

// Every file in the token directory at a SHA: one unauthenticated API call (GITHUB_TOKEN if set), `gh api` if refused.
const list = async (sha) => {
  const api = `repos/${REPO}/contents/${M3_DIR}?ref=${sha}`;
  const r = await fetch(`https://api.github.com/${api}`, { headers: process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {} });
  const names = (r.ok ? await r.json() : JSON.parse(execFileSync('gh', ['api', api], { encoding: 'utf8' }))).map((e) => e.name).sort();
  const odd = names.filter((n) => !n.endsWith('Tokens.kt'));
  if (odd.length) throw new Error(`${M3_DIR} holds files with no rule: ${odd.join(', ')}`);
  return names;
};

// The module the engine imports: each baseline file as a bundled JSON import, so a compiled binary carries the data.
// Light is not .tokens.json (it would collide with dark in one layer): kept as data, not part of the baseline.
const index = (paths) => {
  const files = paths.filter((p) => p.endsWith('.tokens.json')); const light = paths.filter((p) => p.endsWith('/color-light.json'));
  const imports = [...files, ...light].map((p, i) => `import f${i} from './${p}' with { type: 'json' };`);
  return `// Generated by scripts/vendor-m3.mjs. Do not edit.\n${imports.join('\n')}\n\n`
    + `// The baseline layer: every .tokens.json file, in path order.\nexport const tokens = [${files.map((_, i) => `f${i}`).join(', ')}];\n`
    + `// Material's light colour scheme, which the baseline leaves out.\nexport const light = f${files.length};\n`;
};

// Every file under material/ at a SHA, as path → content.
const build = async (sha) => {
  const raw = (dir, f) => fetchText(`https://raw.githubusercontent.com/${REPO}/${sha}/${dir}/${f}`);
  const out = new Map(); const m3 = await list(sha);
  await Promise.all(m3.map(async (f) => {
    const tree = convert(f, await raw(M3_DIR, f)); if (!tree) return;
    const name = kebab(object(f).replace(/Tokens$/, ''));
    // The light scheme is not .tokens.json: it would collide with dark in one layer, so the baseline leaves it out.
    out.set(`m3/${name}${f === 'ColorLightTokens.kt' ? '.json' : '.tokens.json'}`, json({ ...head(sha, M3_DIR, [f]), ...tree }));
  }));
  const tvFiles = [...new Set(TV.map(([f]) => f))]; const tv = {};
  const texts = Object.fromEntries(await Promise.all(tvFiles.map(async (f) => [f, await raw(TV_DIR, f)])));
  for (const [f, anchors, p] of TV) put(tv, p, tvDefault(f, texts[f], anchors), f);
  out.set('tv/tv.tokens.json', json({ ...head(sha, TV_DIR, tvFiles), ...tv }));
  out.set('manifest.json', json({ repo: REPO, sha, m3Dir: M3_DIR, tvDir: TV_DIR, files: [...m3.map((f) => `m3/${f}`), ...tvFiles.map((f) => `tv/${f}`)] }));
  out.set('index.mjs', index([...out.keys()].sort((a, b) => a.localeCompare(b))));
  return new Map([...out].sort(([a], [b]) => a.localeCompare(b)));
};

const main = async (args) => {
  const manifest = (() => { try { return JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8')); } catch { return null; } })();
  const sha = args.includes('--sha') ? args[args.indexOf('--sha') + 1] : manifest?.sha;
  if (!sha) throw new Error('No material/manifest.json; pass --sha <sha>');
  const out = await build(sha);
  if (!args.includes('--check')) {
    for (const [p, content] of out) { mkdirSync(dirname(join(OUT, p)), { recursive: true }); writeFileSync(join(OUT, p), content); }
    return console.log(`Vendored ${out.size} files at ${sha}`);
  }
  const present = readdirSync(OUT, { recursive: true, withFileTypes: true }).filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name).slice(OUT.length));
  const read = (p) => { try { return readFileSync(join(OUT, p), 'utf8'); } catch { return null; } };
  const bad = [...[...out].filter(([p, c]) => read(p) !== c).map(([p]) => p), ...present.filter((p) => !out.has(p))];
  if (bad.length) { console.error(`material/ differs from ${REPO} at ${sha}:\n  ${bad.join('\n  ')}`); process.exit(1); }
  console.log(`material/ matches ${REPO} at ${sha}`);
};

if (import.meta.url === `file://${process.argv[1]}`) await main(process.argv.slice(2));
