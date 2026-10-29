// Derived colour roles: the on-colours, containers and fixed roles Material names but a palette has no
// step for, computed from a kit's roles and written back as token files the build reads (one for the
// base mode, one under the Day media). `tokens --check` keeps them current.
//   - an on-colour is whichever neutral reads best on its accent;
//   - a container is its accent at the blend fraction over surface-container-low, a state layer;
//   - a fixed role keeps one value in both modes: the Day container and the base-mode accent;
//   - a mark is a group item's colour on the surface, and in Day tone 40 of its hue for the listed items.
// Everything about the kit comes from the config's `derived` options (see the README).
import { Hct, argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import { bestOn, byPath, contrast, stateLayer, textSafe } from '../color.mjs';

const SCHEMA = 'https://www.designtokens.org/schemas/2025.10/format.json';

const colour = ($value, $description) => ({ $type: 'color', $value, $description });

// A required option by dotted name, or an error naming it.
const need = (options, name) => {
  const value = name.split('.').reduce((node, key) => node?.[key], options);
  if (value === undefined) throw new Error(`derived option "${name}" is required`);
  return value;
};

const derive = (options, prefix) => {
  const accents = need(options, 'accents');
  const blend = need(options, 'blend');
  const dayFiles = need(options, 'dayFiles');
  const out = { night: need(options, 'out.night'), day: need(options, 'out.day') };
  const custom = new Set(options.custom ?? []);
  const fixed = options.fixed ?? [];
  const marks = options.marks && { group: need(options, 'marks.group'), darkerInDay: options.marks.darkerInDay ?? [] };

  // A role's token path: custom colours and their on- and -container roles, and marks, sit under the prefix.
  const isMark = (role) => marks && role.startsWith(`${marks.group}-`) && role.endsWith('-mark');
  const rolePath = (role) => {
    const own = custom.has(role) || custom.has(role.replace(/^on-|-container$/g, '')) || isMark(role);
    return `${own ? prefix : 'md.sys'}.color.${role}`;
  };
  const roles = (tokens) => { const t = byPath(tokens); return (r) => t.get(rolePath(r)).value; };

  // The mode-dependent roles for one mode.
  const modeRoles = (tokens) => {
    const role = roles(tokens);
    const card = role('surface-container-low');
    const pct = Math.round(byPath(tokens).get(blend).value * 100);
    const neutrals = [role('surface'), role('surface-container-lowest'), role('on-surface'), role('inverse-surface'), role('inverse-on-surface')];
    const result = {};
    for (const a of accents) {
      const [on, ratio] = bestOn(role(a), neutrals);
      const container = stateLayer(card, role(a), pct);
      const onContainer = textSafe(role(a), role('on-surface'), [card, container]);
      result[`on-${a}`] = colour(on, `The neutral that reads best on ${a}: ${ratio.toFixed(2)}:1`);
      result[`${a}-container`] = colour(container, `${a} at ${pct} % over surface-container-low, a state layer`);
      result[`on-${a}-container`] = colour(onContainer.value, `${a}${onContainer.pct ? ` mixed ${onContainer.pct} % toward on-surface` : ''}: ${onContainer.worst.toFixed(2)}:1 on the card and the container`);
    }
    return result;
  };

  // The mark of each group item, a colour role (<prefix>.<group>.<item>.color names it): the base mode's
  // is written once as an alias that follows the item in every mode; Day's override only the listed ones, with a hex.
  const itemMarks = (tokens, day) => {
    if (!marks) return {};
    const result = {};
    const head = `${prefix}.${marks.group}.`;
    for (const { path, value } of tokens) {
      const item = path.startsWith(head) && path.endsWith('.color') ? path.slice(head.length, -'.color'.length) : undefined;
      if (!item || !/^[a-z]+$/.test(item) || (day && !marks.darkerInDay.includes(item))) continue;
      if (!day) { result[`${marks.group}-${item}-mark`] = colour(`{${path}}`, `The ${item} mark on the surface: the accent`); continue; }
      const { hue, chroma } = Hct.fromInt(argbFromHex(value));
      const dark = hexFromArgb(Hct.from(hue, chroma, 40).toInt()).slice(0, 7);
      result[`${marks.group}-${item}-mark`] = colour(dark, `The ${item} mark on the surface, darker in Day: tone 40 of the accent's hue`);
    }
    return result;
  };

  // Fixed roles keep one value in both modes: the Day container (Material's tone 90) and the base-mode
  // accent (tone 80, Material's dark-scheme primary), with text that reads on both.
  const fixedRoles = (night, day) => {
    const n = roles(night); const d = roles(day); const dayRoles = modeRoles(day); const result = {};
    for (const a of fixed) {
      const fix = dayRoles[`${a}-container`].$value; const dim = n(a);
      const [on] = [n('surface'), d('on-surface')].map((h) => [h, Math.min(contrast(h, fix), contrast(h, dim))]).sort((x, y) => y[1] - x[1])[0];
      const variant = textSafe(d(a), d('on-surface'), [fix, dim]);
      result[`${a}-fixed`] = colour(fix, `The Day ${a}-container, in both modes`);
      result[`${a}-fixed-dim`] = colour(dim, `The base-mode ${a}, in both modes`);
      result[`on-${a}-fixed`] = colour(on, `Reads on ${a}-fixed and ${a}-fixed-dim: ${Math.min(contrast(on, fix), contrast(on, dim)).toFixed(2)}:1 at worst`);
      result[`on-${a}-fixed-variant`] = colour(variant.value, `Day ${a}${variant.pct ? ` mixed ${variant.pct} % toward Day on-surface` : ''}: ${variant.worst.toFixed(2)}:1 at worst`);
    }
    return result;
  };

  // Roles split by path (Material's under md.sys.color, the kit's own under <prefix>.color).
  // The note sits on the colour group: a root $description would collide with the other source files'.
  const file = (description, entries) => {
    const tree = { $schema: SCHEMA, md: { sys: { color: { $description: description } } }, [prefix]: { color: {} } };
    for (const [r, t] of Object.entries(entries)) (rolePath(r).startsWith('md.') ? tree.md.sys.color : tree[prefix].color)[r] = t;
    return `${JSON.stringify(tree, null, 2)}\n`;
  };

  return async ({ tokens, mediaTokens }) => {
    const day = await mediaTokens(dayFiles);
    return [
      { path: out.night, content: file('Generated by the derived target from the base-mode roles; do not edit. Fixed roles hold for both modes.', { ...modeRoles(tokens), ...fixedRoles(tokens, day), ...itemMarks(tokens, false) }) },
      { path: out.day, content: file('Generated by the derived target from the Day roles; do not edit.', { ...modeRoles(day), ...itemMarks(day, true) }) },
    ];
  };
};

export default {
  name: 'derived',
  async build(ctx) {
    const { options } = ctx;
    const prefix = ctx.name ?? need(options, 'prefix');
    return derive(options, prefix)(ctx);
  },
};
