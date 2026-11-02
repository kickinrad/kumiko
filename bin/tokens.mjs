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
if (!(await Bun.file(configPath).exists())) {
  console.error("No tokens.config.mjs in this directory");
  process.exit(1);
}
const config = (await import(pathToFileURL(configPath).href)).default ?? {};
try {
  await build(config, { check: process.argv.includes("--check") });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
