// The tailwind, compose-tv, obsidian and mealie outputs, built from a small kit (tests/outputs/) with a design/theme.toml.
import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const command = process.env.TOKENS_BIN ? [resolve(process.env.TOKENS_BIN)] : ["bun", join(root, "bin/tokens.mjs")];
const run = (cwd: string, ...args: string[]) => Bun.spawnSync([...command, ...args], { cwd, stderr: "pipe" });
const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");
const golden = join(root, "tests/outputs/expected");
const files = (dir: string, at = ""): string[] => readdirSync(join(dir, at)).flatMap((entry) =>
  statSync(join(dir, at, entry)).isDirectory() ? files(dir, join(at, entry)) : [join(at, entry)]);
const outputs = files(golden);

const project = () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-outputs-"));
  for (const entry of ["design", "tokens", "VERSION", "tokens.config.mjs"]) cpSync(join(root, "tests/outputs", entry), join(dir, entry), { recursive: true });
  return dir;
};
// The fixture's config with `edit` applied to a copy of its options.
const edited = (edit: string) => {
  const dir = project();
  renameSync(join(dir, "tokens.config.mjs"), join(dir, "base.config.mjs"));
  writeFileSync(join(dir, "tokens.config.mjs"), `import base from "./base.config.mjs";\nconst c = structuredClone(base);\n${edit}\nexport default c;\n`);
  return dir;
};

test("builds the four outputs, byte-identical to the golden", () => {
  const dir = project();
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(outputs.length).toBe(11);
  for (const file of outputs) expect(read(dir, file)).toBe(read(golden, file));
});

test("--check passes on a fresh build and fails on a stale file", () => {
  const dir = project();
  run(dir);
  expect(run(dir, "--check").exitCode).toBe(0);
  writeFileSync(join(dir, "ports/mealie/acme.env"), `${read(dir, "ports/mealie/acme.env")}# edit\n`);
  expect(run(dir, "--check").stderr.toString()).toContain("ports/mealie/acme.env is stale");
});

test("tailwind: one @theme inline block, every value a variable of the kit's runtime CSS, in the kit's namespaces", () => {
  const css = read(golden, "ports/tailwind/acme.css");
  expect((css.match(/^@theme inline \{$/gm) ?? []).length).toBe(1);
  const theme = new Map([...css.matchAll(/^  --([a-z0-9-]+): (.+);$/gm)].map((m) => [m[1], m[2]]));
  for (const [name, value] of theme) expect(value, name).toMatch(/^var\(--[a-z0-9-]+\)$/);
  expect(theme.get("color-primary")).toBe("var(--md-sys-color-primary)");
  expect(theme.get("color-yellow-container") ?? theme.get("color-yellow")).toBe("var(--acme-color-yellow)");
  expect(theme.get("font-mono")).toBe("var(--acme-typeface-mono)");
  expect(theme.get("font-icon")).toBe("var(--acme-typeface-icon)");
  expect(theme.get("text-label-large--line-height")).toBe("var(--md-sys-typescale-label-large-line-height)");
  expect(theme.get("radius-medium")).toBe("var(--md-sys-shape-corner-medium)");
  expect(theme.has("radius-extra-large-top")).toBe(false);
  expect(theme.get("default-transition-duration")).toBe("var(--md-sys-motion-duration-short3)");
  expect(css).toContain('the kit\'s ports/css/acme.css');
});

test("obsidian: a snippet per mode, the slots and the interactive accent from the roles, the mono face from the kit", () => {
  const night = read(golden, "ports/obsidian/acme-night.css");
  const day = read(golden, "ports/obsidian/acme-day.css");
  expect(night).toContain("body.theme-dark {");
  expect(day).toContain("body.theme-light {");
  expect(night).toContain("--color-blue: #7aa2f7;");
  expect(night).toContain("--color-pink: #73daca;");
  expect(night).toContain("--tx3: #adadad;");
  expect(day).toContain("--accent-h: 215;");
  expect(night).toContain("--font-monospace-theme: 'Some Mono', monospace;");
});

test("compose-tv: the package, five files, no Shapes, a font per face and the kit's layout", () => {
  const read2 = (f: string) => read(golden, `ports/compose-tv/${f}`);
  for (const f of ["Color.kt", "Type.kt", "Shape.kt", "Tokens.kt", "Motion.kt"]) expect(read2(f)).toContain("package com.example.acme\n");
  expect(read2("Color.kt")).toMatch(/^val primaryDark = Color\(0xFF7AA2F7\)$/m);
  expect(read2("Color.kt")).toMatch(/^val domainLightContainerLight = Color\(0xFF8C6C3E\)$/m);
  expect(read2("Type.kt")).toMatch(/^val SomeSans = FontFamily\($/m);
  expect(read2("Type.kt")).toMatch(/^val SomeMono = FontFamily\($/m);
  expect(read2("Type.kt")).toMatch(/^val AcmeKitTypography = Typography\($/m);
  expect(read2("Type.kt")).toMatch(/labelLarge = TextStyle\(\s*\n\s*fontFamily = SomeMono,/);
  expect(read2("Shape.kt")).toMatch(/^val CornerMedium = 12\.dp$/m);
  expect(read2("Tokens.kt")).toMatch(/^val SafeMargin = 58\.dp$/m);
  expect(read2("Motion.kt")).toMatch(/^object Motion \{/m);
});

test("mealie: an env file without a header and an overlay with the engine's", () => {
  const env = read(golden, "ports/mealie/acme.env");
  const css = read(golden, "ports/mealie/acme.css");
  expect(env).toContain("THEME_DARK_PRIMARY=#7dcfff");
  expect(env.split("\n")[0]).toStartWith("# Acme for Mealie.");
  expect(css.split("\n")[0]).toStartWith("/* Generated by kumiko");
  expect(css).toContain('href="/acme.css"');
  expect(css).toContain("html .v-theme--dark {");
});

test.each([
  ["tailwind", "path", "delete c.tailwind.path;"],
  ["tailwind", "css", "delete c.tailwind.css;"],
  ["obsidian", "out", "delete c.obsidian.out;"],
  ["obsidian", "modes", "delete c.obsidian.modes;"],
  ["compose-tv", "out", 'delete c["compose-tv"].out;'],
  ["compose-tv", "package", 'delete c["compose-tv"].package;'],
  ["mealie", "out", "delete c.mealie.out;"],
  ["mealie", "modes", "delete c.mealie.modes;"],
  ["mealie", "palette", "delete c.mealie.palette;"],
  ["material-you", "path", 'delete c["material-you"].path;'],
])("%s: a missing %s fails, naming it", (output, option, edit) => {
  const result = run(edited(edit));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain(`${output} option "${option}" is required`);
});

test("material-you: every Material colour role in both modes, then the kit's own values and no palette", () => {
  const dir = project();
  run(dir);
  const file = read(dir, "ports/home-assistant/acme.css");
  const roles = file.slice(file.indexOf(":host, html, body, ha-card {"), file.indexOf("html {"));
  expect(roles).toMatch(/--md-sys-color-primary-light: rgb\(\d+ \d+ \d+\);/);
  expect(roles).toMatch(/--md-sys-color-primary-dark: rgb\(\d+ \d+ \d+\);/);
  expect(roles).not.toContain("--acme-");
  const shared = file.slice(file.indexOf("html {"));
  expect(shared).toContain("--md-sys-shape-corner-medium:");
  expect(shared).toContain("--acme-");
  expect(shared).not.toContain("--acme-palette-");
  expect(shared).not.toMatch(/^  --md-sys-color-/m);
});

test("mealie: a palette colour the kit lacks fails, naming it", () => {
  const result = run(edited('c.mealie.palette.stars = "chartreuse";'));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain('has no colour "chartreuse"');
});

test("an output without a declared kit fails, saying so", () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-outputs-"));
  cpSync(join(root, "tests/outputs/tokens"), join(dir, "tokens"), { recursive: true });
  writeFileSync(join(dir, "tokens/own.tokens.json"), JSON.stringify({ own: { gap: { $type: "dimension", $value: { value: 4, unit: "px" } } } }));
  writeFileSync(join(dir, "tokens.config.mjs"), 'export default { targets: ["tailwind"], tailwind: { path: "a.css", css: "b.css" } };\n');
  const result = run(dir);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("needs a declared kit");
});

test("the engine holds no kit: src/ names no house, and carries no palette hex", () => {
  const sources = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sources(join(dir, entry.name)) : [join(dir, entry.name)]);
  const house = /tokyo/i;
  const hex = /#(?!(?:fff|000)(?:fff|000)?\b)[0-9a-fA-F]{6}\b/;
  for (const file of sources(join(root, "src"))) {
    const text = readFileSync(file, "utf8");
    expect(text, file).not.toMatch(house);
    expect(text, file).not.toMatch(hex);
  }
});
