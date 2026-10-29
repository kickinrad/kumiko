// A kit's fingerprint manifest: <kit root>/manifest.json maps each generated file to its sha256
// and holds "$inputs", a hash of the token sources and the engine version.
// --check refuses a hand-edited output, a leftover (listed, no longer written) and stale inputs;
// a plain build deletes the leftovers the previous manifest listed.
import { createHash } from "node:crypto";
import { glob, readFile, unlink } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import pkg from "../../package.json" with { type: "json" };

const INPUTS = "$inputs";
const sha = (data) => createHash("sha256").update(data).digest("hex");
const rel = (path) => relative(resolve("."), resolve(path)).split(sep).join("/");
const readIf = async (path) => {
  try { return await readFile(path, "utf8"); }
  catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
};

// Path and content of every token source the build reads, sorted by path, plus the engine version.
const inputsHash = async (files, include) => {
  const paths = new Set(files.map(rel));
  for (const pattern of include) for await (const file of glob(pattern)) paths.add(rel(file));
  const hash = createHash("sha256").update(`tokens ${pkg.version}\0`);
  for (const path of [...paths].sort()) hash.update(`${path}\0`).update(await readFile(path)).update("\0");
  return hash.digest("hex");
};

export const kitManifest = async ({ root, outputs, files, include = [], check = false }) => {
  const path = rel(resolve(root, "manifest.json"));
  const fresh = { [INPUTS]: await inputsHash(files, include) };
  for (const output of outputs) fresh[rel(output.path)] = sha(output.content);

  const text = await readIf(path);
  let previous;
  if (text !== undefined) {
    try { previous = JSON.parse(text); }
    catch { throw new Error(`${path} is not valid JSON; run tokens`); }
  }
  const leftovers = Object.keys(previous ?? {}).filter((key) => key !== INPUTS && !(key in fresh));

  if (check) {
    if (previous === undefined) throw new Error(`${path} is missing; run tokens`);
    for (const output of outputs) {
      const key = rel(output.path);
      const disk = await readIf(output.path);
      if (disk !== undefined && previous[key] !== undefined && sha(disk) !== previous[key]) {
        throw new Error(`${key} does not match its hash in ${path}; run tokens`);
      }
    }
    for (const key of leftovers) throw new Error(`${key} is a leftover: ${path} lists it and no target writes it; run tokens`);
    if (previous[INPUTS] !== fresh[INPUTS]) throw new Error(`${path} ${INPUTS} is stale: token inputs changed; run tokens`);
  } else {
    for (const key of leftovers) {
      // Only what the manifest listed, and only inside the working directory.
      const target = relative(resolve("."), resolve(key));
      if (key === path || !target || target.startsWith("..") || isAbsolute(target)) continue;
      try { await unlink(key); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  }
  const sorted = Object.fromEntries(Object.entries(fresh).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return [{ path, content: `${JSON.stringify(sorted, null, 2)}\n` }];
};
