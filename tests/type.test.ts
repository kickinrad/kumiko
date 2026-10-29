// The fifteen Material type styles, read from resolved tokens.
import { expect, test } from "bun:test";
import { STYLES, typeScale } from "../src/type.mjs";

const parts = { font: "'Some Sans', sans-serif", size: "16px", "line-height": "24px", weight: "400", tracking: "0.5px" };
const tokens = (skip = "") => STYLES.flatMap((style) => Object.entries(parts)
  .map(([part, value]) => ({ path: `md.sys.typescale.${style}.${part}`, value }))).filter(({ path }) => path !== skip);

test("each style is a record of family, size, line height, weight and tracking", () => {
  const scale = typeScale(tokens());
  expect(Object.keys(scale)).toEqual(STYLES);
  expect(scale["body-large"]).toEqual({
    fontFamily: "Some Sans, sans-serif", fontSize: "16px", lineHeight: "24px", fontWeight: 400, letterSpacing: "0.5px",
  });
});

test("a missing part fails, naming its path", () => {
  expect(() => typeScale(tokens("md.sys.typescale.label-small.tracking")))
    .toThrow("Missing md.sys.typescale.label-small.tracking");
});
