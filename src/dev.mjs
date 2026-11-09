// kumiko dev: serves the project on localhost (/ opens the playground, when the config has one), builds every edit in
// memory as the engine builds it, and pushes the result live to every page that loads the bridge
// (/_kumiko/bridge.js) or listens to /_kumiko/events. Save writes the edits into theme.toml and rebuilds; a change to
// the kit's sources on disk rebuilds every output and sends "reload".
import { watch } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { build } from "./build.mjs";
import { contrastPairs } from "./checks/contrast.mjs";
import { setValue } from "./toml-edit.mjs";
import { fontLinks } from "./web/foundations.js";

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
// Pages elsewhere (a WordPress copy, a Storybook) read the live CSS and its events.
const OPEN = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

// The bridge a consuming page loads in development only: it applies the kit's live CSS and faces, reads only from the
// server that served it, and announces each update as a "kumiko:live" event (detail: the kit's tokens per mode) for
// code that reads tokens in JavaScript.
const bridge = `// kumiko's live bridge: the kit's CSS from kumiko dev, updated on every edit. Load it in development only.
(() => {
  const origin = new URL(document.currentScript.src).origin;
  const style = Object.assign(document.createElement("style"), { id: "kumiko-live" });
  document.head.append(style);
  const apply = ({ css, fonts, kit }) => {
    style.textContent = css;
    window.dispatchEvent(new CustomEvent("kumiko:live", { detail: kit }));
    for (const href of fonts) if (!document.querySelector('link[href="' + CSS.escape(href) + '"]')) document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href }));
  };
  fetch(origin + "/_kumiko/live").then((response) => response.json()).then(apply);
  new EventSource(origin + "/_kumiko/events").addEventListener("live", (event) => apply(JSON.parse(event.data)));
})();
`;

export const dev = async ({ config, port = 4400 }) => {
  const root = resolve(".");
  const kitRoot = resolve(config.kit?.root ?? "design");
  const themeFile = join(kitRoot, "theme.toml");
  const cssPath = config.css?.path;
  if (!config.kit || !cssPath) throw new Error("kumiko dev needs a kit and a css output");
  const output = (outputs, path) => outputs.find((each) => resolve(each.path) === resolve(path))?.content;

  let edits = {};
  let live;
  const clients = new Set();
  const send = (event, data) => { for (const client of clients) client.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };

  // The saved theme with the edits applied, built in memory: the css output and its faces, the kit as a panel reads it
  // (each mode's tokens, what theme.toml sets that a person tunes, the pairs it is held to), and the pairs that fall
  // under their floors.
  const draft = async () => Object.entries(edits).reduce((text, [path, value]) => setValue(text, path, value), await readFile(themeFile, "utf8"));
  const preview = async () => {
    const text = await draft();
    const { outputs, contrast, theme, modes } = await build(config, { preview: true, theme: text });
    const kit = {
      name: theme.name,
      modes: Object.fromEntries(Object.entries(modes).map(([mode, tokens]) => [mode, tokens.map(({ path, value, type }) => ({ path, value, type }))])),
      tune: { faces: theme.faces, tokens: theme.values.filter(([, each]) => ["dimension", "duration"].includes(each.$type) && !String(each.$value).startsWith("{")).map(([path]) => path) },
      pairs: theme.contrast ? contrastPairs(theme, Object.values(modes)[0]) : undefined,
    };
    live = { css: output(outputs, cssPath), fonts: [...new Set(Object.values(modes).flatMap(fontLinks))], kit, contrast, edits };
    send("live", live);
    return { text, contrast };
  };
  // Writes every output from the files on disk.
  const rebuild = async () => { await build(config); edits = {}; await preview(); };

  await rebuild();
  // A change on disk (the kit's folder, tokens/) rebuilds and tells every listener to reload.
  let pending;
  const changed = () => {
    clearTimeout(pending);
    pending = setTimeout(() => rebuild().then(() => send("reload", {}), (error) => send("problem", { message: error.message })), 100);
  };
  for (const dir of [kitRoot, resolve("tokens")]) try { watch(dir, changed); } catch {}

  const json = (body, status = 200) => Response.json(body, { status, headers: OPEN });
  // A write from this page only: the browser sends Origin on a cross-site POST, and a JSON body needs a preflight
  // this server never grants, so no other site can edit or save.
  const ours = (request) => request.headers.get("origin") === new URL(request.url).origin && request.headers.get("content-type") === "application/json";

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/" && config.playground?.path) return Response.redirect(`/${config.playground.path.replace(/^\.?\//, "")}/index.html`, 302);
      if (url.pathname === "/_kumiko/bridge.js") return new Response(bridge, { headers: { ...OPEN, "Content-Type": "text/javascript" } });
      if (url.pathname === "/_kumiko/live") return json(live);
      if (url.pathname === "/_kumiko/events") {
        let client;
        return new Response(new ReadableStream({
          start(controller) { client = controller; clients.add(client); controller.enqueue(": kumiko\n\n"); },
          cancel() { clients.delete(client); },
        }), { headers: { ...OPEN, "Content-Type": "text/event-stream" } });
      }
      if (url.pathname === "/_kumiko/edit" && request.method === "POST") {
        if (!ours(request)) return json({ error: "Edits come from a page this server serves" }, 403);
        const before = edits;
        try {
          // { path: value } for every value the page has changed; a value of null drops that edit.
          edits = Object.fromEntries(Object.entries({ ...edits, ...(await request.json()) }).filter(([, value]) => value !== null));
          return json({ contrast: (await preview()).contrast });
        } catch (error) {
          edits = before;
          return json({ error: error.message }, 400);
        }
      }
      if (url.pathname === "/_kumiko/save" && request.method === "POST") {
        if (!ours(request)) return json({ error: "Saves come from a page this server serves" }, 403);
        try {
          const { text, contrast } = await preview();
          if (contrast.length) return json({ error: `Not saved: ${contrast.length} pair${contrast.length === 1 ? " is" : "s are"} under its floor`, contrast }, 409);
          const saved = Object.keys(edits);
          await writeFile(themeFile, text);
          await rebuild();
          return json({ saved });
        } catch (error) {
          return json({ error: error.message }, 400);
        }
      }
      // The project's own files, nothing outside it.
      const file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (!file.startsWith(root + sep)) return new Response("Not found", { status: 404 });
      const body = Bun.file(file);
      if (!(await body.exists())) return new Response("Not found", { status: 404 });
      return new Response(body, { headers: { "Content-Type": TYPES[extname(file)] ?? body.type, "Cache-Control": "no-store" } });
    },
  });
  return server;
};
