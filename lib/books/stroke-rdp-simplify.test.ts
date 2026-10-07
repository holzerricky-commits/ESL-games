import { describe, it, expect } from "vitest";
import { rdpSimplify } from "./stroke-rdp-simplify";

describe("rdpSimplify", () => {
  it("returns same points when only 2 points", () => {
    const pts: [number, number][] = [[0, 0], [10, 10]];
    const result = rdpSimplify(pts, 5);
    expect(result).toEqual(pts);
    expect(result).not.toBe(pts); // new array
  });

  it("returns all points when epsilon is 0", () => {
    const pts: [number, number][] = [[0, 0], [1, 1], [2, 0], [3, 1]];
    const result = rdpSimplify(pts, 0);
    expect(result).toEqual(pts);
  });

  it("simplifies a straight line with one outlier", () => {
    // Points on y=0 line with one point slightly off
    const pts: [number, number][] = [[0, 0], [5, 0.1], [10, 0]];
    // epsilon > 0.1 should collapse to endpoints
    expect(rdpSimplify(pts, 1)).toEqual([[0, 0], [10, 0]]);
    // epsilon < 0.1 should keep the outlier
    expect(rdpSimplify(pts, 0.05)).toEqual([[0, 0], [5, 0.1], [10, 0]]);
  });

  it("zigzag: small epsilon keeps most, large epsilon collapses", () => {
    const pts: [number, number][] = [
      [0, 0], [1, 5], [2, 0], [3, 5], [4, 0], [5, 5], [6, 0],
    ];
    const small = rdpSimplify(pts, 0.1);
    const large = rdpSimplify(pts, 100);
    expect(small.length).toBeGreaterThanOrEqual(pts.length - 1);
    expect(large).toEqual([[0, 0], [6, 0]]);
  });
});
