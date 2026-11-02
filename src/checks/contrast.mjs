// A kit declares contrast pairs as kit.contrast: [{ fg, bg, min }] (token paths, min a ratio).
// Every pair is resolved in the base tokens and in each media set, and a pair under its floor fails.
import { contrast } from "../color.mjs";

// An opaque colour as the build writes it (#rrggbb), else undefined.
export const toHex = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/.test(value) ? value : undefined;

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
        else if (token.type !== "color" || !toHex(token.value)) failures.push(`${path} is not an opaque colour (${mode})`);
        else return toHex(token.value);
        return undefined;
      });
      if (colours.includes(undefined)) continue;
      const ratio = contrast(...colours);
      if (ratio < min) failures.push(`${fg} (${colours[0]}) on ${bg} (${colours[1]}) is ${ratio.toFixed(2)}:1 in ${mode}, under the ${min}:1 floor`);
    }
  }
  if (failures.length) throw new Error(`Contrast check failed:\n${[...new Set(failures)].map((line) => `  ${line}`).join("\n")}`);
};
