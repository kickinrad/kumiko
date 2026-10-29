// Springs for the web: Material's damping ratio and stiffness become a CSS linear() easing (the
// unit-mass spring's position sampled over its settle time), so a web port animates with the same
// curve Compose's SpringSpec gives.
import { expect, test } from "bun:test";
import { position, settle, springEasing } from "../src/motion.mjs";

test("a critically damped spring (ratio 1, stiffness 1600) sits at 1 - e^-4 (1 + 4) after 100 ms", () => {
  expect(Math.abs(position(1, 1600, 0.1) - (1 - Math.exp(-4) * 5))).toBeLessThan(1e-9);
});

test("an underdamped spring overshoots, then settles within 0.1 % of its target", () => {
  const ms = settle(0.8, 380);
  expect(ms).toBeGreaterThan(100);
  expect(ms).toBeLessThan(1000);
  expect(Math.max(...[...Array(200)].map((_, i) => position(0.8, 380, (ms / 1000) * (i / 199))))).toBeGreaterThan(1);
  expect(Math.abs(position(0.8, 380, ms / 1000) - 1)).toBeLessThanOrEqual(0.001);
});

test("the easing starts at 0, ends at exactly 1, and samples at most 101 points", () => {
  const curve = springEasing(0.6, 800);
  const stops = curve.match(/^linear\(([^)]*)\)$/)![1].split(", ").map(Number);
  expect(stops[0]).toBe(0);
  expect(stops.at(-1)).toBe(1);
  expect(stops.length).toBeLessThanOrEqual(101);
  expect(stops.length).toBeGreaterThan(10);
});
