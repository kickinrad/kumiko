// A second kit for the plugin output, unlike tests/playground: other names, modes, rules and outputs, and no Beer.
export default {
  targets: ["css", "material-you", "compose-tv", "plugin"],
  include: ["builtin:material"],
  kit: { name: "tern" },
  css: { path: "web/tern.css" },
  "material-you": { path: "home/tern.css" },
  "compose-tv": { out: "tv", package: "org.example.tern" },
  plugin: { path: "agent/tern", repository: "https://example.org/tern", links: { "Style guide": "https://example.org/tern/guide" } },
};
