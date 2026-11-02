// Template output: a kit's own files for apps the engine has no output for (terminal and editor themes, say). Every
// file under options.from is written to the same path under options.to, each {{<mode>.<colour>}} slot the theme's
// palette colour in that mode (#rrggbb, so an alpha can follow it), {{name}} the kit's name; every other byte stays
// as the template has it. Options: from, to (directories).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { need, needKit } from '../system.mjs';

const SLOT = /\{\{\s*([\w.-]+)\s*\}\}/g;

export default {
  name: 'template',
  async build({ tokens, media, mediaTokens, options, name, version, modes = { base: 'base', media: {} } }) {
    needKit({ name, version }, 'template');
    const [from, to] = [need(options, 'template', 'from'), need(options, 'template', 'to')];
    // Each slot's value: the palette per mode, and the kit's name.
    const values = new Map([['name', name]]);
    const palette = (mode, each) => {
      const head = `${name}.palette.`;
      for (const token of each) if (token.path.startsWith(head)) values.set(`${mode}.${token.path.slice(head.length)}`, token.value);
    };
    palette(modes.base, tokens);
    for (const [query, files] of Object.entries(media)) palette(modes.media[query] ?? query, await mediaTokens(files));
    const files = [...new Bun.Glob('**/*').scanSync({ cwd: from, dot: true })].sort();
    if (!files.length) throw new Error(`template: no files under ${from}`);
    return files.map((file) => {
      const path = join(from, file);
      const content = readFileSync(path, 'utf8').replace(SLOT, (slot, key) => {
        if (!values.has(key)) throw new Error(`template: ${path} has ${slot.replace(/\s+/g, '')}, which the theme lacks (slots: <mode>.<palette colour>, name)`);
        return values.get(key);
      });
      return { path: join(to, file), content };
    });
  },
};
