// Outputs declare coverage and consumers; with a kit, the build enforces it and the check reports consumers.
import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const command = process.env.TOKENS_BIN ? [resolve(process.env.TOKENS_BIN)] : ["bun", join(root, "bin/tokens.mjs")];
const run = (cwd: string, ...args: string[]) => Bun.spawnSync([...command, ...args], { cwd, stderr: "pipe", stdout: "pipe" });

const coverage = 'coverage: { native: "the platform", emits: [{ what: "a file", why: "native has none" }], skips: ["the rest"] }, consumers: []';
const target = (name: string, withCoverage: boolean) =>
  `export default { name: "${name}", ${withCoverage ? `${coverage}, ` : ""}build: async () => [{ path: "${name}.txt", content: "x\\n" }] };\n`;

// A kit project: builds only the given project targets over the fixture's tokens.
const kitProject = (targets: Record<string, boolean>, kitExtra = "") => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-coverage-"));
  cpSync(join(root, "tests/fixture"), dir, { recursive: true });
  rmSync(join(dir, "tokens/stack.tokens.json"));
  for (const [name, withCoverage] of Object.entries(targets)) writeFileSync(join(dir, `${name}.mjs`), target(name, withCoverage));
  const specs = Object.keys(targets).map((name) => `"./${name}.mjs"`).join(", ");
  writeFileSync(join(dir, "tokens.config.mjs"),
    `export default { targets: [${specs}], kit: { name: "acme"${kitExtra} } };\n`);
  writeFileSync(join(dir, "VERSION"), "2.0.0\n");
  return dir;
};

test("with a kit, a project target lacking coverage fails the build naming it", () => {
  const dir = kitProject({ good: true, bare: false });
  const result = run(dir);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("bare");
  expect(result.stderr.toString()).toContain("coverage");
});

test("a built-in output declares coverage, so a kit may build them", () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-coverage-"));
  cpSync(join(root, "tests/fixture"), dir, { recursive: true });
  rmSync(join(dir, "tokens/stack.tokens.json"));
  writeFileSync(join(dir, "tokens.config.mjs"),
    'export default { targets: ["css", "theme-json", "design-md"], kit: { name: "acme" } };\n');
  writeFileSync(join(dir, "VERSION"), "2.0.0\n");
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});

const consumersKit = (file: string, extra = "") =>
  `, consumers: { good: [{ name: "otto", file: ${JSON.stringify(file)}, tag: "TAG = \\"v(\\\\d+\\\\.\\\\d+\\\\.\\\\d+)\\"", overrides: "otto/override.css" ${extra}}] }`;

test("--check reports a consumer behind the kit version and lists its override", () => {
  const dir = kitProject({ good: true }, consumersKit("otto.py"));
  writeFileSync(join(dir, "otto.py"), 'TAG = "v1.9.0"\n');
  expect(run(dir).exitCode).toBe(0);
  const result = run(dir, "--check");
  expect(result.exitCode).toBe(0);
  const out = result.stdout.toString();
  expect(out).toContain("otto");
  expect(out).toContain("1.9.0");
  expect(out).toContain("2.0.0");
  expect(out).toContain("behind");
  expect(out).toContain("override: otto/override.css");
});

test("a consumer on the kit version is not behind", () => {
  const dir = kitProject({ good: true }, consumersKit("otto.py"));
  writeFileSync(join(dir, "otto.py"), 'TAG = "v2.0.0"\n');
  run(dir);
  const out = run(dir, "--check").stdout.toString();
  expect(out).toContain("otto");
  expect(out).not.toContain("behind");
});

test("an unreadable consumer file is reported and never fails the check", () => {
  const dir = kitProject({ good: true }, consumersKit("missing.py"));
  run(dir);
  const result = run(dir, "--check");
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("unreadable");
  expect(result.stdout.toString()).toContain("override: otto/override.css");
});

test("with no kit, --check prints nothing and the golden build is unchanged", () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-coverage-"));
  cpSync(join(root, "tests/fixture"), dir, { recursive: true });
  expect(run(dir).exitCode).toBe(0);
  for (const file of ["src/styles/tokens.css", "theme.json", "DESIGN.md"]) {
    expect(readFileSync(join(dir, file), "utf8")).toBe(readFileSync(join(root, "tests/expected", file), "utf8"));
  }
  const check = run(dir, "--check");
  expect(check.exitCode).toBe(0);
  expect(check.stdout.toString()).toBe("");
});
