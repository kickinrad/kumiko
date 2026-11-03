// The template output: a kit's own files for apps the engine has no output for (terminal and editor themes), each a
// template whose {{<mode>.<colour>}} slots the theme's palette fills.
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { read, run } from "./helpers";

const THEME = `name = "acme"
default = "night"

[media]
day = "(prefers-color-scheme: light)"

[palette.night]
ink = "#101010"
blue = "#7aa2f7"

[palette.day]
ink = "#fafafa"
blue = "#2e7de9"
`;

const kit = (templates: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-template-"));
  writeFileSync(join(dir, "VERSION"), "0.5.0\n");
  writeFileSync(join(dir, "kumiko.config.mjs"), 'export default { targets: ["template"], kit: { name: "acme" }, template: { from: "templates", to: "ports" } };\n');
  mkdirSync(join(dir, "design"));
  writeFileSync(join(dir, "design/theme.toml"), THEME);
  for (const [path, text] of Object.entries(templates)) {
    mkdirSync(join(dir, "templates", path, ".."), { recursive: true });
    writeFileSync(join(dir, "templates", path), text);
  }
  return dir;
};

test("each template is written to the same path under `to`, every slot filled from its mode's palette, the rest kept byte for byte", () => {
  const dir = kit({
    "term/acme-night.json": '{ "background": "{{night.ink}}", "blue": "{{ night.blue }}", "dim": "{{night.blue}}80", "name": "{{name}}" }\n',
    "tmux/both.conf": "set -g status-style 'bg={{night.ink}}' # day: {{day.ink}} {{day.blue}}\n\tkeep #2c2c2c as is\n",
  });
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(read(dir, "ports/term/acme-night.json")).toBe('{ "background": "#101010", "blue": "#7aa2f7", "dim": "#7aa2f780", "name": "acme" }\n');
  expect(read(dir, "ports/tmux/both.conf")).toBe("set -g status-style 'bg=#101010' # day: #fafafa #2e7de9\n\tkeep #2c2c2c as is\n");
  expect(run(dir, "--check").exitCode).toBe(0);
});

test("--check flags a rendered file that no longer matches its template or palette", () => {
  const dir = kit({ "a.conf": "fg {{night.blue}}\n" });
  run(dir);
  writeFileSync(join(dir, "design/theme.toml"), THEME.replace('blue = "#7aa2f7"', 'blue = "#7da6ff"'));
  const stale = run(dir, "--check");
  expect(stale.exitCode).toBe(1);
  expect(stale.stderr.toString()).toContain("ports/a.conf is stale");
});

test("a slot the palette lacks fails, naming the template and the slot", () => {
  const result = run(kit({ "a.conf": "fg {{night.pink}}\n" }));
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("template: templates/a.conf has {{night.pink}}, which the theme lacks (slots: <mode>.<palette colour>, name)");
});

test("it needs a declared kit, and `from` and `to`", () => {
  const dir = kit({ "a.conf": "x\n" });
  writeFileSync(join(dir, "kumiko.config.mjs"), 'export default { targets: ["template"], kit: { name: "acme" }, template: { from: "templates" } };\n');
  expect(run(dir).stderr.toString()).toContain('template option "to" is required');
});

test("a theme that extends another takes its modes, palette and faces, then adds or changes its own", () => {
  const dir = kit({ "a.conf": "{{night.ink}} {{night.blue}} {{night.accent}} {{day.ink}} {{day.accent}}\n" });
  writeFileSync(join(dir, "design/base.toml"), THEME.replace('name = "acme"', 'name = "plain"'));
  writeFileSync(join(dir, "design/theme.toml"), 'name = "acme"\nextends = "base.toml"\n\n[palette.night]\nblue = "#7da6ff"\naccent = "#ff00aa"\n\n[palette.day]\naccent = "#aa0055"\n');
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(read(dir, "ports/a.conf")).toBe("#101010 #7da6ff #ff00aa #fafafa #aa0055\n");
  writeFileSync(join(dir, "design/theme.toml"), 'name = "acme"\nextends = "none.toml"\n');
  expect(run(dir).stderr.toString()).toContain("theme.toml: extends: no theme at design/none.toml");
});
