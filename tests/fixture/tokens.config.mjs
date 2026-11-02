export default {
  targets: ["css", "design-md"],
  media: { "(max-width: 850px)": ["tokens/stack.tokens.json"] },
  css: { layer: "tokens", prelude: "@font-face { font-family: Test; }" },
};
