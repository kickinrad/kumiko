// Drift guard: flag a value a consumer hand-typed that the theme defines. Text scanning, line by line.
import { readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { hasHeader } from "./header.mjs";

const EXTENSIONS = new Set([".css", ".scss", ".yaml", ".yml", ".py", ".js", ".mjs", ".ts", ".jinja", ".html", ".kt", ".kts"]);
const OWN = /lint: own\s+[^\s*/>-]/; // a reason, not just a comment closer
const NUM = String.raw`(?<![\w.])\d*\.?\d+`;
// Each rule: [name, pattern]. A match whose number is zero is not a finding.
const RULES = [
  ["colour", /(?<!\w)#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z])/g], // not repo#123
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

// A file, or every file under a directory with a linted extension, skipping hidden folders and node_modules.
const files = (path) => {
  let stat;
  try { stat = statSync(path); } catch { throw new Error(`${path}: no such file or directory`); }
  if (!stat.isFile()) return [...new Bun.Glob("**/*").scanSync({ cwd: path })].sort()
    .filter((file) => EXTENSIONS.has(extname(file)) && !file.split("/").includes("node_modules")).map((file) => join(path, file));
  return EXTENSIONS.has(extname(path)) ? [path] : [];
};

// Returns one "path:line: rule: text" string per finding; throws on a missing path.
export const lint = (paths) => {
  const found = [];
  for (const file of paths.flatMap(files)) {
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
