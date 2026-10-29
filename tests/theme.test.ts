// A kit's hand-written design/theme.toml becomes DTCG 2025.10 token files that feed the build as layers.
import { expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const command = process.env.TOKENS_BIN ? [resolve(process.env.TOKENS_BIN)] : ["bun", join(root, "bin/tokens.mjs")];
const run = (cwd: string, ...args: string[]) => Bun.spawnSync([...command, ...args], { cwd, stderr: "pipe" });
const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");
const json = (dir: string, file: string) => JSON.parse(read(dir, file));

const theme = `name = "acme"
default = "night"

[media]
day = "(prefers-color-scheme: light)"

[palette.night]
ink = "#101418"
blue = "#7aa2f7"

[palette.day]
ink = "#f6f6f6"
blue = "#2e7de9"

[roles]
"md.sys.color.surface" = "ink"
"md.sys.color.primary" = "blue"

[faces]
brand = "Some Sans"
mono = "Some Mono"
`;

// A kit project: tokens/ needs one file of its own; the kit's root is design/.
const kitProject = (toml: string | null = theme, config = 'kit: { name: "acme" }') => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-theme-"));
  mkdirSync(join(dir, "tokens"));
  mkdirSync(join(dir, "design"));
  writeFileSync(join(dir, "tokens/own.tokens.json"),
    JSON.stringify({ own: { gap: { $type: "dimension", $value: { value: 4, unit: "px" } } } }));
  writeFileSync(join(dir, "VERSION"), "1.0.0\n");
  writeFileSync(join(dir, "tokens.config.mjs"), `export default { targets: ["css"], ${config} };\n`);
  if (toml !== null) writeFileSync(join(dir, "design/theme.toml"), toml);
  return dir;
};

test("a kit with a theme.toml builds, writing the default and each media mode's tokens", () => {
  const dir = kitProject();
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(existsSync(join(dir, "design/tokens/theme.tokens.json"))).toBe(true);
  expect(existsSync(join(dir, "design/tokens/theme.day.tokens.json"))).toBe(true);
  const css = read(dir, "src/styles/tokens.css");
  expect(css).toContain("--md-sys-color-primary: #7aa2f7;");
  expect(css).toContain("--acme-palette-ink: #101418;");
  expect(css).toContain("--own-gap: 4px;");
  expect(css).toContain("Some Sans");
});

test("the default file holds the palette, every role and the faces, colours as DTCG objects", () => {
  const dir = kitProject();
  run(dir);
  const file = read(dir, "design/tokens/theme.tokens.json");
  const blue = { colorSpace: "srgb", components: [0.4784, 0.6353, 0.9686], hex: "#7aa2f7" };
  const ink = { colorSpace: "srgb", components: [0.0627, 0.0784, 0.0941], hex: "#101418" };
  expect(JSON.parse(file)).toEqual({
    acme: {
      palette: { ink: { $type: "color", $value: ink }, blue: { $type: "color", $value: blue } },
      font: {
        brand: { $type: "fontFamily", $value: "Some Sans" },
        mono: { $type: "fontFamily", $value: "Some Mono" },
      },
    },
    md: { sys: { color: {
      surface: { $type: "color", $value: ink },
      primary: { $type: "color", $value: blue },
    } } },
  });
  expect(file).toBe(`${JSON.stringify(JSON.parse(file), null, 2)}\n`);
});

test("a media mode's file holds that mode's role values, and they reach the media output", () => {
  const dir = kitProject();
  run(dir);
  const day = { colorSpace: "srgb", components: [0.1804, 0.4902, 0.9137], hex: "#2e7de9" };
  expect(json(dir, "design/tokens/theme.day.tokens.json").md.sys.color.primary).toEqual({ $type: "color", $value: day });
  const css = read(dir, "src/styles/tokens.css");
  const media = css.slice(css.indexOf("@media (prefers-color-scheme: light)"));
  expect(media).toContain("--md-sys-color-primary: #2e7de9;");
  expect(media).toContain("--md-sys-color-surface: #f6f6f6;");
});

test("the project's own tokens override the theme's default layer", () => {
  const dir = kitProject();
  writeFileSync(join(dir, "tokens/own.tokens.json"), JSON.stringify({
    md: { sys: { color: { primary: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" } } } } },
  }));
  expect(run(dir).exitCode).toBe(0);
  const css = read(dir, "src/styles/tokens.css");
  expect(css.slice(0, css.indexOf("@media"))).toContain("--md-sys-color-primary: #ff0000;");
});

test("a role naming a colour the mode's palette lacks fails naming role, colour and mode", () => {
  const dir = kitProject(theme.replace('ink = "#f6f6f6"\nblue', 'ink = "#f6f6f6"\nteal'));
  const result = run(dir);
  expect(result.exitCode).toBe(1);
  const message = result.stderr.toString();
  expect(message).toContain("md.sys.color.primary");
  expect(message).toContain("blue");
  expect(message).toContain("day");
  expect(existsSync(join(dir, "design/tokens/theme.tokens.json"))).toBe(false);
});

test("a colour that is not a six-digit hex fails naming it", () => {
  const result = run(kitProject(theme.replace("#7aa2f7", "blue")));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("night.blue");
});

test("a mode without a media query, or a default without a palette, fails", () => {
  const noQuery = run(kitProject(theme.replace('day = "(prefers-color-scheme: light)"', "")));
  expect(noQuery.exitCode).toBe(1);
  expect(noQuery.stderr.toString()).toContain("day");
  const noDefault = run(kitProject(theme.replace('default = "night"', 'default = "dusk"')));
  expect(noDefault.exitCode).toBe(1);
  expect(noDefault.stderr.toString()).toContain("dusk");
});

test("theme.toml's name must match the config's kit name", () => {
  const result = run(kitProject(theme.replace('name = "acme"', 'name = "other"')));
  expect(result.exitCode).toBe(1);
  const message = result.stderr.toString();
  expect(message).toContain("acme");
  expect(message).toContain("other");
});

test("the generated files pass --check, schema included, and a hand edit is stale", () => {
  const dir = kitProject();
  expect(run(dir).exitCode).toBe(0);
  const result = run(dir, "--check");
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  writeFileSync(join(dir, "design/tokens/theme.day.tokens.json"), "{}\n");
  const stale = run(dir, "--check");
  expect(stale.exitCode).toBe(1);
  expect(stale.stderr.toString()).toContain("design/tokens/theme.day.tokens.json is stale");
});

test("--check on a kit never writes the theme files", () => {
  const dir = kitProject();
  const result = run(dir, "--check");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("design/tokens/theme.tokens.json is stale");
  expect(existsSync(join(dir, "design/tokens"))).toBe(false);
});

test("a kit with no theme.toml builds as before", () => {
  const dir = kitProject(null);
  expect(run(dir).exitCode).toBe(0);
  expect(existsSync(join(dir, "design/tokens"))).toBe(false);
  expect(read(dir, "src/styles/tokens.css")).toContain("--own-gap: 4px;");
});

test("without a kit a theme.toml is ignored and the golden outputs are byte-identical", () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-theme-golden-"));
  cpSync(join(root, "tests/fixture"), dir, { recursive: true });
  mkdirSync(join(dir, "design"));
  writeFileSync(join(dir, "design/theme.toml"), theme);
  expect(run(dir).exitCode).toBe(0);
  for (const file of ["src/styles/tokens.css", "theme.json", "DESIGN.md"]) {
    expect(read(dir, file)).toBe(read(join(root, "tests/expected"), file));
  }
  expect(existsSync(join(dir, "design/tokens"))).toBe(false);
});
