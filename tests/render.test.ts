// The playground as a browser draws it: every destination and item, in each mode, at a desktop and a phone size,
// passes the rendered audit (tests/render/audit.js), under a host's reset as a page that embeds or publishes it
// would add (plain rules, so they outrank Beer's layer). The kit is tests/playground/ with tests/render/theme.toml, a
// complete theme, so a failure is the page's, not the kit's. Needs Chromium
// (bunx playwright install chromium) and the network for the faces.
import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { root, run } from "./helpers";

const HOST_RESET = ":root { color-scheme: light; } body { margin: 0; font: 14px system-ui, sans-serif; color: CanvasText; background: Canvas; }";

const kit = () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-render-"));
  for (const entry of ["design", "tokens", "VERSION", "tokens.config.mjs"]) cpSync(join(root, "tests/playground", entry), join(dir, entry), { recursive: true });
  cpSync(join(root, "tests/render/theme.toml"), join(dir, "design/theme.toml"));
  const result = run(dir);
  expect(result.stderr.toString()).toBe("");
  return dir;
};

test("every destination and item passes the rendered audit, in both modes, on a desktop and a phone", async () => {
  const dir = kit();
  const server = Bun.serve({ port: 0, fetch: async (request) => {
    const file = Bun.file(join(dir, "docs/play", new URL(request.url).pathname.replace(/\/$/, "/index.html")));
    return await file.exists() ? new Response(file) : new Response("missing", { status: 404 });
  } });
  const audit = readFileSync(join(root, "tests/render/audit.js"), "utf8").replace("export const audit", "window.audit");
  const browser = await chromium.launch();
  const failures: string[] = [];
  try {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 412, height: 915 }]) {
      const page = await browser.newPage({ viewport });
      page.on("pageerror", (error) => failures.push(`${viewport.width}px: page error ${error.message}`));
      page.on("requestfailed", (request) => failures.push(`${viewport.width}px: ${request.url()} failed`));
      page.on("response", (response) => { if (response.status() >= 400) failures.push(`${viewport.width}px: ${response.url()} ${response.status()}`); });
      await page.addInitScript((css) => addEventListener("DOMContentLoaded", () => document.head.prepend(Object.assign(document.createElement("style"), { textContent: css }))), HOST_RESET);
      await page.goto(`http://localhost:${server.port}/`);
      await page.waitForSelector("main .panes");
      await page.addScriptTag({ content: audit });
      failures.push(...await page.evaluate(async () => {
        const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
        const data = await (await fetch("tokens.json")).json();
        const faces = [...new Set(Object.values(data.modes).flat().filter((token: any) => token.type === "fontFamily" && /^md\.sys\.typescale\.|\.typeface\.mono$/.test(token.path)).map((token: any) => token.value.split(",")[0].trim().replace(/^["']|["']$/g, "")))];
        const out: string[] = [];
        for (const mode of Object.keys(data.modes)) {
          for (const tab of [...document.querySelectorAll("nav.bottom a, nav.left a")].map((a) => a.getAttribute("href")).filter((href, i, all) => all.indexOf(href) === i)) {
            location.hash = tab!.slice(1);
            await wait(150);
            const items = [...document.querySelectorAll(".list a")].map((a) => a.getAttribute("href"));
            for (const href of items.length ? items : [tab]) {
              location.hash = href!.slice(1);
              await wait(150);
              await document.fonts.ready;
              for (const failure of (window as any).audit(document, { faces })) out.push(`${innerWidth}px ${mode} ${href}: ${failure}`);
            }
          }
          (document.querySelector("[data-mode]") as HTMLElement).click();
          await wait(150);
        }
        return out;
      }));
      await page.close();
    }
  } finally {
    await browser.close();
    server.stop();
  }
  expect(failures).toEqual([]);
}, 120_000);
