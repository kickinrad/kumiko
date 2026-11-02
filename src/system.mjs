// What the outputs read of a kit's tokens, by the kit's name (ctx.name): the colour roles, the corner scale,
// a role's path. Pure functions over the resolved tokens.
import { byPath } from './color.mjs';

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A required option, or an error naming the output and the option.
export const need = (options, output, key) => {
  if (options[key] === undefined) throw new Error(`${output} option "${key}" is required`);
  return options[key];
};

// An output reads the kit's name and version; without a declared kit it has neither.
export const needKit = ({ name, version }, output) => {
  if (!name || !version) throw new Error(`${output} needs a declared kit (kit.name in the config)`);
};

// The two modes an output shows, as theme.toml names them and capitalised for a title: the base mode, then the other.
export const twoModes = ({ modes, media }, output) => {
  const queries = Object.keys(media);
  if (!modes || queries.length !== 1) throw new Error(`${output} needs a theme.toml with exactly one other mode`);
  const label = (mode) => mode[0].toUpperCase() + mode.slice(1);
  return [{ name: modes.base, label: label(modes.base) }, { name: modes.media[queries[0]], label: label(modes.media[queries[0]]), files: media[queries[0]] }];
};

// One mode's colour roles, Material's and the kit's own: { role, varName, value }, where varName is the
// CSS variable name without "--" and role drops the md.sys or kit prefix.
export const colorRoles = (tokens, name) => {
  const head = new RegExp(`^(md\\.sys|${escape(name)})\\.color\\.`);
  return tokens.filter((t) => t.type === 'color' && head.test(t.path))
    .map((t) => ({ role: t.path.replace(head, ''), varName: t.path.replaceAll('.', '-'), value: t.value }));
};

// A role's token path: Material's when it has one, else the kit's.
export const rolePath = (tokens, name, role) => {
  const material = `md.sys.color.${role}`;
  return byPath(tokens).has(material) ? material : `${name}.color.${role}`;
};

// A component's type role: Material names it as a string on an md.comp *-font token (such as "label-large"), and
// it stands for the five typescale variables of that role. The [name, value] pairs, or undefined for any other token.
const TYPE_PARTS = ['font', 'size', 'line-height', 'weight', 'tracking'];
export const typeRole = (token, paths) => token.type === 'string' && token.path.startsWith('md.comp.') && token.path.endsWith('-font') && paths.has(`md.sys.typescale.${token.value}.font`)
  ? TYPE_PARTS.map((part) => [token.name.replace(/-font$/, `-${part}`), `var(--md-sys-typescale-${token.value}-${part})`])
  : undefined;

export const CORNERS = ['none', 'extra-small', 'small', 'medium', 'large', 'large-increased', 'extra-large', 'full'];
// Corner name to px for the scale above.
export const corners = (tokens) => {
  const t = byPath(tokens);
  return Object.fromEntries(CORNERS.map((c) => {
    const tok = t.get(`md.sys.shape.corner.${c}`);
    if (!tok) throw new Error(`Missing token md.sys.shape.corner.${c}`);
    return [c, Number.parseInt(tok.value, 10)];
  }));
};
