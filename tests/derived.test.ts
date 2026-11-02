// The derived roles: on-colours, accent containers, fixed roles and group marks, from theme.toml's [derived],
// computed in memory and read by every output, as the css output shows.
import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { read, root, run } from "./helpers";

const project = () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-derived-"));
  cpSync(join(root, "tests/derived"), dir, { recursive: true });
  return dir;
};
// The fixture with `edit` applied to the text of its theme.toml.
const themed = (edit: (toml: string) => string) => {
  const dir = project();
  writeFileSync(join(dir, "design/theme.toml"), edit(read(dir, "design/theme.toml")));
  return dir;
};
// The accent and derived lines of the css output, in both modes.
const roles = (css: string) => css.split("\n").filter((line) => /^\s*--(md-sys-color-(on-)?(primary|secondary|tertiary|error)|acme-color-)|^\S.*\{$/.test(line)).join("\n");

test("the derived roles in both modes, as the golden", () => {
  const dir = project();
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(`${roles(read(dir, "tokens.css"))}\n`).toBe(read(root, "tests/derived/expected/roles.css"));
});

test("nothing derived is written: the build writes only its outputs", () => {
  const dir = project();
  run(dir);
  expect(new Bun.Glob("**/*.tokens.json").scanSync(dir).toArray()).toEqual([]);
});

test("after a palette change one run is final", () => {
  const dir = project();
  expect(run(dir).exitCode).toBe(0);
  writeFileSync(join(dir, "design/theme.toml"), read(dir, "design/theme.toml").replace('blue = "#7aa2f7"', 'blue = "#f7768e"'));
  expect(run(dir).exitCode).toBe(0);
  expect(read(dir, "tokens.css")).toContain("--md-sys-color-primary-fixed-dim: #f7768e;");
  const again = run(dir, "--check");
  expect(again.stderr.toString()).toBe("");
  expect(again.exitCode).toBe(0);
});

test.each([
  ["container-opacity", (t: string) => t.replace("container-opacity = 0.12\n", ""), "[derived] container-opacity must be a fraction between 0 and 1"],
  ["marks.group", (t: string) => t.replace('group = "track", ', ""), "[derived] marks.group must be a non-empty string"],
  ["an unknown key", (t: string) => t.replace("[derived]\n", "[derived]\nprefix = \"acme\"\n"), '[derived]: unknown key "prefix"'],
])("[derived] without %s fails, naming it", (_, edit, message) => {
  const result = run(themed(edit));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain(message);
});
