// A kit declares contrast pairs as kit.contrast: [{ fg, bg, min }] (token paths, min a ratio).
// Every pair is resolved in the base tokens and in each media set, and a pair under its floor fails.
import { contrast } from "../color.mjs";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const hex2 = (n) => Math.round(n * 255).toString(16).padStart(2, "0");
// An opaque sRGB colour as #rrggbb, from a hex string or a DTCG 2025.10 colour object; else undefined.
export const toHex = (value) => {
  let hex = value;
  if (value && typeof value === "object") {
    if (value.alpha !== undefined && value.alpha !== 1) return undefined;
    const { hex: given, colorSpace, components } = value;
    if (typeof given === "string") hex = given;
    else if (colorSpace === "srgb" && Array.isArray(components) && components.length === 3 &&
        components.every((c) => typeof c === "number" && c >= 0 && c <= 1)) hex = `#${components.map(hex2).join("")}`;
    else return undefined;
  }
  if (typeof hex !== "string" || !HEX.test(hex)) return undefined;
  hex = hex.toLowerCase();
  return hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex;
};

export const checkContrast = async (pairs, { tokens, media, mediaTokens }) => {
  if (pairs === undefined) return;
  if (!Array.isArray(pairs)) throw new Error("kit.contrast must be a list of { fg, bg, min }");
  pairs.forEach((pair, i) => {
    if (!pair || typeof pair.fg !== "string" || typeof pair.bg !== "string" || !Number.isFinite(pair.min)) {
      throw new Error(`kit.contrast[${i}] needs fg and bg token paths and a numeric min`);
    }
  });
  const modes = [["base", tokens]];
  for (const [query, files] of Object.entries(media)) modes.push([query, await mediaTokens(files)]);
  const failures = [];
  for (const [mode, set] of modes) {
    const byPath = new Map(set.map((token) => [token.path, token]));
    for (const { fg, bg, min } of pairs) {
      const colours = [fg, bg].map((path) => {
        const token = byPath.get(path);
        if (!token) failures.push(`${path} is not a token (${mode})`);
        else if (!toHex(token.scalar)) failures.push(`${path} is not an opaque colour (${mode})`);
        else return toHex(token.scalar);
        return undefined;
      });
      if (colours.includes(undefined)) continue;
      const ratio = contrast(...colours);
      if (ratio < min) failures.push(`${fg} on ${bg} is ${ratio.toFixed(2)}:1 in ${mode}, under the ${min}:1 floor`);
    }
  }
  if (failures.length) throw new Error(`Contrast check failed:\n${[...new Set(failures)].map((line) => `  ${line}`).join("\n")}`);
};
