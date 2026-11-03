// What every CLI test shares: the repo root, the binary (KUMIKO_BIN, or the source under Bun), and run/read.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const root = resolve(import.meta.dir, "..");
export const command = process.env.KUMIKO_BIN ? [resolve(process.env.KUMIKO_BIN)] : ["bun", join(root, "bin/kumiko.mjs")];
export const run = (cwd: string, ...args: string[]) => Bun.spawnSync([...command, ...args], { cwd, stderr: "pipe" });
export const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");
