// A small kit for the web targets: three colours in two modes, a spacing token, and the two tokens the beer target can name.
export default {
  targets: ["css", "beer"],
  media: { "(prefers-color-scheme: light)": ["tokens/day.tokens.json"] },
  css: { path: "out/tokens.css", scheme: "dark" },
  beer: { path: "out/beer.css", iconFont: "acme.typeface.icon", shadowOpacity: "acme.elevation.shadow-opacity" },
};
