// DTCG 2025.10 tokens/*.tokens.json is the only value source.
// A target is a module exporting { name, build(ctx) → [{ path, content }] }: built in under ./targets (listed in its
// index), or a project's own, imported by kumiko.config.mjs and listed as an object.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import material, { tv } from "./material.mjs";
import { readTokens, resolve as resolveTokens, typography } from "./resolve.mjs";
import { checkHeader, stamp } from "./header.mjs";
import { checkContrast, contrastPairs } from "./checks/contrast.mjs";
import { derive } from "./derived.mjs";
import { loadTheme, withMedia } from "./theme.mjs";
import builtins from "./targets/index.mjs";

// Built-in include layers, named in a config's `include` beside its file globs.
const layers = { [material.name]: material, [tv.name]: tv };

const cssTypes = new Set(["color", "dimension", "duration", "fontFamily", "fontWeight", "number", "string", "typography", "shadow", "cubicBezier"]);
// One resolved token as targets see it: value is the CSS scalar.
const entry = (token) => {
  if (!cssTypes.has(token.type)) throw new Error(`No lossless CSS scalar mapping for ${token.path} (${token.type})`);
  if (!["string", "number"].includes(typeof token.css) || String(token.css).includes("[object Object]")) {
    throw new Error(`No CSS scalar for ${token.path} (${token.type}); resolve this token before handoff`);
  }
  return {
    path: token.path, segments: token.segments, name: token.name, type: token.type, value: token.css, raw: token.raw,
    alias: token.alias, description: token.description, derived: token.extensions?.["com.kickinrad.derived"] === true || undefined,
    typography: token.type === "typography" ? typography(token.raw) : undefined,
  };
};
// An include may be a glob; its matches join in sorted order.
const expand = (patterns) => patterns.flatMap((pattern) => /[*?[{]/.test(pattern) ? [...new Bun.Glob(pattern).scanSync()].sort() : [pattern]);
// A layer is { file } or { tree, file } (file then names it in an error); `strict` makes a token set twice an error.
const resolveLayers = async (layers, options) => resolveTokens(await Promise.all(layers.map(async (layer) => ({
  ...layer, tree: layer.tree ?? await readTokens(layer.file),
}))), options);

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

export const build = async (config = {}, { check = false } = {}) => {
  if (!Array.isArray(config.targets) || !config.targets.length) throw new Error("kumiko.config.mjs names no targets");
  // A built-in by name, or a project's own target: a module the config imports, listed as its object.
  const targets = config.targets.map((spec) => {
    const target = typeof spec === "string" ? builtins[spec] : spec;
    if (!target) throw new Error(`Unknown token target ${spec}`);
    if (typeof target.build !== "function") throw new Error(`Token target ${target.name ?? spec} has no build()`);
    return target;
  });
  const kit = await loadKit(config.kit);

  // The layers, lowest first: built-in trees, include files, the kit's theme.toml, then the project's own tokens/
  // files, where a token set twice is an error. Each other mode adds its media layers on top.
  const theme = await loadTheme(kit);
  const media = withMedia(theme, config.media);
  const mediaPaths = new Set(Object.values(media).flat().filter((layer) => layer.file).map((layer) => resolve(layer.file)));
  // Sorted: directory listing order varies by filesystem and runtime, and output order must not.
  const baseFiles = (await readdir("tokens").catch((error) => { if (error.code === "ENOENT") return []; throw error; }))
    .filter((file) => file.endsWith(".tokens.json")).sort().map((file) => `tokens/${file}`)
    .filter((file) => !mediaPaths.has(resolve(file)));
  const include = [];
  for (const spec of config.include ?? []) {
    if (!spec.startsWith("builtin:")) { include.push(...expand([spec]).map((file) => ({ file }))); continue; }
    if (!layers[spec]) throw new Error(`Unknown built-in include ${spec}`);
    include.unshift({ tree: layers[spec].tokens(), file: spec });
  }
  if (theme.tree) include.push({ tree: theme.tree, file: "theme.toml" });
  const source = baseFiles.map((file) => ({ file, strict: true }));
  const modeLayers = (query) => [...include, ...source.map(({ file, tree }) => ({ file, tree })), ...media[query]];

  // The derived roles come first, from everything else, so the build reads what this run computes.
  if (theme.derived) {
    const queries = Object.keys(media);
    if (queries.length !== 1) throw new Error(`theme.toml: [derived] needs exactly one other mode; the kit has ${queries.length}`);
    const first = async (layers) => (await resolveLayers(layers, { lenient: true })).flatMap((token) => {
      try { return [entry(token)]; } catch { return []; }
    });
    const derived = derive(theme.derived, theme.name, { tokens: await first([...include, ...source]), other: await first(modeLayers(queries[0])) });
    source.push({ tree: derived.base, file: "the derived roles", strict: true });
    media[queries[0]].push({ tree: derived.media, file: "the derived roles", strict: true });
  }

  const resolved = await resolveLayers([...include, ...source]);
  const paths = new Set(resolved.map((token) => token.path));
  // A theme that maps Material's colour roles maps the ones it picks: once the layers merge, every one must be set.
  if (Object.keys(theme.roles ?? {}).some((role) => role.startsWith("md.sys.color."))) {
    const missing = Object.entries(material.tokens().md.sys.color).filter(([key, token]) => "$value" in token && !paths.has(`md.sys.color.${key}`))
      .map(([key]) => `md.sys.color.${key}`);
    if (missing.length) throw new Error(`theme.toml: no layer sets ${missing.length} Material colour role${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`);
  }
  // A token no layer but a built-in one sets is marked `builtin`, so a target can tell Material's untouched tokens
  // from a project's own.
  const own = new Set();
  const collect = (node, path = []) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    if ("$value" in node) return own.add(path.join("."));
    for (const [key, child] of Object.entries(node)) if (!key.startsWith("$")) collect(child, [...path, key]);
  };
  for (const layer of [...include, ...source, ...Object.values(media).flat()]) {
    if (!layer.file?.startsWith("builtin:")) collect(layer.tree ?? await readTokens(layer.file));
  }
  const tokens = resolved.map(entry).map((token) => own.has(token.path) ? token : { ...token, builtin: true });

  // Each other mode resolves once, when a target or the contrast check first asks for it. A target passes back the
  // layers it was given in ctx.media.
  const cache = new Map();
  const mediaTokens = (layers) => {
    const query = Object.keys(media).find((each) => media[each] === layers);
    if (!query) throw new Error("mediaTokens takes one of ctx.media's values");
    if (!cache.has(query)) cache.set(query, resolveMedia(query));
    return cache.get(query);
  };
  const resolveMedia = async (query) => {
    const own = await Promise.all(media[query].map(async (layer) => layer.tree ?? await readTokens(layer.file)));
    const visit = (node, path = []) => {
      if (!node || typeof node !== "object" || Array.isArray(node)) return;
      if ("$value" in node) { if (!paths.has(path.join("."))) throw new Error(`Media token ${path.join(".")} does not override a base token`); return; }
      for (const [part, child] of Object.entries(node)) if (!part.startsWith("$")) visit(child, [...path, part]);
    };
    own.forEach((tree) => visit(tree));
    return (await resolveLayers(modeLayers(query))).map((token) => {
      try { return entry(token); }
      catch (error) { throw new Error(`Media token: ${error.message}`); }
    });
  };

  await checkContrast(theme.contrast && contrastPairs(theme, tokens), { tokens, media, mediaTokens });

  const readExisting = async (path) => {
    try { return await readFile(path, "utf8"); }
    catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
  };
  // Every target's files, written or checked by the one loop below.
  const outputs = [];
  // What an earlier target in this run made at a path (stamped, as written), so a later one reads it current.
  const built = (path) => outputs.find((output) => resolve(output.path) === resolve(path))?.content;
  for (const target of targets) {
    const options = config[target.name] ?? {};
    const files = await target.build({ tokens, media, mediaTokens, options, config, readExisting, built, ...kit,
      ...(kit.name && { title: theme.title ?? kit.name }), ...(theme.modes && { modes: theme.modes, theme }) });
    outputs.push(...(kit.name ? stamp(files, kit, target.name) : files));
  }
  for (const { path, content } of outputs) {
    if (check) {
      const existing = await readExisting(path);
      if (kit.name) checkHeader(path, existing);
      if (existing !== content) throw new Error(`${path} is stale; run kumiko`);
      continue;
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  return outputs;
};
