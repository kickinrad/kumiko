// Pages: M3's canonical layouts, each composed from cards and components in a framed area.
// Each item is { id, name, body(data, tokens) → html }.
import { actionCard, listCard, mediaCard, settingsCard } from "./cards.js";
import { appBar, button, card, empty, field, frame, iconButton, list, listItem, navBar, opens, panels, reference } from "./components.js";

const CANONICAL = "foundations/layout/canonical-layouts/overview";
const item = (id, name, build) => ({ id, name, body: () => `${reference("MAIN_LAYOUT", CANONICAL, "canonical layouts")}${frame(build())}` });
const stack = (...cards) => cards.map((each) => `${each}<div class="space"></div>`).join("");

// List-detail: a list of threads beside the open one; choosing a row shows its thread.
const THREADS = [
  { avatar: "A", headline: "Ada", supporting: "Lunch on Thursday?", trailing: "9:41", subject: "Lunch on Thursday?", text: "There is a new place by the river. Does noon work for everyone?" },
  { avatar: "S", headline: "Sam", supporting: "The files are ready to review.", trailing: "Mon", subject: "Files ready for review", text: "Everything from last week is uploaded. Comments are open until Friday." },
  { avatar: "R", headline: "Riley", supporting: "Thanks, see you there.", trailing: "Sun", subject: "See you there", text: "Thanks for the details. I will bring the printed copies." },
];
const thread = (each) => card("outlined", `<h5>${each.subject}</h5><p>${each.text}</p><nav>${button("Reply", "tonal", { icon: "reply" })}${button("Archive", "text")}</nav>`);

// Feed: a scrolling grid of cards under a pinned app bar, with a navigation bar below.
const PLACES = [["home", "Home"], ["search", "Search"], ["video_library", "Library"]];

export default [
  item("list-detail", "List-detail", () => `<div class="grid no-space"><div class="s12 m5">${appBar("Inbox", { actions: [iconButton("edit", "Compose")] })}<div class="padding">${field("Search", { prefix: "search" })}</div>${list(THREADS.map((each, index) => listItem({ ...each, attrs: opens(`thread-${index}`) })))}</div><div class="s12 m7 padding">${panels("thread", THREADS.map(thread))}</div></div>`),

  item("supporting-pane", "Supporting pane", () => `<div class="grid no-space"><div class="s12 m8">${appBar("Trip planner", { actions: [iconButton("search", "Search"), iconButton("more_vert", "More")] })}<div class="padding">${stack(mediaCard("elevated"))}</div></div><div class="s12 m4 padding">${stack(actionCard("filled"), settingsCard("outlined"))}</div></div>`),

  item("feed", "Feed", () => `${appBar("Discover", { actions: [iconButton("search", "Search")], fixed: true })}<div class="padding">${panels("feed", [
    `<div class="grid"><div class="s12 m6">${mediaCard("elevated")}</div><div class="s12 m6">${actionCard("filled")}</div><div class="s12 m6">${listCard("outlined")}</div><div class="s12 m6">${mediaCard("filled")}</div></div>`,
    empty("search", "Search", "Find something to read."),
    empty("video_library", "Your library", "Saved items appear here."),
  ])}</div>${navBar("feed", PLACES, 0)}`),
];
