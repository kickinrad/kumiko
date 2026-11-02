// DTCG 2025.10 trees in, resolved tokens out. Layers merge in order, a later one overriding an earlier one;
// a token set in two `strict` layers is an error. Groups pass their $type down, aliases resolve, and each
// value becomes its CSS scalar.
import { readFile } from "node:fs/promises";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isToken = (node) => isObject(node) && "$value" in node;
const ALIAS = /^\{([^{}]+)\}$/;

export const readTokens = async (file) => {
  const text = await readFile(file, "utf8");
  try { return JSON.parse(text); }
  catch (error) { throw new Error(`${file} is not valid JSON: ${error.message}`); }
};

// A CSS variable name from a token path, in kebab case: words split at a case change, lower-cased, joined by "-".
export const kebab = (segments) => segments.join(" ")
  .replace(/([\p{Ll}\d])(\p{Lu})/gu, "$1 $2").replace(/(\p{Lu})([\p{Lu}][\p{Ll}])/gu, "$1 $2")
  .split(/[^\p{L}\d]+/u).filter(Boolean).map((part) => part.toLowerCase()).join("-");

const merge = (target, source, clash, path = []) => {
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith("$")) { if (path.length) target[key] = value; continue; }
    const here = [...path, key];
    if (isToken(value)) {
      if (isObject(target[key]) && !isToken(target[key])) throw new Error(`${here.join(".")} is a token here and a group elsewhere`);
      clash?.(here.join("."));
      target[key] = value;
    } else if (isObject(value)) {
      if (isToken(target[key])) throw new Error(`${here.join(".")} is a group here and a token elsewhere`);
      merge(target[key] ??= {}, value, clash, here);
    }
  }
  return target;
};

// layers: [{ tree, file?, strict? }], lowest first. `lenient` leaves out a token that fails to resolve, for a
// first pass made before every token it may alias exists.
export const resolve = (layers, { lenient = false } = {}) => {
  const tree = {};
  const owners = new Map();
  for (const { tree: source, file, strict } of layers) {
    merge(tree, source, strict && ((path) => {
      if (owners.has(path)) throw new Error(`Token collision: ${path} is set in both ${owners.get(path)} and ${file}`);
      owners.set(path, file);
    }));
  }

  const tokens = [];
  const walk = (node, type, segments) => {
    if (isToken(node)) return tokens.push({ segments, type: node.$type ?? type, node });
    for (const [key, child] of Object.entries(node)) if (!key.startsWith("$") && isObject(child)) walk(child, node.$type ?? type, [...segments, key]);
  };
  walk(tree, undefined, []);
  const byPath = new Map(tokens.map((token) => [token.segments.join("."), token]));

  // The token an alias names, or undefined for a value.
  const aliasOf = (token) => {
    const name = typeof token.node.$value === "string" && token.node.$value.match(ALIAS)?.[1];
    if (!name) return undefined;
    const found = byPath.get(name);
    if (!found) throw new Error(`Missing token alias ${name} (in ${token.segments.join(".")})`);
    return found;
  };
  // Follows aliases to the token holding the value.
  const final = (token, seen = new Set()) => {
    if (seen.has(token)) throw new Error(`Circular token alias at ${token.segments.join(".")}`);
    seen.add(token);
    const next = aliasOf(token);
    return next ? final(next, seen) : token;
  };
  // A value with every alias inside it replaced by what `of` makes of the aliased token.
  const deep = (value, of, where) => {
    if (typeof value === "string") {
      const name = value.match(ALIAS)?.[1];
      if (name) {
        const found = byPath.get(name);
        if (!found) throw new Error(`Missing token alias ${name} (in ${where})`);
        return of(found);
      }
      if (/\{[^{}]+\}/.test(value)) throw new Error(`${where} mixes an alias into a string; alias the whole value`);
      return value;
    }
    if (Array.isArray(value)) return value.map((each) => deep(each, of, where));
    if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, each]) => [key, deep(each, of, where)]));
    return value;
  };
  // Each value made once per token; an alias takes its target's. `stack` catches a cycle through nested aliases.
  const memo = (make) => {
    const cache = new Map();
    const stack = new Set();
    const get = (token) => {
      const source = final(token);
      if (!cache.has(source)) {
        if (stack.has(source)) throw new Error(`Circular token alias at ${source.segments.join(".")}`);
        stack.add(source);
        try { cache.set(source, make(source, get)); }
        finally { stack.delete(source); }
      }
      return cache.get(source);
    };
    return get;
  };
  const raw = memo((token, get) => deep(token.node.$value, get, token.segments.join(".")));
  const css = memo((token, get) => scalar(token.type, deep(token.node.$value, get, token.segments.join("."))));
  const typeOf = (token, seen = new Set()) => {
    if (token.type || seen.has(token)) return token.type;
    seen.add(token);
    const next = aliasOf(token);
    return next && typeOf(next, seen);
  };

  return tokens.flatMap((token) => {
    let value;
    try { value = { type: typeOf(token), raw: raw(token), css: css(token) }; }
    catch (error) { if (lenient) return []; throw error; }
    return [{
      segments: token.segments, path: token.segments.join("."), name: kebab(token.segments), ...value,
      description: token.node.$description, extensions: token.node.$extensions,
    }];
  });
};

const unit = (value) => isObject(value) && "value" in value && "unit" in value ? `${value.value}${value.unit}` : value;
const WEIGHTS = {
  thin: 100, hairline: 100, extralight: 200, ultralight: 200, light: 300,
  normal: 400, regular: 400, medium: 500, semibold: 600, demibold: 600,
  bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900,
};
const fontWeight = (value) => {
  if (typeof value === "number") return value;
  const key = String(value).replace(/[-_\s]/g, "").toLowerCase();
  if (key in WEIGHTS) return WEIGHTS[key];
  if (/^[1-9]00$/.test(key)) return Number(key);
  throw new Error(`Unsupported fontWeight ${value}`);
};
const dimension = (value, field) => {
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?(?:px|rem)$/.test(value)) return value;
  if (!isObject(value) || typeof value.value !== "number" || !["px", "rem"].includes(value.unit)) throw new Error(`Invalid typography ${field} dimension`);
  return unit(value);
};
// A typography value's fields as CSS: the shape targets read.
export const typography = (value) => {
  if (!isObject(value)) throw new Error("Typography must be an object");
  const fields = ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing"];
  for (const field of fields) if (value[field] === undefined) throw new Error(`Typography is missing ${field}`);
  return {
    fontFamily: Array.isArray(value.fontFamily) ? value.fontFamily.join(", ") : unit(value.fontFamily),
    fontSize: dimension(value.fontSize, "fontSize"), fontWeight: fontWeight(value.fontWeight),
    lineHeight: unit(value.lineHeight), letterSpacing: dimension(value.letterSpacing, "letterSpacing"),
  };
};
// A family list as CSS: each name with a space in single quotes, unless already quoted.
const family = (value) => (Array.isArray(value) ? value : String(value).split(",")).map((part) => {
  const name = part.trim();
  const quoted = /^(['"]).*\1$/.test(name);
  const escaped = quoted ? name : name.replace(/'/g, "\\'");
  return /\s/.test(escaped) && !quoted ? `'${escaped}'` : escaped;
}).join(", ");
const colour = (value) => {
  let rgb, alpha = 1;
  if (isObject(value)) {
    if (value.colorSpace !== "srgb" || !Array.isArray(value.components)) throw new Error(`Unsupported colour ${JSON.stringify(value)}`);
    rgb = value.components.map((part) => Math.round(Math.max(0, Math.min(1, part)) * 255));
    alpha = value.alpha ?? 1;
  } else {
    const hex = String(value).match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
    if (!hex) throw new Error(`Unsupported colour ${value}`);
    rgb = [0, 2, 4].map((at) => parseInt(hex[1].slice(at, at + 2), 16));
    if (hex[2]) alpha = Math.round(parseInt(hex[2], 16) / 255 * 100) / 100;
  }
  return alpha === 1 ? `#${rgb.map((part) => part.toString(16).padStart(2, "0")).join("")}` : `rgba(${rgb.join(", ")}, ${alpha})`;
};
const shadow = (value) => (Array.isArray(value) ? value : [value]).map((item) => {
  if (!isObject(item)) throw new Error("Invalid shadow");
  for (const field of ["offsetX", "offsetY", "blur", "spread", "color"]) if (item[field] === undefined) throw new Error(`Shadow is missing ${field}`);
  const color = typeof item.color === "string" ? item.color : colour(item.color);
  return `${item.inset ? "inset " : ""}${["offsetX", "offsetY", "blur", "spread"].map((field) => unit(item[field])).join(" ")} ${color}`;
}).join(", ");

// One value as its CSS scalar, by type. A type with no CSS form leaves the value as it is, and the build refuses it.
const scalar = (type, value) => {
  switch (type) {
    case "color": return colour(value);
    case "dimension": case "duration": return unit(value);
    case "fontFamily": return family(value);
    case "fontWeight": return fontWeight(value);
    case "typography": {
      const each = typography(value.fontFamily === undefined ? value : { ...value, fontFamily: family(value.fontFamily) });
      return `${each.fontWeight} ${each.fontSize}/${each.lineHeight} ${each.fontFamily}`;
    }
    case "shadow": return shadow(value);
    case "cubicBezier":
      if (!Array.isArray(value) || value.length !== 4 || value.some((part) => typeof part !== "number")) throw new Error("Invalid cubicBezier");
      return `cubic-bezier(${value.join(", ")})`;
    default: return value;
  }
};
