// A kit's fingerprint manifest: what a build writes, and what --check refuses.
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const command = process.env.TOKENS_BIN ? [resolve(process.env.TOKENS_BIN)] : ["bun", join(root, "bin/tokens.mjs")];
const run = (cwd: string, ...args: string[]) => Bun.spawnSync([...command, ...args], { cwd, stderr: "pipe" });
const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const err = (result: { stderr: Buffer }) => result.stderr.toString();

const outputs = ["src/styles/tokens.css", "theme.json", "DESIGN.md"];
const extraTarget = 'export default { name: "extra", build: async () => [{ path: "extra/old.txt", content: "old\\n" }] };\n';
const config = (targets: string[]) => `export default {
  targets: ${JSON.stringify(targets)},
  media: { "(max-width: 850px)": ["tokens/stack.tokens.json"] },
  css: { layer: "tokens", prelude: "@font-face { font-family: Test; }" },
  kit: { name: "acme", root: "kit" },
};\n`;
const kitProject = (targets = ["css", "theme-json", "design-md"]) => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-manifest-"));
  cpSync(join(root, "tests/fixture"), dir, { recursive: true });
  writeFileSync(join(dir, "VERSION"), "1.0.0\n");
  writeFileSync(join(dir, "extra.mjs"), extraTarget);
  writeFileSync(join(dir, "tokens.config.mjs"), config(targets));
  return dir;
};
const manifest = (dir: string) => JSON.parse(read(dir, "kit/manifest.json"));

test("a build writes kit/manifest.json: every output's sha256, and the inputs", () => {
  const dir = kitProject();
  expect(run(dir).exitCode).toBe(0);
  const m = manifest(dir);
  expect(Object.keys(m)).toEqual(["$inputs", ...[...outputs].sort()]);
  for (const file of outputs) expect(m[file]).toBe(sha(read(dir, file)));
  expect(m["$inputs"]).toMatch(/^[0-9a-f]{64}$/);
});

test("the manifest is sorted, two-space indented and ends in a newline", () => {
  const dir = kitProject();
  run(dir);
  const text = read(dir, "kit/manifest.json");
  expect(text).toBe(JSON.stringify(manifest(dir), null, 2) + "\n");
  expect(text.startsWith('{\n  "$inputs": "')).toBe(true);
});

test("a second build, and a build in another directory, write the same bytes", () => {
  const a = kitProject();
  const b = kitProject();
  run(a);
  const first = read(a, "kit/manifest.json");
  run(a);
  run(b);
  expect(read(a, "kit/manifest.json")).toBe(first);
  expect(read(b, "kit/manifest.json")).toBe(first);
});

test("--check passes on a fresh build", () => {
  const dir = kitProject();
  run(dir);
  expect(err(run(dir, "--check"))).toBe("");
  expect(run(dir, "--check").exitCode).toBe(0);
});

test("--check fails a missing manifest, naming it", () => {
  const dir = kitProject();
  run(dir);
  rmSync(join(dir, "kit/manifest.json"));
  const result = run(dir, "--check");
  expect(result.exitCode).toBe(1);
  expect(err(result)).toContain("kit/manifest.json");
});

test("--check fails a hand-edited output, naming the path and the manifest", () => {
  const dir = kitProject();
  run(dir);
  appendFileSync(join(dir, "theme.json"), " ");
  const result = run(dir, "--check");
  expect(result.exitCode).toBe(1);
  expect(err(result)).toContain("theme.json");
  expect(err(result)).toContain("kit/manifest.json");
});

test("--check fails a leftover the manifest lists and no target writes, naming the path", () => {
  const dir = kitProject(["css", "theme-json", "design-md", "./extra.mjs"]);
  run(dir);
  expect(manifest(dir)["extra/old.txt"]).toBe(sha("old\n"));
  writeFileSync(join(dir, "tokens.config.mjs"), config(["css", "theme-json", "design-md"]));
  const result = run(dir, "--check");
  expect(result.exitCode).toBe(1);
  expect(err(result)).toContain("extra/old.txt");
  expect(err(result)).toContain("leftover");
  expect(existsSync(join(dir, "extra/old.txt"))).toBe(true);
});

test("a plain build deletes a leftover and drops it from the manifest", () => {
  const dir = kitProject(["css", "theme-json", "design-md", "./extra.mjs"]);
  run(dir);
  writeFileSync(join(dir, "tokens.config.mjs"), config(["css", "theme-json", "design-md"]));
  expect(run(dir).exitCode).toBe(0);
  expect(existsSync(join(dir, "extra/old.txt"))).toBe(false);
  expect(manifest(dir)["extra/old.txt"]).toBeUndefined();
  expect(run(dir, "--check").exitCode).toBe(0);
});

test("a build never deletes a file the manifest did not list", () => {
  const dir = kitProject();
  run(dir);
  writeFileSync(join(dir, "mine.txt"), "mine\n");
  expect(run(dir).exitCode).toBe(0);
  expect(read(dir, "mine.txt")).toBe("mine\n");
});

test("--check fails stale inputs, naming $inputs, even when no output changes", () => {
  const dir = kitProject();
  run(dir);
  appendFileSync(join(dir, "tokens/minimal.tokens.json"), "\n");
  const result = run(dir, "--check");
  expect(result.exitCode).toBe(1);
  expect(err(result)).toContain("$inputs");
  expect(err(result)).toContain("kit/manifest.json");
  expect(run(dir).exitCode).toBe(0);
  expect(run(dir, "--check").exitCode).toBe(0);
});

test("a changed input changes $inputs", () => {
  const dir = kitProject();
  run(dir);
  const before = manifest(dir)["$inputs"];
  appendFileSync(join(dir, "tokens/minimal.tokens.json"), "\n");
  run(dir);
  expect(manifest(dir)["$inputs"]).not.toBe(before);
});

test("with no kit, no manifest is written and the golden outputs are unchanged", () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-nokit-"));
  cpSync(join(root, "tests/fixture"), dir, { recursive: true });
  expect(run(dir).exitCode).toBe(0);
  expect(existsSync(join(dir, "kit"))).toBe(false);
  expect(existsSync(join(dir, "design"))).toBe(false);
  for (const file of outputs) expect(read(dir, file)).toBe(read(join(root, "tests/expected"), file));
  expect(run(dir, "--check").exitCode).toBe(0);
});
