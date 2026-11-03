// A small kit with two modes, a note and one described token, for the playground output.
export default {
  targets: ["css", "beer", "playground"],
  include: ["builtin:material"],
  kit: { name: "acme" },
  css: { path: "ports/css/kit.css", scheme: "dark" },
  beer: { path: "ports/css/kit-beer.css" },
  playground: { path: "docs/play" },
};
