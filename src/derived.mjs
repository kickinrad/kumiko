// Derived colour roles: the on-colours, containers and fixed roles Material names but a palette has no step for,
// computed from a kit's roles by its theme's [derived] recipe, before the build resolves anything else, so one
// run is final. The result is two token trees, one for the base mode and one for the other mode:
//   - an on-colour is whichever neutral reads best on its accent;
//   - a container is its accent at the container opacity over surface-container-low, a state layer;
//   - a fixed role keeps one value in both modes: the other mode's container and the base mode's accent;
//   - a mark is a group item's colour on the surface, and in the other mode tone 40 of its hue for the listed items.
import { Hct, argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import { bestOn, byPath, contrast, stateLayer, textSafe } from './color.mjs';

const colour = ($value, $description) => ({ $type: 'color', $value, $description, $extensions: { 'com.kickinrad.derived': true } });

// recipe: the theme's [derived] ({ accents, custom, fixed, blend, marks }); prefix: the kit's name.
export const derive = ({ accents, custom: own, fixed, blend, marks }, prefix, { tokens, other }) => {
  const custom = new Set(own);

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
    const pct = Math.round(blend * 100);
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
  // is written once as an alias that follows the item in every mode; the other mode overrides only the listed ones.
  const itemMarks = (tokens, inOther) => {
    if (!marks) return {};
    const result = {};
    const head = `${prefix}.${marks.group}.`;
    for (const { path, value } of tokens) {
      const item = path.startsWith(head) && path.endsWith('.color') ? path.slice(head.length, -'.color'.length) : undefined;
      if (!item || !/^[a-z]+$/.test(item) || (inOther && !marks.darker.includes(item))) continue;
      if (!inOther) { result[`${marks.group}-${item}-mark`] = colour(`{${path}}`, `The ${item} mark on the surface: the accent`); continue; }
      const { hue, chroma } = Hct.fromInt(argbFromHex(value));
      const dark = hexFromArgb(Hct.from(hue, chroma, 40).toInt()).slice(0, 7);
      result[`${marks.group}-${item}-mark`] = colour(dark, `The ${item} mark on the surface, darker in the other mode: tone 40 of the accent's hue`);
    }
    return result;
  };

  // Fixed roles keep one value in both modes: the other mode's container (Material's tone 90) and the base-mode
  // accent (tone 80, Material's dark-scheme primary), with text that reads on both.
  const fixedRoles = (base, other) => {
    const n = roles(base); const d = roles(other); const otherRoles = modeRoles(other); const result = {};
    for (const a of fixed) {
      const fix = otherRoles[`${a}-container`].$value; const dim = n(a);
      const [on] = [n('surface'), d('on-surface')].map((h) => [h, Math.min(contrast(h, fix), contrast(h, dim))]).sort((x, y) => y[1] - x[1])[0];
      const variant = textSafe(d(a), d('on-surface'), [fix, dim]);
      result[`${a}-fixed`] = colour(fix, `The other mode's ${a}-container, in both modes`);
      result[`${a}-fixed-dim`] = colour(dim, `The base-mode ${a}, in both modes`);
      result[`on-${a}-fixed`] = colour(on, `Reads on ${a}-fixed and ${a}-fixed-dim: ${Math.min(contrast(on, fix), contrast(on, dim)).toFixed(2)}:1 at worst`);
      result[`on-${a}-fixed-variant`] = colour(variant.value, `The other mode's ${a}${variant.pct ? ` mixed ${variant.pct} % toward its on-surface` : ''}: ${variant.worst.toFixed(2)}:1 at worst`);
    }
    return result;
  };

  // Roles split by path: Material's under md.sys.color, the kit's own under <prefix>.color.
  const tree = (entries) => {
    const result = { md: { sys: { color: {} } }, [prefix]: { color: {} } };
    for (const [r, t] of Object.entries(entries)) (rolePath(r).startsWith('md.') ? result.md.sys.color : result[prefix].color)[r] = t;
    return result;
  };
  return {
    base: tree({ ...modeRoles(tokens), ...fixedRoles(tokens, other), ...itemMarks(tokens, false) }),
    media: tree({ ...modeRoles(other), ...itemMarks(other, true) }),
  };
};
