// Plugin: the kit's agent plugin, one directory that Claude Code and Codex both install, written under options.path:
// .claude-plugin/plugin.json (the manifest), skills/<name>/SKILL.md (when the kit applies, the kit's rules from
// notes.md, then how to build on it: the standard, the components, the outputs, token names), and beside it
// references/components.md (each component with its Material 3 guidance and, with a beer output, Beer's markup) and
// references/theme.toml (the kit's theme.toml, for agents outside the kit's checkout). One template serves every kit;
// everything kit-specific comes from the theme, notes.md and the config.
// Options: path (a directory); optional repository (a URL, where the kit's files are), author ({ name, email?, url? }),
// links ({ label: url }, listed under the skill's references).
import { join, relative } from "node:path";
import specimens from "../web/components.js";
import { fontLinks, iconLink } from "../web/foundations.js";
import { text } from "../header.mjs";
import { need, needKit } from "../system.mjs";

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const M3 = "https://m3.material.io/";
const BEER_DOCS = "https://github.com/beercss/beercss/blob/main/docs/";

// The surfaces a kit's outputs build UI on, for the skill's trigger.
const SURFACES = { css: "web pages", beer: "web pages", tailwind: "web pages", "material-you": "Home Assistant dashboards",
  "compose-tv": "Compose for TV screens", obsidian: "Obsidian", mealie: "Mealie" };

// Each built-in output as the skill lists it, those that build UI first: its files, from its own options (with the
// output's own defaults), and its use.
const OUTPUTS = {
  css: (o, kit) => `\`${o.path ?? "src/styles/tokens.css"}\`: the tokens as CSS custom properties${o.scheme ? `, each colour one \`light-dark()\` on \`:root\` that follows the system, or \`data-theme\` on any element to pin a mode (a Baseline 2024 browser)` : ""}.`,
  beer: (o) => `\`${o.path ?? "src/styles/beer.css"}\`: Beer CSS on the theme; load it after Beer and the css output.`,
  tailwind: (o) => `\`${o.path}\`: Tailwind utilities on the css output.`,
  "material-you": (o) => `\`${o.path}\`: Home Assistant's Material You theme, which follows its light or dark mode.`,
  "compose-tv": (o) => `\`${o.out}/\`: Compose for TV colours, type, shapes, tokens and motion in \`${o.package}\`; the app writes the theme.`,
  obsidian: (o) => `\`${o.out}-<mode>.css\`: Obsidian snippets for Minimal, one per mode.`,
  mealie: (o) => `\`${o.out}.env\` and \`${o.out}.css\`: Mealie's theme variables and its CSS overlay.`,
  "design-md": (o) => `\`${o.path ?? "DESIGN.md"}\`: the DESIGN.md front matter.`,
  "claude-design": (o) => `\`${o.path}/project/\`: the Claude Design System's files.`,
  playground: (o) => `\`${o.path}/\`: the playground, every component live with the foundations and the rules; serve the checkout over HTTP and open it.`,
};

// Markdown headings one level down, so notes.md sits under the skill's own. Fenced code is left alone: a fence
// closes on a line of its own character at least as long as it opened, as CommonMark has it.
const demote = (markdown) => {
  let fence;
  return markdown.split("\n").map((line) => {
    const mark = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (mark && mark[1][0] === fence[0] && mark[1].length >= fence.length && !mark[2].trim()) fence = undefined;
      return line;
    }
    if (mark && !(mark[1][0] === "`" && mark[2].includes("`"))) { fence = mark[1]; return line; }
    return /^ {0,3}#{1,5}(\s|$)/.test(line) ? line.replace(/#/, "##") : line;
  }).join("\n");
};

const guidance = (m3) => m3 ? `[Material 3](${M3}${m3.includes("/") ? m3 : `components/${m3}/overview`})` : "";

export default {
  name: "plugin",
  async build(ctx) {
    needKit(ctx, "plugin");
    const { tokens, options, config, readExisting, root, name, version, title, theme = {}, modes = { base: "base", media: {} } } = ctx;
    const dir = need(options, "plugin", "path");
    if (!NAME.test(name) || name.length > 64) throw new Error(`plugin needs a kit name in kebab-case of at most 64 characters, not "${name}"`);
    const kitRoot = relative(process.cwd(), root) || ".";
    const notesPath = join(kitRoot, "notes.md");
    const themePath = join(kitRoot, "theme.toml");
    const notes = await readExisting(join(root, "notes.md"));
    if (notes === undefined) throw new Error(`plugin needs ${notesPath}: the skill carries the kit's rules`);
    const themeToml = await readExisting(join(root, "theme.toml"));
    if (themeToml === undefined) throw new Error(`plugin needs ${themePath}`);

    const targets = config.targets.filter((target) => typeof target === "string");
    // A project's own output, listed as an object: its name, and its file when its options name one.
    const own = config.targets.filter((target) => typeof target === "object" && target.name !== "plugin").map((target) => {
      const at = config[target.name]?.path ?? config[target.name]?.out;
      return `   - ${target.name}: ${at ? `\`${at}\`, ` : ""}the project's own output.`;
    });
    const material = (config.include ?? []).includes("builtin:material");
    const web = targets.includes("beer");
    const css = targets.includes("css");
    const surfaces = [...new Set(Object.keys(SURFACES).filter((target) => targets.includes(target)).map((target) => SURFACES[target]))];
    const list = (items) => items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
    const base = material ? "Material 3 with its own theme" : "its own tokens";
    const description = `Build UI on the ${title} kit: ${base}. Use when building or changing ${surfaces.length ? `UI${css ? ", even a quick one-file page," : ""} for ${list(surfaces)}` : `UI on ${title}`} unless another kit is selected, or for ${title}'s colours, tokens, type or shapes. Not for a project's own kit or design system.`;
    if (/[<>]/.test(description) || description.length > 350) throw new Error(`plugin: the skill's description must be at most 350 characters with no angle brackets: ${description}`);

    const outputs = Object.keys(OUTPUTS).filter((target) => targets.includes(target))
      .map((target) => `   - ${target}: ${OUTPUTS[target](config[target] ?? {}, { name, modes })}`).concat(own);
    // A web page's head, in the order the outputs load: the kit's faces, Beer in a cascade layer beneath the kit, then
    // the kit's files, where the page can reach them.
    const icon = tokens.find((token) => token.path === `${name}.typeface.icon`)?.value.split(",")[0].trim().replace(/^["']|["']$/g, "");
    const head = !css ? "" : `\n\n\`\`\`html\n${[
      ...[...fontLinks(tokens), ...(icon ? [iconLink(icon)] : [])].map((href) => `<link rel="stylesheet" href="${href}">`),
      ...(web ? ['<style>@import url("https://cdn.jsdelivr.net/npm/beercss/dist/cdn/beer.min.css") layer(beer);</style>'] : []),
      `<link rel="stylesheet" href="${config.css?.path ?? "src/styles/tokens.css"}">`,
      ...(web ? [`<link rel="stylesheet" href="${config.beer?.path ?? "src/styles/beer.css"}">`, '<script type="module" src="https://cdn.jsdelivr.net/npm/beercss/dist/cdn/beer.min.js"></script>'] : []),
    ].join("\n")}\n\`\`\`\n\nPoint the kit's ${web ? "two links" : "link"} at its files where the page runs: a copy beside it, or a checkout of the kit at its newest tag.`;
    const where = `${options.repository ? `[the kit's repository](${options.repository})` : "the kit's repository"} at its newest tag`;
    const links = [
      ...(material ? [`- [Material 3](${M3}): [components](${M3}components), [styles](${M3}styles) (colour, type, shape, motion) and [foundations](${M3}foundations) (layout, interaction, accessibility).`] : []),
      ...(web ? [`- [Beer CSS](https://github.com/beercss/beercss/tree/main/docs): the markup of each web component.`] : []),
      ...Object.entries(options.links ?? {}).map(([label, url]) => `- [${label}](${url})`),
    ];

    const skill = `---
name: ${name}
description: ${JSON.stringify(description)}
---

# ${title}

${title} ${version} is a UI kit: ${base}${theme.tagline ? `. ${theme.tagline}` : "."}

## Which kit

Check this first. Use ${title} when the user names it or the project selects it: the project is the kit's repository, loads its outputs, or its agent instructions name it. When the user or the project selects another kit or design system, use that one and stop here. ${options.default ? `When nothing selects a kit, ${title} is the default: use it.` : "When nothing selects a kit and another kit is also available, stop and ask the user which one before building anything, even in a hurry."} Never mix two kits in one UI.

## Under time pressure

A quick ${css ? "page" : "screen"} is still the kit. ${css ? `Link ${web ? "Beer, then the css and beer outputs," : "the css output"} and use ${web ? "Beer's markup for every control" : "the documented components"}; inline styles may only lay out the page.${head}` : "Use the documented components and the outputs."} "In a hurry", "one file", "inline styles" and "no dependencies" never justify a hand-drawn control or a value copied out of theme.toml. If the ${css ? "page" : "screen"} truly cannot load the outputs, say so and ask.

## ${title}'s rules

These are \`${notesPath}\` at ${version}. Every screen follows them and adds none of its own.

${demote(notes.replace(/^# .*\n+/, "").trim())}

## Build

1. **Read the kit, never memory.** In the kit's checkout, read \`${notesPath}\` and \`${themePath}\`; elsewhere the rules are above and [theme.toml](references/theme.toml) is the kit's copy. theme.toml holds the kit's choices: the palette, the colour each role takes, the faces and the kit's own tokens. A token at a Material path is an exception, and its \`why\` says why. Every other value is ${material ? "Material 3's" : "the kit's other layers'"}; the outputs below hold each resolved one.
2. **Pick documented components.** Before writing code, map every part of the UI to a component in [components.md](references/components.md). For an unfamiliar control, first read its ${material ? "Material 3 guidance" : "guidance"}${web ? " and its Beer markup" : ""}. Use the component's own markup, behaviour and states, and add only the theme. When none fits, tell the user what is missing; in the kit's repository, add it to the kit, never a one-off.
3. **Wire the outputs**, files in ${where}:
${outputs.join("\n")}
4. **Write token names, never values:** ${material ? "\`md.*\` for Material 3, " : ""}\`${name}.*\` for the kit's own. In CSS a name is its path with dashes, as \`${material ? "md.sys.color.primary" : `${name}.color.primary`}\` is \`--${material ? "md-sys-color-primary" : `${name}-color-primary`}\`${css ? `; the css output lists each one${material && web ? ", with Material's component tokens only where the beer output reads them (a platform that needs the rest builds them with `tokens` from `builtin:material`)" : ""}` : ""}. The modes are ${[modes.base, ...Object.values(modes.media)].map((mode) => `\`${mode}\``).join(" and ")}; a value that differs by mode keeps one name.
5. **Name your choices.** Say which component each part uses and its source, in the answer or the change description.

Done when each part of the UI is a documented component, named with its source. Every colour, size, shape, type and motion value is a token name.

## References

${links.length ? `${links.join("\n")}\n` : ""}- [components.md](references/components.md): each component and its sources.
- [theme.toml](references/theme.toml): the kit's values at ${version}.
`;

    const components = `# ${title}'s components

The components the kit themes, in ${material ? "Material 3's" : "their"} families.${web ? " On the web each is Beer CSS's markup on the kit's theme." : ""}${targets.includes("playground") ? ` The playground (\`${config.playground?.path}/\`) shows each live.` : ""}

| Component | Family |${material ? " Guidance |" : ""}${web ? " Web markup |" : ""}
| --- | --- |${material ? " --- |" : ""}${web ? " --- |" : ""}
${specimens.filter((item) => web || item.m3).map((item) => `| ${item.name} | ${item.family} |${material ? ` ${guidance(item.m3) || "none in Material 3"} |` : ""}${web ? ` [Beer ${item.doc}](${BEER_DOCS}${item.doc}.md) |` : ""}`).join("\n")}
`;

    const manifest = {
      name,
      description: `Build UI on the ${title} kit: its rules, components, outputs and token names.`,
      ...(options.author && { author: options.author }),
      ...(options.repository && { repository: options.repository }),
      keywords: [name, ...(material ? ["material-3"] : []), "design-system", "ui"],
    };

    const skillDir = join(dir, "skills", name);
    return [
      { path: join(dir, ".claude-plugin/plugin.json"), content: `${JSON.stringify(manifest, null, 2)}\n` },
      { path: join(skillDir, "SKILL.md"), content: skill },
      { path: join(skillDir, "references/components.md"), content: components },
      // TOML has comments, so the copy carries the header the stamp gives the formats it knows.
      { path: join(skillDir, "references/theme.toml"), content: `# ${text({ name, version }, "plugin")}\n${themeToml}` },
    ];
  },
};
