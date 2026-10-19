// Golden outputs were frozen from the design-system 2.1.0 template; any byte change fails.
import { expect, test } from "bun:test";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const command = process.env.TOKENS_BIN ? [resolve(process.env.TOKENS_BIN)] : ["bun", join(root, "bin/tokens.mjs")];
const project = () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-"));
  cpSync(join(root, "tests/fixture"), dir, { recursive: true });
  return dir;
};
const run = (cwd: string, ...args: string[]) => Bun.spawnSync([...command, ...args], { cwd, stderr: "pipe" });
const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");

test("builds byte-identical outputs to the 2.1.0 template", () => {
  const dir = project();
  expect(run(dir).exitCode).toBe(0);
  for (const file of ["src/styles/tokens.css", "theme.json", "DESIGN.md"]) {
    expect(read(dir, file)).toBe(read(join(root, "tests/expected"), file));
  }
});

test("--check passes when current and names the stale file otherwise", () => {
  const dir = project();
  run(dir);
  expect(run(dir, "--check").exitCode).toBe(0);
  appendFileSync(join(dir, "src/styles/tokens.css"), "/* hand edit */\n");
  const stale = run(dir, "--check");
  expect(stale.exitCode).toBe(1);
  expect(stale.stderr.toString()).toContain("src/styles/tokens.css is stale");
});

test("a project target is one file named in tokens.config.mjs", () => {
  const dir = project();
  writeFileSync(join(dir, "local.mjs"),
    'export default { name: "local", build: async (ctx) => [{ path: "local.txt", content: `${ctx.tokens.length}\\n` }] };\n');
  writeFileSync(join(dir, "tokens.config.mjs"), 'export default { targets: ["css", "./local.mjs"] };\n');
  rmSync(join(dir, "tokens/stack.tokens.json"));
  expect(run(dir).exitCode).toBe(0);
  expect(Number(read(dir, "local.txt"))).toBeGreaterThan(0);
});

test("token files build in sorted order, whatever order the filesystem lists them", () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-order-"));
  mkdirSync(join(dir, "tokens"));
  // Scrambled creation order: directory listing order differs from sorted order on common filesystems.
  const names = ["web", "foundation", "m", "c", "x", "b", "q", "a"];
  for (const name of names) {
    writeFileSync(join(dir, `tokens/${name}.tokens.json`), JSON.stringify({ [`t${name}`]: { gap: { $type: "dimension", $value: { value: 1, unit: "px" } } } }));
  }
  writeFileSync(join(dir, "tokens.config.mjs"), 'export default { targets: ["css"] };\n');
  expect(run(dir).exitCode).toBe(0);
  const css = read(dir, "src/styles/tokens.css");
  const order = [...css.matchAll(/--t([a-z]+)-gap/g)].map((m) => m[1]);
  expect(order).toEqual([...names].sort());
});

test("an unknown target fails loudly", () => {
  const dir = project();
  writeFileSync(join(dir, "tokens.config.mjs"), 'export default { targets: ["nope"] };\n');
  const result = run(dir);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("Unknown token target nope");
});
