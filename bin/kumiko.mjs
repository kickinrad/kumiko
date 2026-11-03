#!/usr/bin/env bun
// Build tokens/*.tokens.json into the targets named in ./kumiko.config.mjs.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "../src/build.mjs";

// kumiko [--check] | kumiko lint <file>… | kumiko audit [<dir>]: anything else is a mistake, so nothing is built.
const [verb, ...rest] = process.argv.slice(2);
const unknown = verb === "lint" || verb === "audit" ? undefined : [verb, ...rest].find((arg) => arg !== undefined && arg !== "--check");
if (unknown !== undefined) {
  console.error(`kumiko: unknown ${unknown} (kumiko [--check], kumiko lint <file>…, kumiko audit [<dir>])`);
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
try {
  await build(config, { check: process.argv.includes("--check") });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
