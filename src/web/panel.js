// The Tune panel's page, served by kumiko dev at /_kumiko/panel (Storybook shows it as an addon panel). It reads the
// kit from the server, sends every edit to it, and the server builds the edit and sends the result here and to every
// page that loads its bridge. Inputs stay put while the rest redraws, so an open colour picker stays open.
import { controls, tuneView, valueOf } from "./tune.js";
import { contrast } from "../color.mjs";

// A mode's colour scheme by its surface, nearer black or white (as the playground decides it).
const scheme = (tokens) => {
  const surface = tokens.find((token) => token.path === "md.sys.color.surface").value;
  return contrast(surface, "#000000") > contrast(surface, "#ffffff") ? "light" : "dark"; // lint: own black and white, the ends a scheme is measured against
};

const app = document.getElementById("app");
const kitCss = document.getElementById("kit-css");
const state = { edits: {}, live: true, problem: "" };
let kit;
let mode;

const loadFonts = (hrefs) => { for (const href of hrefs) if (!document.querySelector(`link[href="${CSS.escape(href)}"]`)) document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href })); };
const draw = () => {
  const names = Object.keys(kit.modes);
  const switcher = names.length > 1 ? `<div class="modes" role="group" aria-label="Mode">${names.map((each) => `<button data-mode="${each}" aria-pressed="${each === mode}">${each[0].toUpperCase()}${each.slice(1)}</button>`).join("")}</div>` : "";
  app.innerHTML = tuneView(kit, mode, state, switcher);
};
// Redraws the change row and each control's status, leaving the inputs alone.
const refresh = () => {
  const panel = document.querySelector("[data-tune-panel]");
  if (!panel) return draw();
  const fresh = Object.assign(document.createElement("div"), { innerHTML: tuneView(kit, mode, state) }).firstElementChild;
  panel.querySelector("[data-changes]").replaceWith(fresh.querySelector("[data-changes]"));
  panel.querySelector("[role=alert]")?.remove();
  const alert = fresh.querySelector("[role=alert]");
  if (alert) panel.querySelector("[data-changes]").after(alert);
  for (const item of fresh.querySelectorAll("[data-item]")) {
    const shown = panel.querySelector(`[data-item="${CSS.escape(item.dataset.item)}"]`);
    if (!shown) continue;
    shown.querySelector("small").replaceWith(item.querySelector("small"));
    shown.querySelector("[data-tune-undo]").hidden = !(item.dataset.item in state.edits);
  }
};
const apply = (live) => {
  const first = !kit;
  kit = live.kit;
  kitCss.textContent = live.css;
  loadFonts(live.fonts);
  if (first) {
    mode = Object.keys(kit.modes)[0];
    document.documentElement.dataset.theme = scheme(kit.modes[mode]);
    return draw();
  }
  refresh();
};

const post = async (path, body) => (await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
let sending = false;
let queued = {};
// Sends an edit; one request at a time, the latest values winning.
const send = async (change) => {
  for (const [path, value] of Object.entries(change)) if (value === null) delete state.edits[path]; else state.edits[path] = value;
  queued = { ...queued, ...change };
  if (sending) return;
  sending = true;
  while (Object.keys(queued).length) {
    const body = queued;
    queued = {};
    state.problem = (await post("/_kumiko/edit", body)).error ?? "";
  }
  sending = false;
  refresh();
};

document.addEventListener("input", (event) => {
  const control = event.target.closest("[data-tune]");
  if (!control) return;
  const item = controls(kit, mode, state.edits).flatMap((group) => group.items).find((each) => each.path === control.dataset.tune);
  const value = valueOf(item, control.value);
  if (item.unit) control.closest(".tune").querySelector("output").textContent = value;
  const saved = item.unit ? `${item.saved}${item.unit}` : valueOf(item, item.saved);
  send({ [item.path]: JSON.stringify(value) === JSON.stringify(saved) ? null : value });
});
document.addEventListener("click", async (event) => {
  const modeButton = event.target.closest("[data-mode]");
  if (modeButton) {
    mode = modeButton.dataset.mode;
    document.documentElement.dataset.theme = scheme(kit.modes[mode]);
    return draw();
  }
  const undo = event.target.closest("[data-tune-undo]");
  if (undo || event.target.closest("[data-tune-reset]")) {
    await send(Object.fromEntries((undo ? [undo.dataset.tuneUndo] : Object.keys(state.edits)).map((path) => [path, null])));
    return draw();
  }
  if (event.target.closest("[data-tune-save]")) {
    const result = await post("/_kumiko/save", {});
    state.problem = result.error ?? "";
    if (!result.error) state.edits = {};
    return draw();
  }
});

fetch("/_kumiko/live").then((response) => response.json()).then((live) => {
  apply(live);
  const events = new EventSource("/_kumiko/events");
  events.addEventListener("live", (event) => apply(JSON.parse(event.data)));
  events.addEventListener("reload", () => location.reload());
  events.addEventListener("problem", (event) => { state.problem = JSON.parse(event.data).message; refresh(); });
});
