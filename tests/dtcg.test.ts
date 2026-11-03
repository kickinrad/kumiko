// The dtcg output: a kit's resolved tokens as DTCG files, which a consumer includes to build its own outputs.
import { expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { read, root, run } from "./helpers";

// acme, the sample kit, with the dtcg output beside its css.
const kit = () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-dtcg-kit-"));
  for (const entry of ["design", "tokens", "VERSION"]) cpSync(join(root, "tests/playground", entry), join(dir, entry), { recursive: true });
  writeFileSync(join(dir, "kumiko.config.mjs"), `export default {
  targets: ["css", "dtcg"], include: ["builtin:material"], kit: { name: "acme" },
  css: { path: "out/kit.css", scheme: "dark" }, dtcg: { path: "tokens-out" },
};\n`);
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  return dir;
};
const declarations = (css: string) => [...css.matchAll(/^\s*(--[a-z0-9-]+: .+;)$/gm)].map((match) => match[1]).sort();

test("writes the base mode and each other mode's differences, aliases resolved, with no untouched Material component token", () => {
  const dir = kit();
  const base = JSON.parse(read(dir, "tokens-out/acme.tokens.json"));
  const day = JSON.parse(read(dir, "tokens-out/acme.day.tokens.json"));
  expect(base.$description).toContain("acme");
  expect(base.md.sys.color.primary.$type).toBe("color");
  expect(base.md.sys.color.primary.$value).toMatchObject({ colorSpace: "srgb", hex: expect.stringMatching(/^#[0-9a-f]{6}$/) });
  expect(base.md.sys.shape.corner.medium.$value).toEqual({ value: 12, unit: "px" });
  expect(base.md.comp).toBeUndefined();
  expect(day.md.sys.color.primary.$value).not.toEqual(base.md.sys.color.primary.$value);
  expect(day.md.sys.shape).toBeUndefined();
  expect(run(dir, "--check").exitCode).toBe(0);
});

test("a consumer that includes the files beneath builtin:material builds the kit's own css", () => {
  const dir = kit();
  const app = mkdtempSync(join(tmpdir(), "tokens-dtcg-app-"));
  mkdirSync(join(app, "kit"));
  for (const file of ["acme.tokens.json", "acme.day.tokens.json"]) cpSync(join(dir, "tokens-out", file), join(app, "kit", file));
  writeFileSync(join(app, "kumiko.config.mjs"), `export default {
  targets: ["css"], include: ["builtin:material", "kit/acme.tokens.json"],
  media: { "(prefers-color-scheme: light)": ["kit/acme.day.tokens.json"] },
  css: { path: "out/app.css", scheme: "dark" },
};\n`);
  const result = run(app);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(declarations(read(app, "out/app.css"))).toEqual(declarations(read(dir, "out/kit.css")));
});

test("every colour, a derived role's too, is a DTCG 2025.10 colour object", () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-dtcg-derived-"));
  cpSync(join(root, "tests/derived"), dir, { recursive: true });
  writeFileSync(join(dir, "kumiko.config.mjs"), 'export default { targets: ["dtcg"], include: ["builtin:material"], kit: { name: "acme" }, dtcg: { path: "out" } };\n');
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  const colours: unknown[] = [];
  const walk = (node: Record<string, unknown>) => {
    if ("$value" in node) { if (node.$type === "color") colours.push(node.$value); return; }
    for (const [key, each] of Object.entries(node)) if (!key.startsWith("$")) walk(each as Record<string, unknown>);
  };
  for (const file of ["acme.tokens.json", "acme.day.tokens.json"]) walk(JSON.parse(read(dir, `out/${file}`)));
  expect(JSON.parse(read(dir, "out/acme.tokens.json")).md.sys.color["primary-container"].$value).toMatchObject({ colorSpace: "srgb" });
  for (const each of colours) expect(each).toMatchObject({ colorSpace: "srgb", components: expect.any(Array), hex: expect.stringMatching(/^#[0-9a-f]{6}$/) });
});

test("the output needs a path, never tokens/, and a declared kit", () => {
  const dir = kit();
  writeFileSync(join(dir, "kumiko.config.mjs"), 'export default { targets: ["dtcg"], include: ["builtin:material"], kit: { name: "acme" } };\n');
  expect(run(dir).stderr.toString()).toContain("path");
  writeFileSync(join(dir, "kumiko.config.mjs"), 'export default { targets: ["dtcg"], include: ["builtin:material"], kit: { name: "acme" }, dtcg: { path: "tokens" } };\n');
  expect(run(dir).stderr.toString()).toContain("tokens/ is the project's own token source");
});
