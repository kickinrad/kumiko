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
