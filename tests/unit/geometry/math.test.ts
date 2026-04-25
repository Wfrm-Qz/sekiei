import { describe, expect, it } from "vitest";
import {
  EPSILON,
  add,
  centroid,
  cross,
  degreesToRadians,
  determinant3x3,
  dot,
  magnitude,
  normalize,
  scale,
  solve3x3,
  subtract,
  vec,
} from "../../../src/geometry/math.ts";

/**
 * geometry/math の基礎ベクトル演算と 3x3 解法を確認する unit test。
 */
describe("geometry/math", () => {
  it("ベクトル生成と四則演算を正しく行う", () => {
    expect(vec(1, 2, 3)).toEqual({ x: 1, y: 2, z: 3 });
    expect(add(vec(1, 2, 3), vec(4, 5, 6))).toEqual({ x: 5, y: 7, z: 9 });
    expect(subtract(vec(4, 5, 6), vec(1, 2, 3))).toEqual({
      x: 3,
      y: 3,
      z: 3,
    });
    expect(scale(vec(1, 2, 3), 2)).toEqual({ x: 2, y: 4, z: 6 });
  });

  it("内積・外積・大きさを正しく計算する", () => {
    expect(dot(vec(1, 2, 3), vec(4, 5, 6))).toBe(32);
    expect(cross(vec(1, 0, 0), vec(0, 1, 0))).toEqual({ x: 0, y: 0, z: 1 });
    expect(magnitude(vec(3, 4, 0))).toBe(5);
  });

  it("normalize は正常系で単位化し、極小ベクトルではゼロへ退避する", () => {
    expect(normalize(vec(3, 0, 0))).toEqual({ x: 1, y: 0, z: 0 });
    expect(normalize(vec(EPSILON / 10, 0, 0))).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("角度変換と行列式を計算できる", () => {
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
    expect(
      determinant3x3([
        [1, 2, 3],
        [0, 1, 4],
        [5, 6, 0],
      ]),
    ).toBe(1);
  });

  it("solve3x3 は正常系で解を返し、退化行列では null を返す", () => {
    expect(
      solve3x3(
        [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
        [2, 3, 4],
      ),
    ).toEqual({ x: 2, y: 3, z: 4 });

    expect(
      solve3x3(
        [
          [1, 2, 3],
          [2, 4, 6],
          [3, 6, 9],
        ],
        [1, 2, 3],
      ),
    ).toBeNull();
  });

  it("centroid は点群の重心を返す", () => {
    expect(centroid([vec(0, 0, 0), vec(2, 2, 2), vec(4, 4, 4)])).toEqual({
      x: 2,
      y: 2,
      z: 2,
    });
  });
});
