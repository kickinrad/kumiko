// Playground edits are local to the page. The exported TOML contains only changed theme.toml values.
const own = (object, key) => Object.hasOwn(object ?? {}, key);
const hex = (value) => /^#[0-9a-fA-F]{6}$/.test(value);
const quote = (value) => JSON.stringify(value);
const scalar = (value) => Array.isArray(value) ? `[${value.map(scalar).join(", ")}]` : quote(value);
const changed = (before, after) => JSON.stringify(before) !== JSON.stringify(after);
const setToken = (data, mode, path, value) => {
  const token = data.modes[mode]?.find((each) => each.path === path);
  if (token) token.value = value;
};
const paletteValue = (editor, mode, choice) => {
  const [from, name] = choice.includes(".") ? choice.split(".") : [mode, choice];
  return editor.palette[from]?.[name];
};
const refreshRole = (data, role, mode) => setToken(data, mode, role, paletteValue(data.editor, mode, data.editor.roles[role][mode]));
const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const editorView = (data, mode, baseline) => {
  const { palette, roles, faces, tokens } = data.editor;
  const field = (label, control) => `<label class="field border round padding"><span>${escape(label)}</span>${control}</label>`;
  const input = (kind, name, value, type = "text") => `<input data-edit="${kind}" data-name="${escape(name)}" type="${type}" value="${escape(value)}">`;
  const colours = Object.entries(palette[mode]).map(([name, value]) => field(name, input("palette", name, value, "color"))).join("");
  const choices = Object.entries(palette).flatMap(([from, entries]) => Object.keys(entries).map((name) => [from === mode ? name : `${from}.${name}`, `${from} · ${name}`]));
  const mapped = Object.entries(roles).map(([role, values]) => field(role, `<select data-edit="role" data-name="${escape(role)}">${choices.map(([key, label]) => `<option value="${escape(key)}"${values[mode] === key ? " selected" : ""}>${escape(label)}</option>`).join("")}</select>`)).join("");
  const families = Object.entries(faces).map(([name, value]) => field(name, input("face", name, Array.isArray(value) ? value.join(", ") : value))).join("");
  const values = Object.entries(tokens).map(([name, value]) => field(name, input("token", name, value))).join("");
  return `<p>Changes preview in this page. Download the changed values and merge each table into design/theme.toml, then run kumiko and kumiko audit. Derived colours recalculate on build.</p>
<h2>Palette · ${escape(mode)}</h2><div class="grid">${colours}</div>
<h2>Roles · ${escape(mode)}</h2><div class="grid">${mapped}</div>
<h2>Faces</h2><div class="grid">${families}</div>
<h2>Other tokens</h2><div class="grid">${values}</div>
<h2>theme.toml patch</h2><p>Only changed values appear here.</p><textarea class="responsive" rows="12" readonly data-patch>${escape(patch(baseline, data.editor))}</textarea>
<p><button data-export${patch(baseline, data.editor) ? "" : " disabled"}><i>download</i><span>Download patch</span></button></p><p role="status" data-edit-status></p>`;
};

export const edit = (data, { kind, mode, name, value }) => {
  const editor = data.editor;
  if (!editor) throw new Error("This kit has no theme.toml editor");
  if (kind === "palette") {
    if (!own(editor.palette[mode], name) || !hex(value)) throw new Error("Choose an existing colour and a six-digit hex value");
    editor.palette[mode][name] = value.toLowerCase();
    setToken(data, mode, `${data.name}.palette.${name}`, editor.palette[mode][name]);
    for (const [role, choices] of Object.entries(editor.roles)) for (const active of Object.keys(data.modes)) {
      const choice = choices[active];
      if (choice === name && active === mode || choice === `${mode}.${name}`) refreshRole(data, role, active);
    }
  } else if (kind === "role") {
    if (!own(editor.roles, name) || !own(data.modes, mode) || !paletteValue(editor, mode, value)) throw new Error("Choose a palette colour for this role");
    editor.roles[name][mode] = value;
    refreshRole(data, name, mode);
  } else if (kind === "face") {
    if (!own(editor.faces, name) || !value.trim()) throw new Error("Choose an existing face and a family");
    const face = Array.isArray(editor.faces[name]) ? value.split(",").map((each) => each.trim()).filter(Boolean) : value.trim();
    if (Array.isArray(face) && !face.length) throw new Error("Enter at least one family");
    editor.faces[name] = face;
    const path = { brand: "md.ref.typeface.brand", plain: "md.ref.typeface.plain", mono: `${data.name}.typeface.mono`, icon: `${data.name}.typeface.icon` }[name];
    const family = Array.isArray(face) ? face.join(", ") : face;
    for (const active of Object.keys(data.modes)) {
      for (const use of editor.faceUses?.[name] ?? []) setToken(data, active, use, family);
      setToken(data, active, path, family);
    }
  } else if (kind === "token") {
    if (!own(editor.tokens, name)) throw new Error("Choose an existing token");
    const old = editor.tokens[name];
    if (typeof old === "number") {
      if (!Number.isFinite(Number(value)) || value === "") throw new Error("Enter a number");
      value = Number(value);
    } else if (typeof old === "string" && /^-?\d*\.?\d+(px|rem|em|ms|s)$/.test(old) && !/^-?\d*\.?\d+(px|rem|em|ms|s)$/.test(value)) throw new Error("Keep a valid length or time unit");
    editor.tokens[name] = value;
    for (const active of Object.keys(data.modes)) setToken(data, active, name, value);
  } else throw new Error(`Unknown edit kind: ${kind}`);
  return data;
};

export const patch = (before, after) => {
  const sections = [];
  const section = (heading, rows) => { if (rows.length) sections.push(`[${heading}]\n${rows.join("\n")}`); };
  for (const [mode, colours] of Object.entries(after.palette)) {
    section(`palette.${mode}`, Object.entries(colours).filter(([key, value]) => changed(before.palette[mode]?.[key], value)).map(([key, value]) => `${quote(key)} = ${quote(value)}`));
  }
  for (const mode of Object.keys(after.palette)) {
    section(`roles.${mode}`, Object.entries(after.roles).filter(([key, values]) => changed(before.roles[key]?.[mode], values[mode])).map(([key, values]) => `${quote(key)} = ${quote(values[mode])}`));
  }
  section("faces", Object.entries(after.faces).filter(([key, value]) => changed(before.faces[key], value)).map(([key, value]) => `${quote(key)} = ${scalar(value)}`));
  section("tokens", Object.entries(after.tokens).filter(([key, value]) => changed(before.tokens[key], value)).map(([key, value]) => {
    const meta = after.tokenMeta?.[key] ?? {};
    const literal = typeof value === "number" ? value : scalar(value);
    const entry = Object.keys(meta).length ? `{ value = ${literal}${meta.type ? `, type = ${quote(meta.type)}` : ""}${meta.why ? `, why = ${quote(meta.why)}` : ""} }` : literal;
    return `${quote(key)} = ${entry}`;
  }));
  return sections.length ? `${sections.join("\n\n")}\n` : "";
};
