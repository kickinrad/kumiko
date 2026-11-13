// Sets one value in a theme.toml's text in place, so a saved edit changes that value's line and nothing else.
// `path` is the value's full key ("palette.night.primary", "faces.brand", "tokens.acme.layout.gap"); `value` is a
// string, a number or a list of strings. A key already set keeps its line, its spelling and its comment, and a token
// written as a table ({ value = …, why = … }) keeps everything but its value. A new key joins the last table its
// path lies in (or a new one at the end). The result is parsed back, and an edit that does not land fails.
const literal = (value) => Array.isArray(value) ? `[${value.map(literal).join(", ")}]` : typeof value === "number" ? String(value) : JSON.stringify(value);
// A key as written ("a.b", a."b.c", "x") to its parts.
const keyParts = (text) => [...text.trim().matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|([A-Za-z0-9_-]+)/g)].map((m) => m[1] !== undefined ? JSON.parse(`"${m[1]}"`) : m[2] ?? m[3]);
// Where the value that starts `text` ends: a string, an inline list or table (one line), or a bare word.
const valueEnd = (text) => {
  const open = text[0];
  if (open === '"' || open === "'") {
    for (let i = 1; i < text.length; i++) {
      if (open === '"' && text[i] === "\\") { i++; continue; }
      if (text[i] === open) return i + 1;
    }
    return text.length;
  }
  if (open === "[" || open === "{") {
    let depth = 0;
    let quote;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quote) { if (c === "\\" && quote === '"') i++; else if (c === quote) quote = undefined; continue; }
      if (c === '"' || c === "'") quote = c;
      else if (c === "[" || c === "{") depth++;
      else if ((c === "]" || c === "}") && --depth === 0) return i + 1;
    }
    return text.length;
  }
  return text.match(/^[^\s#,}\]]*/)[0].length;
};
// theme.toml reads a quoted dotted key ("acme.layout.gap") as a path, as it reads tables, so keys compare joined.
const joined = (parts) => parts.join(".");
const within = (table, path) => path === table || path.startsWith(`${table}.`);
// The value at a joined path, through tables and dotted keys alike.
const lookup = (node, path) => {
  if (path === "") return node;
  if (!node || typeof node !== "object" || Array.isArray(node)) return undefined;
  for (const [key, child] of Object.entries(node)) if (within(key, path)) {
    const found = lookup(child, path === key ? "" : path.slice(key.length + 1));
    if (found !== undefined) return found;
  }
  return undefined;
};
const bare = (part) => /^[A-Za-z0-9_-]+$/.test(part) ? part : JSON.stringify(part);

export const setValue = (text, path, value) => {
  const lines = text.split("\n");
  let table = [];
  let home;
  for (const [i, line] of lines.entries()) {
    const header = line.match(/^\s*\[([^\[\]]+)\]\s*(#.*)?$/);
    if (header) { table = keyParts(header[1]); if (within(joined(table), path) && joined(table) !== path && (!home || table.length >= home.table.length)) home = { table, at: i }; continue; }
    if (home?.table === table) home.at = i;
    const pair = line.match(/^(\s*)((?:"(?:[^"\\]|\\.)*"|'[^']*'|[A-Za-z0-9_.-]+)(?:\s*\.\s*(?:"(?:[^"\\]|\\.)*"|'[^']*'|[A-Za-z0-9_-]+))*)(\s*=\s*)(.*)$/);
    if (!pair) continue;
    if (joined([...table, ...keyParts(pair[2])]) !== path) continue;
    const rest = pair[4];
    let next;
    if (rest.startsWith("{")) {
      // A token table: replace only its value.
      const at = rest.match(/([{,]\s*value\s*=\s*)/);
      if (!at) throw new Error(`theme.toml: ${path} is a table without a value`);
      const start = at.index + at[1].length;
      next = rest.slice(0, start) + literal(value) + rest.slice(start + valueEnd(rest.slice(start)));
    } else next = literal(value) + rest.slice(valueEnd(rest));
    lines[i] = pair[1] + pair[2] + pair[3] + next;
    return verify(lines.join("\n"), path, value);
  }
  // A new key: under its deepest table, as one key (quoted when dotted, as theme.toml writes token paths).
  const rest = (table) => bare(path.slice(joined(table).length + 1));
  if (home) {
    lines.splice(home.at + 1, 0, `${rest(home.table)} = ${literal(value)}`);
    return verify(lines.join("\n"), path, value);
  }
  const parts = path.split(".");
  const head = parts.slice(0, parts[0] === "tokens" ? 1 : -1);
  return verify(`${text.replace(/\n*$/, "")}\n\n[${head.join(".")}]\n${rest(head)} = ${literal(value)}\n`, path, value);
};

const verify = (text, path, value) => {
  const got = lookup(Bun.TOML.parse(text), path);
  const actual = got && typeof got === "object" && !Array.isArray(got) ? got.value : got;
  if (JSON.stringify(actual) !== JSON.stringify(value)) throw new Error(`theme.toml: setting ${path} did not land`);
  return text;
};
