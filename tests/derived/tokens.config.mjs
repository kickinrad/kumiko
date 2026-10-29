// A small kit for the derived target: one custom accent, a two-item mark group, one darker in Day.
export default {
  targets: ["derived"],
  media: { "(prefers-color-scheme: light)": ["tokens/day.tokens.json", "tokens/derived-day.tokens.json"] },
  derived: {
    prefix: "acme",
    accents: ["primary", "amber"],
    custom: ["amber"],
    fixed: ["primary"],
    blend: "acme.color.container-opacity",
    marks: { group: "track", darkerInDay: ["slow"] },
    dayFiles: ["tokens/day.tokens.json"],
    out: { night: "tokens/derived.tokens.json", day: "tokens/derived-day.tokens.json" },
  },
};
