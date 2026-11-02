// The playground's client: a page drawn with Beer's own markup on the kit's generated theme. It reads the kit's
// data from the page (the #kit element, tokens.json's content), and names no kit. Each destination's items come from its own module beside this
// one; everything that draws is a pure function of the data and is exported; the page starts only where there is
// a document. "../color.mjs" is the engine's colour maths, written beside the page as color.mjs.
import { contrast } from "../color.mjs";
import cards from "./cards.js";
import { examples, load } from "./examples.js";
import components from "./components.js";
import foundations, { fontLinks, replay } from "./foundations.js";
import pages from "./pages.js";

export const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Which of the stylesheet's two colour schemes (data-theme) a mode is: by its surface, nearer black or white.
export const scheme = (tokens) => {
  const { value } = tokens.find((token) => token.path === "md.sys.color.surface");
  return contrast(value, "#000000") > contrast(value, "#ffffff") ? "light" : "dark"; // lint: own black and white, the ends a scheme is measured against
};

// The destinations; with the apps' entries loaded, Examples joins them before Rules.
const TABS = [
  { id: "foundations", name: "Foundations", icon: "palette", items: foundations },
  { id: "components", name: "Components", icon: "widgets", items: components },
  { id: "cards", name: "Cards", icon: "dashboard", items: cards },
  { id: "pages", name: "Pages", icon: "devices", items: pages },
  { id: "rules", name: "Rules", icon: "rule", items: [{ id: "notes", name: "Notes", body: (data, tokens) => (data.notes ?? "<p>This kit has no notes.md.</p>") + exceptions(tokens) }] },
];

// The kit's exceptions: every Material token the kit describes by hand (a description on a Material path says why
// the kit differs; the engine's derived tokens say what they are, and are skipped), grouped, after the notes.
export const exceptions = (tokens) => {
  const groups = new Map();
  for (const token of tokens) {
    if (!token.path.startsWith("md.") || !token.description || token.derived) continue;
    const group = token.path.split(".").slice(0, 3).join(".");
    (groups.get(group) ?? groups.set(group, []).get(group)).push(token);
  }
  if (!groups.size) return "";
  return `<h2>Exceptions</h2>${[...groups].map(([group, each]) => `<h3>${esc(group)}</h3><ul>${each.map((token) => `<li><code>${esc(token.path)}</code> ${esc(token.description)}</li>`).join("")}</ul>`).join("")}`;
};

// The whole page for a place and a mode. The top app bar spans the window; the rail is Beer's left navigation
// beneath it from medium up and its bottom bar on small; the list and the detail are Material's two panes
// (layout.css): side by side from expanded, and below that only the list (a tab named) or the open item (an item
// named, `data-open`, with a back button) shows. A destination with one item has no list: its item is the page.
// An entry that did not load is left out (its reason is logged when the page opens); with none loaded, no Examples.
export const tabs = (data, device) => data.loaded?.some((each) => each.entry)
  ? [...TABS.slice(0, -1), { id: "examples", name: "Examples", icon: "apps", items: examples(data.loaded.filter((each) => each.entry), device) }, TABS.at(-1)]
  : TABS;

export const view = (data, { tab: tabId, item: itemId, mode = Object.keys(data.modes)[0], expanded = false, device = 0 }) => {
  const TABS = tabs(data, device);
  const tab = TABS.find((each) => each.id === tabId) ?? TABS[0];
  const item = tab.items.find((each) => each.id === itemId) ?? tab.items[0];
  const open = tab.id === tabId && item.id === itemId;
  const destinations = TABS.map((each) => `<a href="#${each.id}"${each === tab ? ' class="active"' : ""}><i>${each.icon}</i><div>${each.name}</div></a>`).join("");
  // One icon button steps to the next mode; its icon is that mode's scheme.
  const names = Object.keys(data.modes);
  const next = names[(names.indexOf(mode) + 1) % names.length];
  const switcher = `<button class="circle transparent" data-mode="${esc(next)}" aria-label="${esc(next[0].toUpperCase() + next.slice(1))} mode"><i>${scheme(data.modes[next]) === "light" ? "light_mode" : "dark_mode"}</i></button>`;
  const items = tab.items.map((each) => `<li><a class="wave${each === item ? " active" : ""}" href="#${tab.id}/${each.id}"><span class="max">${each.name}</span></a></li>`).join("");
  const list = tab.items.length > 1 ? `<div><ul class="list">${items}</ul></div>\n` : "";
  // The kits the page can switch to: this one, and each other kit's playground that loaded.
  const others = (data.kitsLoaded ?? []).filter((each) => each.entry);
  const kits = others.length
    ? `<button class="circle transparent" data-ui="#kits" aria-label="Design kit"><i>swap_horiz</i></button><menu class="left no-wrap" id="kits"><li><a class="active" href="#">${esc(data.name)}</a></li>${others.map(({ href, entry }) => `<li><a href="${esc(new URL(".", href).href)}">${esc(entry.name)}</a></li>`).join("")}</menu>`
    : "";
  // The top app bar spans the window: the menu button over the rail's column (it expands the rail; on small, where
  // the bottom bar replaces the rail, the kit's mark stands there instead), the kit's title, the kit menu and the
  // mode switch; below expanded, a back button when an item is open. Expanded, the rail is Material's expanded rail (Beer's `max`).
  const menu = `<button class="circle transparent m l" data-rail aria-label="${expanded ? "Collapse" : "Expand"} the navigation"><i>${expanded ? "menu_open" : "menu"}</i></button>`;
  const mark = `<i class="s">${esc(data.icon ?? "style")}</i>`;
  const back = open && list ? `<a class="button circle transparent" data-back href="#${tab.id}" aria-label="Back"><i>arrow_back</i></a>` : "";
  return `<nav class="left m l${expanded ? " max" : ""}">${destinations}</nav>
<nav class="top">${menu}${mark}${back}<h6 class="max">${esc(data.title ?? data.name)}</h6>${kits}${switcher}</nav>
<main><div class="panes"${open ? " data-open" : ""}>
${list}<div><h1>${item.name}</h1>${item.body(data, data.modes[mode])}</div>
</div></main>
<nav class="bottom s">${destinations}</nav>`;
};

const boot = async () => {
  // The kit's data travels in the page (it opens from disk); the apps' entries and other kits are fetched by location.
  const data = JSON.parse(document.getElementById("kit").textContent);
  [data.loaded, data.kitsLoaded] = await Promise.all([load(data.examples ?? [], location.href), load(data.kits ?? [], location.href)]);
  for (const { href, error } of [...data.loaded, ...data.kitsLoaded]) if (error) console.info(`playground: ${href} did not load (${error}); serve its checkout beside the kit's to see it`);
  let device = 0;
  const modes = Object.keys(data.modes);
  const schemes = Object.fromEntries(modes.map((mode) => [mode, scheme(data.modes[mode])]));
  const root = document.documentElement;
  let mode = modes.find((each) => schemes[each] === getComputedStyle(root).colorScheme) ?? modes[0];
  // Whether the rail is expanded, remembered per browser (a convenience; storage may be absent).
  const remember = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  let expanded = false;
  try { expanded = localStorage.getItem("rail") === "expanded"; } catch {}
  document.title = `${data.title ?? data.name} playground`;
  // The kit's faces, one stylesheet each, so a family Google Fonts lacks fails alone.
  for (const href of new Set(modes.flatMap((each) => fontLinks(data.modes[each])))) document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href }));
  const draw = () => {
    const [tab, item] = location.hash.slice(1).split("/");
    document.getElementById("app").innerHTML = view(data, { tab, item, mode, expanded, device });
    // A frame follows the mode through its address: the hash is the data-theme it sets.
    for (const frame of document.querySelectorAll("[data-frame]")) frame.src = `${frame.dataset.frame}#${schemes[mode]}`;
  };
  window.addEventListener("hashchange", draw);
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-replay]")) return replay(document);
    const chosen = event.target.closest("[data-device]");
    if (chosen) { device = Number(chosen.dataset.device); return draw(); }
    // A layout's panes in a frame: a row opens its pane on a small screen, and the pane's back button closes it.
    const panes = event.target.closest(".panes");
    if (panes && event.target.closest("[data-pane]")) panes.setAttribute("data-open", "");
    if (panes && event.target.closest("[data-close]")) panes.removeAttribute("data-open");
    if (event.target.closest("[data-rail]")) {
      expanded = !expanded;
      remember("rail", expanded ? "expanded" : "collapsed");
      return draw();
    }
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    mode = button.dataset.mode;
    root.dataset.theme = schemes[mode];
    draw();
  });
  draw();
};
if (typeof document !== "undefined") boot();
