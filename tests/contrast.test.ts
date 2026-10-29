// The colour maths live in the engine, and a kit's declared contrast pairs are checked in every mode.
import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  bestOn, byPath, contrast, hsl, linear, luminance, mix, rgb, stateLayer, textSafe,
} from "../src/color.mjs";
import { toHex } from "../src/checks/contrast.mjs";

describe("colour maths", () => {
  test("luminance runs from 0 (black) to 1 (white)", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1, 10);
    expect(luminance("#ff0000")).toBeCloseTo(0.2126, 4);
    expect(luminance("#00ff00")).toBeCloseTo(0.7152, 4);
    expect(luminance("#0000ff")).toBeCloseTo(0.0722, 4);
  });
  test("linear uses the sRGB threshold", () => {
    expect(linear(0.04)).toBeCloseTo(0.04 / 12.92, 10);
    expect(linear(0.5)).toBeCloseTo(0.2140, 4);
  });
  test("contrast follows WCAG 2 on known pairs, in either order", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 10);
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 10);
    expect(contrast("#777777", "#777777")).toBe(1);
    expect(contrast("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });
  test("mix blends pct percent of b into a, in sRGB", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 100)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 50)).toBe("#808080");
    expect(mix("#ff0000", "#0000ff", 25)).toBe("#bf0040");
  });
  test("bestOn picks the candidate that reads best, with its ratio", () => {
    const [hex, ratio] = bestOn("#ffffff", ["#777777", "#000000", "#cccccc"]);
    expect(hex).toBe("#000000");
    expect(ratio).toBeCloseTo(21, 10);
  });
  test("stateLayer is a mix of the accent over a surface", () => {
    expect(stateLayer("#ffffff", "#000000", 8)).toBe(mix("#ffffff", "#000000", 8));
    expect(stateLayer("#ffffff", "#000000", 8)).toBe("#ebebeb");
  });
  test("textSafe returns the smallest mix that reaches AA on every surface", () => {
    expect(textSafe("#000000", "#ffffff", ["#ffffff"])).toEqual({ value: "#000000", pct: 0, worst: 21 });
    const safe = textSafe("#cccccc", "#000000", ["#ffffff"]);
    expect(safe.worst).toBeGreaterThanOrEqual(4.5);
    expect(contrast(safe.value, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    const one = mix("#cccccc", "#000000", safe.pct - 1);
    expect(contrast(one, "#ffffff")).toBeLessThan(4.5);
  });
  test("textSafe throws when no mix reaches AA", () => {
    expect(() => textSafe("#808080", "#808080", ["#808080"])).toThrow("No AA mix for #808080");
  });
  test("byPath keys tokens by their path", () => {
    const map = byPath([{ path: "a.b", v: 1 }, { path: "c", v: 2 }]);
    expect(map.get("a.b")).toEqual({ path: "a.b", v: 1 });
    expect(map.get("c")?.v).toBe(2);
    expect(map.size).toBe(2);
  });
  test("hsl gives rounded degrees and percents", () => {
    expect(hsl("#000000")).toEqual([0, 0, 0]);
    expect(hsl("#ffffff")).toEqual([0, 0, 100]);
    expect(hsl("#ff0000")).toEqual([0, 100, 50]);
    expect(hsl("#00ff00")).toEqual([120, 100, 50]);
    expect(hsl("#0000ff")).toEqual([240, 100, 50]);
    expect(hsl("#2e7de9")[0]).toBe(215); // 214.6 degrees, rounded
  });
  test("rgb gives the three channels", () => {
    expect(rgb("#2e7de9")).toEqual([46, 125, 233]);
  });
});

describe("toHex reads the colours a resolved token carries", () => {
  test("hex strings, short and long, any case", () => {
    expect(toHex("#ABCDEF")).toBe("#abcdef");
    expect(toHex("#abc")).toBe("#aabbcc");
  });
  test("DTCG 2025.10 colour objects, by hex or by srgb components", () => {
    expect(toHex({ colorSpace: "srgb", components: [0, 0, 0], hex: "#121416" })).toBe("#121416");
    expect(toHex({ colorSpace: "srgb", components: [1, 0.5, 0] })).toBe("#ff8000");
  });
  test("anything else is not a colour", () => {
    expect(toHex("16px")).toBeUndefined();
    expect(toHex("rgba(0 0 0 / 0.5)")).toBeUndefined();
    expect(toHex({ colorSpace: "oklch", components: [0.5, 0.1, 20] })).toBeUndefined();
    expect(toHex(undefined)).toBeUndefined();
  });
});

describe("a kit's contrast pairs", () => {
  const root = resolve(import.meta.dir, "..");
  const command = process.env.TOKENS_BIN ? [resolve(process.env.TOKENS_BIN)] : ["bun", join(root, "bin/tokens.mjs")];
  const run = (cwd: string, ...args: string[]) => Bun.spawnSync([...command, ...args], { cwd, stderr: "pipe" });
  const write = (dir: string, file: string, data: unknown) => writeFileSync(join(dir, file), JSON.stringify(data));
  const colours = {
    c: {
      $type: "color",
      bg: { $value: { colorSpace: "srgb", components: [1, 1, 1], hex: "#ffffff" } },
      fg: { $value: { colorSpace: "srgb", components: [0, 0, 0], hex: "#000000" } },
      mark: { $value: { colorSpace: "srgb", components: [0.4627, 0.4627, 0.4627], hex: "#767676" } },
    },
    size: { $type: "dimension", gap: { $value: { value: 4, unit: "px" } } },
  };
  const pairs = [
    { fg: "c.fg", bg: "c.bg", min: 4.5 },
    { fg: "c.mark", bg: "c.bg", min: 3 },
  ];
  // Base is light; the media set (a dark mode) swaps bg and fg, and may override fg further.
  const kit = (contrast: unknown, dark: unknown = { c: { bg: { $value: { colorSpace: "srgb", components: [0, 0, 0], hex: "#000000" } }, fg: { $value: { colorSpace: "srgb", components: [1, 1, 1], hex: "#ffffff" } }, mark: { $value: { colorSpace: "srgb", components: [0.6, 0.6, 0.6], hex: "#999999" } } } }) => {
    const dir = mkdtempSync(join(tmpdir(), "tokens-contrast-"));
    mkdirSync(join(dir, "tokens"));
    write(dir, "tokens/colors.tokens.json", colours);
    write(dir, "tokens/dark.tokens.json", dark);
    writeFileSync(join(dir, "VERSION"), "1.0.0\n");
    writeFileSync(join(dir, "tokens.config.mjs"), `export default {
      targets: ["css"], media: { "(prefers-color-scheme: dark)": ["tokens/dark.tokens.json"] },
      kit: { name: "acme", contrast: ${JSON.stringify(contrast)} },
    };\n`);
    return dir;
  };

  test("pairs that pass in every mode build and check cleanly", () => {
    const dir = kit(pairs);
    expect(run(dir).exitCode).toBe(0);
    expect(run(dir, "--check").exitCode).toBe(0);
  });

  test("a pair under its floor in a media mode fails, naming fg, bg, mode, ratio and floor", () => {
    const dir = kit(pairs, { c: { bg: { $value: { colorSpace: "srgb", components: [0, 0, 0], hex: "#000000" } }, fg: { $value: { colorSpace: "srgb", components: [0.3059, 0.3059, 0.3059], hex: "#4e4e4e" } }, mark: { $value: { colorSpace: "srgb", components: [0.6, 0.6, 0.6], hex: "#999999" } } } });
    for (const args of [[], ["--check"]]) {
      const result = run(dir, ...args);
      expect(result.exitCode).toBe(1);
      const message = result.stderr.toString();
      expect(message).toContain("c.fg");
      expect(message).toContain("c.bg");
      expect(message).toContain("(prefers-color-scheme: dark)");
      expect(message).toContain("2.52");
      expect(message).toContain("c.fg (#4e4e4e)");
      expect(message).toContain("c.bg (#000000)");
      expect(message).toContain("4.5");
      expect(message).not.toContain("base");
    }
  });

  test("a pair under its floor in the base tokens names the base mode", () => {
    const dir = kit([{ fg: "c.mark", bg: "c.bg", min: 4.6 }]);
    const result = run(dir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toMatch(/c\.mark.*c\.bg.*4\.54.*base.*4\.6/);
  });

  test("a failing build writes nothing", () => {
    const dir = kit([{ fg: "c.mark", bg: "c.bg", min: 4.6 }]);
    run(dir);
    expect(() => readFileSync(join(dir, "src/styles/tokens.css"))).toThrow();
  });

  test("a path that is not a token fails, naming it", () => {
    const result = run(kit([{ fg: "c.nope", bg: "c.bg", min: 4.5 }]));
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("c.nope");
  });

  test("a path that is not a colour fails, naming it", () => {
    const result = run(kit([{ fg: "c.fg", bg: "size.gap", min: 4.5 }]));
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("size.gap");
  });

  test("a pair with no numeric min fails, naming the pair", () => {
    const result = run(kit([{ fg: "c.fg", bg: "c.bg" }]));
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("kit.contrast");
  });

  test("with no kit, nothing is checked and the golden outputs stay byte-identical", () => {
    const dir = mkdtempSync(join(tmpdir(), "tokens-contrast-golden-"));
    cpSync(join(root, "tests/fixture"), dir, { recursive: true });
    expect(run(dir).exitCode).toBe(0);
    for (const file of ["src/styles/tokens.css", "theme.json", "DESIGN.md"]) {
      expect(readFileSync(join(dir, file), "utf8")).toBe(readFileSync(join(root, "tests/expected", file), "utf8"));
    }
    rmSync(dir, { recursive: true });
  });
  test("a hex string in a token that is not a colour is refused", () => {
    const dir = kit([{ fg: "label.ink", bg: "c.bg", min: 4.5 }]);
    write(dir, "tokens/label.tokens.json", { label: { $type: "string", ink: { $value: "#000000" } } });
    const result = run(dir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("label.ink is not an opaque colour");
  });
});
