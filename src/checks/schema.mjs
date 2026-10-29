// Validate a kit's token sources against the official DTCG 2025.10 format schema (vendored under ../schema/2025.10).
import { glob, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import Ajv from "ajv";
import schema from "../schema/2025.10/format.json" with { type: "json" };

const tokenTypes = new Set(schema.definitions["https://www.designtokens.org/schemas/2025.10/format/tokenType.json"].enum);
// "format" keywords (uri-reference, json-pointer-uri-fragment) are annotations here: the reference patterns already check them.
const validate = new Ajv({ allErrors: true, strict: false, validateFormats: false }).compile(schema);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// The official schema checks a value against a token's own $type only, but DTCG lets a group hand its $type down.
// Validate a copy where every token carries the type it inherits, so a hex string under a colour group fails too.
const inherit = (node, inherited) => {
  if (!isObject(node)) return node;
  const own = tokenTypes.has(node.$type) ? node.$type : inherited;
  const copy = {};
  for (const [key, child] of Object.entries(node)) copy[key] = key.startsWith("$") && key !== "$root" ? child : inherit(child, own);
  if ("$value" in node && node.$type === undefined && own !== undefined) copy.$type = own;
  return copy;
};

const dotted = (instancePath) => {
  const parts = instancePath.split("/").slice(1).map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  return ["$", ...parts].join(".");
};

// The oneOf/if wrappers fire on every parent of a bad value; the deepest errors say what is wrong.
const describe = (errors) => {
  const leaves = errors.filter((error) => !["oneOf", "if", "anyOf"].includes(error.keyword));
  const paths = new Set(leaves.map((error) => error.instancePath));
  const deepest = leaves.filter((error) =>
    ![...paths].some((path) => path.startsWith(`${error.instancePath}/`)));
  const lines = deepest.map((error) => {
    const extra = error.params?.additionalProperty ? ` (${error.params.additionalProperty})` : "";
    return `${dotted(error.instancePath)} ${error.message}${extra}`;
  });
  return [...new Set(lines)];
};

// files: paths read as-is; include: globs for the silent base layer. Throws one Error listing every problem, file first.
export const checkSchema = async ({ files = [], include = [] } = {}) => {
  const found = new Set(files.map((file) => resolve(file)));
  for (const pattern of include) for await (const file of glob(pattern)) found.add(resolve(file));
  const problems = [];
  for (const file of [...found].sort()) {
    const name = relative(process.cwd(), file);
    let document;
    try { document = JSON.parse(await readFile(file, "utf8")); }
    catch (error) { problems.push(`${name}: not readable JSON (${error.message})`); continue; }
    if (!validate(inherit(document))) {
      for (const line of describe(validate.errors)) problems.push(`${name}: ${line}`);
    }
  }
  if (problems.length) throw new Error(`Kit tokens do not match the DTCG 2025.10 schema:\n${problems.join("\n")}`);
};
