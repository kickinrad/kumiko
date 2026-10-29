// A kit's departures.toml: every difference from Material is a named record with a reason.
import { describe, expect, test } from "bun:test";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const command = process.env.TOKENS_BIN ? [resolve(process.env.TOKENS_BIN)] : ["bun", join(root, "bin/tokens.mjs")];
const run = (cwd: string, ...args: string[]) => Bun.spawnSync([...command, ...args], { cwd, stderr: "pipe" });
const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");
const dim = (value: number) => ({ $type: "dimension", $value: { value, unit: "px" } });
const shape = "md.comp.elevated-card.container-shape"; // an alias of md.sys.shape.corner.medium (12px) in Material
const heat = { colorSpace: "srgb", components: [0.81, 0.48, 0.13], hex: "#cf7b20" };

const card = `[[departure]]
id = "card-corner"
replaces = "${shape}"
value = { value = 28, unit = "px" }
why = "The house card shape."
`;
const domain = `[[addition]]
id = "domain-heat"
adds = "acme.domain.heat.color"
type = "color"
value = { colorSpace = "srgb", components = [0.81, 0.48, 0.13], hex = "#cf7b20" }
why = "Material has no domain colours."
`;

// A kit on the Material baseline. `project` is written to tokens/project.tokens.json, `toml` to design/departures.toml.
const kit = ({ project, toml, include = '"builtin:material"' }: { project?: unknown; toml?: string; include?: string } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-departures-"));
  mkdirSync(join(dir, "tokens"));
  mkdirSync(join(dir, "design"));
  writeFileSync(join(dir, "VERSION"), "1.0.0\n");
  writeFileSync(join(dir, "tokens.config.mjs"),
    `export default { targets: ["css"], include: [${include}], kit: { name: "acme" } };\n`);
  if (project) writeFileSync(join(dir, "tokens/project.tokens.json"), JSON.stringify(project));
  if (toml !== undefined) writeFileSync(join(dir, "design/departures.toml"), toml);
  return dir;
};
const overShape = (value: number) => ({ md: { comp: { "elevated-card": { "container-shape": dim(value) } } } });

describe("the records become tokens", () => {
  test("each becomes a token under its path, typed, with its why as the description", () => {
    const dir = kit({ toml: card + domain });
    const result = run(dir);
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
    const layer = JSON.parse(read(dir, "design/tokens/departures.tokens.json"));
    expect(layer.md.comp["elevated-card"]["container-shape"]).toEqual({
      $type: "dimension", $value: { value: 28, unit: "px" }, $description: "The house card shape.",
    });
    expect(layer.acme.domain.heat.color).toEqual({
      $type: "color", $value: heat, $description: "Material has no domain colours.",
    });
    const css = read(dir, "src/styles/tokens.css");
    expect(css).toContain("--md-comp-elevated-card-container-shape: 28px;");
    expect(css).toMatch(/--acme-domain-heat-color: #[0-9a-f]{6};/);
  });

  test("the layer sits above the baseline and below the project's own tokens", () => {
    const dir = kit({ toml: card, project: overShape(40) });
    expect(run(dir).exitCode).toBe(0);
    expect(read(dir, "src/styles/tokens.css")).toContain("--md-comp-elevated-card-container-shape: 40px;");
  });

  test("--check passes when current, and names the layer when it is stale", () => {
    const dir = kit({ toml: card });
    run(dir);
    expect(run(dir, "--check").exitCode).toBe(0);
    appendFileSync(join(dir, "design/tokens/departures.tokens.json"), " ");
    const stale = run(dir, "--check");
    expect(stale.exitCode).toBe(1);
    expect(stale.stderr.toString()).toContain("departures.tokens.json is stale");
  });

  test("the schema check covers the layer", () => {
    const dir = kit({ toml: domain.replace(/value = \{.*\}/, 'value = "#cf7b20"') });
    expect(run(dir).exitCode).toBe(0);
    const result = run(dir, "--check");
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("departures.tokens.json");
  });
});

describe("a difference from Material needs a record", () => {
  test("a project token that changes a baseline token, unrecorded, fails naming the path and both values", () => {
    const dir = kit({ project: overShape(28) });
    for (const args of [[], ["--check"]]) {
      const result = run(dir, ...args);
      expect(result.exitCode).toBe(1);
      const message = result.stderr.toString();
      expect(message).toContain(shape);
      expect(message).toContain('{"value":28,"unit":"px"}');
      expect(message).toContain('{"value":12,"unit":"px"}');
    }
  });

  test("adding the record makes it pass", () => {
    const dir = kit({ project: overShape(28), toml: card });
    expect(run(dir).exitCode).toBe(0);
    expect(run(dir, "--check").exitCode).toBe(0);
  });

  test("a changed token is named once; what aliases it follows without a record of its own", () => {
    const dir = kit({ project: { md: { sys: { shape: { corner: { medium: dim(20) } } } } } });
    const message = run(dir).stderr.toString();
    expect(message).toContain("md.sys.shape.corner.medium");
    expect(message).not.toContain("md.comp.filled-card.container-shape");
  });

  test("colour roles are the kit's palette: they differ without a record", () => {
    const dir = kit({ project: { md: { sys: { color: { primary: { $type: "color", $value: heat } } } } } });
    const result = run(dir);
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
    expect(run(dir, "--check").exitCode).toBe(0);
  });

  test("a kit with no departures.toml is still checked", () => {
    const dir = kit({ project: overShape(28), toml: undefined });
    expect(run(dir).stderr.toString()).toContain(shape);
  });

  test("with no builtin:material there is no baseline: nothing is compared, nothing is written", () => {
    const dir = kit({ project: overShape(28), toml: card, include: "" });
    expect(run(dir).exitCode).toBe(0);
    expect(() => read(dir, "design/tokens/departures.tokens.json")).toThrow();
  });
});

describe("a malformed record fails", () => {
  test("a replaces that is not in the baseline names the path and the id", () => {
    const result = run(kit({ toml: card.replace(shape, "md.comp.nope.container-shape") }));
    expect(result.exitCode).toBe(1);
    const message = result.stderr.toString();
    expect(message).toContain("card-corner");
    expect(message).toContain("md.comp.nope.container-shape");
  });

  test("an adds that is already in the baseline names the path and the id", () => {
    const result = run(kit({ toml: domain.replace("acme.domain.heat.color", shape) }));
    expect(result.exitCode).toBe(1);
    const message = result.stderr.toString();
    expect(message).toContain("domain-heat");
    expect(message).toContain(shape);
  });

  test("a record missing a field names its id and the field", () => {
    const result = run(kit({ toml: card.replace(/^why = .*\n/m, "") }));
    expect(result.exitCode).toBe(1);
    const message = result.stderr.toString();
    expect(message).toContain("card-corner");
    expect(message).toContain("why");
  });

  test("two records for one path fail, naming it", () => {
    const result = run(kit({ toml: `${card}\n${card.replace("card-corner", "again")}` }));
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(shape);
  });

  test("a failing build writes nothing", () => {
    const dir = kit({ project: overShape(28) });
    run(dir);
    expect(() => read(dir, "src/styles/tokens.css")).toThrow();
    expect(() => read(dir, "design/tokens/departures.tokens.json")).toThrow();
  });
});

test("with no kit, the golden outputs stay byte-identical", () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-departures-golden-"));
  cpSync(join(root, "tests/fixture"), dir, { recursive: true });
  expect(run(dir).exitCode).toBe(0);
  for (const file of ["src/styles/tokens.css", "theme.json", "DESIGN.md"]) {
    expect(read(dir, file)).toBe(readFileSync(join(root, "tests/expected", file), "utf8"));
  }
  rmSync(dir, { recursive: true });
});
