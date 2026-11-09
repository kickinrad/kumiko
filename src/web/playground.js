// The playground's client: a page drawn with Beer's own markup on the kit's generated theme. It reads the kit's
// data from the page (the #kit element), and names no kit. Each destination's items come from its own module beside this
// one; everything that draws is a pure function of the data and is exported; the page starts only where there is
// a document. "../color.mjs" is the engine's colour maths, written beside the page as color.mjs.
import { contrast } from "../color.mjs";
import cards from "./cards.js";
import { examples } from "./examples.js";
import components from "./components.js";
import foundations, { fontLinks, iconLink, replay } from "./foundations.js";
import pages from "./pages.js";
import { edit, editorView, patch } from "./edit.js";

export const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Which of the stylesheet's two colour schemes (data-theme) a mode is: by its surface, nearer black or white.
export const scheme = (tokens) => {
  const { value } = tokens.find((token) => token.path === "md.sys.color.surface");
  return contrast(value, "#000000") > contrast(value, "#ffffff") ? "light" : "dark"; // lint: own black and white, the ends a scheme is measured against
};

// The destinations; with the project's example entries, Examples joins them before Rules.
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
// Without example entries, no Examples.
export const tabs = (data, device, baseline = data.editor) => [
  ...TABS.slice(0, -1),
  ...(data.examples?.length ? [{ id: "examples", name: "Examples", icon: "apps", items: examples(data.examples, device) }] : []),
  ...(data.editor ? [{ id: "edit", name: "Edit", icon: "tune", items: [{ id: "theme", name: "Theme", body: (data, tokens) => editorView(data, Object.keys(data.modes).find((mode) => data.modes[mode] === tokens), baseline) }] }] : []),
  TABS.at(-1),
];

export const view = (data, { tab: tabId, item: itemId, mode = Object.keys(data.modes)[0], expanded = false, device = 0, baseline = data.editor }) => {
  const TABS = tabs(data, device, baseline);
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
  // The top app bar spans the window: the menu button over the rail's column (it expands the rail; on small, where
  // the bottom bar replaces the rail, the kit's mark stands there instead), the kit's title and the
  // mode switch; below expanded, a back button when an item is open. Expanded, the rail is Material's expanded rail (Beer's `max`).
  const menu = `<button class="circle transparent m l" data-rail aria-label="${expanded ? "Collapse" : "Expand"} the navigation"><i>${expanded ? "menu_open" : "menu"}</i></button>`;
  const mark = `<i class="s">${esc(data.icon ?? "style")}</i>`;
  const back = open && list ? `<a class="button circle transparent" data-back href="#${tab.id}" aria-label="Back"><i>arrow_back</i></a>` : "";
  return `<nav class="left m l${expanded ? " max" : ""}">${destinations}</nav>
<nav class="top">${menu}${mark}${back}<h6 class="max">${esc(data.title ?? data.name)}</h6>${switcher}</nav>
<main><div class="panes"${open ? " data-open" : ""}>
${list}<div><h1>${item.name}</h1>${item.body(data, data.modes[mode])}</div>
</div></main>
<nav class="bottom s">${destinations}</nav>`;
};

const boot = () => {
  // The kit's data, examples included, travels in the page, so it opens from disk.
  const data = JSON.parse(document.getElementById("kit").textContent);
  const baseline = structuredClone(data.editor);
  let device = 0;
  const modes = Object.keys(data.modes);
  const schemes = Object.fromEntries(modes.map((mode) => [mode, scheme(data.modes[mode])]));
  const root = document.documentElement;
  // The page opens in the scheme it shows: the root's, when it names one (a data-theme pin or a host's rule), else the
  // system's, since the stylesheet's :root lists both.
  const named = getComputedStyle(root).colorScheme.split(" ").filter((each) => each === "light" || each === "dark");
  const shown = named.length === 1 ? named[0] : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  let mode = modes.find((each) => schemes[each] === shown) ?? modes[0];
  // Whether the rail is expanded, remembered per browser (a convenience; storage may be absent).
  const remember = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  let expanded = false;
  try { expanded = localStorage.getItem("rail") === "expanded"; } catch {}
  document.title = `${data.title ?? data.name} playground`;
  // The kit's faces, one stylesheet each, so a family Google Fonts lacks fails alone.
  for (const href of new Set(modes.flatMap((each) => fontLinks(data.modes[each])))) document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href }));
  const syncPreview = (target) => {
    if (!data.editor) return;
    const hasChanges = Boolean(patch(baseline, data.editor));
    const paths = [...Object.keys(data.editor.palette[mode]).map((name) => `${data.name}.palette.${name}`), ...Object.keys(data.editor.roles), ...Object.keys(data.editor.tokens), "md.ref.typeface.brand", "md.ref.typeface.plain", `${data.name}.typeface.mono`, `${data.name}.typeface.icon`, ...data.modes[mode].filter((token) => token.type === "fontFamily" && token.path.startsWith("md.sys.typescale.")).map((token) => token.path)];
    for (const path of paths) {
      const token = data.modes[mode].find((each) => each.path === path);
      if (token) {
        const variable = `--${data.editor.variableNames?.[path] ?? path.replaceAll(".", "-")}`;
        if (hasChanges) target.style.setProperty(variable, token.value);
        else target.style.removeProperty(variable);
      }
    }
  };
  const draw = () => {
    const [tab, item] = location.hash.slice(1).split("/");
    document.getElementById("app").innerHTML = view(data, { tab, item, mode, expanded, device, baseline });
    syncPreview(root);
    for (const href of fontLinks(data.modes[mode])) if (!document.querySelector(`link[href="${href}"]`)) document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href }));
    const icon = data.editor?.faces.icon;
    if (icon) {
      const family = (Array.isArray(icon) ? icon[0] : icon).replace(/^['"]|['"]$/g, "");
      const href = iconLink(family);
      if (!document.querySelector(`link[href="${href}"]`)) document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href }));
    }
    // A frame follows the mode through its address: the hash is the data-theme it sets.
    for (const frame of document.querySelectorAll("iframe")) {
      if (frame.dataset.frame) frame.src = `${frame.dataset.frame}#${schemes[mode]}`;
      try { if (frame.contentDocument) syncPreview(frame.contentDocument.documentElement); } catch {} // An external example is not same-origin.
    }
  };
  document.addEventListener("load", (event) => { if (event.target.tagName === "IFRAME") { try { syncPreview(event.target.contentDocument.documentElement); } catch {} } }, true);
  window.addEventListener("hashchange", draw);
  document.addEventListener("change", (event) => {
    const control = event.target.closest("[data-edit]");
    if (!control) return;
    try { edit(data, { kind: control.dataset.edit, mode, name: control.dataset.name, value: control.value }); draw(); }
    catch (error) { document.querySelector("[data-edit-status]").textContent = error.message; }
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-export]")) {
      const content = patch(baseline, data.editor);
      if (!content) return;
      const url = URL.createObjectURL(new Blob([content], { type: "application/toml" }));
      const link = Object.assign(document.createElement("a"), { href: url, download: "theme.patch.toml" });
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
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
