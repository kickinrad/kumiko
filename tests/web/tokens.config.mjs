// A small kit for the web targets: three colours in two modes, a spacing token, and the two kit tokens the beer target reads.
export default {
  targets: ["css", "beer"],
  kit: { name: "acme" },
  media: { "(prefers-color-scheme: light)": ["tokens/day.tokens.json"] },
  css: { path: "out/tokens.css", scheme: "dark" },
  beer: { path: "out/beer.css" },
};
