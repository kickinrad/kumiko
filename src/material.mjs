// The built-in Material 3 baseline: androidx's token files (Apache-2.0), vendored as one file by
// scripts/vendor-m3.mjs, plus the Material values those files lack, hand-written with their sources in
// material-guidance.tokens.json. Both are bundled JSON imports, so a compiled binary carries them. A config lists
// "builtin:material" in `include`; it sits beneath every file include and the project's own tokens. The vendored
// tv-material card defaults are a layer of their own, "builtin:material-tv", for a TV app to add.
import vendored from "../material/material.tokens.json" with { type: "json" };
import guidance from "./material-guidance.tokens.json" with { type: "json" };

const isGroup = (value) => value && typeof value === "object" && !Array.isArray(value) && !("$value" in value);
// The guidance only adds: a path the vendored files already hold is a mistake in it.
const add = (target, source, path = []) => {
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith("$")) continue;
    const here = [...path, key];
    if (isGroup(value)) add(target[key] ??= {}, value, here);
    else if (key in target) throw new Error(`material-guidance.tokens.json repeats ${here.join(".")}, which material/ holds`);
    else target[key] = value;
  }
  return target;
};

const TV = "tv-card";
const { [TV]: tvCard, ...comp } = vendored.md.comp;

export default { name: "builtin:material", tokens: () => add(structuredClone({ ...vendored, md: { ...vendored.md, comp } }), structuredClone(guidance)) };
export const tv = { name: "builtin:material-tv", tokens: () => ({ md: { comp: { [TV]: structuredClone(tvCard) } } }) };
