#!/usr/bin/env bun
// Build tokens/*.tokens.json into the targets named in ./tokens.config.mjs.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "../src/build.mjs";

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

const configPath = resolve("tokens.config.mjs");
const loadConfig = async () => (await import(pathToFileURL(configPath).href)).default ?? {};

// tokens audit [<dir>]: the playground (the config's playground path by default) in headless Chrome.
if (process.argv[2] === "audit") {
  const { audit } = await import("../src/render.mjs");
  try {
    const dir = process.argv[3] ?? (await Bun.file(configPath).exists() ? (await loadConfig()).playground?.path : undefined);
    if (!dir) throw new Error("tokens audit: name the playground's directory, or run it where tokens.config.mjs has a playground output");
    const failures = await audit(resolve(dir));
    if (failures.length) console.log(failures.join("\n"));
    process.exit(failures.length ? 1 : 0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (!(await Bun.file(configPath).exists())) {
  console.error("No tokens.config.mjs in this directory");
  process.exit(1);
}
const config = await loadConfig();
try {
  await build(config, { check: process.argv.includes("--check") });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
