// `kumiko audit` on a kit: the sample kit (tests/playground/ with tests/render.theme.toml, a complete theme) passes in
// headless Chrome; a page that breaks a rule fails, naming it. Needs Chrome (`kumiko audit` finds it).
import { expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root, run } from "./helpers";

const kit = () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-render-"));
  for (const entry of ["design", "tokens", "VERSION", "kumiko.config.mjs"]) cpSync(join(root, "tests/playground", entry), join(dir, entry), { recursive: true });
  cpSync(join(root, "tests/render.theme.toml"), join(dir, "design/theme.toml"));
  // The project's own example: an entry with one capture (a 1×1 PNG).
  mkdirSync(join(dir, "preview"));
  writeFileSync(join(dir, "preview/example.json"), '{ "name": "Home", "surface": "A dashboard", "captures": [{ "src": "home.png", "label": "Home, Night" }] }');
  writeFileSync(join(dir, "preview/home.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPgPAAEDAQAIicLsAAAAAElFTkSuQmCC", "base64"));
  const config = join(dir, "kumiko.config.mjs");
  writeFileSync(config, readFileSync(config, "utf8").replace('playground: { path: "docs/play" }', 'playground: { path: "docs/play", examples: ["preview/example.json"] }'));
  expect(run(dir).stderr.toString()).toBe("");
  return dir;
};

test("kumiko audit passes the sample kit's playground: every destination and item, its example included, both modes, desktop and phone, under a host reset", () => {
  const result = run(kit(), "audit");
  expect(result.stdout.toString()).toBe("");
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
}, 120_000);

test("kumiko audit fails a page that breaks a rule or misses a file, naming the text or the file, the mode and the size", () => {
  const dir = kit();
  // A primary that reads under 4.5:1 as text on the Day surfaces, and an example's capture that is not there.
  const theme = join(dir, "design/theme.toml");
  writeFileSync(theme, readFileSync(theme, "utf8").replace('blue = "#174ea6"', 'blue = "#5b8def"'));
  rmSync(join(dir, "preview/home.png"));
  expect(run(dir).exitCode).toBe(0);
  const result = run(dir, "audit");
  expect(result.exitCode).toBe(1);
  expect(result.stdout.toString()).toMatch(/^1280px day #components\/button: contrast \d\.\d\d:1 .*: span "text"$/m);
  expect(result.stdout.toString()).toMatch(/^1280px: file:\S+\/preview\/home\.png failed/m);
  expect(run(dir, "audit", "nowhere").stderr.toString()).toContain("kumiko audit: no playground at");
}, 120_000);
