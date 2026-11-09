// The Kit panel's control model: plain names first (the theme.toml path is the detail), DTCG's groups, each colour
// with the pairs that hold it and whether they pass, and units on every length and time.
import { expect, test } from "bun:test";
import { contrast } from "../src/color.mjs";
import { controls, status, tuneView, valueOf } from "../src/web/tune.js";

const tokens = (palette: Record<string, string>, extra: { path: string; value: string; type: string }[] = []) => [
  ...Object.entries(palette).map(([key, value]) => ({ path: `acme.palette.${key}`, value, type: "color" })),
  { path: "md.sys.color.surface", value: palette.ink, type: "color" },
  { path: "md.sys.color.on-surface", value: palette.paper, type: "color" },
  { path: "md.sys.color.primary", value: palette.signal, type: "color" },
  { path: "md.sys.color.on-primary", value: palette["on-signal"], type: "color" },
  ...extra,
];
const kit = {
  name: "acme",
  modes: {
    night: tokens({ ink: "#101010", paper: "#eeeeee", signal: "#fd5416", "on-signal": "#ffffff" }, [
      { path: "acme.space.base", value: "8px", type: "dimension" },
      { path: "acme.shape.corner", value: "0px", type: "dimension" },
      { path: "acme.motion.quick", value: "120ms", type: "duration" },
    ]),
    day: tokens({ ink: "#ffffff", paper: "#111111", signal: "#922906", "on-signal": "#ffffff" }),
  },
  tune: { faces: { brand: ["Archivo", "sans-serif"], mono: "PT Mono" }, tokens: ["acme.space.base", "acme.shape.corner", "acme.motion.quick"] },
  pairs: [
    { fg: "md.sys.color.on-surface", bg: "md.sys.color.surface", min: 4.5 },
    { fg: "md.sys.color.on-primary", bg: "md.sys.color.primary", min: 4.5 },
  ],
};

test("groups by type, labels in plain words, the theme.toml path as the detail", () => {
  const groups = controls(kit, "night");
  expect(groups.map((group: { group: string }) => group.group)).toEqual(["Color", "Typography", "Spacing", "Radius", "Duration"]);
  const items = groups.flatMap((group: { items: object[] }) => group.items);
  for (const item of items as { label: string; detail: string }[]) expect(item.label).not.toContain(".");
  expect(items.find((item: any) => item.path === "palette.night.on-signal")).toMatchObject({ label: "On signal", kind: "color" });
  expect(items.find((item: any) => item.path === "faces.brand")).toMatchObject({ label: "Display, headline and title", value: "Archivo, sans-serif" });
  expect(items.find((item: any) => item.path === "tokens.acme.space.base")).toMatchObject({ unit: "px", value: 8 });
  expect(items.find((item: any) => item.path === "tokens.acme.motion.quick")).toMatchObject({ unit: "ms", value: 120 });
});

test("each colour carries the pairs that hold it, with the live ratio and pass or fail", () => {
  const signal = controls(kit, "night")[0].items.find((item: any) => item.path === "palette.night.signal");
  const ratio = contrast("#ffffff", "#fd5416");
  expect(signal.pairs).toEqual([{ line: "Under On signal", ratio, min: 4.5, pass: false }]);
  expect(status(signal)).toContain("1 of 1 fail");
  expect(status(controls(kit, "night")[0].items.find((item: any) => item.path === "palette.night.ink"))).not.toContain("fail");
});

test("an edit shows in the control's value, and its reset appears", () => {
  const html = tuneView(kit, "night", { edits: { "palette.night.signal": "#00ff00" } });
  expect(html).toContain('id="palette.night.signal" value="#00ff00"');
  expect(html).toContain("1 unsaved change");
  expect(html).toMatch(/data-tune-undo="palette.night.signal" aria-label="Reset Signal">/);
  expect(valueOf({ unit: "px" }, "12")).toBe("12px");
  expect(valueOf({ kind: "fontFamily" }, "Archivo, sans-serif")).toEqual(["Archivo", "sans-serif"]);
});
