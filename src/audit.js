// What a rendered playground must hold, measured in the page itself: every visible text meets Material's contrast
// against the colour actually behind it; every text is set in one of the kit's faces, and each face in use loaded; no two
// boxes inside one control overlap; nothing scrolls the page sideways; headings step down; prose keeps a readable
// measure, and a list's markers sit inside its text column. Returns one line per failure. Runs in the page; `tokens audit` (src/render.mjs) puts it there.
export const audit = (doc, { faces }) => {
  const win = doc.defaultView;
  const failures = [];
  const used = new Set();
  const style = (el) => win.getComputedStyle(el);
  const rgba = (text) => { const [r, g, b, a = 1] = text.match(/[\d.]+/g).map(Number); return { r, g, b, a }; };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const luminance = ({ r, g, b }) => [r, g, b].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  // The colour behind an element: its own and its ancestors' backgrounds, composed down to the first opaque one.
  const behind = (el) => {
    const layers = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const bg = rgba(style(node).backgroundColor);
      if (bg.a > 0) layers.push(bg);
      if (bg.a >= 1) break;
    }
    return layers.reverse().reduce((under, top) => over(top, under), { r: 255, g: 255, b: 255, a: 1 });
  };
  const opacity = (el) => { let o = 1; for (let node = el; node && node.nodeType === 1; node = node.parentElement) o *= Number(style(node).opacity); return o; };
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && style(el).visibility === "visible" && el.checkVisibility?.() !== false; };
  const name = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).join(".")}` : ""} "${el.textContent.trim().slice(0, 30)}"`;
  // Text an element sets itself, not only its children's; a disabled specimen (Material's 38%) is meant to be faint,
  // and a contrast pair the page marks failing (`data-fail`) is shown failing on purpose.
  const texts = [...doc.body.querySelectorAll("*")].filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    && visible(el) && !el.closest("[disabled], [aria-disabled='true'], :disabled, .disabled, [data-fail], iframe, script, style") && opacity(el) > 0.9);

  for (const el of texts) {
    const s = style(el);
    const size = parseFloat(s.fontSize);
    const face = s.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
    const icon = el.tagName === "I" || /symbols/i.test(face);
    // An icon is a graphic (3:1), as is large text.
    const large = icon || size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
    const bg = behind(el);
    const value = ratio(over(rgba(s.color), bg), bg);
    if (value < (large ? 3 : 4.5)) failures.push(`contrast ${value.toFixed(2)}:1 (${s.color} on rgb(${bg.r}, ${bg.g}, ${bg.b})): ${name(el)}`);
    if (!icon) used.add(face);
    if (!icon && !faces.includes(face)) failures.push(`face "${face}" is not the kit's (${faces.join(", ")}): ${name(el)}`);
  }
  // A face the page sets text in has loaded (a browser loads a face only once text uses it).
  for (const face of used) if (faces.includes(face) && !doc.fonts.check(`16px "${face}"`)) failures.push(`face "${face}" did not load`);

  // Inside one control (a destination, a list row, a button) the icon and the label never overlap.
  for (const control of doc.querySelectorAll("nav a, nav button, .list a, button")) {
    // A badge sits on its icon by design.
    const parts = [...control.children].filter((el) => visible(el) && !el.matches(".badge")).map((el) => [el, el.getBoundingClientRect()]);
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      const [a, ra] = parts[i]; const [b, rb] = parts[j];
      const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (x > 1 && y > 1) failures.push(`overlap ${Math.round(x)}×${Math.round(y)}: ${name(a)} and ${name(b)} in ${name(control)}`);
    }
  }
  if (doc.documentElement.scrollWidth > win.innerWidth + 1) failures.push(`the page scrolls sideways: ${doc.documentElement.scrollWidth} > ${win.innerWidth}`);

  // In the open item: a heading is never larger than one a level above it, and running text stays near a readable
  // measure (under about 75 characters, 45em).
  const detail = doc.querySelector("main > .panes > :last-child");
  if (detail && visible(detail)) {
    const sizes = [1, 2, 3, 4, 5, 6].map((level) => [level, [...detail.querySelectorAll(`:scope > h${level}`)].map((h) => [h, parseFloat(style(h).fontSize)])]);
    for (const [level, each] of sizes) for (const [h, size] of each) for (const [, above] of sizes.slice(0, level - 1).flatMap(([, list]) => list)) {
      if (size > above + 0.5) { failures.push(`h${level} ${size}px is larger than a heading above it (${above}px): ${name(h)}`); break; }
    }
    // A pane of running text alone (no list beside it) is as wide as its text, not the window: wider, and the text
    // sits against one side with the rest of the pane empty.
    const lone = detail.parentElement.children.length === 1;
    const prose = [...detail.querySelectorAll(":scope > :is(p, ul, ol, blockquote)")];
    if (lone && prose.length) {
      const pane = detail.getBoundingClientRect();
      const text = Math.max(...prose.map((each) => each.getBoundingClientRect().right)) - pane.left;
      if (pane.width - text > pane.width / 3) failures.push(`a lone pane ${Math.round(pane.width)}px wide holds text ${Math.round(text)}px wide, against one side: ${name(detail.querySelector("h1") ?? detail)}`);
    }
    // A bulleted or numbered list keeps its markers inside the text column: room for them before the text.
    for (const list of detail.querySelectorAll("ul, ol")) {
      const s = style(list);
      const marked = [...list.children].some((li) => style(li).display === "list-item" && style(li).listStyleType !== "none" && style(li).listStylePosition === "outside");
      if (!visible(list) || !marked) continue;
      const room = parseFloat(s.paddingInlineStart) / parseFloat(s.fontSize);
      if (room < 1) failures.push(`list markers hang outside the text column (${room.toFixed(2)}em of room): ${name(list)}`);
    }
    for (const p of detail.querySelectorAll(":scope > :is(p, ul, ol, blockquote)")) {
      const em = p.getBoundingClientRect().width / parseFloat(style(p).fontSize);
      if (em > 45) failures.push(`measure ${Math.round(em)}em is too wide: ${name(p)}`);
    }
  }
  return [...new Set(failures)];
};
