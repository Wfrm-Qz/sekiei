import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  buildDirectBasis,
  buildReciprocalBasis,
  createReflectionMatrix,
  createRotationMatrix,
  twinAxisDirection,
  twinPlaneNormal,
} from "../../../src/domain/crystalFrame.ts";

/**
 * crystalFrame の基底変換と双晶則ベクトル変換を確認する unit test。
 */
describe("domain/crystalFrame", () => {
  const cubicParameters = {
    crystalSystem: "cubic",
    axes: { a: 1, b: 1, c: 1 },
    angles: { alpha: 90, beta: 90, gamma: 90 },
  };

  const trigonalParameters = {
    crystalSystem: "trigonal",
    axes: { a: 1, b: 1, c: 2 },
    angles: { alpha: 90, beta: 90, gamma: 120 },
  };

  it("buildDirectBasis は正常系で実空間基底を作る", () => {
    const basis = buildDirectBasis(
      cubicParameters.axes,
      cubicParameters.angles,
    );

    expect(basis.a.x).toBeCloseTo(1);
    expect(basis.b.y).toBeCloseTo(1);
    expect(basis.c.z).toBeCloseTo(1);
  });

  it("buildReciprocalBasis は direct basis から reciprocal basis を作る", () => {
    const reciprocal = buildReciprocalBasis(
      buildDirectBasis(cubicParameters.axes, cubicParameters.angles),
    );

    expect(reciprocal.aStar.x).toBeCloseTo(1);
    expect(reciprocal.bStar.y).toBeCloseTo(1);
    expect(reciprocal.cStar.z).toBeCloseTo(1);
  });

  it("twinPlaneNormal は正常系で面法線を返し、四軸系でも有限値を返す", () => {
    const cubicNormal = twinPlaneNormal({ h: 1, k: 0, l: 0 }, cubicParameters);
    expect(cubicNormal.x).toBeCloseTo(1);
    expect(cubicNormal.y).toBeCloseTo(0);

    const trigonalNormal = twinPlaneNormal(
      { h: 1, k: 0, i: -1, l: 0 },
      trigonalParameters,
    );
    expect(Number.isFinite(trigonalNormal.length())).toBe(true);
    expect(trigonalNormal.length()).toBeCloseTo(1);
  });

  it("twinAxisDirection は正常系で軸方向を返し、四軸系でも有限値を返す", () => {
    const cubicAxis = twinAxisDirection({ h: 0, k: 0, l: 1 }, cubicParameters);
    expect(cubicAxis.z).toBeCloseTo(1);

    const trigonalAxis = twinAxisDirection(
      { h: 1, k: 0, i: -1, l: 0 },
      trigonalParameters,
    );
    expect(Number.isFinite(trigonalAxis.length())).toBe(true);
    expect(trigonalAxis.length()).toBeCloseTo(1);
  });

  it("createReflectionMatrix は非単位法線でも鏡映し、createRotationMatrix は角度 0 で維持する", () => {
    const vector = new THREE.Vector3(2, 3, 4);
    const reflected = vector
      .clone()
      .applyMatrix4(createReflectionMatrix(new THREE.Vector3(10, 0, 0)));
    expect(reflected.x).toBeCloseTo(-2);
    expect(reflected.y).toBeCloseTo(3);
    expect(reflected.z).toBeCloseTo(4);

    const rotated = new THREE.Vector3(1, 0, 0).applyMatrix4(
      createRotationMatrix(new THREE.Vector3(0, 0, 1), 0),
    );
    expect(rotated.x).toBeCloseTo(1);
    expect(rotated.y).toBeCloseTo(0);
  });
});
