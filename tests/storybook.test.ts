// The storybook output: Storybook's UI from the kit, the preview on the kit's CSS and modes, generated docs pages, and
// each site as a story (tests/playground/ is the kit).
import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { read, root, run } from "./helpers";

const kit = (options: string) => {
  const dir = mkdtempSync(join(tmpdir(), "kumiko-storybook-"));
  for (const entry of ["design", "tokens", "VERSION", "kumiko.config.mjs"]) cpSync(join(root, "tests/playground", entry), join(dir, entry), { recursive: true });
  renameSync(join(dir, "kumiko.config.mjs"), join(dir, "base.config.mjs"));
  writeFileSync(join(dir, "kumiko.config.mjs"), `import base from "./base.config.mjs";\nexport default { ...base, targets: [...base.targets, "storybook"], storybook: ${options} };\n`);
  return dir;
};

test("writes the theme, manager, preview, docs and site stories, and --check passes on them", () => {
  const dir = kit('{ sites: [{ name: "Our site", url: "https://example.test/" }] }');
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(readdirSync(join(dir, ".storybook")).sort()).toEqual(["color.mjs", "colour.mdx", "kit.js", "kit.json", "manager.js", "material.mdx", "measures.mdx", "preview.js", "sites.stories.js", "theme.js", "type.mdx"]);
  expect(run(dir, "--check").exitCode).toBe(0);
  // The generated scripts parse: Storybook's own build is the first place a syntax error would otherwise show.
  const parse = new Bun.Transpiler({ loader: "jsx" });
  for (const file of ["kit.js", "manager.js", "preview.js", "sites.stories.js", "theme.js"]) expect(() => parse.transformSync(read(dir, `.storybook/${file}`))).not.toThrow();

  // The Type page sets each size in its own face and weight: a kit can set a role's sizes in two faces.
  expect(read(dir, ".storybook/kit.js")).toContain('fontFamily: at(role + "-" + size + ".font"), fontWeight: at(role + "-" + size + ".weight")');

  const data = JSON.parse(read(dir, ".storybook/kit.json"));
  const value = (path: string) => data.modes.night.find((token: { path: string }) => token.path === path).value;
  const theme = read(dir, ".storybook/theme.js");
  expect(theme).toContain('"base": "dark"');
  expect(theme).toContain(`"appContentBg": "${value("md.sys.color.surface")}"`);
  expect(theme).toContain(`"colorPrimary": "${value("md.sys.color.primary")}"`);
  expect(theme).toContain(`"fontCode": "'Fixture Mono', monospace"`);
  expect(Object.keys(data.modes)).toEqual(["night", "day"]);
  expect(data.modes.night.some((token: { path: string }) => token.path.startsWith("md.comp."))).toBe(false);

  const preview = read(dir, ".storybook/preview.js");
  expect(preview).toContain('import "../ports/css/kit.css";');
  expect(preview).toContain('themes: {"night":"dark","day":"light"}');
  expect(preview).toContain("http://localhost:4400/_kumiko/bridge.js");
  expect(preview).toContain('a11y: { test: "error" }');
  expect(preview).toContain("document.documentElement.dataset.platform = platform");
  expect(preview).toContain('"ink":{"name":"ink","value":"var(--acme-palette-ink)"}');
  expect(read(dir, ".storybook/manager.js")).toContain('src: "http://localhost:4400/_kumiko/panel"');
  expect(read(dir, ".storybook/colour.mdx")).toContain('<Meta title="Foundations/Colour" />');
  expect(read(dir, ".storybook/sites.stories.js")).toContain("export const OurSite = {");
  expect(read(dir, ".storybook/sites.stories.js")).toContain('title: "Site/Live"');
});

test("path and dev are options", () => {
  const dir = kit('{ path: "sb", dev: "http://localhost:5000" }');
  expect(run(dir).exitCode).toBe(0);
  expect(readdirSync(join(dir, "sb"))).not.toContain("sites.stories.js");
  expect(read(dir, "sb/manager.js")).toContain("http://localhost:5000/_kumiko/panel");
});
