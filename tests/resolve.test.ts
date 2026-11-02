// The resolver: layers merge lowest first, and a token's type comes from itself, its group, its alias, or the
// token it replaced.
import { expect, test } from "bun:test";
import { resolve } from "../src/resolve.mjs";

const typeOf = (layers: object[], path: string) => resolve(layers.map((tree) => ({ tree }))).find((token) => token.path === path)?.type;

test("an untyped value that replaces a token keeps the type that token resolved to, through its alias", () => {
  const base = { weight: { medium: { $type: "fontWeight", $value: 500 } }, title: { weight: { $value: "{weight.medium}" } } };
  expect(typeOf([base, { title: { weight: { $value: 600 } } }], "title.weight")).toBe("fontWeight");
  expect(typeOf([base, { title: { weight: { $type: "number", $value: 600 } } }], "title.weight")).toBe("number");
});

test("a new untyped value is a number or a string by its value", () => {
  expect(typeOf([{ a: { $value: 0.5 } }], "a")).toBe("number");
  expect(typeOf([{ a: { $value: "12 / 5" } }], "a")).toBe("string");
});
