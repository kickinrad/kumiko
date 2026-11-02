// A small kit for the tailwind, compose-tv, obsidian, mealie and material-you outputs.
export default {
  targets: ["tailwind", "compose-tv", "obsidian", "mealie", "material-you"],
  include: ["builtin:material"],
  kit: { name: "acme" },
  tailwind: { path: "ports/tailwind/acme.css", css: "ports/css/acme.css" },
  obsidian: { out: "ports/obsidian/acme" },
  "compose-tv": { out: "ports/compose-tv", package: "com.example.acme" },
  "material-you": { path: "ports/home-assistant/acme.css" },
  mealie: { out: "ports/mealie/acme" },
};
