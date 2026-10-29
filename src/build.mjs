// DTCG 2025.10 tokens/*.tokens.json is the only value source.
// A target is one module exporting { name, build(ctx) → [{ path, content }] }:
// built in under ./targets (listed in its index) or a project path in tokens.config.mjs.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import StyleDictionary from "style-dictionary";
import { checkSchema } from "./checks/schema.mjs";
import { loadTheme, syncTheme, withMedia } from "./theme.mjs";
import builtins from "./targets/index.mjs";

export const DEFAULT_TARGETS = ["css", "theme-json", "design-md"];

const weights = {
  thin: 100, hairline: 100, extralight: 200, ultralight: 200, light: 300,
  normal: 400, regular: 400, medium: 500, semibold: 600, demibold: 600,
  bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900,
};
const cssValue = (value) => value && typeof value === "object" && "value" in value && "unit" in value
  ? `${value.value}${value.unit}` : value;
const dimensionValue = (value, field) => {
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?(?:px|rem)$/.test(value)) return value;
  if (!value || typeof value !== "object" || typeof value.value !== "number" ||
      !["px", "rem"].includes(value.unit)) throw new Error(`Invalid typography ${field} dimension`);
  return cssValue(value);
};
const fontWeight = (value) => {
  if (typeof value === "number") return value;
  const key = String(value).replace(/[-_\s]/g, "").toLowerCase();
  if (key in weights) return weights[key];
  if (/^[1-9]00$/.test(key)) return Number(key);
  throw new Error(`Unsupported fontWeight ${value}`);
};
export const typography = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Typography must be an object");
  for (const field of ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing"]) {
    if (value[field] === undefined) throw new Error(`Typography is missing ${field}`);
  }
  const result = {};
  for (const field of ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing"]) {
    result[field] = ["fontSize", "letterSpacing"].includes(field) ? dimensionValue(value[field], field)
      : field === "fontWeight" ? fontWeight(value[field])
      : field === "fontFamily" && Array.isArray(value[field]) ? value[field].join(", ")
        : cssValue(value[field]);
  }
  return result;
};
const shadow = (value) => {
  const one = (item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid shadow");
    for (const field of ["offsetX", "offsetY", "blur", "spread", "color"]) {
      if (item[field] === undefined) throw new Error(`Shadow is missing ${field}`);
    }
    const color = typeof item.color === "string" ? item.color
      : StyleDictionary.hooks.transforms["color/css"].transform(
        { $type: "color", $value: item.color }, undefined, { usesDtcg: true });
    return `${item.inset ? "inset " : ""}${["offsetX", "offsetY", "blur", "spread"].map((field) => cssValue(item[field])).join(" ")} ${color}`;
  };
  return (Array.isArray(value) ? value : [value]).map(one).join(", ");
};
const cubicBezier = (value) => {
  if (!Array.isArray(value) || value.length !== 4 || value.some((part) => typeof part !== "number")) {
    throw new Error("Invalid cubicBezier");
  }
  return `cubic-bezier(${value.join(", ")})`;
};

const transforms = {
  "design-system/duration": { type: "duration", transform: (token) => cssValue(token.$value) },
  "design-system/font-weight": { type: "fontWeight", transform: (token) => fontWeight(token.$value) },
  "design-system/typography": {
    type: "typography",
    transform: (token) => {
      const value = typography(token.$value);
      return `${value.fontWeight} ${value.fontSize}/${value.lineHeight} ${value.fontFamily}`;
    },
  },
  "design-system/shadow": { type: "shadow", transform: (token) => shadow(token.$value) },
  "design-system/cubic-bezier": { type: "cubicBezier", transform: (token) => cubicBezier(token.$value) },
};
for (const [name, { type, transform }] of Object.entries(transforms)) {
  StyleDictionary.registerTransform({
    name, type: "value", transitive: true, filter: (token) => token.$type === type, transform,
  });
}
const cssTransforms = [
  ...StyleDictionary.hooks.transformGroups.css.filter((name) =>
    !["typography/css/shorthand", "time/seconds", "shadow/css/shorthand", "cubicBezier/css"].includes(name)),
  ...Object.keys(transforms),
];
const cssTypes = new Set(["color", "dimension", "duration", "fontFamily", "fontWeight", "number", "string", "typography", "shadow", "cubicBezier"]);

const makeDictionary = (source, include = []) => new StyleDictionary({
  include, source,
  log: { warnings: "error", verbosity: "verbose" },
  platforms: { raw: {}, css: { transforms: cssTransforms } },
});
const resolvedType = (token, tokenMap, seen = new Set()) => {
  if (token.$type) return token.$type;
  const path = token.path.join(".");
  if (seen.has(path)) throw new Error(`Circular token alias at ${path}`);
  const alias = token.original?.$value?.match?.(/^\{([^{}]+)\}$/);
  if (!alias) return undefined;
  const target = tokenMap.get(alias[1]);
  if (!target) throw new Error(`Missing token alias ${alias[1]}`);
  return resolvedType(target, tokenMap, new Set([...seen, path]));
};
const fluidValue = (rawToken, path) => {
  const fluid = rawToken?.$extensions?.["com.kickinrad.css"]?.value;
  if (fluid !== undefined && typeof fluid !== "string") throw new Error(`Invalid CSS extension for ${path}`);
  return fluid;
};
// One resolved token as targets see it: value is the CSS scalar (fluid wins).
const entry = (token, rawToken, type) => {
  const path = token.path.join(".");
  const fluid = fluidValue(rawToken, path);
  const value = fluid ?? token.$value;
  return {
    path, segments: token.path, name: token.name, type, fluid, value, scalar: token.$value,
    typography: type === "typography" ? typography(rawToken?.$value) : undefined,
  };
};

const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
// A declared kit adds its root, version and name to every target's ctx; none declared, ctx is unchanged.
const loadKit = async (kit) => {
  if (kit === undefined) return {};
  if (!kit || typeof kit !== "object" || typeof kit.name !== "string" || !kit.name) {
    throw new Error("kit.name is required when kit is set");
  }
  let version;
  try { version = (await readFile("VERSION", "utf8")).trim(); }
  catch (error) { if (error.code === "ENOENT") throw new Error("VERSION is missing; a kit needs one"); throw error; }
  if (!semver.test(version)) throw new Error(`VERSION must hold a semantic version, not "${version}"`);
  return { root: resolve(kit.root ?? "design"), version, name: kit.name };
};

const loadTarget = async (spec) => {
  if (!spec.startsWith(".") && !spec.startsWith("/")) {
    if (!builtins[spec]) throw new Error(`Unknown token target ${spec}`);
    return builtins[spec];
  }
  const target = (await import(pathToFileURL(resolve(spec)).href)).default;
  if (!target || typeof target.build !== "function") throw new Error(`Token target ${spec} exports no build()`);
  return target;
};

export const build = async (config = {}, { check = false } = {}) => {
  const specs = config.targets ?? DEFAULT_TARGETS;
  const targets = [];
  for (const spec of specs) targets.push(await loadTarget(spec));
  const kit = await loadKit(config.kit);

  // The kit's theme.toml becomes token files: its default is an include layer, its modes join their media query.
  const theme = await loadTheme(kit);
  await syncTheme(theme, { check });
  const media = withMedia(theme, config.media);
  const mediaPaths = new Set(Object.values(media).flat().map((file) => resolve(file)));
  // Sorted: directory listing order varies by filesystem and runtime, and output order must not.
  const baseFiles = (await readdir("tokens"))
    .filter((file) => file.endsWith(".tokens.json"))
    .sort()
    .map((file) => `tokens/${file}`)
    .filter((file) => !mediaPaths.has(resolve(file)) && !theme.include.includes(resolve(file)));
  // Include files (globs) are a silent base layer under the project's own tokens, which override them.
  // The theme's default sits last among them: above the built-in includes, below the project.
  const include = [...(config.include ?? []), ...theme.include];
  if (check && config.kit) await checkSchema({ files: [...baseFiles, ...mediaPaths], include });
  const dictionary = makeDictionary(baseFiles, include);
  const raw = await dictionary.getPlatformTokens("raw");
  const rawTokens = new Map(raw.allTokens.map((token) => [token.path.join("."), token]));
  for (const token of raw.allTokens) {
    const type = resolvedType(token, rawTokens);
    if (!cssTypes.has(type)) {
      throw new Error(`No lossless CSS scalar mapping for ${token.path.join(".")} (${type})`);
    }
  }
  const resolved = await dictionary.getPlatformTokens("css");
  const tokens = resolved.allTokens.map((token) => {
    const path = token.path.join(".");
    const rawToken = rawTokens.get(path);
    const type = resolvedType(rawToken, rawTokens);
    if (!["string", "number"].includes(typeof token.$value) || String(token.$value).includes("[object Object]")) {
      throw new Error(`No CSS scalar for ${path} (${type}); resolve this token before handoff`);
    }
    return entry(token, rawToken, type);
  });

  // Media overrides resolve on demand: only CSS can express them.
  const mediaTokens = async (files) => {
    const overridePaths = new Set();
    const visit = (node, path = []) => {
      if (!node || typeof node !== "object" || Array.isArray(node)) return;
      if ("$value" in node) { overridePaths.add(path.join(".")); return; }
      for (const [part, child] of Object.entries(node)) {
        if (!part.startsWith("$")) visit(child, [...path, part]);
      }
    };
    for (const file of files) visit(JSON.parse(await readFile(file, "utf8")));
    for (const path of overridePaths) {
      if (!rawTokens.has(path)) throw new Error(`Media token ${path} does not override a base token`);
    }
    // Order matters: among include files the later wins, so the project's base files beat the include layer.
    const mediaDictionary = makeDictionary(files, [...include, ...baseFiles]);
    const mediaRaw = await mediaDictionary.getPlatformTokens("raw");
    const mediaRawTokens = new Map(mediaRaw.allTokens.map((token) => [token.path.join("."), token]));
    const mediaResolved = await mediaDictionary.getPlatformTokens("css");
    return mediaResolved.allTokens.map((token) => {
      const path = token.path.join(".");
      const rawToken = mediaRawTokens.get(path);
      const type = resolvedType(rawToken, mediaRawTokens);
      if (!cssTypes.has(type)) throw new Error(`No CSS scalar mapping for media token ${path} (${type})`);
      const result = entry(token, rawToken, type);
      if (!["string", "number"].includes(typeof result.value) || String(result.value).includes("[object Object]")) {
        throw new Error(`No CSS scalar for media token ${path} (${type})`);
      }
      return result;
    });
  };

  const readExisting = async (path) => {
    try { return await readFile(path, "utf8"); }
    catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
  };
  const outputs = [];
  for (const target of targets) {
    const options = config[target.name] ?? {};
    outputs.push(...await target.build({ tokens, media, mediaTokens, options, readExisting, ...kit }));
  }
  for (const { path, content } of outputs) {
    if (check) {
      if (await readExisting(path) !== content) throw new Error(`${path} is stale; run tokens`);
      continue;
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  return outputs;
};
