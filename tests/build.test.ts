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
const echoTarget = 'export default { name: "echo", build: async (ctx) => [{ path: "echo.json", content: JSON.stringify({ keys: Object.keys(ctx).sort(), root: ctx.root, version: ctx.version, name: ctx.name }) + "\\n" }] };\n';
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

test("with no kit, a target's ctx carries no kit keys", () => {
  const dir = kitProject(undefined, null);
  expect(run(dir).exitCode).toBe(0);
  expect(JSON.parse(read(dir, "echo.json")).keys).toEqual(
    ["built", "media", "mediaTokens", "options", "readExisting", "tokens"]);
});

// A kit's tokens are not schema-checked: a hex-string colour builds and passes --check.
test("a kit with hex-string colours passes --check", () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-hex-"));
  mkdirSync(join(dir, "tokens"));
  writeFileSync(join(dir, "tokens/brand.tokens.json"), JSON.stringify({ color: { ink: { $type: "color", $value: "#121416" } } }));
  writeFileSync(join(dir, "VERSION"), "1.0.0\n");
  writeFileSync(join(dir, "tokens.config.mjs"), 'export default { targets: ["css"], kit: { name: "acme" } };\n');
  expect(run(dir).exitCode).toBe(0);
  const result = run(dir, "--check");
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});

// The built-in Material 3 baseline: `builtin:material` in include, read from the engine, never from the project.
const materialProject = (include: string) => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-material-"));
  mkdirSync(join(dir, "tokens"));
  writeFileSync(join(dir, "tokens/project.tokens.json"), JSON.stringify({
    md: { sys: { shape: { corner: { medium: { $type: "dimension", $value: { value: 20, unit: "px" } } } } } },
  }));
  writeFileSync(join(dir, "tokens.config.mjs"), `export default { targets: ["css"], include: [${include}] };\n`);
  return dir;
};

test("builtin:material gives a project Material's tokens beneath its own", () => {
  const dir = materialProject('"builtin:material"');
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  const css = read(dir, "src/styles/tokens.css");
  expect(css).toContain("--md-sys-color-primary: #");
  // An alias in the baseline follows the project's override.
  expect(css).toContain("--md-comp-filled-card-container-shape: 20px;");
  expect(css).toContain("--md-sys-motion-duration-short3: 150ms;");
  expect(css).toContain("--md-sys-shape-corner-medium: 20px;");
  expect(css).not.toContain("--md-sys-shape-corner-medium: 12px;");
  expect(run(dir, "--check").exitCode).toBe(0);
});

test("builtin:material sits beneath file includes too", () => {
  const dir = materialProject('"vendor/*.tokens.json", "builtin:material"');
  mkdirSync(join(dir, "vendor"));
  writeFileSync(join(dir, "vendor/base.tokens.json"), JSON.stringify({
    md: { sys: { shape: { corner: { small: { $type: "dimension", $value: { value: 3, unit: "px" } } } } } },
  }));
  expect(run(dir).exitCode).toBe(0);
  expect(read(dir, "src/styles/tokens.css")).toContain("--md-sys-shape-corner-small: 3px;");
});

test("an unknown built-in include fails loudly", () => {
  const result = run(materialProject('"builtin:nope"'));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("Unknown built-in include builtin:nope");
});
