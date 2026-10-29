// The fifteen Material type styles as targets emit them, read from the resolved tokens
// (md.sys.typescale.*: the built-in Material layer with a kit's overrides over it). Emphasized styles
// stay in the tokens; no target emits them yet.
import { byPath } from './color.mjs';

export const STYLES = ['display-large', 'display-medium', 'display-small', 'headline-large', 'headline-medium',
  'headline-small', 'title-large', 'title-medium', 'title-small', 'body-large', 'body-medium', 'body-small',
  'label-large', 'label-medium', 'label-small'];
// One record per style: fontFamily (unquoted stack), fontSize/lineHeight/letterSpacing as px strings,
// fontWeight as a number.
export const typeScale = (tokens) => {
  const t = byPath(tokens);
  return Object.fromEntries(STYLES.map((style) => {
    const get = (part) => { const tok = t.get(`md.sys.typescale.${style}.${part}`); if (!tok) throw new Error(`Missing md.sys.typescale.${style}.${part}`); return tok.value; };
    return [style, { fontFamily: String(get('font')).replace(/'/g, ''), fontSize: get('size'), lineHeight: get('line-height'),
      fontWeight: Number(get('weight')), letterSpacing: get('tracking') }];
  }));
};
