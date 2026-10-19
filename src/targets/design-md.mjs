// DESIGN.md: replaces only the schema-supported frontmatter groups (colors,
// typography, rounded, spacing); name, description, other keys and the body stay.
import YAML from "yaml";

export default {
  name: "design-md",
  async build({ tokens, options, readExisting }) {
    const { path = "DESIGN.md" } = options;
    const current = await readExisting(path) ?? "";
    const match = current.startsWith("---")
      ? current.match(/^---\r?\n([\s\S]*?)^---(?:\r?\n|$)/m) : null;
    if (current.startsWith("---") && !match) throw new Error(`Unclosed ${path} frontmatter`);
    const document = YAML.parseDocument(match ? match[1] : "");
    if (document.errors.length) throw new Error(`Invalid ${path} frontmatter: ${document.errors[0].message}`);
    document.contents ??= new YAML.YAMLMap();
    const existing = document.toJS();
    if (existing !== null && (typeof existing !== "object" || Array.isArray(existing))) {
      throw new Error(`Invalid ${path} frontmatter: expected a mapping`);
    }
    const frontmatter = { colors: {}, typography: {}, rounded: {}, spacing: {} };
    for (const token of tokens) {
      if (token.fluid !== undefined) continue;
      const slug = (token.segments.length > 1 && ["color", "colors", "typography"].includes(token.segments[0])
        ? token.segments.slice(1) : token.segments).join("-");
      if (token.type === "color") frontmatter.colors[slug] = token.value;
      if (token.type === "typography") frontmatter.typography[slug] = token.typography;
      if (token.type === "dimension") {
        const radiusAt = token.segments.findIndex((part) => ["radius", "rounded"].includes(part));
        const spaceAt = token.segments.findIndex((part) => ["space", "spacing"].includes(part));
        if (radiusAt >= 0) frontmatter.rounded[token.segments.slice(radiusAt + 1).join("-")] = token.value;
        else if (spaceAt >= 0) frontmatter.spacing[token.segments.slice(spaceAt + 1).join("-")] = token.value;
      }
    }
    for (const group of Object.keys(frontmatter)) {
      if (Object.keys(frontmatter[group]).length) document.setIn([group], frontmatter[group]);
    }
    document.deleteIn(["tokens"]);
    const body = match ? current.slice(match[0].length) : current;
    return [{ path, content: `---\n${document.toString({ lineWidth: 0 })}---\n${body}` }];
  },
};
