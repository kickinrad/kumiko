// `tokens audit` on a kit: the sample kit (tests/playground/ with tests/render.theme.toml, a complete theme) passes in
// headless Chrome; a page that breaks a rule fails, naming it. Needs Chrome (`tokens audit` finds it).
import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root, run } from "./helpers";

const kit = () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-render-"));
  for (const entry of ["design", "tokens", "VERSION", "tokens.config.mjs"]) cpSync(join(root, "tests/playground", entry), join(dir, entry), { recursive: true });
  cpSync(join(root, "tests/render.theme.toml"), join(dir, "design/theme.toml"));
  expect(run(dir).stderr.toString()).toBe("");
  return dir;
};

test("tokens audit passes the sample kit's playground: every destination and item, both modes, desktop and phone, under a host reset", () => {
  const result = run(kit(), "audit");
  expect(result.stdout.toString()).toBe("");
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
}, 120_000);

test("tokens audit fails a page that breaks a rule, naming the text, the mode and the size", () => {
  const dir = kit();
  // A primary that reads under 4.5:1 as text on the Day surfaces.
  const theme = join(dir, "design/theme.toml");
  writeFileSync(theme, readFileSync(theme, "utf8").replace('blue = "#174ea6"', 'blue = "#5b8def"'));
  expect(run(dir).exitCode).toBe(0);
  const result = run(dir, "audit");
  expect(result.exitCode).toBe(1);
  expect(result.stdout.toString()).toMatch(/^1280px day #components\/button: contrast \d\.\d\d:1 .*: span "text"$/m);
  expect(run(dir, "audit", "nowhere").stderr.toString()).toContain("tokens audit: no playground at");
}, 120_000);
