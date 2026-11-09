import { expect, test } from "bun:test";
import { edit, editorView, patch } from "../src/web/edit.js";

const original = {
  name: "acme",
  modes: {
    night: [{ path: "acme.palette.ink", value: "#141414", type: "color" }, { path: "md.sys.color.surface", value: "#141414", type: "color" }, { path: "md.ref.typeface.brand", value: "Fixture Serif", type: "fontFamily" }, { path: "acme.gap", value: "8px", type: "dimension" }],
    day: [{ path: "acme.palette.ink", value: "#f6f6f6", type: "color" }, { path: "md.sys.color.surface", value: "#f6f6f6", type: "color" }, { path: "md.ref.typeface.brand", value: "Fixture Serif", type: "fontFamily" }, { path: "acme.gap", value: "8px", type: "dimension" }],
  },
  editor: { palette: { night: { ink: "#141414" }, day: { ink: "#f6f6f6" } }, roles: { "md.sys.color.surface": { night: "ink", day: "ink" } }, faces: { brand: "Fixture Serif" }, tokens: { "acme.gap": "8px" } },
};

test("edits update both the token preview and a valid, minimal theme.toml patch", () => {
  const data = structuredClone(original);
  edit(data, { kind: "palette", mode: "night", name: "ink", value: "#222222" });
  edit(data, { kind: "role", mode: "day", name: "md.sys.color.surface", value: "night.ink" });
  edit(data, { kind: "face", name: "brand", value: "New Serif" });
  edit(data, { kind: "token", name: "acme.gap", value: "12px" });
  expect(data.modes.night[1].value).toBe("#222222");
  expect(data.modes.day[1].value).toBe("#222222");
  expect(data.modes.day[2].value).toBe("New Serif");
  expect(data.modes.night[3].value).toBe("12px");
  const output = patch(original.editor, data.editor);
  expect(Bun.TOML.parse(output)).toEqual({ palette: { night: { ink: "#222222" } }, roles: { day: { "md.sys.color.surface": "night.ink" } }, faces: { brand: "New Serif" }, tokens: { "acme.gap": "12px" } });
  expect(patch(data.editor, data.editor)).toBe("");
});

test("bad edits leave the preview unchanged", () => {
  const data = structuredClone(original);
  expect(() => edit(data, { kind: "palette", mode: "night", name: "ink", value: "orange" })).toThrow();
  expect(() => edit(data, { kind: "role", mode: "night", name: "md.sys.color.surface", value: "missing" })).toThrow();
  expect(() => edit(data, { kind: "token", name: "acme.gap", value: "oops" })).toThrow();
  data.editor.faces.plain = ["Fixture Sans", "sans-serif"];
  expect(() => edit(data, { kind: "face", name: "plain", value: ",,," })).toThrow();
  data.editor.faces.plain = original.editor.faces.plain;
  expect(data).toEqual(original);
});

test("the editor shows each source field and its patch without kit-specific content", () => {
  const data = structuredClone(original);
  const html = editorView(data, "night", original.editor);
  expect(html).toContain('data-edit="palette"');
  expect(html).toContain('data-edit="role"');
  expect(html).toContain('data-edit="face"');
  expect(html).toContain('data-edit="token"');
  expect(html).toContain('data-export disabled');
  edit(data, { kind: "palette", mode: "night", name: "ink", value: "#222222" });
  expect(editorView(data, "night", original.editor)).toContain('data-patch');
  expect(editorView(data, "night", original.editor)).toContain("#222222");
});

test("a Material token patch retains its required why and type", () => {
  const data = structuredClone(original);
  data.editor.tokens["md.sys.shape.corner.small"] = "4px";
  data.editor.tokenMeta = { "md.sys.shape.corner.small": { type: "dimension", why: "Brand corner" } };
  edit(data, { kind: "token", name: "md.sys.shape.corner.small", value: "8px" });
  expect(Bun.TOML.parse(patch(original.editor, data.editor)).tokens["md.sys.shape.corner.small"]).toEqual({ value: "8px", type: "dimension", why: "Brand corner" });
});

test("face preview follows alias identity when two faces currently share a family", () => {
  const data = structuredClone(original);
  for (const mode of Object.keys(data.modes)) {
    data.modes[mode].push({ path: "md.ref.typeface.plain", value: "Fixture Serif", type: "fontFamily" });
    data.modes[mode].push({ path: "md.sys.typescale.display-large.font", value: "Fixture Serif", type: "fontFamily" });
    data.modes[mode].push({ path: "md.sys.typescale.body-large.font", value: "Fixture Serif", type: "fontFamily" });
  }
  data.editor.faces.plain = "Fixture Serif";
  data.editor.faceUses = { brand: ["md.sys.typescale.display-large.font"], plain: ["md.sys.typescale.body-large.font"] };
  edit(data, { kind: "face", name: "brand", value: "New Serif" });
  const values = Object.fromEntries(data.modes.night.map((token) => [token.path, token.value]));
  expect(values["md.sys.typescale.display-large.font"]).toBe("New Serif");
  expect(values["md.sys.typescale.body-large.font"]).toBe("Fixture Serif");
  expect(values["md.ref.typeface.plain"]).toBe("Fixture Serif");
});
