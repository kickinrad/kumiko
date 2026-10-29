// The playground's client: a page drawn with Beer's own markup on the kit's generated theme. It reads one file
// of the kit's, tokens.json, and names no kit. Everything that draws is a pure function of the data and is
// exported; the page starts only where there is a document. Its one import, the engine's colour maths,
// is replaced by that file's text when the output is made, so the page is one module.
import { contrast } from "../color.mjs";

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

// Which of the stylesheet's two colour schemes (data-theme) a mode is: by its surface, nearer black or white.
export const scheme = (tokens) => {
  const { value } = tokens.find((token) => token.path === `${COLOR}surface`);
  return contrast(value, "#000000") > contrast(value, "#ffffff") ? "light" : "dark";
};

const later = (text) => () => `<p>${text}</p>`;
const TABS = [
  { id: "foundations", name: "Foundations", icon: "palette", items: [{ id: "colour", name: "Colour", body: (data, tokens) => colour(tokens) }] },
  { id: "components", name: "Components", icon: "widgets", items: [{ id: "overview", name: "Overview", body: later("Beer's full set of components, live on this theme, will fill this.") }] },
  { id: "cards", name: "Cards", icon: "dashboard", items: [{ id: "overview", name: "Overview", body: later("The kit's card patterns will fill this.") }] },
  { id: "pages", name: "Pages", icon: "devices", items: [{ id: "overview", name: "Overview", body: later("The kit's page layouts will fill this.") }] },
  { id: "rules", name: "Rules", icon: "rule", items: [{ id: "notes", name: "Notes", body: (data) => (data.notes ? markdown(data.notes) : "<p>This kit has no notes.md.</p>") }] },
];

// The whole page for a place and a mode. The rail is Beer's left navigation from medium up and its bottom bar on
// small; the panes sit side by side from medium up, and on small only the list (a tab named) or the open
// item (an item named, with a back button) shows.
export const view = (data, { tab: tabId, item: itemId, mode = Object.keys(data.modes)[0] }) => {
  const tab = TABS.find((each) => each.id === tabId) ?? TABS[0];
  const item = tab.items.find((each) => each.id === itemId) ?? tab.items[0];
  const open = tab.id === tabId && item.id === itemId;
  const destinations = TABS.map((each) => `<a href="#${each.id}"${each === tab ? ' class="active"' : ""}><i>${each.icon}</i><div>${each.name}</div></a>`).join("");
  const modes = Object.keys(data.modes).map((each) => `<button${each === mode ? ' class="active"' : ""} data-mode="${esc(each)}">${esc(each[0].toUpperCase() + each.slice(1))}</button>`).join("");
  const items = tab.items.map((each) => `<li><a class="wave round${each === item ? " secondary-container" : ""}" href="#${tab.id}/${each.id}"><span class="max">${each.name}</span></a></li>`).join("");
  return `<nav class="left m l">${destinations}</nav>
<header><nav>${open ? `<a class="button circle transparent s" href="#${tab.id}" aria-label="Back"><i>arrow_back</i></a>` : ""}<h6 class="max">${esc(data.name)}</h6><nav class="group connected">${modes}</nav></nav></header>
<main><div class="grid">
<div class="s12 m4 l3${open ? " m l" : ""}"><ul class="list">${items}</ul></div>
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
  const draw = () => {
    const [tab, item] = location.hash.slice(1).split("/");
    document.getElementById("app").innerHTML = view(data, { tab, item, mode });
  };
  window.addEventListener("hashchange", draw);
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    mode = button.dataset.mode;
    root.dataset.theme = schemes[mode];
    draw();
  });
  draw();
};
if (typeof document !== "undefined") boot();
