// DTCG 2025.10 tokens/*.tokens.json is the only value source.
// A target is one module exporting { name, build(ctx) → [{ path, content }] }:
// built in under ./targets (listed in its index) or a project path in tokens.config.mjs.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import material from "./material.mjs";
import { readTokens, resolve as resolveTokens, typography } from "./resolve.mjs";
import { checkHeader, stamp } from "./header.mjs";
import { checkContrast } from "./checks/contrast.mjs";
import { loadTheme, syncTheme, withMedia } from "./theme.mjs";
import builtins from "./targets/index.mjs";

// Built-in include layers, named in a config's `include` beside its file globs.
const layers = { [material.name]: material };

export const DEFAULT_TARGETS = ["css", "theme-json", "design-md"];

const cssTypes = new Set(["color", "dimension", "duration", "fontFamily", "fontWeight", "number", "string", "typography", "shadow", "cubicBezier"]);
const fluidValue = (token) => {
  const fluid = token.extensions?.["com.kickinrad.css"]?.value;
  if (fluid !== undefined && typeof fluid !== "string") throw new Error(`Invalid CSS extension for ${token.path}`);
  return fluid;
};
// One resolved token as targets see it: value is the CSS scalar (fluid wins).
const entry = (token) => {
  const fluid = fluidValue(token);
  if (!cssTypes.has(token.type)) throw new Error(`No lossless CSS scalar mapping for ${token.path} (${token.type})`);
  if (!["string", "number"].includes(typeof token.css) || String(token.css).includes("[object Object]")) {
    throw new Error(`No CSS scalar for ${token.path} (${token.type}); resolve this token before handoff`);
  }
  return {
    path: token.path, segments: token.segments, name: token.name, type: token.type, fluid, value: fluid ?? token.css, scalar: token.css,
    description: token.description, derived: token.extensions?.["com.kickinrad.derived"] === true || undefined,
    typography: token.type === "typography" ? typography(token.raw) : undefined,
  };
};
// The layers, lowest first: the built-in trees, then include files (a later one wins), then the source files,
// where a token set twice is an error.
// An include may be a glob; its matches join in sorted order.
const expand = (patterns) => patterns.flatMap((pattern) => /[*?[{]/.test(pattern) ? [...new Bun.Glob(pattern).scanSync()].sort() : [pattern]);
const layered = async (builtin, include, source) => [
  ...builtin.map((tree) => ({ tree })),
  ...await Promise.all(expand(include).map(async (file) => ({ tree: await readTokens(file), file }))),
  ...await Promise.all(source.map(async (file) => ({ tree: await readTokens(file), file, strict: true }))),
];

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
  // Includes are a silent base layer under the project's own tokens, which override them: file globs, and
  // built-in layers (builtin:<name>), which sit beneath the globs. The theme's default sits last among the
  // globs: above the built-in layers and other includes, below the project.
  const include = [];
  const builtin = [];
  for (const spec of config.include ?? []) {
    if (!spec.startsWith("builtin:")) { include.push(spec); continue; }
    if (!layers[spec]) throw new Error(`Unknown built-in include ${spec}`);
    builtin.push(layers[spec].tokens());
  }
  include.push(...theme.include);
  const resolved = resolveTokens(await layered(builtin, include, baseFiles));
  const paths = new Set(resolved.map((token) => token.path));
  // A kit's theme maps the roles it picks; once the layers merge, every Material colour role must be set.
  if (theme.files.length) {
    const missing = Object.entries(material.tokens().md.sys.color).filter(([key, token]) => "$value" in token && !paths.has(`md.sys.color.${key}`))
      .map(([key]) => `md.sys.color.${key}`);
    if (missing.length) throw new Error(`theme.toml: no layer sets ${missing.length} Material colour role${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`);
  }
  const tokens = resolved.map(entry);

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
      if (!paths.has(path)) throw new Error(`Media token ${path} does not override a base token`);
    }
    // The project's base files join the include layer, above the other includes; the media files override them.
    return resolveTokens(await layered(builtin, [...include, ...baseFiles], files)).map((token) => {
      try { return entry(token); }
      catch (error) { throw new Error(`Media token: ${error.message}`); }
    });
  };

  await checkContrast(config.kit?.contrast, { tokens, media, mediaTokens });

  const readExisting = async (path) => {
    try { return await readFile(path, "utf8"); }
    catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
  };
  const outputs = [];
  // What an earlier target in this run made at a path (stamped, as written), so a later one reads it current.
  const built = (path) => outputs.find((output) => resolve(output.path) === resolve(path))?.content;
  for (const target of targets) {
    const options = config[target.name] ?? {};
    const made = await target.build({ tokens, media, mediaTokens, options, readExisting, built, ...kit, ...(theme.modes && { modes: theme.modes }) });
    outputs.push(...(kit.name ? stamp(made, kit, target.name) : made));
  }
  for (const { path, content } of outputs) {
    if (check) {
      const existing = await readExisting(path);
      if (kit.name) checkHeader(path, existing);
      if (existing !== content) throw new Error(`${path} is stale; run tokens`);
      continue;
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  return outputs;
};
