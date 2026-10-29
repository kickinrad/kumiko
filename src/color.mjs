// Colour arithmetic shared by every target and check: WCAG contrast, sRGB mixes, on-colours and
// Material state layers over a surface. Pure functions over hex strings; no palette knowledge.
// sRGB to linear, the sRGB spec's threshold (IEC 61966-2-1: 0.04045; WCAG 2.0 printed 0.03928, WCAG 2.1 corrected it).
export const SRGB_LINEAR_THRESHOLD = 0.04045;
export const linear = (v) => (v <= SRGB_LINEAR_THRESHOLD ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const luminance = (hex) => {
  const [r, g, b] = hex.match(/[0-9a-f]{2}/gi).map((c) => linear(Number.parseInt(c, 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hex2 = (n) => Math.round(n).toString(16).padStart(2, '0');
// Blend `pct` percent of b into a, in sRGB (what CSS color-mix(in srgb) does).
export const mix = (a, b, pct) => {
  const [x, y] = [a, b].map((h) => h.match(/[0-9a-f]{2}/gi).map((v) => Number.parseInt(v, 16)));
  return `#${x.map((v, i) => hex2(v + (y[i] - v) * (pct / 100))).join('')}`;
};
// The candidate that reads best on a solid fill: [hex, ratio].
export const bestOn = (fill, candidates) => candidates
  .map((hex) => [hex, contrast(hex, fill)])
  .sort((x, y) => y[1] - x[1])[0];
// A Material state layer: `pct` percent of the accent over a surface, as a solid hex.
export const stateLayer = (surface, accent, pct) => mix(surface, accent, pct);
// The smallest mix of `accent` toward `text` that reaches AA (4.5:1) on every surface given.
export const textSafe = (accent, text, surfaces) => {
  for (let pct = 0; pct <= 100; pct += 1) {
    const value = pct ? mix(accent, text, pct) : accent;
    const worst = Math.min(...surfaces.map((s) => contrast(value, s)));
    if (worst >= 4.5) return { value, pct, worst };
  }
  throw new Error(`No AA mix for ${accent}`);
};
// Tokens keyed by path, for targets that look roles up by name.
export const byPath = (tokens) => new Map(tokens.map((t) => [t.path, t]));
// Hex to [h, s, l] with h in degrees and s, l in percent, rounded, for Obsidian's --accent-h/s/l.
export const hsl = (hex) => {
  const [r, g, b] = hex.match(/[0-9a-f]{2}/gi).map((c) => Number.parseInt(c, 16) / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min; const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
};
export const rgb = (hex) => hex.match(/[0-9a-f]{2}/gi).map((c) => Number.parseInt(c, 16));
