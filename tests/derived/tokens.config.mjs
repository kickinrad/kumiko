// A small kit for the derived target: one custom accent, a two-item mark group, one darker in Day.
// The container, fixed and Day-mark notes and the two file notes are the kit's own; the rest are the engine's.
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
    descriptions: {
      night: "Acme night roles; do not edit.",
      day: "Acme day roles; do not edit.",
      container: (accent, pct) => `Acme: ${accent} at ${pct} % over the card`,
      markDay: () => "Acme: the slow mark is darker in Day",
    },
  },
};
