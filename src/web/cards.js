// Cards: M3's three cards (elevated, filled, outlined), composed from the components' builders into four realistic cards.
// Each item is { id, name, body(data, tokens) → html }; the card builders are exported for pages.js.
import { button, card, chip, icon, iconButton, list, listItem, reference, row, switchRow, toggles } from "./components.js";

const body = (...children) => children.join("");
const nav = (...buttons) => `<nav>${buttons.join("")}</nav>`;

// A card with media above its text: the media is a surface in a container colour, with an icon in it.
export const mediaCard = (style) =>
  card(style, body(
    `<div class="primary-container small-height middle-align center-align">${icon("landscape", "extra")}</div>`,
    `<div class="padding"><h5>Mountain loop</h5><p>12 km, moderate. Best before noon.</p>${row(chip("Hiking", { icon: "hiking" }), chip("Views"))}${nav(button("Save", "text"), button("Directions", "tonal", { icon: "directions" }))}</div>`,
  ), { size: "no-padding" });

// A card whose body is a list.
export const listCard = (style) =>
  card(style, body(
    `<h5>Recent files</h5>`,
    list([
      listItem({ icon: "description", headline: "Budget", supporting: "Edited today", trailing: "2 MB" }),
      listItem({ icon: "image", headline: "Cover photo", supporting: "Edited yesterday", trailing: "4 MB" }),
      listItem({ icon: "folder", headline: "Archive", supporting: "Edited last week", trailing: "18 MB" }),
    ]),
    nav(button("See all", "text")),
  ));

// A card that asks for one action, with small actions beside it.
export const actionCard = (style) =>
  card(style, body(
    `<h5>Invite your team</h5><p>Share a link so others can view and comment.</p>`,
    `<nav>${button("Copy link", "filled", { icon: "link" })}<div class="max"></div>${iconButton("favorite", "Favourite", "standard", { attrs: toggles })}${iconButton("share", "Share")}</nav>`,
  ));

// A card of settings: switches in rows.
export const settingsCard = (style) =>
  card(style, body(
    `<h5>Notifications</h5>`,
    switchRow("Messages", "Alerts for new messages", { checked: true }),
    switchRow("Reminders", "A nudge before events"),
    switchRow("Sounds", "Play a sound with alerts", { checked: true, glyph: "volume_up" }),
  ));

const STYLES = ["elevated", "filled", "outlined"];
const item = (id, name, build) => ({ id, name, body: () => `${reference("CARD", "cards")}<div class="grid">${STYLES.map((style) => `<div class="s12 m6 l4">${build(style)}</div>`).join("")}</div>` });

export default [
  item("media-card", "Media card", mediaCard),
  item("list-card", "List card", listCard),
  item("action-card", "Action card", actionCard),
  item("settings-card", "Settings card", settingsCard),
];
