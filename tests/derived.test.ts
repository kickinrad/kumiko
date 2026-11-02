// The derived target: on-colours, accent containers, fixed roles and group marks, all from the config's options.
import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { command, read, root, run } from "./helpers";

const outputs = ["tokens/derived.tokens.json", "tokens/derived-day.tokens.json"];

const project = () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-derived-"));
  cpSync(join(root, "tests/derived/tokens"), join(dir, "tokens"), { recursive: true });
  cpSync(join(root, "tests/derived/tokens.config.mjs"), join(dir, "tokens.config.mjs"));
  return dir;
};
// The fixture's config with `edit` applied to its derived options (a copy it can delete from).
const edited = (edit: string) => {
  const dir = project();
  renameSync(join(dir, "tokens.config.mjs"), join(dir, "base.config.mjs"));
  writeFileSync(join(dir, "tokens.config.mjs"),
    `import base from "./base.config.mjs";\nconst d = structuredClone(base.derived);\n${edit}\nexport default { ...base, derived: d };\n`);
  return dir;
};

test("builds the night and day files, byte-identical to the golden", () => {
  const dir = project();
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  for (const file of outputs) expect(read(dir, file)).toBe(read(join(root, "tests/derived/expected"), file));
});

test("the outputs feed back into the build, and --check passes on them", () => {
  const dir = project();
  run(dir);
  const again = run(dir, "--check");
  expect(again.stderr.toString()).toBe("");
  expect(again.exitCode).toBe(0);
});

test("after a palette change one run is final: the outputs read this run's derived roles", () => {
  const dir = project();
  renameSync(join(dir, "tokens.config.mjs"), join(dir, "base.config.mjs"));
  writeFileSync(join(dir, "tokens.config.mjs"), 'import base from "./base.config.mjs";\nexport default { ...base, targets: ["derived", "css"] };\n');
  expect(run(dir).exitCode).toBe(0);
  writeFileSync(join(dir, "tokens/base.tokens.json"), read(dir, "tokens/base.tokens.json").replace("#7aa2f7", "#f7768e"));
  expect(run(dir).exitCode).toBe(0);
  const again = run(dir, "--check");
  expect(again.stderr.toString()).toBe("");
  expect(again.exitCode).toBe(0);
});

test("a declared kit supplies the prefix", () => {
  const dir = edited("delete d.prefix;");
  writeFileSync(join(dir, "VERSION"), "1.0.0\n");
  writeFileSync(join(dir, "tokens.config.mjs"), read(dir, "tokens.config.mjs").replace("export default {", 'export default { kit: { name: "acme" },'));
  expect(run(dir).exitCode).toBe(0);
  expect(JSON.parse(read(dir, "tokens/derived.tokens.json")).acme.color["on-amber"]).toBeDefined();
});

test.each([
  ["prefix", "delete d.prefix;"],
  ["accents", "delete d.accents;"],
  ["blend", "delete d.blend;"],
  ["out.night", "delete d.out.night;"],
  ["out.day", "delete d.out.day;"],
  ["marks.group", "delete d.marks.group;"],
])("a missing %s fails, naming it", (name, edit) => {
  const result = run(edited(edit));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain(`derived option "${name}"`);
});
