// Springs for the web. Material names a spring by damping ratio and stiffness (Compose's SpringSpec on
// unit mass); CSS has no spring, so each becomes a linear() easing: the spring's position sampled from
// rest to its settle time (within 0.1 % of the target), plus that settle time as the duration to pair
// it with. Pure functions; the token names come from the built-in Material layer's md.sys.motion.
import { byPath } from './color.mjs';

// Position of a unit-mass spring released from 0 toward 1, at `t` seconds.
export const position = (ratio, stiffness, t) => {
  const w0 = Math.sqrt(stiffness);
  if (ratio < 1) {
    const wd = w0 * Math.sqrt(1 - ratio * ratio);
    return 1 - Math.exp(-ratio * w0 * t) * (Math.cos(wd * t) + ((ratio * w0) / wd) * Math.sin(wd * t));
  }
  if (ratio === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const s1 = -w0 * (ratio - Math.sqrt(ratio * ratio - 1)); const s2 = -w0 * (ratio + Math.sqrt(ratio * ratio - 1));
  return 1 - (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1);
};
// Milliseconds until the spring stays within 0.1 % of its target, found by scanning at 1 ms.
export const settle = (ratio, stiffness) => {
  for (let ms = 5000; ms > 0; ms -= 1) if (Math.abs(position(ratio, stiffness, ms / 1000) - 1) > 0.001) return ms + 1;
  return 1;
};
// The spring as a CSS linear() easing over its settle time, 101 stops at most, ending at exactly 1.
export const springEasing = (ratio, stiffness, stops = 101) => {
  const T = settle(ratio, stiffness) / 1000;
  const values = [...Array(stops)].map((_, i) => (i === stops - 1 ? 1 : Number(position(ratio, stiffness, (T * i) / (stops - 1)).toFixed(3))));
  return `linear(${values.join(', ')})`;
};
// [name without "--", value] for every vendored spring: its easing and settle time beside the
// damping and stiffness the system variables already carry.
export const springVars = (tokens) => {
  const t = byPath(tokens); const out = [];
  for (const [path, tok] of t) {
    if (!/^md\.sys\.motion\.spring\..*\.damping$/.test(path)) continue;
    const base = path.replace(/\.damping$/, ''); const k = Number(t.get(`${base}.stiffness`).value); const ratio = Number(tok.value);
    out.push([`${base.replaceAll('.', '-')}-easing`, springEasing(ratio, k)], [`${base.replaceAll('.', '-')}-settle`, `${settle(ratio, k)}ms`]);
  }
  return out.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
};
