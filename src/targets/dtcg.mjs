// DTCG: the kit's resolved tokens as DTCG 2025.10 files that any tool reads, kumiko too (as an `include` layer, with
// each other mode's file under that mode's `media` query). <path>/<name>.tokens.json holds the base mode;
// <path>/<name>.<mode>.tokens.json holds each other mode's tokens whose value differs from the base. Aliases are
// resolved. Material's own component tokens that the kit leaves alone stay out: a project that wants them includes
// builtin:material beneath these files.
// Options: path (a directory).
import { join, resolve } from "node:path";
import { text } from "../header.mjs";
import { need, needKit } from "../system.mjs";

const kept = (token) => !(token.builtin && token.path.startsWith("md.comp."));
// A colour as DTCG 2025.10 writes it: a derived role, and an alias of one, holds a hex string.
const value = ({ type, raw }) => {
  if (type !== "color" || typeof raw !== "string") return raw;
  const [r, g, b, alpha] = [1, 3, 5, 7].map((at) => Math.round(parseInt(raw.slice(at, at + 2), 16) / 255 * 1e4) / 1e4);
  return { colorSpace: "srgb", components: [r, g, b], ...(raw.length === 9 && { alpha }), hex: raw.slice(0, 7).toLowerCase() };
};

const file = (tokens, description) => {
  const root = { $description: description };
  for (const token of tokens) {
    let node = root;
    for (const segment of token.segments.slice(0, -1)) {
      node = node[segment] ??= {};
      if ("$value" in node) throw new Error(`dtcg: ${token.path} sits inside the token ${segment}`);
    }
    node[token.segments.at(-1)] = { $type: token.type, $value: value(token), ...(token.description && { $description: token.description }) };
  }
  return `${JSON.stringify(root, null, 2)}\n`;
};

export default {
  name: "dtcg",
  async build({ tokens, media, mediaTokens, options, name, version, modes = { media: {} } }) {
    needKit({ name, version }, "dtcg");
    const dir = need(options, "dtcg", "path");
    if (resolve(dir) === resolve("tokens")) throw new Error("dtcg: tokens/ is the project's own token source; write the output elsewhere");
    const header = text({ name, version }, "dtcg");
    const base = tokens.filter(kept);
    const paths = new Set(base.map((token) => token.path));
    const baseRaw = new Map(base.map((token) => [token.path, JSON.stringify(token.raw)]));
    const files = [{ path: join(dir, `${name}.tokens.json`), content: file(base, header) }];
    for (const [query, layers] of Object.entries(media)) {
      const mode = modes.media[query];
      if (!mode) throw new Error(`dtcg: the mode for ${query} has no name in theme.toml`);
      const differ = (await mediaTokens(layers)).filter((token) => paths.has(token.path) && JSON.stringify(token.raw) !== baseRaw.get(token.path));
      files.push({ path: join(dir, `${name}.${mode}.tokens.json`), content: file(differ, `${header}; the ${mode} mode (${query}), over ${name}.tokens.json`) });
    }
    return files;
  },
};
