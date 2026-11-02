// The built-in Material 3 baseline: androidx's token files (Apache-2.0), vendored as one file by
// scripts/vendor-m3.mjs and bundled as a JSON import, so a compiled binary carries it. A config lists
// "builtin:material" in `include`; it sits beneath every file include and the project's own tokens.
import tokens from "../material/material.tokens.json" with { type: "json" };

export default { name: "builtin:material", tokens: () => structuredClone(tokens) };
