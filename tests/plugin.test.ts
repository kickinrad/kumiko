// The plugin output: a kit's agent plugin beside the kit's own SKILL.md, its references from theme.toml, notes.md and
// the components. Two kits prove it: tests/playground (acme: Beer on the web, a playground) and tests/plugin (tern).
import { expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HEADER_LINE } from "../src/header.mjs";
import { read, root, run } from "./helpers";

const SKILL = "---\nname: kit\ndescription: The kit's own skill.\n---\n\n# The kit\n";
// The kit's own skill, which the plugin output never writes.
const skill = (dir: string, at: string) => {
  mkdirSync(join(dir, at), { recursive: true });
  writeFileSync(join(dir, at, "SKILL.md"), SKILL);
};
// acme with the plugin output added, and `edit` applied to the config.
const acme = (edit = "") => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-plugin-acme-"));
  for (const entry of ["design", "tokens", "VERSION", "tokens.config.mjs"]) cpSync(join(root, "tests/playground", entry), join(dir, entry), { recursive: true });
  renameSync(join(dir, "tokens.config.mjs"), join(dir, "base.config.mjs"));
  writeFileSync(join(dir, "tokens.config.mjs"), `import base from "./base.config.mjs";\nconst c = structuredClone(base);\nc.targets.push("plugin");\nc.plugin = { path: "plugins/acme", author: { name: "Acme" } };\n${edit}\nexport default c;\n`);
  skill(dir, "plugins/acme/skills/acme");
  return dir;
};
const tern = () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-plugin-tern-"));
  cpSync(join(root, "tests/plugin"), dir, { recursive: true });
  skill(dir, "agent/tern/skills/tern");
  return dir;
};
const built = (dir: string) => {
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  return dir;
};
const kits = () => ({ acme: built(acme()), tern: built(tern()) });
const references = ["components.md", "notes.md", "theme.toml"];

test("writes the manifest and the skill's references beside the kit's own SKILL.md, which it leaves alone, and --check passes", () => {
  const dir = kits().tern;
  const manifest = JSON.parse(read(dir, "agent/tern/.claude-plugin/plugin.json"));
  expect(manifest).toMatchObject({ name: "tern", repository: "https://example.org/tern" });
  for (const file of references) expect(existsSync(join(dir, "agent/tern/skills/tern/references", file))).toBe(true);
  for (const file of ["components.md", "notes.md"]) expect(read(dir, `agent/tern/skills/tern/references/${file}`).split("\n", 10).some((line) => HEADER_LINE.test(line))).toBe(true);
  expect(read(dir, "agent/tern/skills/tern/SKILL.md")).toBe(SKILL);
  expect(run(dir, "--check").exitCode).toBe(0);
});

test("a kit without its own SKILL.md fails, naming it", () => {
  const dir = tern();
  rmSync(join(dir, "agent/tern/skills/tern/SKILL.md"));
  const result = run(dir);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain("plugin needs agent/tern/skills/tern/SKILL.md: the kit writes its own skill");
});

test("components.md lists every component with Material's guidance, and Beer's markup only with a beer output", () => {
  const dirs = kits();
  const a = read(dirs.acme, "plugins/acme/skills/acme/references/components.md");
  expect(a).toContain("| Buttons | Actions | [Material 3](https://m3.material.io/components/buttons/overview) | [Beer BUTTON](https://github.com/beercss/beercss/blob/main/docs/BUTTON.md) |");
  expect(a).toContain("The playground (`docs/play/`) shows each live.");
  const t = read(dirs.tern, "agent/tern/skills/tern/references/components.md");
  expect(t).toContain("| Buttons | Actions | [Material 3](https://m3.material.io/components/buttons/overview) |\n");
  expect(t).not.toContain("playground");
});

test("components.md without a beer output lists only components Material 3 documents", () => {
  const t = read(kits().tern, "agent/tern/skills/tern/references/components.md");
  expect(t).not.toContain("| Tables |");
  expect(t).not.toContain("none in Material 3");
  const a = read(kits().acme, "plugins/acme/skills/acme/references/components.md");
  expect(a).toContain("| Tables | Containment | none in Material 3 | [Beer TABLE]");
});

test("notes.md and theme.toml beside the skill are the kit's own", () => {
  const dir = kits().tern;
  expect(read(dir, "agent/tern/skills/tern/references/notes.md")).toContain(read(dir, "design/notes.md"));
  const copy = read(dir, "agent/tern/skills/tern/references/theme.toml");
  expect(copy.split("\n")[0]).toMatch(HEADER_LINE);
  expect(copy.split("\n").slice(1).join("\n")).toBe(read(dir, "design/theme.toml"));
});

test("an edited notes.md makes the plugin stale", () => {
  const dir = built(tern());
  writeFileSync(join(dir, "design/notes.md"), `${read(dir, "design/notes.md")}\n- A new rule.\n`);
  const result = run(dir, "--check");
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain("agent/tern/skills/tern/references/notes.md is stale");
});

test("a kit without notes.md fails, naming it", () => {
  const dir = acme();
  renameSync(join(dir, "design/notes.md"), join(dir, "design/other.md"));
  const result = run(dir);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain("plugin needs design/notes.md");
});

test("the output needs a path and a declared kit", () => {
  const result = run(acme("delete c.plugin.path;"));
  expect(result.stderr.toString()).toContain('plugin option "path" is required');
  const bare = run(acme("delete c.kit; c.targets = ['plugin'];"));
  expect(bare.stderr.toString()).toContain("plugin needs a declared kit");
});
