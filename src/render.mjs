// `tokens audit`: the playground as a browser draws it. Opens the generated playground from disk in headless Chrome
// (over the DevTools protocol, so the engine needs no browser library) at a desktop and a phone size, under a host's
// reset as a page that embeds or publishes it would add, and runs src/audit.js on every destination and item in
// every mode. Returns one line per failure: the audit's, a page error, or a request that failed.
import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import auditSource from "./audit.js" with { type: "text" };

// Plain rules, so they outrank Beer's cascade layer, as a host's would.
const HOST_RESET = ":root { color-scheme: light; } body { margin: 0; font: 14px system-ui, sans-serif; color: CanvasText; background: Canvas; }";
const VIEWPORTS = [{ width: 1280, height: 800, mobile: false }, { width: 412, height: 915, mobile: true }];

// Chrome: $CHROME, else one on the PATH, else Playwright's download.
const chrome = () => {
  const found = [process.env.CHROME, ...["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"].map((name) => Bun.which(name))].find(Boolean);
  if (found) return found;
  const cache = join(homedir(), ".cache/ms-playwright");
  const [downloaded] = [...new Bun.Glob("chromium-*/chrome-linux*/chrome").scanSync({ cwd: cache, absolute: true, onlyFiles: true })].sort().reverse();
  if (downloaded) return downloaded;
  throw new Error("tokens audit needs Chrome: set CHROME, or put google-chrome or chromium on the PATH");
};

// One DevTools connection: send(method, params, session) and every event to `on`.
const connect = async (url) => {
  const socket = new WebSocket(url);
  await new Promise((open, fail) => { socket.onopen = open; socket.onerror = () => fail(new Error(`tokens audit: cannot reach Chrome at ${url}`)); });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (!pending.has(message.id)) return listeners.forEach((listen) => listen(message));
    const [done, fail] = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) fail(new Error(`${message.error.message}`)); else done(message.result);
  };
  const send = (method, params = {}, sessionId) => new Promise((done, fail) => {
    pending.set(++id, [done, fail]);
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  return { send, on: (listen) => listeners.push(listen), close: () => socket.close() };
};

// In the page (handed over as its source): each mode, each destination, each item (or the destination alone),
// audited with the kit's faces.
const walk = async () => {
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const data = JSON.parse(document.getElementById("kit").textContent);
  const faces = [...new Set(Object.values(data.modes).flat().filter((token) => token.type === "fontFamily" && /^md\.sys\.typescale\.|\.typeface\.mono$/.test(token.path)).map((token) => token.value.split(",")[0].trim().replace(/^["']|["']$/g, "")))];
  const names = Object.keys(data.modes);
  // The page opens in the mode the browser prefers; the switch names the next one.
  const current = () => names[(names.indexOf(document.querySelector("[data-mode]").dataset.mode) + names.length - 1) % names.length];
  const out = [];
  for (const _ of names) {
    const mode = current();
    const tabs = [...new Set([...document.querySelectorAll("nav.bottom a, nav.left a")].map((a) => a.getAttribute("href")))];
    for (const tab of tabs) {
      location.hash = tab.slice(1);
      await wait(150);
      const items = [...document.querySelectorAll(".list a")].map((a) => a.getAttribute("href"));
      for (const href of items.length ? items : [tab]) {
        location.hash = href.slice(1);
        await wait(150);
        // A face loads when text first uses it; ask for each, so a slow one is waited for and a missing one fails.
        await Promise.all(faces.map((face) => document.fonts.load(`16px "${face}"`)));
        for (const failure of window.__audit(document, { faces })) out.push(`${mode} ${href}: ${failure}`);
      }
    }
    document.querySelector("[data-mode]").click();
    await wait(150);
  }
  return out;
};

export const audit = async (dir) => {
  if (!(await Bun.file(join(dir, "index.html")).exists())) throw new Error(`tokens audit: no playground at ${dir} (run tokens first)`);
  const profile = mkdtempSync(join(tmpdir(), "tokens-audit-"));
  const browser = Bun.spawn([chrome(), "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stderr: "pipe", stdout: "ignore" });
  const failures = [];
  try {
    let text = "";
    const reader = browser.stderr.getReader();
    while (!/DevTools listening on (ws:\S+)/.test(text)) {
      const { value, done } = await reader.read();
      if (done) throw new Error(`tokens audit: Chrome did not start\n${text}`);
      text += new TextDecoder().decode(value);
    }
    const devtools = await connect(text.match(/DevTools listening on (ws:\S+)/)[1]);
    const page = pathToFileURL(join(dir, "index.html")).href;
    // The apps' entries and other kits are optional and fetched by location; one that is not there is left out.
    const data = await Bun.file(join(dir, "tokens.json")).json();
    const optional = new Set([...(data.examples ?? []), ...(data.kits ?? [])].map((each) => new URL(each, page).href));
    const requested = new Map();
    for (const viewport of VIEWPORTS) {
      const at = `${viewport.width}px`;
      const { targetId } = await devtools.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await devtools.send("Target.attachToTarget", { targetId, flatten: true });
      const send = (method, params) => devtools.send(method, params, sessionId);
      let loaded;
      const load = new Promise((done) => { loaded = done; });
      devtools.on((message) => {
        if (message.sessionId !== sessionId) return;
        const { method, params } = message;
        if (method === "Page.loadEventFired") loaded();
        if (method === "Runtime.exceptionThrown") failures.push(`${at}: page error ${params.exceptionDetails.exception?.description ?? params.exceptionDetails.text}`);
        if (method === "Network.requestWillBeSent") requested.set(params.requestId, params.request.url);
        if (method === "Network.responseReceived" && params.response.status >= 400 && !optional.has(params.response.url)) failures.push(`${at}: ${params.response.url} answered ${params.response.status}`);
        if (method === "Network.loadingFailed" && !params.canceled && !optional.has(requested.get(params.requestId))) failures.push(`${at}: ${requested.get(params.requestId) ?? "a request"} failed (${params.errorText})`);
      });
      for (const domain of ["Page", "Runtime", "Network"]) await send(`${domain}.enable`);
      await send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile });
      await send("Page.addScriptToEvaluateOnNewDocument", { source: `addEventListener("DOMContentLoaded", () => document.head.prepend(Object.assign(document.createElement("style"), { textContent: ${JSON.stringify(HOST_RESET)} })));\n${auditSource.replace("export const audit", "window.__audit")}` });
      await send("Page.navigate", { url: page });
      await load;
      const { result, exceptionDetails } = await send("Runtime.evaluate", { expression: `(${walk})()`, awaitPromise: true, returnByValue: true });
      if (exceptionDetails) failures.push(`${at}: the audit could not run (${exceptionDetails.exception?.description ?? exceptionDetails.text})`);
      else failures.push(...result.value.map((line) => `${at} ${line}`));
      await devtools.send("Target.closeTarget", { targetId });
    }
    devtools.close();
  } finally {
    browser.kill();
    await browser.exited;
    rmSync(profile, { recursive: true, force: true });
  }
  return [...new Set(failures)];
};
