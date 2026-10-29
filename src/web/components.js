// Components: Beer's full set, live on the theme, in Beer's own markup. Each item is { id, name, body(data, tokens) → html }.
// The small builders are exported: cards.js composes cards from them and pages.js composes pages from both.
// Every string is trusted literal markup, so nothing is escaped. A toggle is Beer's data-ui with no target, which
// flips `active`; a destination is Beer's data-ui on a link, which shows the page it names.

const classes = (...names) => {
  const list = names.filter(Boolean).join(" ");
  return list ? ` class="${list}"` : "";
};
const REACH = ' tabindex="0"';

export const icon = (name, size) => `<i${classes(size)}>${name}</i>`;

const BUTTON = { filled: "", tonal: "fill", outlined: "border", text: "transparent primary-text", elevated: "surface-container-low elevate" };
export const button = (label, style = "filled", { icon: glyph, size, attrs = "" } = {}) =>
  `<button${classes(BUTTON[style], size)}${attrs}>${glyph ? icon(glyph) : ""}<span${style === "elevated" ? ' class="primary-text"' : ""}>${label}</span></button>`;

const ICON_BUTTON = { standard: "transparent", filled: "", tonal: "fill", outlined: "border" };
export const iconButton = (glyph, label, style = "standard", { size, attrs = "" } = {}) =>
  `<button${classes("circle", ICON_BUTTON[style], size)} aria-label="${label}"${attrs}>${icon(glyph)}</button>`;

export const chip = (label, { icon: glyph, color, size, attrs = "" } = {}) =>
  `<button${classes("chip", color, size)}${attrs}>${glyph ? icon(glyph) : ""}<span>${label}</span></button>`;

const FIELD = { filled: "fill", outlined: "border" };
export const field = (label, { style = "outlined", type = "text", value, prefix, suffix, size, round, active, helper, error, attrs = "" } = {}) =>
  `<div${classes("field", "label", FIELD[style], size, round && "round", prefix && "prefix", suffix && "suffix", error && "invalid")}>${prefix ? icon(prefix) : ""}<input type="${type}"${value ? ` value="${value}"` : ""} placeholder=" "${active ? ' class="active"' : ""}${attrs}><label${active ? ' class="active"' : ""}>${label}</label>${suffix ? icon(suffix) : ""}${helper ? `<output>${helper}</output>` : ""}${error ? `<output class="invalid">${error}</output>` : ""}</div>`;

// A list row: a leading icon or avatar letter, a headline with optional supporting text, a trailing label.
export const listItem = ({ icon: glyph, avatar, headline, supporting, trailing, selected, attrs = "" }) =>
  `<li${classes("wave", selected && "secondary-container")}${REACH}${attrs}>${glyph ? icon(glyph) : ""}${avatar ? `<button class="circle">${avatar}</button>` : ""}${supporting ? `<div class="max"><h6 class="small">${headline}</h6><div>${supporting}</div></div>` : `<span class="max">${headline}</span>`}${trailing ? `<label>${trailing}</label>` : ""}</li>`;
export const list = (items, size = "") => `<ul${classes("list", "border", size)}>${items.join("")}</ul>`;

const CARD = { elevated: "", filled: "no-elevate surface-container-highest", outlined: "border" };
export const card = (style, inner, { size, attrs = "" } = {}) => `<article${classes(CARD[style], size)}${attrs}>${inner}</article>`;

export const switchRow = (title, text, { checked, glyph } = {}) =>
  `<nav><div class="max"><h6 class="small">${title}</h6><div>${text}</div></div><label${classes("switch", glyph && "icon")}><input type="checkbox" aria-label="${title}"${checked ? " checked" : ""}><span>${glyph ? icon(glyph) : ""}</span></label></nav>`;

// A menu beside its button; Beer's data-ui on the wrapper opens it. Items are [icon, label, trailing] (a list as
// trailing is a submenu).
export const menu = (id, trigger, items, { position = "", selected } = {}) =>
  `<div data-ui="#${id}">${trigger}<menu id="${id}"${classes("no-wrap", position)}>${items.map(([glyph, label, trailing], index) => (label === "-" ? "<li><hr></li>"
    : `<li${classes(index === selected && "active")}>${glyph ? icon(glyph) : ""}${Array.isArray(trailing) ? `<span class="max">${label}</span>${icon("arrow_right")}<menu class="no-wrap">${trailing.map((each) => `<li>${each}</li>`).join("")}</menu>` : `<span class="max">${label}</span>${trailing ? `<label>${trailing}</label>` : ""}`}</li>`)).join("")}</menu></div>`;

export const dialog = (id, inner, { modal, size } = {}) => `<dialog id="${id}"${classes(modal && "modal", size)}>${inner}</dialog>`;
export const snackbar = (id, inner, { top } = {}) => `<div id="${id}"${classes("snackbar", top && "top")}>${inner}</div>`;
export const opens = (id) => ` data-ui="#${id}"`;
export const toggles = ' data-ui=""';

// Destinations that switch their pages: a link per page, `current` the one showing. Rail and bar draw an icon over a
// label; a drawer draws the label beside it.
export const destinations = (id, items, { current = 0, drawer } = {}) =>
  items.map(([glyph, label, count], index) => `<a${classes(index === current && "active")}${REACH}${opens(`${id}-${index}`)}>${icon(glyph)}${drawer ? `<span class="max">${label}</span>${count ? `<span>${count}</span>` : ""}` : `<div>${label}</div>`}</a>`).join("");
export const panels = (id, pages, current = 0) => pages.map((page, index) => `<div${classes("page", index === current && "active")} id="${id}-${index}">${page}</div>`).join("");
export const empty = (glyph, title, text) => `<div class="center-align padding">${icon(glyph, "extra")}<h6>${title}</h6><p>${text}</p></div>`;

export const navBar = (id, items, current) => `<nav class="bottom" aria-label="Sections">${destinations(id, items, { current })}</nav>`;
export const navRail = (id, items, current, top = "", height = "") => `<nav${classes("left", height)} aria-label="Sections">${top ? `<header>${top}</header>` : ""}${destinations(id, items, { current })}</nav>`;
export const tabs = (id, labels, current = 0) => `<div class="tabs">${labels.map((label, index) => `<a${classes(index === current && "active")}${REACH}${opens(`${id}-${index}`)}>${label}</a>`).join("")}</div>`;
export const appBar = (title, { back, actions = [], fixed } = {}) => `<header${classes(fixed && "fixed")}><nav>${back ? iconButton("arrow_back", "Back") : ""}<h6 class="max">${title}</h6>${actions.join("")}</nav></header>`;

// A bordered box at a fixed height: the frame a whole container component or a page is shown in.
export const frame = (inner, size = "large-height") => `<div class="border round ${size} scroll">${inner}</div>`;
export const group = (title, inner) => `<section><h6 class="small">${title}</h6>${inner}</section><div class="space"></div>`;
export const row = (...items) => `<nav class="wrap">${items.flat().join("")}</nav>`;

const DOCS = "https://github.com/beercss/beercss/blob/main/docs/";
const M3 = "https://m3.material.io/";
// A component's page is under components/; any other Material 3 page is a path from the site's root.
export const reference = (doc, m3, label = m3) => `<p class="small-text">Beer: <a class="link" href="${DOCS}${doc}.md" target="_blank" rel="noopener">${doc}.md</a>${m3 ? ` · Material 3: <a class="link" href="${M3}${m3.includes("/") ? m3 : `components/${m3}/overview`}" target="_blank" rel="noopener">${label}</a>` : ""}</p>`;
const item = (id, name, doc, m3, body) => ({ id, name, body: () => `${reference(doc, m3)}${body()}` });

const items = [];

items.push(
  item("badge", "Badge", "BADGE", "badges", () =>
    group("On an icon button", row(
      `<button class="circle">${icon("notifications")}<div class="badge">3</div></button>`,
      `<button class="circle">${icon("mail")}<div class="badge">99+</div></button>`,
      `<button class="circle">${icon("chat")}<div class="badge min"></div></button>`,
      `<button class="circle">${icon("shopping_cart")}<div class="badge border">2</div></button>`,
      `<button class="circle">${icon("favorite")}<div class="badge primary">7</div></button>`))
    + group("On a chip", row(`<a class="chip circle">${icon("home")}<div class="badge">10</div></a>`))
    + group("On a destination", `<nav class="bottom" aria-label="Sections"><a class="active">${icon("inbox")}<div>Inbox</div><div class="badge">4</div></a><a>${icon("send")}<div>Sent</div></a></nav>`)),

  item("button", "Buttons", "BUTTON", "buttons", () =>
    group("Styles", row(["filled", "tonal", "outlined", "text", "elevated"].map((style) => button(style, style))))
    + group("With an icon", row(["filled", "tonal", "outlined", "text", "elevated"].map((style) => button("Add", style, { icon: "add" }))))
    + group("Disabled", row(["filled", "tonal", "outlined", "text"].map((style) => button(style, style, { attrs: " disabled" }))))
    + group("Sizes", row(["small", "", "extra", "large", "xlarge"].map((size) => button(size || "default", "filled", { size }))))
    + group("Responsive", `<button class="responsive">${"Fills its container"}</button>`)),

  item("icon-button", "Icon buttons", "BUTTON", "icon-buttons", () =>
    group("Styles", row(["standard", "filled", "tonal", "outlined"].map((style) => iconButton("favorite", style, style))))
    + group("Disabled", row(iconButton("favorite", "Standard", "standard", { attrs: " disabled" }), iconButton("favorite", "Filled", "filled", { attrs: " disabled" })))
    + group("Sizes", row(["small", "", "large", "extra"].map((size) => iconButton("favorite", size || "default", "tonal", { size }))))
    + group("Toggle", row(iconButton("favorite", "Favourite", "standard", { attrs: toggles }), iconButton("bookmark", "Save", "outlined", { attrs: toggles }),
      `<label class="checkbox icon"><input type="checkbox" aria-label="Star"><span>${icon("star_border")}${icon("star")}</span></label>`))),

  item("fab", "Floating action buttons", "BUTTON", "floating-action-button", () =>
    group("Sizes", row(`<button class="circle primary-container" aria-label="Add">${icon("add")}</button>`, `<button class="circle extra primary-container" aria-label="Add">${icon("add")}</button>`, `<button class="circle large primary-container" aria-label="Add">${icon("add")}</button>`))
    + group("Colours", row(["primary-container", "secondary-container", "tertiary-container"].map((color) => `<button class="circle extra ${color}" aria-label="Edit">${icon("edit")}</button>`), `<button class="square round extra primary" aria-label="Edit">${icon("edit")}</button>`))
    + group("Extended", row(`<button class="extend circle primary-container">${icon("edit")}<span>Compose</span></button>`, `<button class="extend circle tertiary-container">${icon("navigation")}<span>Route</span></button>`))
    + group("Menu", `<div data-ui="#create-menu"><button class="circle extra" aria-label="Create">${icon("add")}</button><menu id="create-menu" class="top transparent no-wrap"><li>${button("Photo", "tonal", { icon: "photo_camera" })}</li><li>${button("Note", "tonal", { icon: "edit_note" })}</li><li>${button("Reminder", "tonal", { icon: "alarm" })}</li></menu></div>`)),

  item("button-group", "Button groups", "BUTTON", "button-groups", () => {
    const labels = ["Day", "Week", "Month"];
    const shape = ["left-round", "", "right-round"];
    const buttons = (extra = "") => labels.map((label, index) => `<button${classes(shape[index])}${extra}>${label}</button>`).join("");
    return group("Group", `<nav class="group">${buttons()}</nav>`)
      + group("Connected, the segmented button", `<nav class="group connected">${labels.map((label, index) => `<button${classes(shape[index], index === 0 && "active")}${toggles}>${label}</button>`).join("")}</nav>`)
      + group("Connected, outlined", `<nav class="group connected">${labels.map((label, index) => `<button${classes("border", shape[index])}${toggles}>${label}</button>`).join("")}</nav>`)
      + group("Split", `<nav class="group split"><button class="left-round">Save</button><button class="right-round" aria-label="More">${icon("keyboard_arrow_down")}</button></nav>`)
      + group("Disabled", `<nav class="group connected">${buttons(" disabled")}</nav>`);
  }),

  item("chip", "Chips", "CHIP", "chips", () =>
    group("Assist", row(chip("Add to calendar", { icon: "event" }), chip("Directions", { icon: "directions" }), chip("Share", { icon: "share" })))
    + group("Filter", row(chip("Open now", { color: "secondary-container" }), chip("Top rated"), chip("Nearby"), chip("Free")))
    + group("Input", row(chip("Ada", { icon: "person" }).replace("</button>", `${icon("close")}</button>`), chip("Sam", { icon: "person" }).replace("</button>", `${icon("close")}</button>`)))
    + group("Fill and border", row(chip("fill", { color: "fill" }), chip("border"), chip("primary", { color: "primary" })))
    + group("Sizes", row(["small", "", "medium", "large"].map((size) => chip(size || "default", { size }))))
    + group("Disabled", row(chip("Unavailable", { attrs: " disabled" })))),
);

const actions = (...buttons) => `<nav>${buttons.join("")}</nav>`;
const labelled = (kind, label, extra = "") => `<label class="${kind}"><input type="${kind === "radio" ? "radio" : "checkbox"}"${extra}><span>${label}</span></label>`;

items.push(
  item("card", "Cards", "CARD", "cards", () =>
    group("Elevated, filled and outlined", `<div class="grid">${["elevated", "filled", "outlined"].map((style) =>
      `<div class="s12 m4">${card(style, `<h5>Trip to the coast</h5><div>Three days, two stops, and a late train home.</div>${actions(button("Details", "text"), button("Book", "tonal"))}`)}</div>`).join("")}</div>`)
    + group("Without padding, with media", `<div class="grid"><div class="s12 m6">${card("elevated", `<div class="primary-container large-height middle-align center-align">${icon("landscape", "extra")}</div><div class="padding"><h5>Mountain loop</h5><p>12 km, moderate, best before noon.</p></div>`, { size: "no-padding" })}</div></div>`)),

  item("checkbox", "Checkboxes", "CHECKBOX", "checkbox", () =>
    group("States", row(`<label class="checkbox"><input type="checkbox" aria-label="Unchecked"><span></span></label>`, `<label class="checkbox"><input type="checkbox" aria-label="Checked" checked><span></span></label>`,
      `<label class="checkbox"><input type="checkbox" aria-label="Disabled" disabled><span></span></label>`, `<label class="checkbox"><input type="checkbox" aria-label="Disabled, checked" checked disabled><span></span></label>`))
    + group("With a label", row(labelled("checkbox", "Remember me"), labelled("checkbox", "Send updates", " checked")))
    + group("With an icon", row(`<label class="checkbox icon"><input type="checkbox" aria-label="Done"><span>${icon("close")}${icon("done")}</span></label>`))
    + group("A set", `<nav>${["Photos", "Videos", "Documents"].map((label, index) => labelled("checkbox", label, index === 0 ? " checked" : "")).join("")}</nav>`)
    + group("Sizes", row(["small", "", "medium", "large", "extra"].map((size) => `<label${classes("checkbox", size)}><input type="checkbox" aria-label="${size || "default"}" checked><span></span></label>`)))),

  item("radio", "Radio buttons", "RADIO", "radio-button", () =>
    group("A set", `<nav>${["Standard", "Express", "Pickup"].map((label, index) => labelled("radio", label, ` name="delivery"${index === 0 ? " checked" : ""}`)).join("")}</nav>`)
    + group("Disabled", row(`<label class="radio"><input type="radio" name="off" aria-label="Disabled" disabled><span></span></label>`, `<label class="radio"><input type="radio" name="off" aria-label="Disabled, selected" checked disabled><span></span></label>`))
    + group("Sizes", row(["small", "", "medium", "large", "extra"].map((size) => `<label${classes("radio", size)}><input type="radio" name="size" aria-label="${size || "default"}" ${size === "" ? "checked" : ""}><span></span></label>`)))),

  item("switch", "Switches", "SWITCH", "switch", () =>
    group("States", row(`<label class="switch"><input type="checkbox" aria-label="Off"><span></span></label>`, `<label class="switch"><input type="checkbox" aria-label="On" checked><span></span></label>`,
      `<label class="switch"><input type="checkbox" aria-label="Disabled" disabled><span></span></label>`, `<label class="switch"><input type="checkbox" aria-label="Disabled, on" checked disabled><span></span></label>`))
    + group("With an icon", row(`<label class="switch icon"><input type="checkbox" aria-label="Wi-Fi"><span>${icon("wifi")}</span></label>`, `<label class="switch icon"><input type="checkbox" aria-label="Done" checked><span>${icon("close")}${icon("done")}</span></label>`))
    + group("In a row", switchRow("Notifications", "Alerts for new messages", { checked: true }) + switchRow("Wi-Fi only", "Download on Wi-Fi", { glyph: "wifi" }))),

  item("slider", "Sliders", "SLIDER", "sliders", () => {
    const slider = (label, extra = "", inside = "", input = "") => `<div${classes("slider", extra)}><input type="range" value="40" aria-label="${label}"${input}><span>${inside}</span></div>`;
    return group("Default", slider("Level"))
      + group("Range 4 to 8", `<div class="slider"><input type="range" min="4" max="8" value="6" aria-label="Range"><span></span></div>`)
      + group("Value indicator", `<div class="slider"><input type="range" value="40" aria-label="Volume"><span></span><div class="tooltip"></div></div>`)
      + group("Sizes, with an inset icon from medium", ["small", "medium", "large", "extra"].map((size) => slider(size, size, size === "small" ? "" : icon("sunny"))).join(""))
      + group("Disabled", slider("Disabled", "", "", " disabled"));
  }),

  item("text-field", "Text fields", "INPUT", "text-fields", () =>
    group("Outlined and filled", `<div class="grid"><div class="s12 m6">${field("Name", { value: "Ada Lovelace" })}</div><div class="s12 m6">${field("Name", { style: "filled", value: "Ada Lovelace" })}</div></div>`)
    + group("Leading and trailing icons", `<div class="grid"><div class="s12 m6">${field("Email", { prefix: "mail" })}</div><div class="s12 m6">${field("Password", { type: "password", suffix: "visibility" })}</div></div>`)
    + group("Helper and error", `<div class="grid"><div class="s12 m6">${field("Username", { helper: "Letters and numbers only" })}</div><div class="s12 m6">${field("Email", { value: "ada@", error: "Enter a full address", prefix: "mail" })}</div></div>`)
    + group("Disabled", `<div class="grid"><div class="s12 m6">${field("Locked", { value: "Cannot edit", attrs: " disabled" })}</div></div>`)
    + group("Search", `<div class="grid"><div class="s12 m6"><div class="field round fill prefix">${icon("search")}<input type="search" placeholder="Search" aria-label="Search"></div></div></div>`)
    + group("Date and time, the browser's pickers", `<div class="grid"><div class="s12 m6">${field("Date", { type: "date", prefix: "event", active: true })}</div><div class="s12 m6">${field("Time", { type: "time", prefix: "schedule", active: true })}</div></div>`)
    + group("Sizes", `<div class="grid">${["small", "", "large", "extra"].map((size) => `<div class="s12 m6">${field(size || "default", { size, value: "Text" })}</div>`).join("")}</div>`)),

  item("textarea", "Text areas", "TEXTAREA", "text-fields", () =>
    group("Outlined and filled", `<div class="grid"><div class="s12 m6"><div class="field label border"><textarea placeholder=" "></textarea><label>Message</label></div></div><div class="s12 m6"><div class="field label fill"><textarea placeholder=" "></textarea><label>Message</label></div></div></div>`)
    + group("Fixed rows", `<div class="grid"><div class="s12 m6"><div class="field label border"><textarea rows="5" placeholder=" ">A few lines of text.</textarea><label>Notes</label></div></div></div>`)),

  item("select", "Selects", "SELECT", "menus", () => {
    const select = (style, extra = "") => `<div class="field label ${style} suffix"><select${extra}><option>Small</option><option>Medium</option><option>Large</option></select><label>Size</label>${icon("arrow_drop_down")}</div>`;
    return group("Outlined and filled", `<div class="grid"><div class="s12 m6">${select("border")}</div><div class="s12 m6">${select("fill")}</div></div>`)
      + group("Disabled", `<div class="grid"><div class="s12 m6">${select("border", " disabled")}</div></div>`);
  }),
);

items.push(
  item("menu", "Menus", "MENU", "menus", () =>
    group("Actions, with shortcuts and a submenu", menu("menu-actions", button("Edit", "outlined", { icon: "arrow_drop_down" }), [
      ["undo", "Undo", "Ctrl+Z"], ["redo", "Redo", "Ctrl+Y"], [null, "-"], ["content_cut", "Cut", "Ctrl+X"], ["content_copy", "Copy", "Ctrl+C"], ["content_paste", "Paste", "Ctrl+V"], [null, "-"],
      ["share", "Share", [`<span>Email</span>`, `<span>Message</span>`, `<span>Copy link</span>`]],
    ]))
    + group("From an icon button", menu("menu-more", iconButton("more_vert", "More"), [["edit", "Rename"], ["drive_file_move", "Move"], ["delete", "Delete"]], { position: "left" }))
    + group("Choosing one, the chosen row active", menu("menu-sort", button("Sort by", "tonal", { icon: "sort" }), [["schedule", "Newest"], ["history", "Oldest"], ["sort_by_alpha", "Name"]], { selected: 0 }))),

  item("dialog", "Dialogs", "DIALOG", "dialogs", () =>
    group("Open one", row(button("Basic", "outlined", { attrs: opens("dialog-basic") }), button("Modal", "outlined", { attrs: opens("dialog-modal") }), button("With a form", "outlined", { attrs: opens("dialog-form") }), button("Full screen", "outlined", { attrs: opens("dialog-full") })))
    + dialog("dialog-basic", `<h5>Discard draft?</h5><p>Your changes will be lost. This cannot be undone.</p><nav class="right-align">${button("Cancel", "text", { attrs: opens("dialog-basic") })}${button("Discard", "text", { attrs: opens("dialog-basic") })}</nav>`)
    + dialog("dialog-modal", `<h5>Allow notifications?</h5><p>A modal dialog blocks the page behind it until you choose.</p><nav class="right-align">${button("Not now", "text", { attrs: opens("dialog-modal") })}${button("Allow", "text", { attrs: opens("dialog-modal") })}</nav>`, { modal: true })
    + dialog("dialog-form", `<h5>New folder</h5>${field("Name", { value: "Untitled" })}<nav class="right-align">${button("Cancel", "text", { attrs: opens("dialog-form") })}${button("Create", "text", { attrs: opens("dialog-form") })}</nav>`)
    + dialog("dialog-full", `<header class="fixed"><nav>${iconButton("close", "Close", "standard", { attrs: opens("dialog-full") })}<h6 class="max">New event</h6>${button("Save", "text", { attrs: opens("dialog-full") })}</nav></header>${field("Title")}<div class="space"></div>${field("Date", { type: "date", prefix: "event", active: true })}`, { size: "max" })),

  item("snackbar", "Snackbars", "SNACKBAR", "snackbar", () =>
    group("Open one", row(button("Message", "outlined", { attrs: opens("snackbar-message") }), button("With an action", "outlined", { attrs: opens("snackbar-action") }), button("At the top", "outlined", { attrs: opens("snackbar-top") })))
    + snackbar("snackbar-message", `<span class="max">Message sent</span>`)
    + snackbar("snackbar-action", `<span class="max">Conversation archived</span><a class="inverse-link"${REACH}>Undo</a>`)
    + snackbar("snackbar-top", `${icon("warning")}<span class="max">Connection lost</span>${iconButton("close", "Dismiss", "standard")}`, { top: true })),

  item("tooltip", "Tooltips", "TOOLTIP", "tooltips", () =>
    group("On a button", row(`<button><span>Hover or focus</span><span class="tooltip">A short hint</span></button>`, `<button class="circle transparent" aria-label="Share">${icon("share")}<span class="tooltip">Share</span></button>`))
    + group("Positions", row(["top", "bottom", "left", "right"].map((side) => `<button class="border"><span>${side}</span><span class="tooltip ${side}">${side}</span></button>`)))
    + group("Rich", row(`<button class="fill"><span>Details</span><div class="tooltip max"><b>Storage</b><div>Files you delete stay in the bin for thirty days.</div></div></button>`))),

  item("progress", "Progress", "PROGRESS", "progress-indicators", () =>
    group("Linear", `<progress value="35" max="100"></progress><div class="space"></div><progress></progress>`)
    + group("Linear, wavy", `<progress class="wavy" value="35" max="100"></progress><div class="space"></div><progress class="wavy"></progress>`)
    + group("Circular", row(`<progress class="circle" value="35" max="100"></progress>`, `<progress class="circle"></progress>`, `<progress class="circle wavy" value="35" max="100"></progress>`, `<progress class="circle wavy"></progress>`))
    + group("Sizes", `<progress class="small" value="35" max="100"></progress><div class="space"></div><progress class="medium" value="35" max="100"></progress><div class="space"></div><progress class="large" value="35" max="100"></progress>`)),

  item("overlay", "Overlays", "OVERLAY", null, () =>
    group("Block the screen while waiting; click it to dismiss", row(button("Overlay", "outlined", { attrs: opens("overlay-plain") }), button("Blurred", "outlined", { attrs: opens("overlay-blur") })))
    + `<div class="overlay center-align middle-align" id="overlay-plain"${opens("overlay-plain")}><progress class="circle"></progress></div><div class="overlay blur center-align middle-align" id="overlay-blur"${opens("overlay-blur")}><progress class="circle wavy"></progress></div>`),

  item("shape", "Shapes", "SHAPE", "loading-indicator", () =>
    group("Shapes", row(["sunny", "burst", "flower", "heart", "sided-cookie9", "puffy", "clamshell", "gem"].map((name) => `<div class="shape ${name}"></div>`)))
    + group("Sizes", row(["tiny", "small", "", "large", "extra"].map((size) => `<div${classes("shape", "flower", size)}></div>`)))
    + group("Loading indicator", row(`<div class="shape loading-indicator"></div>`, `<div class="shape loading-indicator fast-rotate"></div>`, `<div class="shape sunny slow-rotate"></div>`))
    + group("Holding an icon", row(`<div class="shape sided-cookie6">${icon("music_note")}</div>`))),

  item("icon", "Icons", "ICON", null, () =>
    group("Sizes", row(["tiny", "small", "", "large", "extra"].map((size) => icon("home", size))))
    + group("Outlined and filled", row(icon("favorite"), icon("favorite", "fill"), icon("star"), icon("star", "fill")))),

  item("media", "Media", "MEDIA", null, () =>
    group("Circle, round and square", row(["circle", "round", "square"].map((form) => `<svg class="${form} extra primary-container" viewBox="0 0 24 24" aria-hidden="true"><path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"></path></svg>`)))
    + group("Sizes", row(["tiny", "small", "", "large", "extra"].map((size) => `<svg${classes("circle", size)} viewBox="0 0 24 24" aria-hidden="true"><path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"></path></svg>`)))
    + group("Responsive", `<svg class="responsive round medium" viewBox="0 0 24 24" aria-hidden="true"><path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"></path></svg>`)),
);

const MAIL = [["inbox", "Inbox", "24"], ["star", "Starred"], ["send", "Sent"], ["drafts", "Drafts", "2"]];
const PLACES = [["home", "Home"], ["search", "Search"], ["video_library", "Library"], ["settings", "Settings"]];
const threads = [
  { avatar: "A", headline: "Ada", supporting: "Lunch on Thursday?", trailing: "9:41" },
  { avatar: "S", headline: "Sam", supporting: "The files are ready to review.", trailing: "Mon" },
  { avatar: "R", headline: "Riley", supporting: "Thanks, see you there.", trailing: "Sun" },
];
const pageFor = (title) => `<h6>${title}</h6><p>Content for ${title.toLowerCase()} appears here.</p>`;

items.push(
  item("list", "Lists", "LIST", "lists", () =>
    group("One line, with icons", list(MAIL.map(([glyph, headline, trailing], index) => listItem({ icon: glyph, headline, trailing, selected: index === 0 }))))
    + group("Two lines, with avatars", list(threads.map((thread) => listItem(thread))))
    + group("Expansion", `<ul class="list border"><li class="wave"${REACH}>Account</li><li><details><summary>More settings</summary><ul class="list"><li class="wave"${REACH}>Privacy</li><li class="wave"${REACH}>Storage</li></ul></details></li></ul>`)),

  item("divider", "Dividers", "DIVIDER", "divider", () =>
    group("Full width and sizes", `<hr><hr class="small"><hr class="medium"><hr class="large">`)
    + group("In a list", `<ul class="list"><li>Above</li><li><hr></li><li>Below</li></ul>`)
    + group("Vertical", row(`<span>Left</span><hr class="vertical"><span>Right</span>`))),

  item("expansion", "Expansion", "EXPANSION", null, () =>
    group("A panel", `<details><summary><div class="row"><span class="max">Shipping details</span>${icon("expand_more")}</div></summary><p>Orders leave the warehouse within two working days.</p></details>`)
    + group("Several levels", `<details><summary><div class="row"><span class="max">Settings</span>${icon("expand_more")}</div></summary><details><summary><div class="row"><span class="max">Privacy</span>${icon("expand_more")}</div></summary><p>Choose who can see your activity.</p></details></details>`)),

  item("table", "Tables", "TABLE", null, () => {
    const body = [["Ada", "Design", "Active"], ["Sam", "Research", "Away"], ["Riley", "Support", "Active"]].map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
    const table = (extra = "") => `<table${classes(extra)}><thead><tr><th>Name</th><th>Team</th><th>Status</th></tr></thead><tbody>${body}</tbody><tfoot><tr><th>Total</th><th>3</th><th></th></tr></tfoot></table>`;
    return group("Default", table()) + group("Border", table("border")) + group("Stripes", table("stripes"));
  }),

  item("tabs", "Tabs", "TABS", "tabs", () =>
    group("Primary tabs that switch their pages", `${tabs("tabs-demo", ["Overview", "Specs", "Reviews"])}${panels("tabs-demo", [pageFor("Overview"), pageFor("Specs"), pageFor("Reviews")])}`)
    + group("Tabs with icons", `<div class="tabs"><a class="active"${REACH}>${icon("flight")}<span>Flights</span></a><a${REACH}>${icon("hotel")}<span>Stays</span></a><a${REACH}>${icon("directions_car")}<span>Cars</span></a></div>`)),

  item("navigation-bar", "Navigation bar", "NAVIGATION", "navigation-bar", () =>
    group("Whole, with pages", frame(`<div class="padding">${panels("bar", PLACES.map(([, label]) => pageFor(label)))}</div>${navBar("bar", PLACES, 0)}`, "medium-height"))),

  item("navigation-rail", "Navigation rail", "NAVIGATION", "navigation-rail", () =>
    group("Whole, with pages", frame(`<div class="row top-align">${navRail("rail", PLACES, 0, iconButton("menu", "Menu"), "medium-height")}<div class="max padding">${panels("rail", PLACES.map(([, label]) => pageFor(label)))}</div></div>`, "medium-height"))),

  item("navigation-drawer", "Navigation drawer", "NAVIGATION", "navigation-drawer", () =>
    group("Whole, with pages", frame(`<div class="row top-align"><nav class="left max medium-height" aria-label="Mail"><header><h6>Mail</h6></header>${destinations("drawer", MAIL, { drawer: true })}</nav><div class="max padding">${panels("drawer", MAIL.map(([, label]) => pageFor(label)))}</div></div>`, "medium-height"))),

  item("top-app-bar", "Top app bar", "LAYOUT", "app-bars", () =>
    group("Small", frame(appBar("Title", { back: true, actions: [iconButton("search", "Search"), iconButton("more_vert", "More")] }) + `<div class="padding"><p>Content scrolls beneath the bar.</p></div>`, "small-height"))
    + group("With a menu", frame(appBar("Photos", { actions: [iconButton("search", "Search"), menu("bar-menu", iconButton("more_vert", "More"), [["select_all", "Select all"], ["settings", "Settings"]], { position: "left" })] }), "small-height"))),

  item("bottom-app-bar", "Bottom app bar", "LAYOUT", "app-bars", () =>
    group("With actions and a button", frame(`<div class="padding"><p>Page content.</p></div><footer><nav>${["check_box", "brush", "mic", "image"].map((glyph) => iconButton(glyph, glyph)).join("")}<div class="max"></div><button class="square round extra primary" aria-label="Add">${icon("add")}</button></nav></footer>`, "small-height"))),

  item("toolbar", "Toolbars", "NAVIGATION", "toolbars", () =>
    group("Horizontal", `<nav class="toolbar">${["format_bold", "format_italic", "format_underlined"].map((glyph, index) => `<a${classes(index === 0 && "active")}${REACH}${toggles}>${icon(glyph)}</a>`).join("")}</nav>`)
    + group("Filled", `<nav class="toolbar fill">${["undo", "redo", "share"].map((glyph) => `<a${REACH}>${icon(glyph)}</a>`).join("")}</nav>`)
    + group("Tabbed", `<nav class="tabbed small">${["Day", "Week", "Month"].map((label, index) => `<a${classes(index === 0 && "active")}${REACH}${opens(`tabbed-${index}`)}>${label}</a>`).join("")}</nav>${panels("tabbed", ["Day view", "Week view", "Month view"].map(pageFor))}`)),
);

export default items;
