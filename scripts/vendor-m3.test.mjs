// The Kotlin-to-DTCG conversion, on excerpts of the real androidx files in scripts/fixtures/.
import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { convert, tvDefault } from './vendor-m3.mjs';

const kt = (f) => readFileSync(new URL(`fixtures/${f}`, import.meta.url), 'utf8');
const conv = (f) => convert(f, kt(f));
const get = (tokens, path) => path.split('.').reduce((o, k) => o?.[k], tokens);
const tok = (src, $value, $type) => ({ ...($type && { $type }), $value, $extensions: { 'com.kickinrad.material': { src } } });
const px = (value) => ({ value, unit: 'px' });

test('a component file: aliases by name, numbers, dp sizes, each with its source line', () => {
  const t = conv('FilledCardTokens.kt');
  assert.deepEqual(get(t, 'md.comp.filled-card.container-color'), tok('FilledCardTokens.kt:24', '{md.sys.color.surface-container-highest}'));
  assert.deepEqual(get(t, 'md.comp.filled-card.container-elevation'), tok('FilledCardTokens.kt:27', '{md.sys.elevation.level0}'));
  assert.deepEqual(get(t, 'md.comp.filled-card.container-shape'), tok('FilledCardTokens.kt:30', '{md.sys.shape.corner.medium}'));
  assert.deepEqual(get(t, 'md.comp.filled-card.disabled-container-opacity'), tok('FilledCardTokens.kt:39', 0.38, 'number'));
  assert.deepEqual(get(t, 'md.comp.filled-card.icon-size'), tok('FilledCardTokens.kt:55', px(24), 'dimension'));
  assert.deepEqual(Object.keys(t.md.comp['filled-card']).length, 13);
});

test('a TypographyKeyTokens reference names the type role as a string', () => {
  assert.deepEqual(get(conv('AssistChipTokens.kt'), 'md.comp.assist-chip.label-text-font'), tok('AssistChipTokens.kt:27', 'label-large', 'string'));
});

test('shapes: the corner scale by our names, full and none, asymmetric corners as a border-radius string', () => {
  const c = conv('ShapeTokens.kt').md.sys.shape;
  for (const name of ['none', 'extra-small', 'small', 'medium', 'large', 'large-increased', 'extra-large', 'full']) assert.ok(c.corner[name], name);
  assert.deepEqual(c.corner.medium, tok('ShapeTokens.kt:70', px(12), 'dimension'));
  assert.deepEqual(c.corner.full, tok('ShapeTokens.kt:46', px(9999), 'dimension'));
  assert.deepEqual(c.corner.none, tok('ShapeTokens.kt:71', px(0), 'dimension'));
  assert.deepEqual(c.corner['extra-large-top'], tok('ShapeTokens.kt:31', '28px 28px 0px 0px', 'string'));
  assert.deepEqual(c.corner['large-end'], tok('ShapeTokens.kt:48', '0px 16px 16px 0px', 'string'));
  assert.deepEqual(c['corner-value'].small, tok('ShapeTokens.kt:81', px(8), 'dimension'));
});

test('the type scale: sp sizes as px, negative tracking, font and weight as typeface aliases, emphasized roles kept', () => {
  const s = conv('TypeScaleTokens.kt').md.sys.typescale;
  assert.deepEqual(s['body-large'].font, tok('TypeScaleTokens.kt:24', '{md.ref.typeface.plain}'));
  assert.deepEqual(s['body-large']['line-height'], tok('TypeScaleTokens.kt:27', px(24), 'dimension'));
  assert.deepEqual(s['body-large'].size, tok('TypeScaleTokens.kt:30', px(16), 'dimension'));
  assert.deepEqual(s['body-large'].weight, tok('TypeScaleTokens.kt:36', '{md.ref.typeface.weight-regular}'));
  assert.deepEqual(s['display-large'].tracking, tok('TypeScaleTokens.kt:40', px(-0.2), 'dimension'));
  assert.ok(s['body-large-emphasized'].font);
});

test('typefaces: generic families and named weights', () => {
  const f = conv('TypefaceTokens.kt').md.ref.typeface;
  assert.deepEqual(f.plain, tok('TypefaceTokens.kt:28', 'sans-serif', 'fontFamily'));
  assert.deepEqual([f['weight-bold'].$value, f['weight-medium'].$value, f['weight-regular'].$value], [700, 500, 400]);
  assert.equal(f['weight-medium'].$type, 'fontWeight');
});

test('motion: untyped durations in ms, easings as cubic beziers without the suffix', () => {
  const m = conv('MotionTokens.kt').md.sys.motion;
  assert.deepEqual(m.duration.short3, tok('MotionTokens.kt:38', { value: 150, unit: 'ms' }, 'duration'));
  assert.deepEqual(m.duration['extra-long1'].$value, { value: 700, unit: 'ms' });
  assert.deepEqual(m.easing['emphasized-decelerate'], tok('MotionTokens.kt:46', [0.05, 0.7, 0.1, 1], 'cubicBezier'));
  assert.ok(m.easing.emphasized && m.easing['emphasized-accelerate']);
});

test('state layers by state', () => {
  assert.deepEqual(get(conv('StateTokens.kt'), 'md.sys.state.hover.state-layer-opacity'), tok('StateTokens.kt:24', 0.08, 'number'));
});

test('palette colours as hex; colour roles alias the palette and their own file by name', () => {
  const p = conv('PaletteTokens.kt').md.ref.palette;
  assert.deepEqual(p.black, tok('PaletteTokens.kt:24', '#000000', 'color'));
  assert.deepEqual(p.primary40, tok('PaletteTokens.kt:27', '#6750a4', 'color'));
  const c = conv('ColorDarkTokens.kt').md.sys.color;
  assert.deepEqual(c.background, tok('ColorDarkTokens.kt:22', '{md.ref.palette.neutral6}'));
  assert.deepEqual(c['surface-tint'], tok('ColorDarkTokens.kt:28', '{md.sys.color.primary}'));
});

test('the index-only key files and TypographyTokens convert to nothing', () => {
  assert.equal(convert('ColorSchemeKeyTokens.kt', 'anything'), null);
  assert.equal(conv('TypographyTokens.kt'), null);
});

test('IconButtonTokens.kt declares StandardIconButtonTokens; the path follows the object', () => {
  assert.deepEqual(get(conv('IconButtonTokens.kt'), 'md.comp.standard-icon-button.disabled-color'), tok('IconButtonTokens.kt:22', '{md.sys.color.on-surface}'));
});

test('springs by motion scheme, speed and kind', () => {
  assert.deepEqual(get(conv('ExpressiveMotionTokens.kt'), 'md.sys.motion.spring.expressive.default.spatial.damping'), tok('ExpressiveMotionTokens.kt:22', 0.8, 'number'));
  assert.deepEqual(get(conv('StandardMotionTokens.kt'), 'md.sys.motion.spring.standard.default.spatial.stiffness'), tok('StandardMotionTokens.kt:21', 700, 'number'));
  assert.equal(Object.keys(conv('StandardMotionTokens.kt').md.sys.motion.spring.standard.fast.effects).length, 2);
});

test('an unrecognised declaration or value form throws naming file:line', () => {
  assert.throws(() => convert('FooTokens.kt', 'internal class FooTokens(val x: Int) {\n}\n'), /FooTokens\.kt:1\b/);
  assert.throws(() => convert('XTokens.kt', 'internal object XTokens {\n    inline val A: Color\n        get() = Color.Transparent\n}\n'), /XTokens\.kt:2\b/);
  assert.throws(() => convert('ShapeTokens.kt', 'internal object ShapeTokens {\n    val Squircle = RoundedCornerShape(4.dp)\n}\n'), /ShapeTokens\.kt:2\b/);
});

test('tv-material defaults are found by their anchors in source order, cited by line', () => {
  const card = kt('Card.kt');
  assert.deepEqual(tvDefault('Card.kt', card, ['object CardDefaults {', 'val ContainerShape =']), tok('Card.kt:22', px(8), 'dimension'));
  assert.deepEqual(tvDefault('Card.kt', card, ['object CardDefaults {', 'fun scale(', 'focusedScale: Float =']), tok('Card.kt:26', 1.1, 'number'));
  assert.deepEqual(tvDefault('Card.kt', card, ['object CardDefaults {', 'fun border(', 'focusedBorder: Border =', 'BorderStroke(width =']),
    tok('Card.kt:45', px(3), 'dimension'));
  assert.throws(() => tvDefault('Card.kt', card, ['object CardDefaults {', 'val Nope =']), /Card\.kt.*val Nope =/);
});
