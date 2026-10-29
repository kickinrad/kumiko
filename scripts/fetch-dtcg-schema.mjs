// Re-fetch the vendored DTCG 2025.10 format schema: node scripts/fetch-dtcg-schema.mjs
// The one URL is a bundle: every sibling schema (token, values/*, group, ...) rides inside it under "definitions" by $id.
import { writeFile } from "node:fs/promises";

const url = "https://www.designtokens.org/schemas/2025.10/format.json";
const dir = new URL("../src/schema/2025.10/", import.meta.url);

const response = await fetch(url);
if (!response.ok) throw new Error(`${url}: ${response.status}`);
const schema = await response.json();
if (schema.$id !== url) throw new Error(`${url} has $id ${schema.$id}`);

await writeFile(new URL("format.json", dir), `${JSON.stringify(schema, null, 2)}\n`);
await writeFile(new URL(".source", dir),
  `${url}\nfetched ${new Date().toISOString().slice(0, 10)} by scripts/fetch-dtcg-schema.mjs\n` +
  "A bundle: the sibling schemas (token, values/*, group, ...) are embedded in it under definitions, keyed by their $id.\n");
console.log(`wrote ${new URL("format.json", dir).pathname}`);
