#!/usr/bin/env bun
// Build tokens/*.tokens.json into the targets named in ./kumiko.config.mjs.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "../src/build.mjs";

// kumiko [--check] | kumiko lint <file>… | kumiko audit [<dir>] | kumiko dev [--port <n>]: anything else is a
// mistake, so nothing is built.
const [verb, ...rest] = process.argv.slice(2);
const port = verb === "dev" && rest[0] === "--port" && /^\d+$/.test(rest[1] ?? "") ? Number(rest[1]) : undefined;
const unknown = verb === "lint" || verb === "audit" ? undefined
  : verb === "dev" ? (port ? rest.slice(2) : rest)[0]
  : [verb, ...rest].find((arg) => arg !== undefined && arg !== "--check");
if (unknown !== undefined) {
  console.error(`kumiko: unknown ${unknown} (kumiko [--check], kumiko lint <file>…, kumiko audit [<dir>], kumiko dev [--port <n>])`);
  process.exit(1);
}

if (process.argv[2] === "lint") {
  const { lint } = await import("../src/lint.mjs");
  try {
    const findings = lint(process.argv.slice(3));
    if (findings.length) console.log(findings.join("\n"));
    process.exit(findings.length ? 1 : 0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

const configPath = resolve("kumiko.config.mjs");
const loadConfig = async () => (await import(pathToFileURL(configPath).href)).default ?? {};

// kumiko audit [<dir>]: the playground (the config's playground path by default) in headless Chrome.
if (process.argv[2] === "audit") {
  const { audit } = await import("../src/render.mjs");
  try {
    const dir = process.argv[3] ?? (await Bun.file(configPath).exists() ? (await loadConfig()).playground?.path : undefined);
    if (!dir) throw new Error("kumiko audit: name the playground's directory, or run it where kumiko.config.mjs has a playground output");
    const failures = await audit(resolve(dir));
    if (failures.length) console.log(failures.join("\n"));
    process.exit(failures.length ? 1 : 0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (!(await Bun.file(configPath).exists())) {
  console.error("No kumiko.config.mjs in this directory");
  process.exit(1);
}
const config = await loadConfig();
if (verb === "dev") {
  const { dev } = await import("../src/dev.mjs");
  try {
    const server = await dev({ config, port });
    console.log(`kumiko dev: http://localhost:${server.port}/ (the bridge is http://localhost:${server.port}/_kumiko/bridge.js)`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
} else try {
  await build(config, { check: process.argv.includes("--check") });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
