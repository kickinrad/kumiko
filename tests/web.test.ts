// The web targets: css pins a mode with `scheme` and carries Material's springs, and beer themes Beer CSS.
import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import beerCss from "beercss/dist/cdn/beer.css" with { type: "text" };
import material from "../src/material.mjs";
import { settle, springEasing } from "../src/motion.mjs";

const root = resolve(import.meta.dir, "..");
const command = process.env.TOKENS_BIN ? [resolve(process.env.TOKENS_BIN)] : ["bun", join(root, "bin/tokens.mjs")];
const run = (cwd: string, ...args: string[]) => Bun.spawnSync([...command, ...args], { cwd, stderr: "pipe" });
const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");
const golden = (file: string) => readFileSync(join(root, "tests/web/expected", file), "utf8");

const project = (config?: string) => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-web-"));
  cpSync(join(root, "tests/web/tokens"), join(dir, "tokens"), { recursive: true });
  cpSync(join(root, "tests/web/tokens.config.mjs"), join(dir, "tokens.config.mjs"));
  if (config) writeFileSync(join(dir, "tokens.config.mjs"), config);
  return dir;
};
const only = (target: string, options: string) => `export default {
  targets: ["${target}"], media: { "(prefers-color-scheme: light)": ["tokens/day.tokens.json"] },
  ${target}: ${options},
};\n`;

test("css with scheme names the base mode and lets data-theme pin either, byte-identical to the golden", () => {
  const dir = project(only("css", '{ path: "out/tokens.css", scheme: "dark" }'));
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(read(dir, "out/tokens.css")).toBe(golden("tokens.css"));
  expect(run(dir, "--check").exitCode).toBe(0);
});

test("css without scheme sets no colour scheme and leaves data-theme alone", () => {
  const dir = project(only("css", '{ path: "out/tokens.css" }'));
  expect(run(dir).exitCode).toBe(0);
  const css = read(dir, "out/tokens.css");
  expect(css).not.toMatch(/^\s*color-scheme:/m);
  expect(css).not.toContain("data-theme");
  expect(css).toContain("@media (prefers-color-scheme: light) {\n  :root {\n");
});

test("css emits each Material spring as an easing and a settle time when the tokens hold springs, and nothing otherwise", () => {
  const withScheme = only("css", '{ path: "out/tokens.css", scheme: "dark" }');
  const without = project(withScheme);
  run(without);
  expect(read(without, "out/tokens.css")).not.toMatch(/-easing|-settle/);

  const dir = project(withScheme);
  cpSync(join(root, "tests/web/springs.tokens.json"), join(dir, "tokens/springs.tokens.json"));
  expect(run(dir).exitCode).toBe(0);
  const css = read(dir, "out/tokens.css");
  const base = css.slice(0, css.indexOf("@media"));
  expect(base).toContain("--md-sys-motion-spring-snappy-spatial-damping: 0.8;");
  expect(base).toContain(`--md-sys-motion-spring-snappy-spatial-easing: ${springEasing(0.8, 380)};`);
  expect(base).toContain(`--md-sys-motion-spring-snappy-spatial-settle: ${settle(0.8, 380)}ms;`);
  expect(css.match(/-easing:/g)).toHaveLength(1);
});

test("beer sets Beer's system variables from Material and names the kit's two tokens, byte-identical to the golden", () => {
  const dir = project();
  expect(run(dir).exitCode).toBe(0);
  expect(read(dir, "out/beer.css")).toBe(golden("beer.css"));
  expect(run(dir, "--check").exitCode).toBe(0);
});

test("beer leaves Beer's own icon font and shadows when the options are absent", () => {
  const dir = project(only("beer", '{ path: "out/beer.css" }'));
  expect(run(dir).exitCode).toBe(0);
  const css = read(dir, "out/beer.css");
  expect(css).not.toMatch(/--font-icon|--elevate/);
  expect(css).toContain("--speed1: var(--md-sys-motion-duration-short2);");
});

test("beer names a token that does not exist, and fails", () => {
  const dir = project(only("beer", '{ path: "out/beer.css", iconFont: "acme.typeface.nope" }'));
  const result = run(dir);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("acme.typeface.nope");
});

// Beer's colour roles as the installed release declares them, read independently of the target.
const beerRoles = (css: string) => {
  const block = css.match(/:root,\s*body\.light\s*\{([^}]*)\}/)![1];
  return [...block.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]);
};

test("every colour role the installed Beer declares is set to Material's role of the same name", () => {
  const dir = project();
  run(dir);
  const set = new Map([...read(dir, "out/beer.css").matchAll(/^  --([a-z0-9-]+): (.+);$/gm)].map((m) => [m[1], m[2]]));
  const roles = beerRoles(beerCss);
  expect(roles.length).toBeGreaterThanOrEqual(36);
  // The vendored Material layer names every role but shadow, which a kit supplies at its Material path.
  const m3 = new Set([...Object.keys(material.tokens().md.sys.color), "shadow"]);
  for (const role of roles) {
    expect(set.get(role)).toBe(`var(--md-sys-color-${role})`);
    expect(m3.has(role), `md.sys.color.${role} is a Material role`).toBe(true);
  }
  expect(read(dir, "out/beer.css")).toMatch(/^:root, \[data-theme\], body\.light, body\.dark \{$/m);
});

test("Beer's rem is body-large, so its buttons are Material's: small XS 32, the default S 40, extra M 56", () => {
  const tokens = material.tokens().md;
  const px = (token: { $value: { value: number } }) => token.$value.value;
  const rem = px(tokens.sys.typescale["body-large"].size);
  const size = (selector: RegExp) => Number.parseFloat(beerCss.match(selector)![1]);
  expect(size(/\.button,\s*button \{[^}]*?--_size: ([0-9.]+)rem/) * rem).toBe(px(tokens.comp["button-small"]["container-height"]));
  expect(size(/:is\(button, \.button\)\.small \{[^}]*?--_size: ([0-9.]+)rem/) * rem).toBe(px(tokens.comp["button-xsmall"]["container-height"]));
  expect(size(/:is\(\.button, button\):is\(\.extra, \.extend\) \{[^}]*?--_size: ([0-9.]+)rem/) * rem).toBe(px(tokens.comp["button-medium"]["container-height"]));
});

test("material.css draws the rail's top space and gap, the hover layer and the segmented list from Material's tokens, typing no value", () => {
  const css = readFileSync(join(root, "src/web/material.css"), "utf8");
  for (const name of [
    "md-comp-navigation-rail-collapsed-top-space", "md-comp-navigation-rail-collapsed-item-vertical-space", "md-comp-navigation-rail-baseline-item-container-vertical-space", "md-sys-state-hover-state-layer-opacity",
    "md-comp-list-segmented-gap", "md-comp-list-item-one-line-container-height", "md-comp-list-item-container-expressive-shape",
    "md-comp-list-item-hovered-container-expressive-shape", "md-comp-list-item-selected-container-expressive-shape", "md-comp-list-item-selected-container-color",
    "md-comp-app-bar-small-container-height", "md-comp-app-bar-small-title-size", "md-comp-navigation-rail-collapsed-container-width",
    "md-comp-navigation-rail-expanded-container-width-minimum", "md-comp-navigation-rail-horizontal-item-active-indicator-height", "md-comp-navigation-rail-baseline-item-header-space-minimum",
    "md-sys-color-surface-container-low", "md-sys-shape-corner-large", "md-comp-list-item-leading-space", "md-comp-list-item-container-color",
  ]) expect(css).toContain(`var(--${name})`);
  expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/#[0-9a-f]{3,8}\b|\d(px|rem|ms)\b/i);
  const dir = project();
  run(dir);
  expect(read(dir, "out/beer.css")).toContain("var(--md-comp-list-segmented-gap)");
});

test("layout.css lays out Material's panes inside Beer's main with Material's guidance numbers, and ends the beer output", () => {
  const css = readFileSync(join(root, "src/web/layout.css"), "utf8");
  expect(css).toContain("main > .panes { display: grid;");
  // Material's breakpoints (compact under 600, expanded from 840, large from 1200), pane widths (360, 412), spacer (24) and margins (16, 24).
  for (const literal of ["(max-width: 839px)", "(min-width: 600px)", "(min-width: 840px)", "(min-width: 1200px)", "360px minmax(0, 1fr); gap: 24px;", "412px minmax(0, 1fr);", "--_padding: 16px;", "--_padding: 24px;"]) expect(css).toContain(literal);
  expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  const dir = project();
  run(dir);
  const out = read(dir, "out/beer.css");
  expect(out.indexOf("main > .panes > *")).toBeLessThan(out.indexOf("main > .panes { display: grid;"));
  expect(out.trimEnd().endsWith("412px minmax(0, 1fr); } }")).toBe(true);
});
