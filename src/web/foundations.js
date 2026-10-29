// Foundations: the kit's values, read from the mode's tokens and drawn in the live theme's variables.
// Each item is { id, name, body(data, tokens) → html }.
import { contrast } from "../color.mjs";

// Colour: each Material role as a tile in its own colour (the live theme's variable) under its on-colour's
// text, with the ratio between the two from the mode's tokens. A role with no on-colour of its own takes
// on-surface; the on-colours are the text, so they have no tile.
const COLOR = "md.sys.color.";
export const colour = (tokens) => {
  const roles = new Map(tokens.filter((token) => token.type === "color" && token.path.startsWith(COLOR)).map((token) => [token.path.slice(COLOR.length), token.value]));
  const tiles = [...roles].filter(([role]) => !role.startsWith("on-") && role !== "inverse-on-surface").map(([role, value]) => {
    const on = roles.has(`on-${role}`) ? `on-${role}` : role === "inverse-surface" ? "inverse-on-surface" : "on-surface";
    return `<div class="s6 m4 l3"><div class="padding round" style="background: var(--${COLOR.replaceAll(".", "-")}${role}); color: var(--${COLOR.replaceAll(".", "-")}${on})"><b>${role}</b><br><small>${on} ${contrast(roles.get(on), value).toFixed(2)}:1</small></div></div>`;
  });
  return `<div class="grid">${tiles.join("")}</div>`;
};

export default [{ id: "colour", name: "Colour", body: (data, tokens) => colour(tokens) }];
