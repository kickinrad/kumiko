// A kit's hand-written design/theme.toml becomes DTCG 2025.10 token files that feed the build as layers.
import { expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import material from "../src/material.mjs";

const root = resolve(import.meta.dir, "..");
const command = process.env.TOKENS_BIN ? [resolve(process.env.TOKENS_BIN)] : ["bun", join(root, "bin/tokens.mjs")];
const run = (cwd: string, ...args: string[]) => Bun.spawnSync([...command, ...args], { cwd, stderr: "pipe" });
const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");
const json = (dir: string, file: string) => JSON.parse(read(dir, file));

// The fixture fills every Material colour role with ink, but primary.
const roles = Object.keys(material.tokens().md.sys.color).map((key) => `md.sys.color.${key}`);
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
${roles.map((role) => `"${role}" = "${role === "md.sys.color.primary" ? "blue" : "ink"}"`).join("\n")}

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

test("the default file holds the palette, the roles and the faces (brand and plain in Material's slots), colours as DTCG objects", () => {
  const dir = kitProject();
  run(dir);
  const file = read(dir, "design/tokens/theme.tokens.json");
  const blue = { colorSpace: "srgb", components: [0.4784, 0.6353, 0.9686], hex: "#7aa2f7" };
  const ink = { colorSpace: "srgb", components: [0.0627, 0.0784, 0.0941], hex: "#101418" };
  expect(JSON.parse(file)).toEqual({
    acme: {
      palette: { ink: { $type: "color", $value: ink }, blue: { $type: "color", $value: blue } },
      typeface: { mono: { $type: "fontFamily", $value: "Some Mono" } },
    },
    md: {
      ref: { typeface: { brand: { $type: "fontFamily", $value: "Some Sans" } } },
      sys: { color: Object.fromEntries(roles.map((role) => [role.split(".").at(-1),
        { $type: "color", $value: role === "md.sys.color.primary" ? blue : ink }])) },
    },
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

test("a role path through Object.prototype keys fails naming the path", () => {
  for (const role of ["constructor.prototype.primary", "md.__proto__.primary"]) {
    const result = run(kitProject(theme.replace('"md.sys.color.primary"', `"${role}"`)));
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(`theme.toml: role ${role}`);
    expect(result.stderr.toString()).toContain("is not a valid name");
  }
});

test("a palette colour named like an Object.prototype key fails instead of vanishing", () => {
  const result = run(kitProject(theme.replace('"md.sys.color.primary" = "blue"', '"md.sys.color.primary" = "toString"')));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("toString");
});

test("each media mode carries its own palette, and it reaches the media output", () => {
  const dir = kitProject();
  expect(run(dir).exitCode).toBe(0);
  const day = { colorSpace: "srgb", components: [0.1804, 0.4902, 0.9137], hex: "#2e7de9" };
  expect(json(dir, "design/tokens/theme.day.tokens.json").acme.palette.blue).toEqual({ $type: "color", $value: day });
  const css = read(dir, "src/styles/tokens.css");
  const media = css.slice(css.indexOf("@media (prefers-color-scheme: light)"));
  expect(media).toContain("--acme-palette-blue: #2e7de9;");
  expect(media).toContain("--acme-palette-ink: #f6f6f6;");
  expect(css.slice(0, css.indexOf("@media"))).toContain("--acme-palette-blue: #7aa2f7;");
});

test("a kit maps only the roles it picks; the others come from its other layers", () => {
  const dir = kitProject(theme.slice(0, theme.indexOf("[roles]")) + '[roles]\n"md.sys.color.primary" = "blue"\n\n' + theme.slice(theme.indexOf("[faces]")),
    'kit: { name: "acme" }, include: ["builtin:material"]');
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(Object.keys(json(dir, "design/tokens/theme.tokens.json").md.sys.color)).toEqual(["primary"]);
  expect(read(dir, "src/styles/tokens.css")).toContain("--md-sys-color-surface:");
});

test("a role may name one mode's colour, and [roles.<mode>] overrides a role in that mode", () => {
  const dir = kitProject(theme
    .replace('"md.sys.color.scrim" = "ink"', '"md.sys.color.scrim" = "night.ink"')
    .replace('"md.sys.color.inverse-surface" = "ink"', '"md.sys.color.inverse-surface" = "day.ink"')
    .replace("[faces]", '[roles.day]\n"md.sys.color.inverse-surface" = "night.ink"\n\n[faces]'));
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  const night = json(dir, "design/tokens/theme.tokens.json").md.sys.color;
  const day = json(dir, "design/tokens/theme.day.tokens.json").md.sys.color;
  expect([night.scrim.$value.hex, day.scrim.$value.hex]).toEqual(["#101418", "#101418"]);
  expect([night["inverse-surface"].$value.hex, day["inverse-surface"].$value.hex]).toEqual(["#f6f6f6", "#101418"]);
});

test("a role naming an unknown mode fails, and so does an override table for one", () => {
  const unknown = run(kitProject(theme.replace('"md.sys.color.scrim" = "ink"', '"md.sys.color.scrim" = "dusk.ink"')));
  expect(unknown.exitCode).toBe(1);
  expect(unknown.stderr.toString()).toContain("dusk");
  const table = run(kitProject(theme.replace("[faces]", '[roles.dusk]\n"md.sys.color.scrim" = "ink"\n\n[faces]')));
  expect(table.exitCode).toBe(1);
  expect(table.stderr.toString()).toContain("dusk");
});

test("a face may be a font stack", () => {
  const dir = kitProject(theme.replace('mono = "Some Mono"', 'mono = ["Some Mono", "monospace"]'));
  expect(run(dir).exitCode).toBe(0);
  expect(json(dir, "design/tokens/theme.tokens.json").acme.typeface.mono.$value).toEqual(["Some Mono", "monospace"]);
  expect(read(dir, "src/styles/tokens.css")).toContain("--acme-typeface-mono:");
});

test("a role may sit in the kit's own group, but not on a palette colour", () => {
  const own = kitProject(theme.replace("[faces]", '"acme.art.scrim" = "night.ink"\n\n[faces]'));
  expect(run(own).stderr.toString()).toBe("");
  expect(json(own, "design/tokens/theme.day.tokens.json").acme.art.scrim.$value.hex).toBe("#101418");
  const clash = run(kitProject(theme.replace("[faces]", '"acme.palette.ink" = "blue"\n\n[faces]')));
  expect(clash.exitCode).toBe(1);
  expect(clash.stderr.toString()).toContain("acme.palette.ink is defined twice");
});
