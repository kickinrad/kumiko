#!/usr/bin/env node
// Build tokens/*.tokens.json into the targets named in ./tokens.config.mjs.
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "../src/build.mjs";

const configPath = resolve("tokens.config.mjs");
let config = {};
try {
  await access(configPath);
  config = (await import(pathToFileURL(configPath).href)).default ?? {};
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
try {
  await build(config, { check: process.argv.includes("--check") });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
