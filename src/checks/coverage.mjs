// With a kit declared: every output states its coverage, and the check lists who reads the kit.
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

const text = (value) => typeof value === "string" && value !== "";

export const assertCoverage = (targets) => {
  for (const { name, coverage } of targets) {
    const ok = coverage && text(coverage.native) && Array.isArray(coverage.skips) && coverage.skips.every(text) &&
      Array.isArray(coverage.emits) && coverage.emits.every((emit) => text(emit?.what) && text(emit?.why));
    if (!ok) throw new Error(`Target ${name} must export coverage: { native, emits: [{ what, why }], skips: [] }`);
  }
};

// The outputs' own consumers plus the kit's, per target name; never mutates the shared modules.
export const withConsumers = (targets, kitConsumers = {}) => {
  const names = new Set(targets.map((target) => target.name));
  for (const name of Object.keys(kitConsumers)) {
    if (!names.has(name)) throw new Error(`kit.consumers names ${name}, which is not a target`);
  }
  return targets.map((target) => {
    const consumers = [...(target.consumers ?? []), ...(kitConsumers[target.name] ?? [])];
    for (const consumer of consumers) {
      if (!text(consumer?.name) || !text(consumer.file) || !text(consumer.tag)) {
        throw new Error(`A consumer of ${target.name} needs name, file and tag`);
      }
    }
    return { ...target, consumers };
  });
};

const core = (version) => version.split(/[-+]/)[0].split(".").map(Number);
const isBehind = (read, kit) => {
  const [a, b] = [core(read), core(kit)];
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return read.includes("-") && !kit.includes("-");
};

const path = (file) => resolve(file === "~" || file.startsWith("~/") ? homedir() + file.slice(1) : file);

const readVersion = async ({ file, tag }) => {
  try { return new RegExp(tag).exec(await readFile(path(file), "utf8"))?.[1]; }
  catch { return undefined; }
};

// Lines for the check; informational, it never throws on a consumer.
export const consumerReport = async (targets, version) => {
  const lines = [];
  for (const target of targets) {
    for (const consumer of target.consumers) {
      const read = await readVersion(consumer);
      const state = read === undefined ? "unreadable" : `reads ${read}${isBehind(read, version) ? " (behind)" : ""}`;
      lines.push(`${consumer.name} (${target.name}): ${state}, kit ${version}`);
      if (consumer.overrides) lines.push(`  override: ${consumer.overrides}`);
    }
  }
  return lines;
};
