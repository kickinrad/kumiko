// A small kit for the tailwind, compose-tv, obsidian and mealie outputs.
export default {
  targets: ["tailwind", "compose-tv", "obsidian", "mealie"],
  include: ["builtin:material"],
  kit: { name: "acme", root: "design" },
  tailwind: { path: "ports/tailwind/acme.css", css: "ports/css/acme.css", title: "Acme", generatedBy: "the acme fixture" },
  obsidian: {
    out: "ports/obsidian/acme",
    modes: ["Night", "Day"],
    title: "Acme",
    tagline: "Acme accents on grey.",
    generatedBy: "the acme fixture",
    license: "MIT License",
  },
  "compose-tv": {
    out: "ports/compose-tv",
    package: "com.example.acme",
    title: "Acme Kit",
    short: "Acme",
    generatedBy: "the acme fixture",
    ownColours: "(yellow, orange, cyan, green)",
    fontNote: ["Some Sans and Some Mono are variable fonts expected under res/font."],
  },
  mealie: {
    out: "ports/mealie/acme",
    title: "Acme",
    modes: ["Night", "Day"],
    generatedBy: "the acme fixture; edit that, not this.",
    palette: {
      slots: { primary: "cyan", accent: "teal", secondary: "yellow", success: "green", info: "teal", warning: "orange", error: "red" },
      overlay: { primary: "blue", accent: "blue", secondary: "blue", success: "green", info: "teal", warning: "orange", error: "red" },
      layers: ["crust", "mantle", "base", "surface0", "surface1"],
      text: "text",
      muted: "subtext1",
      stars: "yellow",
    },
  },
};
