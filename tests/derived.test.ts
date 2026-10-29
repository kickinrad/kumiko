// The derived target: on-colours, accent containers, fixed roles and group marks, all from the config's options.
import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const command = process.env.TOKENS_BIN ? [resolve(process.env.TOKENS_BIN)] : ["bun", join(root, "bin/tokens.mjs")];
const run = (cwd: string, ...args: string[]) => Bun.spawnSync([...command, ...args], { cwd, stderr: "pipe" });
const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");
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
    `import base from "./base.config.mjs";\nconst d = structuredClone({ ...base.derived, descriptions: undefined });\n${edit}\nexport default { ...base, derived: d };\n`);
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
  ["dayFiles", "delete d.dayFiles;"],
  ["out.night", "delete d.out.night;"],
  ["out.day", "delete d.out.day;"],
  ["marks.group", "delete d.marks.group;"],
])("a missing %s fails, naming it", (name, edit) => {
  const result = run(edited(edit));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain(`derived option "${name}"`);
});
