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

test("include files are a silent base: project tokens override them, in the base and in media", () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-include-"));
  mkdirSync(join(dir, "tokens"));
  mkdirSync(join(dir, "vendor"));
  const dim = (value: number) => ({ $type: "dimension", $value: { value, unit: "px" } });
  // Base layer: a and b; the project overrides a and adds c; media overrides c only.
  writeFileSync(join(dir, "vendor/base.tokens.json"), JSON.stringify({ t: { a: dim(1), b: dim(2) } }));
  writeFileSync(join(dir, "tokens/project.tokens.json"), JSON.stringify({ t: { a: dim(10), c: dim(3) } }));
  writeFileSync(join(dir, "tokens/narrow.tokens.json"), JSON.stringify({ t: { c: dim(30) } }));
  writeFileSync(join(dir, "tokens.config.mjs"), `export default {
    targets: ["css"], include: ["vendor/*.tokens.json"],
    media: { "(max-width: 600px)": ["tokens/narrow.tokens.json"] },
  };\n`);
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  const css = read(dir, "src/styles/tokens.css");
  const [base, narrow] = css.split("@media");
  expect(base).toContain("--t-a: 10px;");
  expect(base).toContain("--t-b: 2px;");
  expect(base).toContain("--t-c: 3px;");
  // Inside media, project values still beat the include layer.
  expect(narrow).toContain("--t-c: 30px;");
  expect(narrow).not.toContain("--t-a: 1px;");
});

// A kit gives every target its root, version and name, so no target reads a path beside its own file.
const echoTarget = 'export default { name: "echo", coverage: { native: "none", emits: [], skips: [] }, build: async (ctx) => [{ path: "echo.json", content: JSON.stringify({ keys: Object.keys(ctx).sort(), root: ctx.root, version: ctx.version, name: ctx.name }) + "\\n" }] };\n';
const kitProject = (kit: string | undefined, version: string | null = "1.2.3\n") => {
  const dir = project();
  rmSync(join(dir, "tokens/stack.tokens.json"));
  writeFileSync(join(dir, "echo.mjs"), echoTarget);
  writeFileSync(join(dir, "tokens.config.mjs"),
    `export default { targets: ["./echo.mjs"]${kit === undefined ? "" : `, kit: ${kit}`} };\n`);
  if (version !== null) writeFileSync(join(dir, "VERSION"), version);
  return dir;
};

test("a kit hands every target its root, version and name", () => {
  const dir = kitProject('{ name: "acme", root: "kit" }');
  expect(run(dir).exitCode).toBe(0);
  const ctx = JSON.parse(read(dir, "echo.json"));
  expect(ctx.root).toBe(join(dir, "kit"));
  expect(ctx.version).toBe("1.2.3");
  expect(ctx.name).toBe("acme");
});

test("a kit root defaults to design", () => {
  const dir = kitProject('{ name: "acme" }');
  expect(run(dir).exitCode).toBe(0);
  expect(JSON.parse(read(dir, "echo.json")).root).toBe(join(dir, "design"));
});

test("a kit needs a name", () => {
  const result = run(kitProject("{ root: \"kit\" }"));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("kit.name");
});

test("a kit with no VERSION file fails naming VERSION", () => {
  const result = run(kitProject('{ name: "acme" }', null));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("VERSION");
});

test("a kit with a non-semver VERSION fails naming VERSION", () => {
  const result = run(kitProject('{ name: "acme" }', "v1\n"));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("VERSION");
});

test("with no kit, a target's ctx carries no new keys", () => {
  const dir = kitProject(undefined, null);
  expect(run(dir).exitCode).toBe(0);
  expect(JSON.parse(read(dir, "echo.json")).keys).toEqual(
    ["media", "mediaTokens", "options", "readExisting", "tokens"]);
});

// With a kit, --check also validates the token sources against the official DTCG 2025.10 schema.
const srgb = (hex: string, components: number[]) => ({ colorSpace: "srgb", components, hex });
const kitTokens = (ink: unknown) => ({
  color: { $type: "color", ink: { $value: ink }, text: { $value: "{color.ink}" } },
  space: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } },
});
const schemaProject = (ink: unknown = srgb("#121416", [0.07, 0.08, 0.09])) => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-schema-"));
  mkdirSync(join(dir, "tokens"));
  mkdirSync(join(dir, "vendor"));
  writeFileSync(join(dir, "tokens/brand.tokens.json"), JSON.stringify(kitTokens(ink)));
  writeFileSync(join(dir, "vendor/base.tokens.json"), JSON.stringify({ base: { gap: { $type: "dimension", $value: { value: 1, unit: "px" } } } }));
  writeFileSync(join(dir, "VERSION"), "1.0.0\n");
  writeFileSync(join(dir, "tokens.config.mjs"),
    'export default { targets: ["css"], include: ["vendor/*.tokens.json"], kit: { name: "acme" } };\n');
  return dir;
};
const check = (dir: string) => { expect(run(dir).exitCode).toBe(0); return run(dir, "--check"); };

test("a kit whose colours are objects passes --check", () => {
  const result = check(schemaProject());
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});

test("a kit with one hex-string colour fails --check naming the file and the path", () => {
  const result = check(schemaProject("#121416"));
  expect(result.exitCode).toBe(1);
  const message = result.stderr.toString();
  expect(message).toContain("tokens/brand.tokens.json");
  expect(message).toContain("$.color.ink.$value");
});

test("a hex-string colour fails when the token carries its own $type too", () => {
  const dir = schemaProject();
  writeFileSync(join(dir, "tokens/brand.tokens.json"),
    JSON.stringify({ color: { ink: { $type: "color", $value: "#121416" } } }));
  const result = check(dir);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("$.color.ink.$value");
});

test("every error is named, across files, and the include layer and media files are read", () => {
  const dir = schemaProject("#121416");
  writeFileSync(join(dir, "vendor/base.tokens.json"),
    JSON.stringify({ base: { gap: { $type: "dimension", $value: "1px" } } }));
  writeFileSync(join(dir, "tokens/narrow.tokens.json"),
    JSON.stringify({ color: { ink: { $type: "color", $value: "#000000" } } }));
  writeFileSync(join(dir, "tokens.config.mjs"),
    'export default { targets: ["css"], include: ["vendor/*.tokens.json"], media: { "(max-width: 600px)": ["tokens/narrow.tokens.json"] }, kit: { name: "acme" } };\n');
  const message = check(dir).stderr.toString();
  expect(message).toContain("vendor/base.tokens.json: $.base.gap.$value");
  expect(message).toContain("tokens/brand.tokens.json: $.color.ink.$value");
  expect(message).toContain("tokens/narrow.tokens.json: $.color.ink.$value");
});

test("a kit file that is not JSON fails --check naming the file", () => {
  const dir = schemaProject();
  expect(run(dir).exitCode).toBe(0);
  writeFileSync(join(dir, "tokens/brand.tokens.json"), "{ nope");
  const result = run(dir, "--check");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("tokens/brand.tokens.json");
});

test("without a kit, hex-string colours still pass --check", () => {
  const dir = schemaProject("#121416");
  writeFileSync(join(dir, "tokens.config.mjs"), 'export default { targets: ["css"], include: ["vendor/*.tokens.json"] };\n');
  const result = check(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});

test("a kit's plain build does not run the schema check", () => {
  expect(run(schemaProject("#121416")).exitCode).toBe(0);
});
