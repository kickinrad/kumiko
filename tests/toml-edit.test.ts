// theme.toml edits change the edited value's line and nothing else (kumiko dev's save).
import { expect, test } from "bun:test";
import { setValue } from "../src/toml-edit.mjs";

const theme = `name = "acme"
default = "night"
[palette.night]
ink = "#101418" # the ground
blue = "#7aa2f7"
[faces]
brand = ["Some Sans", "sans-serif"]
[tokens]
"acme.layout.gap" = "8px"
"md.sys.shape.corner.small" = { value = "4px", why = "Tighter" }
[tokens.acme.motion]
quick = "120ms"
`;
const changed = (before: string, after: string) => after.split("\n").filter((line, i) => line !== before.split("\n")[i]);

test("an existing value changes on its own line, keeping its key, spacing and comment", () => {
  const after = setValue(theme, "palette.night.ink", "#000000");
  expect(changed(theme, after)).toEqual(['ink = "#000000" # the ground']);
  expect(changed(theme, setValue(theme, "faces.brand", ["Archivo", "sans-serif"]))).toEqual(['brand = ["Archivo", "sans-serif"]']);
  expect(changed(theme, setValue(theme, "tokens.acme.layout.gap", "12px"))).toEqual(['"acme.layout.gap" = "12px"']);
  expect(changed(theme, setValue(theme, "tokens.acme.motion.quick", "200ms"))).toEqual(['quick = "200ms"']);
});

test("a token table keeps its why; only its value changes", () => {
  expect(changed(theme, setValue(theme, "tokens.md.sys.shape.corner.small", "0px"))).toEqual(['"md.sys.shape.corner.small" = { value = "0px", why = "Tighter" }']);
});

test("a new key joins its table, and a new table goes at the end", () => {
  const added = setValue(theme, "palette.night.red", "#ff0000");
  expect(added).toContain('blue = "#7aa2f7"\nred = "#ff0000"\n[faces]');
  expect(setValue(theme, "palette.day.ink", "#ffffff")).toEndWith('quick = "120ms"\n\n[palette.day]\nink = "#ffffff"\n');
  expect(Bun.TOML.parse(setValue(theme, "faces.mono", ["Mono", "monospace"])).faces.mono).toEqual(["Mono", "monospace"]);
});
