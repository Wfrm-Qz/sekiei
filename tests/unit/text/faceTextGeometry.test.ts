import { describe, expect, it } from "vitest";
import {
  buildFaceClosedShellWithText,
  buildFaceStlReplacementPatchWithText,
  buildFaceTrianglesWithText,
  validateFaceTextSettings,
} from "../../../src/text/faceTextGeometry.ts";

/**
 * text/faceTextGeometry の validation と fallback 経路を確認する unit test。
 */
describe("text/faceTextGeometry", () => {
  function measureTopology(positions: { x: number; y: number; z: number }[]) {
    const edgeOwners = new Map<string, number>();
    const pointKey = (point: { x: number; y: number; z: number }) =>
      `${Math.round(point.x * 1e6)},${Math.round(point.y * 1e6)},${Math.round(point.z * 1e6)}`;
    const edgeKey = (
      left: { x: number; y: number; z: number },
      right: { x: number; y: number; z: number },
    ) => {
      const a = pointKey(left);
      const b = pointKey(right);
      return a < b ? `${a}|${b}` : `${b}|${a}`;
    };

    for (let index = 0; index + 2 < positions.length; index += 3) {
      const triangle = [
        positions[index],
        positions[index + 1],
        positions[index + 2],
      ];
      const keys = [
        edgeKey(triangle[0], triangle[1]),
        edgeKey(triangle[1], triangle[2]),
        edgeKey(triangle[2], triangle[0]),
      ];
      keys.forEach((key) => {
        edgeOwners.set(key, (edgeOwners.get(key) ?? 0) + 1);
      });
    }

    const counts = [...edgeOwners.values()];
    return {
      openEdgeCount: counts.filter((count) => count === 1).length,
      multiOwnerEdgeCount: counts.filter((count) => count > 2).length,
    };
  }

  it("validateFaceTextSettings は正常系では警告だけ、異常系では error / warning を積む", () => {
    const validation = { errors: [] as string[], warnings: [] as string[] };
    validateFaceTextSettings(
      {
        faces: [
          {
            text: {
              content: "A",
              fontSize: 1,
              depth: 0.1,
              offsetU: 0,
              offsetV: 0,
              rotationDeg: 0,
            },
          },
          {
            text: {
              content: "B",
              fontSize: -1,
              depth: Number.NaN,
              offsetU: Number.NaN,
              offsetV: 0,
              rotationDeg: Number.NaN,
            },
          },
        ],
      },
      validation,
    );

    expect(validation.warnings.length).toBeGreaterThan(0);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it("buildFaceTrianglesWithText は正常系の no-text / no-font で元面三角形へ fallback し、異常系の basis failure でも warning を返す", () => {
    const face = {
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      normal: { x: 0, y: 0, z: 1 },
    };
    const validation = { errors: [] as string[], warnings: [] as string[] };

    const noText = buildFaceTrianglesWithText(
      face,
      { text: { content: "", depth: 1 } },
      null,
      validation,
      "面1",
    );
    expect(noText.positions).toHaveLength(3);

    const noFont = buildFaceTrianglesWithText(
      face,
      { text: { content: "A", depth: 1 } },
      null,
      validation,
      "面1",
    );
    expect(noFont.positions).toHaveLength(3);

    const badBasis = buildFaceTrianglesWithText(
      {
        vertices: face.vertices,
        normal: { x: 0, y: 0, z: 0 },
      },
      { text: { content: "A", depth: 1 } },
      { generateShapes: () => [] },
      validation,
      "面2",
    );
    expect(badBasis.positions).toHaveLength(3);
    expect(validation.warnings.length).toBeGreaterThan(0);
  });

  it("buildFaceClosedShellWithText は単純な glyph で閉じた face shell を返す", () => {
    const face = {
      vertices: [
        { x: -2, y: -2, z: 0 },
        { x: 2, y: -2, z: 0 },
        { x: 2, y: 2, z: 0 },
        { x: -2, y: 2, z: 0 },
      ],
      normal: { x: 0, y: 0, z: 1 },
      textUpVector: { x: 0, y: 1, z: 0 },
    };
    const validation = { errors: [] as string[], warnings: [] as string[] };
    const mockFont = {
      generateShapes: () => [
        {
          getPoints: () => [
            { x: -0.8, y: -0.6 },
            { x: 0.8, y: -0.6 },
            { x: 0.8, y: 0.6 },
            { x: -0.8, y: 0.6 },
            { x: -0.8, y: -0.6 },
          ],
          holes: [],
        },
      ],
    };

    const shell = buildFaceClosedShellWithText(
      face,
      { text: { content: "A", depth: 0.6, fontSize: 1 } },
      mockFont,
      validation,
      "面1",
    );
    const topology = measureTopology(shell.positions);

    expect(shell.positions.length).toBeGreaterThan(0);
    expect(shell.debug?.cavityBottomTriangleCount).toBeGreaterThan(0);
    expect(shell.debug?.cavitySideTriangleCount).toBeGreaterThan(0);
    expect(topology.openEdgeCount).toBe(0);
    expect(topology.multiOwnerEdgeCount).toBe(0);
  });

  it("buildFaceClosedShellWithText は負の depth では当面平面シェルへ fallback する", () => {
    const face = {
      vertices: [
        { x: -1, y: -1, z: 0 },
        { x: 1, y: -1, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: -1, y: 1, z: 0 },
      ],
      normal: { x: 0, y: 0, z: 1 },
      textUpVector: { x: 0, y: 1, z: 0 },
    };
    const validation = { errors: [] as string[], warnings: [] as string[] };
    const mockFont = {
      generateShapes: () => [
        {
          getPoints: () => [
            { x: -0.2, y: -0.2 },
            { x: 0.2, y: -0.2 },
            { x: 0.2, y: 0.2 },
            { x: -0.2, y: 0.2 },
            { x: -0.2, y: -0.2 },
          ],
          holes: [],
        },
      ],
    };

    const shell = buildFaceClosedShellWithText(
      face,
      { text: { content: "A", depth: -0.6, fontSize: 1 } },
      mockFont,
      validation,
      "面2",
    );

    expect(shell.debug?.cavityBottomTriangleCount).toBe(0);
    expect(
      validation.warnings.some((warning) => warning.includes("未対応")),
    ).toBe(true);
  });

  it("buildFaceStlReplacementPatchWithText は負の depth で飛び出し文字パッチを作る", () => {
    const face = {
      vertices: [
        { x: -2, y: -2, z: 0 },
        { x: 2, y: -2, z: 0 },
        { x: 2, y: 2, z: 0 },
        { x: -2, y: 2, z: 0 },
      ],
      normal: { x: 0, y: 0, z: 1 },
      textUpVector: { x: 0, y: 1, z: 0 },
    };
    const validation = { errors: [] as string[], warnings: [] as string[] };
    const mockFont = {
      generateShapes: () => [
        {
          getPoints: () => [
            { x: -0.6, y: -0.4 },
            { x: 0.6, y: -0.4 },
            { x: 0.6, y: 0.4 },
            { x: -0.6, y: 0.4 },
            { x: -0.6, y: -0.4 },
          ],
          holes: [],
        },
      ],
    };

    const patch = buildFaceStlReplacementPatchWithText(
      face,
      { text: { content: "A", depth: -0.6, fontSize: 1 } },
      mockFont,
      validation,
      "面3",
    );
    const topology = measureTopology(patch.positions);

    expect(
      validation.warnings.some((warning) => warning.includes("未対応")),
    ).toBe(false);
    expect(patch.debug?.embossTopTriangleCount).toBeGreaterThan(0);
    expect(patch.debug?.embossSideTriangleCount).toBeGreaterThan(0);
    expect(topology.openEdgeCount).toBe(4);
    expect(topology.multiOwnerEdgeCount).toBe(0);
  });
});
