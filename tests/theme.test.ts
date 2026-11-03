// A kit's hand-written design/theme.toml becomes token layers in memory: nothing is written beside it.
import { expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import material from "../src/material.mjs";
import { command, read, root, run } from "./helpers";


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

// A kit project on Material, with one token file of its own; the kit's root is design/.
const kitProject = (toml: string | null = theme, config = 'kit: { name: "acme" }, include: ["builtin:material"]') => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-theme-"));
  mkdirSync(join(dir, "tokens"));
  mkdirSync(join(dir, "design"));
  writeFileSync(join(dir, "tokens/own.tokens.json"),
    JSON.stringify({ own: { gap: { $type: "dimension", $value: { value: 4, unit: "px" } } } }));
  writeFileSync(join(dir, "VERSION"), "1.0.0\n");
  writeFileSync(join(dir, "kumiko.config.mjs"), `export default { targets: ["css"], ${config} };\n`);
  if (toml !== null) writeFileSync(join(dir, "design/theme.toml"), toml);
  return dir;
};

// The css output's base block and its one media block.
const blocks = (dir: string) => {
  const css = read(dir, "src/styles/tokens.css");
  return { base: css.slice(0, css.indexOf("@media")), day: css.slice(css.indexOf("@media (prefers-color-scheme: light)")) };
};
// Only what the build writes: the css output, nothing beside theme.toml.
const written = (dir: string) => new Bun.Glob("**/*").scanSync(dir).toArray().sort();

test("a kit with a theme.toml builds, writing only its outputs", () => {
  const dir = kitProject();
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(written(dir)).toEqual(["VERSION", "design/theme.toml", "kumiko.config.mjs", "src/styles/tokens.css", "tokens/own.tokens.json"]);
  const css = read(dir, "src/styles/tokens.css");
  expect(css).toContain("--md-sys-color-primary: #7aa2f7;");
  expect(css).toContain("--acme-palette-ink: #101418;");
  expect(css).toContain("--own-gap: 4px;");
  expect(css).toContain("Some Sans");
});

test("the base mode holds the palette, the roles and the faces, brand and plain in Material's slots", () => {
  const dir = kitProject();
  run(dir);
  const { base } = blocks(dir);
  expect(base).toContain("--acme-palette-blue: #7aa2f7;");
  expect(base).toContain("--md-sys-color-surface: #101418;");
  expect(base).toContain("--md-ref-typeface-brand: 'Some Sans';");
  expect(base).toContain("--acme-typeface-mono: 'Some Mono';");
});

test("a media mode holds that mode's role values", () => {
  const dir = kitProject();
  run(dir);
  const { day } = blocks(dir);
  expect(day).toContain("--md-sys-color-primary: #2e7de9;");
  expect(day).toContain("--md-sys-color-surface: #f6f6f6;");
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
  expect(existsSync(join(dir, "src"))).toBe(false);
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

test("the outputs pass --check, and a changed theme.toml makes them stale", () => {
  const dir = kitProject();
  expect(run(dir).exitCode).toBe(0);
  const result = run(dir, "--check");
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  writeFileSync(join(dir, "design/theme.toml"), theme.replace("#2e7de9", "#2e7de8"));
  const stale = run(dir, "--check");
  expect(stale.exitCode).toBe(1);
  expect(stale.stderr.toString()).toContain("src/styles/tokens.css is stale");
});

test("a kit with no theme.toml builds from its token files", () => {
  const dir = kitProject(null, 'kit: { name: "acme" }');
  expect(run(dir).exitCode).toBe(0);
  expect(read(dir, "src/styles/tokens.css")).toContain("--own-gap: 4px;");
});

test("without a kit a theme.toml is ignored and the golden outputs are byte-identical", () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-theme-golden-"));
  cpSync(join(root, "tests/fixture"), dir, { recursive: true });
  mkdirSync(join(dir, "design"));
  writeFileSync(join(dir, "design/theme.toml"), theme);
  expect(run(dir).exitCode).toBe(0);
  for (const file of ["src/styles/tokens.css", "DESIGN.md"]) {
    expect(read(dir, file)).toBe(read(join(root, "tests/expected"), file));
  }
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

test("each media mode carries its own palette", () => {
  const dir = kitProject();
  expect(run(dir).exitCode).toBe(0);
  const { base, day } = blocks(dir);
  expect(day).toContain("--acme-palette-blue: #2e7de9;");
  expect(day).toContain("--acme-palette-ink: #f6f6f6;");
  expect(base).toContain("--acme-palette-blue: #7aa2f7;");
});

test("a kit maps only the roles it picks; the others are Material's", () => {
  const dir = kitProject(theme.slice(0, theme.indexOf("[roles]")) + '[roles]\n"md.sys.color.primary" = "blue"\n\n' + theme.slice(theme.indexOf("[faces]")));
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(blocks(dir).base).toMatch(/--md-sys-color-surface: #(?!101418)[0-9a-f]{6};/);
  expect(blocks(dir).base).toContain("--md-sys-color-primary: #7aa2f7;");
});

test("a role may name one mode's colour, and [roles.<mode>] overrides a role in that mode", () => {
  const dir = kitProject(theme
    .replace('"md.sys.color.scrim" = "ink"', '"md.sys.color.scrim" = "night.ink"')
    .replace('"md.sys.color.inverse-surface" = "ink"', '"md.sys.color.inverse-surface" = "day.ink"')
    .replace("[faces]", '[roles.day]\n"md.sys.color.inverse-surface" = "night.ink"\n\n[faces]'));
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  const { base, day } = blocks(dir);
  expect(base).toContain("--md-sys-color-scrim: #101418;");
  // A value the same in both modes is set once.
  expect(day).not.toContain("--md-sys-color-scrim:");
  expect(base).toContain("--md-sys-color-inverse-surface: #f6f6f6;");
  expect(day).toContain("--md-sys-color-inverse-surface: #101418;");
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
  expect(read(dir, "src/styles/tokens.css")).toContain("--acme-typeface-mono: 'Some Mono', monospace;");
});

test("a role may sit in the kit's own group, but not on a palette colour", () => {
  const own = kitProject(theme.replace("[faces]", '"acme.art.scrim" = "night.ink"\n\n[faces]'));
  expect(run(own).stderr.toString()).toBe("");
  expect(blocks(own).base).toContain("--acme-art-scrim: #101418;");
  expect(blocks(own).day).not.toContain("--acme-art-scrim:");
  const clash = run(kitProject(theme.replace("[faces]", '"acme.palette.ink" = "blue"\n\n[faces]')));
  expect(clash.exitCode).toBe(1);
  expect(clash.stderr.toString()).toContain("acme.palette.ink is defined twice");
});

test("without Material, a Material colour role nothing sets fails naming it", () => {
  const dir = kitProject(theme.slice(0, theme.indexOf("[roles]")) + '[roles]\n"md.sys.color.primary" = "blue"\n\n' + theme.slice(theme.indexOf("[faces]")), 'kit: { name: "acme" }');
  const result = run(dir);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("md.sys.color.surface");
  expect(result.stderr.toString()).not.toContain("md.sys.color.primary,");
});

test("a reference with more than one dot fails naming the role and the value", () => {
  const result = run(kitProject(theme.replace('"md.sys.color.scrim" = "ink"', '"md.sys.color.scrim" = "night.ink.typo"')));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("md.sys.color.scrim");
  expect(result.stderr.toString()).toContain("night.ink.typo");
});

test("an override of an inherited key like toString is not a mapped role", () => {
  const result = run(kitProject(theme.replace("[faces]", '[roles.day]\n"toString" = "ink"\n\n[faces]')));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("toString, which [roles] doesn't set");
});

test("[tokens] values reach the outputs, typed by their unit, and an md. path carries its why", () => {
  const dir = kitProject(`${theme}
[tokens]
"acme.layout.gap" = "8px"
"acme.motion.quick" = "120ms"
"acme.art.dim" = 0.6
"acme.hero.weight" = { value = 600, type = "fontWeight" }
"acme.hero" = { aspect = "12 / 5" }
"md.sys.typescale.label-small.size" = { value = "12px", why = "The system floor" }
`);
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  const { base } = blocks(dir);
  for (const line of ["--acme-layout-gap: 8px;", "--acme-motion-quick: 120ms;", "--acme-art-dim: 0.6;", "--acme-hero-weight: 600;", "--acme-hero-aspect: 12 / 5;", "--md-sys-typescale-label-small-size: 12px;"]) expect(base).toContain(line);
});

test.each([
  ["an md. path without a why", '"md.sys.typescale.label-small.size" = "12px"', "[tokens] md.sys.typescale.label-small.size changes a Material value, so it needs a why"],
  ["an unknown unit", '"acme.gap" = "8pt"', '[tokens] acme.gap: unknown unit "pt" in 8pt'],
  ["a list without a type", '"acme.stack" = ["A", "B"]', "[tokens] acme.stack: a list needs a type"],
  ["an unknown type", '"acme.gap" = { value = 8, type = "size" }', '[tokens] acme.gap: type "size" is not one of'],
  ["an unknown key", '"acme.gap" = { value = 8, note = "x" }', '[tokens] acme.gap: unknown key "note"'],
  ["a boolean", '"acme.flag" = true', "[tokens] acme.flag: a value is an alias, a length, a time, a number, a string or a list"],
])("[tokens] with %s fails, naming it", (_, line, message) => {
  const result = run(kitProject(`${theme}\n[tokens]\n${line}\n`));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain(message);
});

test("a title or icon that is not a name fails, naming it", () => {
  for (const [line, key] of [["title = 7", "title"], ['icon = ""', "icon"]]) {
    const result = run(kitProject(theme.replace('name = "acme"\n', `name = "acme"\n${line}\n`)));
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(`theme.toml: ${key} must be a non-empty string`);
  }
});
