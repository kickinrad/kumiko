// Examples: a project's own previews of the kit it builds from, each from an entry the project owns (a JSON file its
// config names, carried in the page as { base, entry }, base the path from the page to the entry's folder). An entry
// is { name, surface, output, preview?, captures?, devices? }: `preview` a live web page, `captures`
// [{ src, label, build? }] for a surface the page cannot embed, `devices` [{ name, width, height }], each path
// relative to the entry. A web preview is embedded live at the chosen device's size; a capture is labelled as one,
// with its source and build.
import { esc } from "./playground.js";

// An item id from an entry's name.
const slug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "example";

// The destination's items, with the chosen device.
export const examples = (entries, device = 0) => entries.map(({ base, entry }) => {
  const at = (path) => base + path;
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
