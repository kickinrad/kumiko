// React Native / Expo values for both theme modes. CSS-only shadows and Material's unchanged
// component defaults stay out; the rest keep their DTCG path as a nested, typed object.
import { need, needKit, twoModes } from "../system.mjs";
import { typeScale } from "../type.mjs";

// A rem is the web's root font size, 16px by default; em and % depend on a parent React Native does not have.
const REM = 16;
const px = (value, path) => {
  const match = String(value).match(/^(-?\d+(?:\.\d+)?)(px|rem)$/);
  if (!match) throw new Error(`react-native: ${path} must use px or rem for a React Native point value`);
  return Number(match[1]) * (match[2] === "rem" ? REM : 1);
};
const ms = (value, path) => {
  const match = String(value).match(/^(-?\d+(?:\.\d+)?)(ms|s)$/);
  if (!match) throw new Error(`react-native: ${path} must use ms or s`);
  return Number(match[1]) * (match[2] === "s" ? 1000 : 1);
};
const face = (value) => String(value).split(",")[0].trim().replace(/^['"]|['"]$/g, "");
const native = (token) => {
  if (token.type === "dimension") return px(token.value, token.path);
  if (token.type === "duration") return ms(token.value, token.path);
  if (token.type === "fontFamily") return face(token.value);
  if (token.type === "color" || token.type === "fontWeight") return token.value;
  return token.raw;
};
const modeTokens = (tokens) => {
  const root = Object.create(null);
  for (const token of [...tokens].sort((a, b) => a.path.localeCompare(b.path))) {
    if (token.type === "shadow" || token.type === "typography" || (token.builtin && token.path.startsWith("md.comp."))) continue;
    let node = root;
    for (const segment of token.segments.slice(0, -1)) node = node[segment] ??= Object.create(null);
    node[token.segments.at(-1)] = native(token);
  }
  return root;
};
const modeStyles = (tokens) => Object.fromEntries(Object.entries(typeScale(tokens)).map(([name, style]) => [name, {
  fontFamily: face(style.fontFamily), fontSize: px(style.fontSize, `md.sys.typescale.${name}.size`),
  fontWeight: String(style.fontWeight), lineHeight: px(style.lineHeight, `md.sys.typescale.${name}.line-height`),
  letterSpacing: px(style.letterSpacing, `md.sys.typescale.${name}.tracking`),
}]));

export default {
  name: "react-native",
  async build(ctx) {
    needKit(ctx, "react-native");
    const path = need(ctx.options, "react-native", "path");
    if (!path.endsWith(".ts")) throw new Error("react-native: path must end in .ts");
    const [base, other] = twoModes(ctx, "react-native");
    const second = await ctx.mediaTokens(other.files);
    const tokens = { [base.name]: modeTokens(ctx.tokens), [other.name]: modeTokens(second) };
    const textStyles = { [base.name]: modeStyles(ctx.tokens), [other.name]: modeStyles(second) };
    const content = [
      "// Dimensions are React Native points (a rem is 16), durations are milliseconds, and font families name the first installed face.",
      `export const tokens = ${JSON.stringify(tokens, null, 2)} as const;`,
      `export const textStyles = ${JSON.stringify(textStyles, null, 2)} as const;`,
      "export type ThemeMode = keyof typeof tokens;",
      "export type ThemeTokens = (typeof tokens)[ThemeMode];",
      "",
    ].join("\n");
    return [{ path, content }];
  },
};
