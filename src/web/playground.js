// The playground's client: a page drawn with Beer's own markup on the kit's generated theme. It reads one file
// of the kit's, tokens.json, and names no kit. Each destination's items come from its own module beside this
// one; everything that draws is a pure function of the data and is exported; the page starts only where there is
// a document. "../color.mjs" is the engine's colour maths, written beside the page as color.mjs.
import { contrast } from "../color.mjs";
import cards from "./cards.js";
import components from "./components.js";
import foundations, { fontLinks, replay } from "./foundations.js";
import pages from "./pages.js";

export const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Markdown, as much as a kit's notes use: headings (one level down, under the item's own h1), paragraphs,
// lists and inline code.
export const markdown = (text) => {
  const out = [];
  let paragraph = [];
  let list = null;
  const flush = () => {
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(" "))}</p>`);
    if (list) out.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.tag}>`);
    paragraph = [];
    list = null;
  };
  const inline = (line) => esc(line).replace(/`([^`]+)`/g, "<code>$1</code>");
  for (const line of text.split("\n")) {
    const heading = line.match(/^(#{1,6})\s+(.*)/);
    const bullet = line.match(/^(?:([-*])|\d+\.)\s+(.*)/);
    if (heading) {
      flush();
      const level = Math.min(heading[1].length + 1, 6);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (bullet) {
      const tag = bullet[1] ? "ul" : "ol";
      if (list?.tag !== tag) flush();
      list ??= { tag, items: [] };
      list.items.push(bullet[2]);
    } else if (!line.trim()) flush();
    else if (list) list.items[list.items.length - 1] += ` ${line.trim()}`;
    else paragraph.push(line.trim());
  }
  flush();
  return out.join("\n");
};

// Which of the stylesheet's two colour schemes (data-theme) a mode is: by its surface, nearer black or white.
export const scheme = (tokens) => {
  const { value } = tokens.find((token) => token.path === "md.sys.color.surface");
  return contrast(value, "#000000") > contrast(value, "#ffffff") ? "light" : "dark";
};

const TABS = [
  { id: "foundations", name: "Foundations", icon: "palette", items: foundations },
  { id: "components", name: "Components", icon: "widgets", items: components },
  { id: "cards", name: "Cards", icon: "dashboard", items: cards },
  { id: "pages", name: "Pages", icon: "devices", items: pages },
  { id: "rules", name: "Rules", icon: "rule", items: [{ id: "notes", name: "Notes", body: (data, tokens) => (data.notes ? markdown(data.notes) : "<p>This kit has no notes.md.</p>") + exceptions(tokens) }] },
];

// The kit's exceptions: every Material token the kit describes (a description on a Material path says why the kit
// differs), grouped by the token's group, after the notes.
export const exceptions = (tokens) => {
  const groups = new Map();
  for (const token of tokens) {
    if (!token.path.startsWith("md.") || !token.description) continue;
    const group = token.path.split(".").slice(0, 3).join(".");
    (groups.get(group) ?? groups.set(group, []).get(group)).push(token);
  }
  if (!groups.size) return "";
  return `<h2>Exceptions</h2>${[...groups].map(([group, each]) => `<h3>${esc(group)}</h3><ul>${each.map((token) => `<li><code>${esc(token.path)}</code> ${esc(token.description)}</li>`).join("")}</ul>`).join("")}`;
};

// The whole page for a place and a mode. The rail is Beer's left navigation from medium up and its bottom bar on
// small; the panes sit side by side from medium up, and on small only the list (a tab named) or the open
// item (an item named, with a back button) shows.
export const view = (data, { tab: tabId, item: itemId, mode = Object.keys(data.modes)[0] }) => {
  const tab = TABS.find((each) => each.id === tabId) ?? TABS[0];
  const item = tab.items.find((each) => each.id === itemId) ?? tab.items[0];
  const open = tab.id === tabId && item.id === itemId;
  const destinations = TABS.map((each) => `<a href="#${each.id}"${each === tab ? ' class="active"' : ""}><i>${each.icon}</i><div>${each.name}</div></a>`).join("");
  // One icon button steps to the next mode; its icon is that mode's scheme.
  const names = Object.keys(data.modes);
  const next = names[(names.indexOf(mode) + 1) % names.length];
  const switcher = `<button class="circle transparent" data-mode="${esc(next)}" aria-label="${esc(next[0].toUpperCase() + next.slice(1))} mode"><i>${scheme(data.modes[next]) === "light" ? "light_mode" : "dark_mode"}</i></button>`;
  const items = tab.items.map((each) => `<li><a class="wave${each === item ? " active" : ""}" href="#${tab.id}/${each.id}"><span class="max">${each.name}</span></a></li>`).join("");
  return `<nav class="left m l">${destinations}</nav>
<header><nav>${open ? `<a class="button circle transparent s" href="#${tab.id}" aria-label="Back"><i>arrow_back</i></a>` : ""}<h6 class="max">${esc(data.name)}</h6>${switcher}</nav></header>
<main><div class="grid">
<div class="s12 m4 l3${open ? " m l" : ""}"><ul class="list segmented">${items}</ul></div>
<div class="s12 m8 l9${open ? "" : " m l"}"><h1>${item.name}</h1>${item.body(data, data.modes[mode])}</div>
</div></main>
<nav class="bottom s">${destinations}</nav>`;
};

const boot = async () => {
  const data = await (await fetch(new URL("tokens.json", import.meta.url))).json();
  const modes = Object.keys(data.modes);
  const schemes = Object.fromEntries(modes.map((mode) => [mode, scheme(data.modes[mode])]));
  const root = document.documentElement;
  let mode = modes.find((each) => schemes[each] === getComputedStyle(root).colorScheme) ?? modes[0];
  document.title = `${data.name} playground`;
  // The kit's faces, one stylesheet each, so a family Google Fonts lacks fails alone.
  for (const href of new Set(modes.flatMap((each) => fontLinks(data.modes[each])))) document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href }));
  const draw = () => {
    const [tab, item] = location.hash.slice(1).split("/");
    document.getElementById("app").innerHTML = view(data, { tab, item, mode });
    // A frame follows the mode through its address: the hash is the data-theme it sets.
    for (const frame of document.querySelectorAll("[data-frame]")) frame.src = `${frame.dataset.frame}#${schemes[mode]}`;
  };
  window.addEventListener("hashchange", draw);
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-replay]")) return replay(document);
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    mode = button.dataset.mode;
    root.dataset.theme = schemes[mode];
    draw();
  });
  draw();
};
if (typeof document !== "undefined") boot();
