import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultParameters } from "../../../src/constants.ts";
import {
  buildCrystalMeshData,
  validateParameters,
} from "../../../src/geometry/crystalGeometry.ts";

const getFaceTextFontMock = vi.fn();

vi.mock("../../../src/text/fonts.ts", () => ({
  getFaceTextFont: (...args: unknown[]) => getFaceTextFontMock(...args),
}));

function createMockFont() {
  return {
    generateShapes() {
      const shape = new THREE.Shape([
        new THREE.Vector2(-0.18, -0.18),
        new THREE.Vector2(0.18, -0.18),
        new THREE.Vector2(0.18, 0.18),
        new THREE.Vector2(-0.18, 0.18),
      ]);
      shape.autoClose = true;
      return [shape];
    },
  };
}

/**
 * geometry/crystalGeometry の公開 build / validate を確認する unit test。
 */
describe("geometry/crystalGeometry", () => {
  beforeEach(() => {
    getFaceTextFontMock.mockReset();
  });

  it("正常系として既定 parameter から meshData を構築できる", () => {
    const parameters = createDefaultParameters();

    const result = buildCrystalMeshData(parameters);

    expect(result.geometry).not.toBeNull();
    expect(result.validation.errors).toHaveLength(0);
    expect(result.metrics.vertexCount).toBeGreaterThan(0);
  });

  it("異常系として face が少なすぎる parameter は validation error を返す", () => {
    const parameters = createDefaultParameters();
    parameters.faces = [];

    const result = buildCrystalMeshData(parameters);
    const validation = validateParameters(parameters);

    expect(result.validation.errors.length).toBeGreaterThan(0);
    expect(validation).toBeTruthy();
    expect(result.geometry).toBeNull();
  });

  it("文字設定とフォントが揃っていれば文字掘り込み込みの三角形へ増える", () => {
    const plainParameters = createDefaultParameters();
    const textParameters = createDefaultParameters();
    textParameters.faces[0].text = {
      ...textParameters.faces[0].text,
      content: "A",
      fontSize: 1.6,
      depth: 0.6,
    };
    getFaceTextFontMock.mockReturnValue(createMockFont());

    const plainResult = buildCrystalMeshData(plainParameters);
    const textResult = buildCrystalMeshData(textParameters);

    expect(textResult.validation.errors).toHaveLength(0);
    expect(textResult.geometry).not.toBeNull();
    expect(textResult.geometry!.positions.length).toBeGreaterThan(
      plainResult.geometry!.positions.length,
    );
  });

  it("preview 用 face には geometry 単位へ換算済みの text 設定を載せる", () => {
    const parameters = createDefaultParameters();
    parameters.faces[0].text = {
      ...parameters.faces[0].text,
      content: "A",
      fontSize: 5,
      depth: 1,
      offsetU: 2,
      offsetV: 3,
    };
    getFaceTextFontMock.mockReturnValue(createMockFont());

    const result = buildCrystalMeshData(parameters, { normalizeSize: false });
    const previewFace = result.geometry?.faces.find(
      (face) => face.id === parameters.faces[0].id,
    );

    expect(previewFace?.text?.content).toBe("A");
    expect(Number(previewFace?.text?.fontSize)).toBeLessThan(5);
    expect(Number(previewFace?.text?.depth)).toBeLessThan(1);
    expect(Number(previewFace?.text?.offsetU)).toBeLessThan(2);
    expect(Number(previewFace?.text?.offsetV)).toBeLessThan(3);
  });

  it("文字設定が不正なら validation に error を積む", () => {
    const parameters = createDefaultParameters();
    parameters.faces[0].text = {
      ...parameters.faces[0].text,
      content: "A",
      fontSize: -1,
      depth: Number.NaN,
      rotationDeg: Number.NaN,
    };

    const validation = validateParameters(parameters);

    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.warnings.length).toBeGreaterThan(0);
  });
});
