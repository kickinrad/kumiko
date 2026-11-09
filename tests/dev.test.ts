// kumiko dev: an edit is built in memory and sent live; only its own pages may edit or save; save writes exactly the
// edited values into theme.toml, and the outputs pass --check after (tests/playground/ is the kit).
import { afterAll, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { command, root, run } from "./helpers";

const dir = mkdtempSync(join(tmpdir(), "kumiko-dev-"));
for (const entry of ["design", "tokens", "VERSION", "kumiko.config.mjs"]) cpSync(join(root, "tests/playground", entry), join(dir, entry), { recursive: true });
const port = 4800 + Math.floor(Math.random() * 1000);
const server = Bun.spawn([...command, "dev", "--port", String(port)], { cwd: dir, stdout: "pipe", stderr: "pipe" });
afterAll(() => server.kill());
const origin = `http://localhost:${port}`;
const ready = (async () => { for (const _ of Array(100)) { try { if ((await fetch(`${origin}/_kumiko/live`)).ok) return; } catch {} await Bun.sleep(100); } throw new Error("kumiko dev did not start"); })();
const post = (path: string, body: object, from = origin) => fetch(`${origin}${path}`, { method: "POST", headers: { Origin: from, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const live = async () => (await fetch(`${origin}/_kumiko/live`)).json();
const theme = readFileSync(join(dir, "design/theme.toml"), "utf8");

test("an edit reaches the live CSS and the kit's tokens without touching theme.toml", async () => {
  await ready;
  expect((await live()).css).toContain("--acme-palette-blue: light-dark(#2e7de9, #7aa2f7);");
  expect((await post("/_kumiko/edit", { "palette.night.blue": "#ff0000" })).status).toBe(200);
  const now = await live();
  expect(now.css).toContain("--acme-palette-blue: light-dark(#2e7de9, #ff0000);");
  expect(now.css).toContain("--md-sys-color-primary: light-dark(#2e7de9, #ff0000);");
  expect(now.kit.modes.night.find((token: { path: string }) => token.path === "md.sys.color.primary").value).toBe("#ff0000");
  expect(readFileSync(join(dir, "design/theme.toml"), "utf8")).toBe(theme);
  expect(await (await fetch(`${origin}/_kumiko/bridge.js`)).text()).toContain("kumiko:live");
});

test("a page elsewhere cannot edit or save", async () => {
  await ready;
  expect((await post("/_kumiko/edit", { "palette.night.blue": "#00ff00" }, "https://example.com")).status).toBe(403);
  expect((await post("/_kumiko/save", {}, "https://example.com")).status).toBe(403);
});

test("save writes exactly the edited values, and --check passes after", async () => {
  await ready;
  await post("/_kumiko/edit", { "faces.brand": ["Archivo", "serif"] });
  expect((await post("/_kumiko/save", {})).status).toBe(200);
  const saved = readFileSync(join(dir, "design/theme.toml"), "utf8").split("\n");
  const changed = saved.filter((line, i) => line !== theme.split("\n")[i]);
  expect(changed).toEqual(['blue = "#ff0000"', 'brand = ["Archivo", "serif"]']);
  expect(run(dir, "--check").exitCode).toBe(0);
});

test("the panel page carries the kit's draft CSS and the panel's client", async () => {
  await ready;
  const page = await (await fetch(`${origin}/_kumiko/panel`)).text();
  expect(page).toContain('<style id="kit-css">');
  expect(page).toContain("--acme-palette-ink");
  expect(page).toContain("data-tune-panel");
});

test("the event stream stays open past Bun's idle timeout", async () => {
  await ready;
  const reader = (await fetch(`${origin}/_kumiko/events`)).body!.getReader();
  await reader.read();
  const next = reader.read();
  await Bun.sleep(13_000);
  expect(await Promise.race([next.then(({ done }) => (done ? "closed" : "data")), Bun.sleep(10).then(() => "open")])).toBe("open");
  await reader.cancel();
}, 20_000);
