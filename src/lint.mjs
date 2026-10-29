// Drift guard: flag a value a consumer hand-typed that the theme defines. Text scanning, line by line.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { hasHeader } from "./header.mjs";

const EXTENSIONS = new Set([".css", ".scss", ".yaml", ".yml", ".py", ".js", ".mjs", ".ts", ".jinja", ".html", ".kt", ".kts"]);
const OWN = /lint: own\s+[^\s*/>-]/; // a reason, not just a comment closer
const NUM = String.raw`(?<![\w.])\d*\.?\d+`;
// Each rule: [name, pattern]. A match whose number is zero is not a finding.
const RULES = [
  ["colour", /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?(?![0-9a-zA-Z])/g],
  ["colour", /\b(?:rgba?|hsla?)\(\s*\d/g],
  ["colour", /\bColor\(\s*0x[0-9a-fA-F]+/g],
  ["motion", new RegExp(String.raw`(?<=\b(?:transition|animation)[\w-]*\s*:[^;}]*?)${NUM}m?s\b`, "g")],
  ["motion", /cubic-bezier\(/g],
  ["motion", /(?<=\btween\(\s*)\d+/g],
  ["type size", new RegExp(String.raw`(?<=font-size\s*:\s*)${NUM}px\b`, "g")],
  ["type size", /(?<![\w.])\d+(?:\.\d+)?\.sp\b/g],
  ["radius", new RegExp(String.raw`(?<=border-radius\s*:[^;}]*?)${NUM}px\b`, "g")],
  ["radius", /(?<=RoundedCornerShape\(\s*)\d+(?:\.\d+)?\.dp\b/g],
];

const files = (path, out) => {
  let stat;
  try { stat = statSync(path); } catch { throw new Error(`${path}: no such file or directory`); }
  if (!stat.isDirectory()) { if (EXTENSIONS.has(extname(path))) out.push(path); return out; }
  for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory() ? entry.name === "node_modules" || entry.name.startsWith(".") : false) continue;
    files(join(path, entry.name), out);
  }
  return out;
};

// Returns one "path:line: rule: text" string per finding; throws on a missing path.
export const lint = (paths) => {
  const found = [];
  for (const file of paths.flatMap((path) => files(path, []))) {
    const text = readFileSync(file, "utf8");
    if (hasHeader(text)) continue;
    text.split("\n").forEach((line, index) => {
      if (OWN.test(line)) return;
      for (const [rule, pattern] of RULES) {
        for (const [match] of line.matchAll(pattern)) {
          if (parseFloat(match) !== 0) found.push(`${file}:${index + 1}: ${rule}: ${match}`);
        }
      }
    });
  }
  return found;
};
