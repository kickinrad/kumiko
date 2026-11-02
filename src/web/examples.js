// Examples: the apps' own previews of the kit, each from an entry the app owns (a JSON file the config names by
// location only). An entry is { name, surface, output, preview?, captures?, devices? }: `preview` a live web page,
// `captures` [{ src, label, build? }] for a surface the page cannot embed, `devices` [{ name, width, height }],
// each path relative to the entry. The page fetches entries when it opens, so a kit builds without them; one that
// does not load is left out. A web preview is embedded live at the chosen device's size; a capture is
// labelled as one, with its source and build.
import { esc } from "./playground.js";

// An item id from an entry's name.
const slug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "example";

// The destination's items, from the entries that loaded ({ href, entry }), with the chosen device.
export const examples = (loaded, device = 0) => loaded.map(({ href, entry }) => {
  const at = (path) => new URL(path, href).href;
  const devices = entry.devices ?? [];
  const chosen = devices[Math.min(device, devices.length - 1)];
  const selector = devices.length > 1
    ? `<nav class="group connected">${devices.map((each, i) => `<button class="${each === chosen ? "active" : "border"}" data-device="${i}">${esc(each.name)}</button>`).join("")}</nav>`
    : "";
  const about = `<p>${esc(entry.surface ?? "")}${entry.output ? ` · reads <code>${esc(entry.output)}</code>` : ""}</p>`;
  const live = entry.preview
    ? `<h3>Live preview${chosen ? `: ${esc(chosen.name)}, ${chosen.width} × ${chosen.height}` : ""}</h3><div class="scroll border round"><iframe src="${esc(at(entry.preview))}" title="${esc(entry.name)} preview" ${chosen ? `width="${chosen.width}" height="${chosen.height}"` : 'class="large-height" width="100%"'}></iframe></div><p><a class="link" href="${esc(at(entry.preview))}" target="_blank" rel="noopener">Open the preview</a></p>`
    : "";
  const captures = (entry.captures ?? []).map((each) => `<figure><img class="responsive round" src="${esc(at(each.src))}" alt="${esc(each.label)}"><figcaption>Capture: ${esc(each.label)}${each.build ? ` · build ${esc(each.build)}` : ""} · <a class="link" href="${esc(at(each.src))}" target="_blank" rel="noopener">source</a></figcaption></figure>`).join("");
  return { id: slug(entry.name), name: entry.name, body: () => `${about}${selector}${live}${captures || (live ? "" : "<p>This entry has no preview or capture.</p>")}` };
});

// Each entry, fetched; a failure is kept as the reason, never thrown.
export const load = (hrefs, base) => Promise.all(hrefs.map(async (href) => {
  try {
    const response = await fetch(new URL(href, base));
    if (!response.ok) return { href, error: `HTTP ${response.status}` };
    return { href: new URL(href, base).href, entry: await response.json() };
  } catch (error) { return { href, error: error.message }; }
}));
