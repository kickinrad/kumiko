// The built-in Material 3 baseline: androidx's token files (Apache-2.0), vendored under ../material by
// scripts/vendor-m3.mjs and bundled as JSON imports, so a compiled binary carries them. A config lists
// "builtin:material" in `include`; it sits beneath every file include and the project's own tokens.
import { tokens as files } from "../material/index.mjs";

const isGroup = (value) => value && typeof value === "object" && !Array.isArray(value);
// Files hold disjoint token paths; a leaf declared twice is a vendoring bug, not an override.
const merge = (target, source, path = []) => {
  for (const [key, value] of Object.entries(source)) {
    if (!path.length && key.startsWith("$")) continue;
    const here = [...path, key];
    if (isGroup(value) && !("$value" in value)) merge(target[key] ??= {}, value, here);
    else if (key in target) throw new Error(`Built-in Material declares ${here.join(".")} twice`);
    else target[key] = structuredClone(value);
  }
  return target;
};

export default {
  name: "builtin:material",
  tokens: () => files.reduce((tree, file) => merge(tree, file), {}),
};
