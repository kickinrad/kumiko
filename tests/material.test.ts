// The built-in Material layer: the vendored androidx data plus the cited values it lacks.
import { expect, test } from "bun:test";
import vendored from "../material/material.tokens.json" with { type: "json" };
import guidance from "../src/material-guidance.tokens.json" with { type: "json" };
import material from "../src/material.mjs";

const paths = (node: Record<string, any>, at: string[] = []): string[] => Object.entries(node).filter(([key]) => !key.startsWith("$"))
  .flatMap(([key, child]) => "$value" in child ? [[...at, key].join(".")] : paths(child, [...at, key]));

test("the guidance only adds: no path repeats one in the vendored data, and each says its source", () => {
  const own = new Set(paths(vendored));
  const added = paths(guidance);
  expect(added.length).toBe(11);
  for (const path of added) expect(own.has(path), path).toBe(false);
  const tree = material.tokens();
  for (const path of added) {
    const token = path.split(".").reduce((node: any, part) => node[part], tree);
    expect(token.$description, path).toMatch(/tokens|ColorDarkTokens|material-web/);
  }
});

test("the merged layer holds the shadow role, the focus indicator and the slider sizes beside the vendored data", () => {
  const tree = material.tokens();
  expect(tree.md.sys.color.shadow.$value).toBe("#000000");
  expect(tree.md.sys.state["focus-indicator"].thickness.$value).toEqual({ value: 3, unit: "px" });
  expect(tree.md.comp.slider.xlarge["active-handle-height"].$value).toEqual({ value: 108, unit: "px" });
  expect(tree.md.sys.color.primary).toBeDefined();
});
