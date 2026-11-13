// The kit's Storybook: Storybook's own UI in the kit, generated docs pages for its foundations and its Material
// mapping, the kit's CSS and faces in every story, and, while kumiko dev runs, its edit panel and live bridge. The
// project keeps its own main.js (framework, stories globs, addons, refs) and points it at these files.
// Options: path (the directory it writes; .storybook by default), dev (kumiko dev's address; http://localhost:4400),
// sites ([{ name, url }]: pages each shown in a story, framed; the stories are @storybook/html-vite's), logo (an image path for the
// sidebar, relative to path). Needs the css output, listed before it.
import { relative } from "node:path";
import { need, needKit } from "../system.mjs";
import { contrastPairs } from "../checks/contrast.mjs";
import { fontLinks } from "../web/foundations.js";
import { source } from "./playground.mjs";

const COLOR = "md.sys.color.";
// The colour scheme a mode's surface is nearer to (as the playground and the panel decide it).
const schemeOf = async (tokens) => {
  const { contrast } = await import("../color.mjs");
  const surface = tokens.find((token) => token.path === `${COLOR}surface`).value;
  return contrast(surface, "#000000") > contrast(surface, "#ffffff") ? "light" : "dark"; // lint: own black and white, the ends a scheme is measured against
};
const px = (value) => Number.parseFloat(value);

// The docs pages' components: each draws from the kit's data, and redraws on every "kumiko:live" event (kumiko dev's
// bridge), so a docs page follows an edit as the stories do.
const KIT_JS = `import React, { useEffect, useState } from "react";
import { ColorItem, ColorPalette, Typeset } from "@storybook/addon-docs/blocks";
import { contrast } from "./color.mjs";
import KIT from "./kit.json";

const h = React.createElement;
const label = (key) => key[0].toUpperCase() + key.slice(1).replaceAll("-", " ");
const useKit = () => {
  const [kit, setKit] = useState(() => ({ ...KIT, ...window.kumikoLive }));
  useEffect(() => {
    const live = (event) => setKit({ ...KIT, ...event.detail });
    window.addEventListener("kumiko:live", live);
    return () => window.removeEventListener("kumiko:live", live);
  }, []);
  return kit;
};
const reader = (kit) => {
  const modes = Object.keys(kit.modes);
  const value = (mode, path) => kit.modes[mode].find((token) => token.path === path)?.value;
  const head = kit.name + ".palette.";
  // The palette colours whose value a token has, in a mode.
  const named = (mode, path) => kit.modes[mode].filter((token) => token.path.startsWith(head) && token.value === value(mode, path)).map((token) => token.path.slice(head.length));
  return { modes, value, head, named };
};
const swatches = (kit, paths, title, subtitle) => {
  const { modes, value } = reader(kit);
  return h(ColorPalette, null, paths.map((path) => h(ColorItem, { key: path, title: title(path), subtitle: subtitle(path), colors: Object.fromEntries(modes.map((mode) => [label(mode), value(mode, path)])) })));
};

// The kit's own colours, both modes side by side.
export const Colours = () => {
  const kit = useKit();
  const { modes, head } = reader(kit);
  const paths = kit.modes[modes[0]].filter((token) => token.path.startsWith(head)).map((token) => token.path);
  return swatches(kit, paths, (path) => label(path.slice(head.length)), (path) => "palette." + path.slice(head.length));
};

// Every pair the build holds the kit to, by the palette colours that fill it, with its ratio in each mode.
export const Contrast = () => {
  const kit = useKit();
  const { modes, value, named } = reader(kit);
  const name = (path) => { const found = named(modes[0], path); return found.length ? label(found[0]) : path.split(".").at(-1); };
  const seen = new Set();
  const rows = (kit.pairs ?? []).filter(({ fg, bg }) => { const key = name(fg) + "/" + name(bg); return !seen.has(key) && seen.add(key); });
  if (!rows.length) return h("p", null, "This kit sets no contrast floors.");
  return h("table", null,
    h("thead", null, h("tr", null, h("th", null, "Text or mark"), h("th", null, "On"), h("th", null, "Floor"), ...modes.map((mode) => h("th", { key: mode }, label(mode))))),
    h("tbody", null, rows.map(({ fg, bg, min }) => h("tr", { key: fg + bg }, h("td", null, name(fg)), h("td", null, name(bg)), h("td", null, min + ":1"),
      ...modes.map((mode) => { const ratio = contrast(value(mode, fg), value(mode, bg)); return h("td", { key: mode }, ratio.toFixed(2) + ":1 " + (ratio >= min ? "passes" : "fails")); })))));
};

// The type roles at their three sizes, each size in its own face and weight (a kit may set a role's sizes apart).
export const Type = () => {
  const kit = useKit();
  const { modes, value } = reader(kit);
  const at = (path) => value(modes[0], "md.sys.typescale." + path);
  return ["display", "headline", "title", "body", "label"].map((role) => h(React.Fragment, { key: role },
    h("h3", null, label(role)),
    ["large", "medium", "small"].map((size) => h(Typeset, { key: size, fontFamily: at(role + "-" + size + ".font"), fontWeight: at(role + "-" + size + ".weight"), fontSizes: [at(role + "-" + size + ".size")], sampleText: kit.tagline ?? "The quick brown fox jumps over the lazy dog" }))));
};

// The kit's own lengths and times, by what they measure, each with a sample drawn in its variable.
const KINDS = [["Spacing", /space|spacing|gap|padding|margin|inset|gutter/], ["Radius", /corner|radius|shape|round/], ["Border width", /border|stroke/], ["Measure", /measure|width|container/]];
export const Measures = () => {
  const kit = useKit();
  const { modes } = reader(kit);
  const own = kit.modes[modes[0]].filter((token) => (kit.tune?.tokens ?? []).includes(token.path));
  if (!own.length) return h("p", null, "This kit sets no lengths or times of its own.");
  const kind = (token) => token.type === "duration" ? "Duration" : KINDS.find(([, test]) => test.test(token.path))?.[0] ?? "Size";
  const css = (token) => "var(--" + token.path.replaceAll(".", "-") + ")";
  const sample = (token) => ({
    Spacing: h("div", { style: { inlineSize: css(token), blockSize: 12, background: "currentColor" } }),
    Radius: h("div", { style: { inlineSize: 48, blockSize: 32, border: "1px solid currentColor", borderRadius: css(token) } }),
    "Border width": h("div", { style: { inlineSize: 48, blockSize: 32, border: css(token) + " solid currentColor" } }),
  })[kind(token)] ?? null;
  const name = (token) => label(token.path.slice(kit.name.length + 1).replaceAll(".", " "));
  return ["Spacing", "Radius", "Border width", "Measure", "Size", "Duration"].map((group) => {
    const rows = own.filter((token) => kind(token) === group);
    return rows.length ? h(React.Fragment, { key: group }, h("h3", null, group), h("table", null, h("tbody", null, rows.map((token) => h("tr", { key: token.path }, h("td", null, name(token)), h("td", null, token.value), h("td", null, sample(token))))))) : null;
  });
};

// How the kit fills Material's colour roles, for the platforms that read them.
export const Roles = () => {
  const kit = useKit();
  const { modes, named } = reader(kit);
  const roles = kit.modes[modes[0]].filter((token) => token.path.startsWith("${COLOR}") && token.type === "color").map((token) => token.path);
  const corners = kit.modes[modes[0]].filter((token) => /^md\\.sys\\.shape\\.corner\\.[a-z-]+$/.test(token.path) && token.type === "dimension").sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
  return h(React.Fragment, null,
    h("h2", null, "Colour roles"),
    swatches(kit, roles, (path) => path.slice("${COLOR}".length), (path) => named(modes[0], path).map(label).join(", ") || "no palette colour"),
    h("h2", null, "Corner scale"),
    h("table", null, h("tbody", null, corners.map((token) => h("tr", { key: token.path }, h("td", null, h("code", null, token.path)), h("td", null, token.value), h("td", null, h("div", { style: { inlineSize: 48, blockSize: 32, border: "1px solid currentColor", borderRadius: "var(--" + token.path.replaceAll(".", "-") + ")" } })))))));
};
`;

export default {
  name: "storybook",
  async build(ctx) {
    needKit(ctx, "storybook");
    const { tokens, media, mediaTokens, options, config, name, title, theme, modes = { base: "base", media: {} } } = ctx;
    const dir = options.path ?? ".storybook";
    const dev = options.dev ?? "http://localhost:4400";
    const cssPath = need(config.css ?? {}, "css", "path");
    if (!config.targets.indexOf || config.targets.indexOf("css") > config.targets.indexOf("storybook")) throw new Error("storybook: list the css output before it");

    const byMode = { [modes.base]: tokens };
    for (const [query, files] of Object.entries(media)) byMode[modes.media[query] ?? query] = await mediaTokens(files);
    const value = (path) => tokens.find((token) => token.path === path)?.value;
    const scheme = await schemeOf(tokens);
    const schemes = Object.fromEntries(await Promise.all(Object.entries(byMode).map(async ([mode, each]) => [mode, await schemeOf(each)])));
    const fonts = [...new Set(Object.values(byMode).flatMap(fontLinks))];
    const local = `["localhost", "127.0.0.1"].includes(location.hostname)`;

    // Storybook's UI from the kit's roles and faces (storybook/theming create(); every value it takes).
    const manager = {
      base: scheme,
      brandTitle: title ?? name,
      ...(options.logo && { brandImage: options.logo }),
      colorPrimary: value(`${COLOR}primary`),
      colorSecondary: value(`${COLOR}primary`),
      appBg: value(`${COLOR}surface-container-low`),
      appContentBg: value(`${COLOR}surface`),
      appPreviewBg: value(`${COLOR}surface`),
      appHoverBg: value(`${COLOR}surface-container-high`),
      appBorderColor: value(`${COLOR}outline-variant`),
      appBorderRadius: px(value("md.sys.shape.corner.medium")),
      fontBase: value("md.sys.typescale.body-medium.font"),
      fontCode: value(`${name}.typeface.mono`) ?? "monospace",
      textColor: value(`${COLOR}on-surface`),
      textInverseColor: value(`${COLOR}inverse-on-surface`),
      textMutedColor: value(`${COLOR}on-surface-variant`),
      barTextColor: value(`${COLOR}on-surface-variant`),
      barHoverColor: value(`${COLOR}primary`),
      barSelectedColor: value(`${COLOR}primary`),
      barBg: value(`${COLOR}surface-container`),
      buttonBg: value(`${COLOR}surface-container-high`),
      buttonBorder: value(`${COLOR}outline-variant`),
      booleanBg: value(`${COLOR}surface-container-highest`),
      booleanSelectedBg: value(`${COLOR}secondary-container`),
      inputBg: value(`${COLOR}surface-container-lowest`),
      inputBorder: value(`${COLOR}outline`),
      inputTextColor: value(`${COLOR}on-surface`),
      inputBorderRadius: px(value("md.sys.shape.corner.extra-small")),
    };
    const kit = {
      name,
      title: title ?? name,
      ...(theme?.tagline && { tagline: theme.tagline }),
      modes: Object.fromEntries(Object.entries(byMode).map(([mode, each]) => [mode, each.filter((token) => !token.path.startsWith("md.comp.")).map(({ path, value, type }) => ({ path, value, type }))])),
      ...(theme && { tune: { tokens: theme.values.filter(([path, each]) => path.startsWith(`${name}.`) && ["dimension", "duration"].includes(each.$type)).map(([path]) => path) } }),
      ...(theme?.contrast && { pairs: contrastPairs(theme, tokens) }),
    };
    const fontsJs = `for (const href of ${JSON.stringify(fonts)}) document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href }));`;
    const page = (title, intro, body) => `import { Meta } from "@storybook/addon-docs/blocks";\nimport { ${body.match(/<([A-Z]\w+)/g).map((tag) => tag.slice(1)).filter((each, i, all) => all.indexOf(each) === i).join(", ")} } from "./kit.js";\n\n<Meta title="${title}" />\n\n# ${title.split("/").at(-1)}\n\n${intro}\n\n${body}\n`;

    const files = {
      "theme.js": `// The kit's Storybook theme (storybook/theming create()), for the manager and the docs pages.\nimport { create } from "storybook/theming";\n\nexport default create(${JSON.stringify(manager, null, 2)});\n`,
      "manager.js": `// Storybook's UI in the kit, and, while kumiko dev runs on this machine, its edit panel.
import React from "react";
import { addons, types } from "storybook/manager-api";
import { AddonPanel } from "storybook/internal/components";
import theme from "./theme.js";

addons.setConfig({ theme });
${fontsJs}
if (${local}) {
  addons.register("kumiko", () => addons.add("kumiko/panel", {
    type: types.PANEL,
    title: "Kit",
    render: ({ active }) => React.createElement(AddonPanel, { active }, React.createElement("iframe", { src: "${dev}/_kumiko/panel", title: "Kit", style: { border: 0, display: "block", inlineSize: "100%", blockSize: "100%", minBlockSize: "60vh" } })),
  }));
}
`,
      "preview.js": `// Every story and docs page on the kit: its CSS, its faces, its modes (data-theme), its docs theme, its colours as
// backgrounds, viewports, a platform switch (data-platform: web, iOS, Android, each with its device), and, while
// kumiko dev runs on this machine, the live bridge.
import { useEffect, useGlobals } from "storybook/preview-api";
import { INITIAL_VIEWPORTS, MINIMAL_VIEWPORTS } from "storybook/viewport";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import "${relative(dir, cssPath)}";
import theme from "./theme.js";

${fontsJs}
document.documentElement.dataset.theme ??= "${scheme}";
if (${local}) document.head.append(Object.assign(document.createElement("script"), { src: "${dev}/_kumiko/bridge.js" }));

// Each platform's device, picked when the platform changes.
const DEVICES = { web: "desktop", ios: "iphone14", android: "pixel" };
const withPlatform = (story, { globals }) => {
  const [, updateGlobals] = useGlobals();
  const platform = globals.platform ?? "web";
  useEffect(() => {
    document.documentElement.dataset.platform = platform;
    if (globals.viewport?.value !== DEVICES[platform]) updateGlobals({ viewport: { value: DEVICES[platform], isRotated: false } });
  }, [platform]);
  return story();
};

export default {
  parameters: {
    docs: { theme },
    // Accessibility failures fail the story tests (addon-vitest); the a11y panel shows the same checks.
    a11y: { test: "error" },
    backgrounds: { options: ${JSON.stringify(Object.fromEntries(tokens.filter((token) => token.type === "color" && token.path.startsWith(`${name}.palette.`)).map((token) => { const key = token.path.slice(`${name}.palette.`.length); return [key, { name: key, value: `var(--${token.name})` }]; })))} },
    viewport: { options: { ...MINIMAL_VIEWPORTS, iphone14: INITIAL_VIEWPORTS.iphone14, pixel: INITIAL_VIEWPORTS.pixel } },
    options: { storySort: { order: ["Foundations", "Components", "Patterns", "Pages", "Site", "Platform mapping"] } },
  },
  globalTypes: {
    platform: {
      description: "Platform: a preview of the kit's adaptation rules, on the web",
      toolbar: { title: "Platform", icon: "mobile", items: [{ value: "web", title: "Web" }, { value: "ios", title: "iOS" }, { value: "android", title: "Android" }], dynamicTitle: true },
    },
  },
  initialGlobals: { platform: "web" },
  decorators: [withPlatform, withThemeByDataAttribute({ themes: ${JSON.stringify(schemes)}, defaultTheme: "${modes.base}", attributeName: "data-theme" })],
};
`,
      "kit.js": KIT_JS,
      "kit.json": `${JSON.stringify(kit, null, 1)}\n`,
      "color.mjs": await source("../color.mjs"),
      "colour.mdx": page("Foundations/Colour", "The kit's own colours in each mode, then every pair the build holds them to.", "<Colours />\n\n## Contrast\n\n<Contrast />"),
      "type.mdx": page("Foundations/Type", "Each type role in its face, at its large, medium and small sizes.", "<Type />"),
      "measures.mdx": page("Foundations/Shape and measure", "The kit's own spacing, radius, border widths, measures and durations.", "<Measures />"),
      "material.mdx": page("Platform mapping/Material", "How the kit fills Material 3's colour roles and corner scale, for the platforms that read them (Android, the web outputs, Home Assistant).", "<Roles />"),
    };
    // Each site is a story (a docs page has no addon panel), the page in a frame that fills the canvas.
    if (options.sites?.length) {
      files["sites.stories.js"] = `// The project's sites, live: each loads kumiko dev's bridge, so an edit in the Kit panel restyles it. Stories
// return HTML (@storybook/html-vite).
export default { title: "Site/Live", parameters: { layout: "fullscreen" } };

// The page in a frame; the mode switch reaches it through the bridge ({ kumiko: "theme", scheme }).
const SCHEMES = ${JSON.stringify(schemes)};
const frame = (url, title, mode) => {
  const iframe = Object.assign(document.createElement("iframe"), { src: url, title });
  iframe.style.cssText = "border: 0; display: block; width: 100%; height: 100vh";
  const send = () => iframe.contentWindow?.postMessage({ kumiko: "theme", scheme: SCHEMES[mode] ?? SCHEMES[Object.keys(SCHEMES)[0]] }, "*");
  iframe.addEventListener("load", () => { send(); setTimeout(send, 1000); });
  return iframe;
};
${options.sites.map((site) => `
export const ${site.name.replace(/[^A-Za-z0-9]+(.)?/g, (_, next = "") => next.toUpperCase()).replace(/^./, (first) => first.toUpperCase())} = {
  name: ${JSON.stringify(site.name)},
  render: (args, { globals }) => frame(${JSON.stringify(site.url)}, ${JSON.stringify(site.name)}, globals.theme),
};`).join("\n")}
`;
    }
    return Object.entries(files).map(([file, content]) => ({ path: `${dir}/${file}`, content }));
  },
};
