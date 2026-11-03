// Plugin: the kit's agent plugin, one directory that Claude Code and Codex both install, written under options.path:
// .claude-plugin/plugin.json (the manifest) and, beside the kit's own skills/<name>/SKILL.md, its references:
// components.md (each component with its Material 3 guidance and, with a beer output, Beer's markup), notes.md (the
// kit's rules) and theme.toml (the kit's values), for agents outside the kit's checkout. The kit writes SKILL.md
// itself, so its wording changes with the kit, not with the engine.
// Options: path (a directory); optional repository (a URL, where the kit's files are) and author ({ name, email?, url? }).
import { join, relative } from "node:path";
import specimens from "../web/components.js";
import { text } from "../header.mjs";
import { need, needKit } from "../system.mjs";

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const M3 = "https://m3.material.io/";
const BEER_DOCS = "https://github.com/beercss/beercss/blob/main/docs/";

const guidance = (m3) => m3 ? `[Material 3](${M3}${m3.includes("/") ? m3 : `components/${m3}/overview`})` : "";

export default {
  name: "plugin",
  async build(ctx) {
    needKit(ctx, "plugin");
    const { options, config, readExisting, root, name, version, title } = ctx;
    const dir = need(options, "plugin", "path");
    if (!NAME.test(name) || name.length > 64) throw new Error(`plugin needs a kit name in kebab-case of at most 64 characters, not "${name}"`);
    const skillDir = join(dir, "skills", name);
    if (await readExisting(join(skillDir, "SKILL.md")) === undefined) throw new Error(`plugin needs ${join(skillDir, "SKILL.md")}: the kit writes its own skill`);
    const kitRoot = relative(process.cwd(), root) || ".";
    const notes = await readExisting(join(root, "notes.md"));
    if (notes === undefined) throw new Error(`plugin needs ${join(kitRoot, "notes.md")}: the kit's rules`);
    const themeToml = await readExisting(join(root, "theme.toml"));
    if (themeToml === undefined) throw new Error(`plugin needs ${join(kitRoot, "theme.toml")}`);

    const targets = config.targets.filter((target) => typeof target === "string");
    const material = (config.include ?? []).includes("builtin:material");
    const web = targets.includes("beer");
    const components = `# ${title}'s components

The components the kit themes, in ${material ? "Material 3's" : "their"} families.${web ? " On the web each is Beer CSS's markup on the kit's theme." : ""}${targets.includes("playground") ? ` The playground (\`${config.playground?.path}/\`) shows each live.` : ""}

| Component | Family |${material ? " Guidance |" : ""}${web ? " Web markup |" : ""}
| --- | --- |${material ? " --- |" : ""}${web ? " --- |" : ""}
${specimens.filter((item) => web || item.m3).map((item) => `| ${item.name} | ${item.family} |${material ? ` ${guidance(item.m3) || "none in Material 3"} |` : ""}${web ? ` [Beer ${item.doc}](${BEER_DOCS}${item.doc}.md) |` : ""}`).join("\n")}
`;

    const manifest = {
      name,
      description: `Build UI on the ${title} kit: its rules, components and token names.`,
      ...(options.author && { author: options.author }),
      ...(options.repository && { repository: options.repository }),
      keywords: [name, ...(material ? ["material-3"] : []), "design-system", "ui"],
    };

    return [
      { path: join(dir, ".claude-plugin/plugin.json"), content: `${JSON.stringify(manifest, null, 2)}\n` },
      { path: join(skillDir, "references/components.md"), content: components },
      { path: join(skillDir, "references/notes.md"), content: notes },
      // TOML has comments, so the copy carries the header the stamp gives the formats it knows.
      { path: join(skillDir, "references/theme.toml"), content: `# ${text({ name, version }, "plugin")}\n${themeToml}` },
    ];
  },
};
