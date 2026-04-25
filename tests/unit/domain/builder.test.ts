import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultTwinParameters,
  normalizeTwinParameters,
} from "../../../src/domain/parameters.ts";
import { buildTwinMeshData } from "../../../src/domain/builder.ts";

const buildCrystalMeshDataMock = vi.fn();
const buildCrystalStlCompositeMeshDataMock = vi.fn();
const unionMeshDataWithJscadMock = vi.fn();

vi.mock("../../../src/geometry/crystalGeometry.ts", () => ({
  buildCrystalMeshData: (...args: unknown[]) =>
    buildCrystalMeshDataMock(...args),
  buildCrystalStlCompositeMeshData: (...args: unknown[]) =>
    buildCrystalStlCompositeMeshDataMock(...args),
}));

vi.mock("../../../src/domain/jscadCsg.ts", () => ({
  unionMeshDataWithJscad: (...args: unknown[]) =>
    unionMeshDataWithJscadMock(...args),
}));

/**
 * domain/builder の公開 build 関数を確認する smoke unit test。
 */
describe("domain/builder", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    buildCrystalMeshDataMock.mockReset();
    buildCrystalStlCompositeMeshDataMock.mockReset();
    unionMeshDataWithJscadMock.mockReset();
    buildCrystalMeshDataMock.mockImplementation((parameters) => {
      const firstFaceId = parameters.faces?.[0]?.id ?? "face-1";
      const hasText =
        String(parameters.faces?.[0]?.text?.content ?? "").trim().length > 0;
      return {
        geometry: {
          positions: hasText
            ? [0, 0, 0, 1, 0, 0, 0, 1, 0, 0.5, 0, 0, 0, 0.5, 0]
            : [0, 0, 0, 1, 0, 0, 0, 1, 0],
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
          ],
          faces: [
            {
              id: firstFaceId,
              normal: { x: 0, y: 0, z: 1 },
              vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
              ],
            },
          ],
          axisGuides: [],
          faceVertexCounts: [{ id: firstFaceId, vertexCount: hasText ? 5 : 3 }],
        },
        validation: { errors: [], warnings: [] },
        metrics: {
          vertexCount: hasText ? 5 : 3,
          faceCount: 1,
          maxDimensionMm: 1,
        },
      };
    });
    buildCrystalStlCompositeMeshDataMock.mockImplementation((parameters) => {
      const firstFaceId = parameters.faces?.[0]?.id ?? "face-1";
      return {
        geometry: {
          positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
          ],
          faces: [
            {
              id: firstFaceId,
              normal: { x: 0, y: 0, z: 1 },
              vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
              ],
            },
          ],
          axisGuides: [],
          faceVertexCounts: [{ id: firstFaceId, vertexCount: 3 }],
        },
        validation: { errors: [], warnings: [] },
        metrics: {
          vertexCount: 3,
          faceCount: 1,
          maxDimensionMm: 1,
        },
        textShells: [{ faceId: firstFaceId, positions: [], debug: {} }],
      };
    });
    unionMeshDataWithJscadMock.mockReturnValue(new THREE.BoxGeometry(1, 1, 1));
  });

  it("正常系として buildTwinMeshData は既定 parameters から geometry を返す", () => {
    const parameters = createDefaultTwinParameters();

    const result = buildTwinMeshData(parameters);

    expect(result.finalGeometry).not.toBeNull();
    expect(result.previewFinalGeometry).not.toBeNull();
    expect(result.validation.errors).toHaveLength(0);
  });

  it("異常系として結晶が全無効でも fallback 付き結果オブジェクトは返す", () => {
    const parameters = normalizeTwinParameters(createDefaultTwinParameters());
    parameters.twin.crystals.forEach((crystal) => {
      crystal.enabled = false;
    });

    const result = buildTwinMeshData(parameters);

    expect(result).toBeTruthy();
    expect(Array.isArray(result.validation.errors)).toBe(true);
    expect(Array.isArray(result.validation.warnings)).toBe(true);
  });

  it("1 結晶相当では face text を剥がさずに単体 build へ渡す", () => {
    const parameters = normalizeTwinParameters(createDefaultTwinParameters());
    parameters.faces[0].text = {
      ...parameters.faces[0].text,
      content: "A",
      depth: 0.6,
    };
    parameters.twin.crystals[0].faces[0].text = {
      ...parameters.twin.crystals[0].faces[0].text,
      content: "A",
      depth: 0.6,
    };

    buildTwinMeshData(parameters);

    expect(buildCrystalMeshDataMock).toHaveBeenCalled();
    expect(
      buildCrystalMeshDataMock.mock.calls[0][0].faces[0].text.content,
    ).toBe("A");
  });

  it("複数結晶を有効にした build では CSG 用は strip を維持しつつ preview 用 text mesh を別 build する", () => {
    const parameters = normalizeTwinParameters({
      ...createDefaultTwinParameters(),
      twin: {
        ...createDefaultTwinParameters().twin,
        enabled: true,
      },
    });
    parameters.faces[0].text = {
      ...parameters.faces[0].text,
      content: "A",
      depth: 0.6,
    };
    parameters.twin.crystals.forEach((crystal) => {
      crystal.enabled = true;
      crystal.faces[0].text = {
        ...crystal.faces[0].text,
        content: "A",
        depth: 0.6,
      };
    });

    const result = buildTwinMeshData(parameters);

    expect(buildCrystalMeshDataMock).toHaveBeenCalledTimes(4);
    expect(buildCrystalStlCompositeMeshDataMock).toHaveBeenCalledTimes(2);
    expect(
      buildCrystalMeshDataMock.mock.calls.map(
        ([callParameters]) => callParameters.faces[0].text.content,
      ),
    ).toEqual(["", "A", "", "A"]);
    expect(resultFaceVertexCount(result.crystalPreviewMeshData)).toBe(5);
    expect(result.crystalStlCompositeGeometries?.filter(Boolean).length).toBe(
      2,
    );
  });
});

function resultFaceVertexCount(
  crystalPreviewMeshData:
    | {
        faceVertexCounts?: { id: string; vertexCount: number }[];
      }[]
    | null
    | undefined,
) {
  return crystalPreviewMeshData?.[0]?.faceVertexCounts?.[0]?.vertexCount ?? 0;
}
