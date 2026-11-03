// The plugin output: a kit's agent plugin from its theme.toml and notes.md, on one template. Two kits prove it:
// tests/playground (acme: Beer on the web, a playground) and tests/plugin (tern: other modes, rules and outputs).
import { expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HEADER_LINE } from "../src/header.mjs";
import { read, root, run } from "./helpers";

// acme with the plugin output added, and `edit` applied to the config.
const acme = (edit = "") => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-plugin-acme-"));
  for (const entry of ["design", "tokens", "VERSION", "tokens.config.mjs"]) cpSync(join(root, "tests/playground", entry), join(dir, entry), { recursive: true });
  renameSync(join(dir, "tokens.config.mjs"), join(dir, "base.config.mjs"));
  writeFileSync(join(dir, "tokens.config.mjs"), `import base from "./base.config.mjs";\nconst c = structuredClone(base);\nc.targets.push("plugin");\nc.plugin = { path: "plugins/acme", author: { name: "Acme" } };\n${edit}\nexport default c;\n`);
  return dir;
};
const tern = () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-plugin-tern-"));
  cpSync(join(root, "tests/plugin"), dir, { recursive: true });
  return dir;
};
const built = (dir: string) => {
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  return dir;
};
const kits = () => ({ acme: built(acme()), tern: built(tern()) });
const files = (name: string) => [".claude-plugin/plugin.json", `skills/${name}/SKILL.md`, `skills/${name}/references/components.md`, `skills/${name}/references/theme.toml`];
const at = { acme: "plugins/acme", tern: "agent/tern" };

test("writes the manifest, the skill and its references, each text file with the header, and --check passes", () => {
  for (const [name, dir] of Object.entries(kits())) {
    for (const file of files(name)) expect(existsSync(join(dir, at[name], file))).toBe(true);
    for (const file of files(name).slice(1)) expect(read(dir, `${at[name]}/${file}`).split("\n", 10).some((line) => HEADER_LINE.test(line))).toBe(true);
    expect(run(dir, "--check").exitCode).toBe(0);
  }
});

test("the skill's front matter is its name and a trigger, with the header after it", () => {
  const skill = read(kits().acme, "plugins/acme/skills/acme/SKILL.md").split("\n");
  expect(skill[0]).toBe("---");
  expect(skill[1]).toBe("name: acme");
  const description = JSON.parse(skill[2].replace(/^description: /, ""));
  expect(description).toStartWith("Build UI on the acme kit: Material 3 with its own theme. Use when building or changing UI, even a quick one-file page, for web pages unless another kit is selected");
  expect(description.length).toBeLessThanOrEqual(350);
  expect(description).not.toMatch(/[<>]/);
  expect(skill[3]).toBe("---");
  expect(skill[4]).toMatch(HEADER_LINE);
});

test("the skill holds each kit's own rules, outputs and links, and the manifest its own name", () => {
  const dirs = kits();
  const skill = (name: string) => read(dirs[name], `${at[name]}/skills/${name}/SKILL.md`);
  const a = skill("acme");
  expect(a).toContain("- Use `acme.gap` for spacing.");
  expect(a).toContain("### Don't");
  expect(a).toContain("   - beer: `ports/css/kit-beer.css`: ");
  expect(a).toContain("   - playground: `docs/play/`: ");
  expect(a.indexOf("   - css:")).toBeLessThan(a.indexOf("   - beer:"));
  expect(a).toContain("[Beer CSS](https://github.com/beercss/beercss/tree/main/docs)");
  expect(a).toContain("`night` and `day`");
  const t = skill("tern");
  expect(t).toContain("Sea greys under one orange.");
  expect(t).toContain("- Put at most one filled button on a screen.");
  expect(t).toContain("# not a heading\n");
  expect(t).toContain("   - compose-tv: `tv/`: ");
  expect(t).toContain("`org.example.tern`");
  expect(t).toContain("[the kit's repository](https://example.org/tern) at its newest tag");
  expect(t).toContain("a checkout of the kit at its newest tag");
  expect(t).toContain("- [Style guide](https://example.org/tern/guide)");
  expect(t).toContain("`dusk` and `dawn`");
  expect(t).not.toContain("Beer");
  expect(JSON.parse(read(dirs.acme, "plugins/acme/.claude-plugin/plugin.json"))).toMatchObject({ name: "acme", author: { name: "Acme" } });
  expect(JSON.parse(read(dirs.tern, "agent/tern/.claude-plugin/plugin.json"))).toMatchObject({ name: "tern", repository: "https://example.org/tern" });
});

test("a web kit's quick page loads its faces, then Beer in a cascade layer beneath the kit's files", () => {
  const t = read(built(acme()), "plugins/acme/skills/acme/SKILL.md");
  const head = t.slice(t.indexOf("```html"), t.indexOf("```", t.indexOf("```html") + 3));
  const order = ["fonts.googleapis.com/css2?family=", '@import url("https://cdn.jsdelivr.net/npm/beercss/dist/cdn/beer.min.css") layer(beer);', 'href="ports/css/kit.css"', 'href="ports/css/kit-beer.css"', "beer.min.js"];
  const at = order.map((part) => head.indexOf(part));
  expect(at.every((index) => index >= 0)).toBe(true);
  expect(at).toEqual([...at].sort((x, y) => x - y));
  expect(head).not.toMatch(/\d+\.\d+\.\d+/);
});

test("a default kit is used when nothing selects another; any other kit asks", () => {
  const ask = "When nothing selects a kit and another kit is also available, stop and ask the user which one";
  expect(read(built(acme()), "plugins/acme/skills/acme/SKILL.md")).toContain(ask);
  const t = read(built(acme("c.plugin.default = true;")), "plugins/acme/skills/acme/SKILL.md");
  expect(t).toContain("When nothing selects a kit, acme is the default: use it.");
  expect(t).not.toContain(ask);
});

test("two kits' plugins share the template and nothing of each other's choices", () => {
  const dirs = kits();
  const all = (name: string) => files(name).map((file) => read(dirs[name], `${at[name]}/${file}`)).join("\n");
  const [a, t] = [all("acme"), all("tern")];
  for (const word of ["tern", "Tern", "dusk", "dawn", "Sea greys", "orange", "example.org"]) expect(a).not.toContain(word);
  for (const word of ["acme", "night", "Fixture", "acme.gap", "kit-beer.css"]) expect(t).not.toContain(word);
  const shape = (text: string, name: string) => text.split("\n").filter((line) => line.startsWith("## ")).map((line) => line.replace(new RegExp(name, "gi"), "KIT"));
  expect(shape(read(dirs.acme, "plugins/acme/skills/acme/SKILL.md"), "acme")).toEqual(shape(read(dirs.tern, "agent/tern/skills/tern/SKILL.md"), "tern"));
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

test("notes.md headings go one level down, but not inside a fence, however long", () => {
  const dir = tern();
  writeFileSync(join(dir, "design/notes.md"), "# Tern\n\n## Rules\n\n````md\n# literal\n```\n## still literal\n````\n\n## After\n");
  const skill = read(built(dir), "agent/tern/skills/tern/SKILL.md");
  expect(skill).toContain("### Rules\n\n````md\n# literal\n```\n## still literal\n````\n\n### After\n");
});

test("an output's default path and a project's own output are listed as the build writes them", () => {
  const dir = tern();
  writeFileSync(join(dir, "own.mjs"), 'export default { name: "notes-page", build: () => [{ path: "site/notes.txt", content: "x\\n" }] };\n');
  const config = read(dir, "tokens.config.mjs").replace("// A second", 'import own from "./own.mjs";\n// A second')
    .replace('css: { path: "web/tern.css" },', "css: {},\n  obsidian: { out: \"notes/tern\" },\n  \"notes-page\": { path: \"site/notes.txt\" },")
    .replace('targets: ["css",', 'targets: [own, "obsidian", "css",');
  writeFileSync(join(dir, "tokens.config.mjs"), config);
  const skill = read(built(dir), "agent/tern/skills/tern/SKILL.md");
  expect(skill).toContain("   - css: `src/styles/tokens.css`: ");
  expect(skill).toContain("   - notes-page: `site/notes.txt`, the project's own output.");
  expect(skill).toMatch(/description: "[^"]*web pages, Home Assistant dashboards, Compose for TV screens or Obsidian unless/);
});

test("theme.toml beside the skill is the kit's own under the header", () => {
  const dir = kits().tern;
  const copy = read(dir, "agent/tern/skills/tern/references/theme.toml");
  expect(copy.split("\n")[0]).toMatch(HEADER_LINE);
  expect(copy.split("\n").slice(1).join("\n")).toBe(read(dir, "design/theme.toml"));
});

test("an edited notes.md makes the plugin stale", () => {
  const dir = built(tern());
  writeFileSync(join(dir, "design/notes.md"), `${read(dir, "design/notes.md")}\n- A new rule.\n`);
  const result = run(dir, "--check");
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain("agent/tern/skills/tern/SKILL.md is stale");
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
