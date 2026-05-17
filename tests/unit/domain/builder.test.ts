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

  it("貫入双晶の軸方向 offset は距離1面までの距離を 1 として線形に移動する", () => {
    const parameters = normalizeTwinParameters({
      ...createDefaultTwinParameters(),
      sizeMm: 1,
      twin: {
        ...createDefaultTwinParameters().twin,
        enabled: true,
      },
    });
    parameters.twin.crystals[1].axis = {
      ...parameters.twin.crystals[1].axis,
      h: 1,
      k: 0,
      l: 0,
    };
    parameters.twin.crystals[1].rotationAngleDeg = 0;
    parameters.twin.crystals[1].offsets = [
      {
        kind: "axis",
        basis: "twin-axis",
        amount: 0.5,
        unit: "axis-plane-intercept",
      },
      {
        kind: "axis",
        basis: "twin-axis",
        amount: 0.5,
        unit: "axis-plane-intercept",
      },
    ];

    const result = buildTwinMeshData(parameters);
    const baseX = result.crystalPreviewMeshData?.[0]?.vertices?.[0]?.x ?? 0;
    const derivedX = result.crystalPreviewMeshData?.[1]?.vertices?.[0]?.x ?? 0;

    expect(derivedX - baseX).toBeCloseTo(1);
  });

  it("接触双晶の回転角は接触面を保ったまま派生結晶だけを面内回転する", () => {
    const parameters = normalizeTwinParameters({
      crystalSystem: "cubic",
      faces: [{ id: "base-face", h: 1, k: 0, l: 0, distance: 1 }],
      twin: {
        enabled: true,
        crystals: [
          {
            id: "base",
            faces: [{ id: "base-face", h: 1, k: 0, l: 0, distance: 1 }],
          },
          {
            id: "derived",
            from: 0,
            enabled: true,
            twinType: "contact",
            ruleType: "plane",
            rotationAngleDeg: 90,
            contact: {
              baseFaceRef: "base-face",
              derivedFaceRef: "derived-face",
              referenceAxisLabel: null,
            },
            faces: [{ id: "derived-face", h: -1, k: 0, l: 0, distance: 1 }],
          },
        ],
      },
    });

    buildCrystalMeshDataMock
      .mockImplementationOnce(() => ({
        geometry: createMockContactMeshData("base-face", { x: 0, y: 0, z: 1 }),
        validation: { errors: [], warnings: [] },
        metrics: { vertexCount: 3, faceCount: 1, maxDimensionMm: 1 },
      }))
      .mockImplementationOnce(() => ({
        geometry: createMockContactMeshData("derived-face", {
          x: 0,
          y: 0,
          z: -1,
        }),
        validation: { errors: [], warnings: [] },
        metrics: { vertexCount: 3, faceCount: 1, maxDimensionMm: 1 },
      }));

    const result = buildTwinMeshData(parameters);
    const derivedAxis = result.crystalPreviewMeshData?.[1]?.axisGuides?.find(
      (axis) => axis.label === "a",
    );
    const direction = axisGuideDirection(derivedAxis);
    const baseFaceCenter = resultFaceCenter(
      result.crystalPreviewMeshData?.[0],
      "base-face",
    );
    const derivedFaceCenter = resultFaceCenter(
      result.crystalPreviewMeshData?.[1],
      "derived-face",
    );

    expect(direction).not.toBeNull();
    expect(direction!.x).toBeCloseTo(0);
    expect(direction!.y).toBeGreaterThan(0.9);
    expect(baseFaceCenter).not.toBeNull();
    expect(derivedFaceCenter).not.toBeNull();
    expect(derivedFaceCenter!.distanceTo(baseFaceCenter!)).toBeCloseTo(0);
  });

  it("貫入双晶の派生結晶軸中心は生成元結晶の双晶軸上へ補正する", () => {
    const parameters = normalizeTwinParameters({
      ...createDefaultTwinParameters(),
      sizeMm: 1,
      twin: {
        ...createDefaultTwinParameters().twin,
        enabled: true,
      },
    });
    parameters.twin.crystals[1].axis = {
      ...parameters.twin.crystals[1].axis,
      h: 1,
      k: 0,
      l: 0,
    };
    parameters.twin.crystals[1].rotationAngleDeg = 0;
    parameters.twin.crystals[1].offsets = [];

    buildCrystalMeshDataMock
      .mockImplementationOnce(() => ({
        geometry: createMockMeshDataWithAxisCenter(new THREE.Vector3(0, 0, 0)),
        validation: { errors: [], warnings: [] },
        metrics: { vertexCount: 3, faceCount: 1, maxDimensionMm: 1 },
      }))
      .mockImplementationOnce(() => ({
        geometry: createMockMeshDataWithAxisCenter(new THREE.Vector3(0, 2, 3)),
        validation: { errors: [], warnings: [] },
        metrics: { vertexCount: 3, faceCount: 1, maxDimensionMm: 1 },
      }));

    const result = buildTwinMeshData(parameters);
    const baseCenter = resultAxisGuideCenter(
      result.crystalPreviewMeshData?.[0],
    );
    const derivedCenter = resultAxisGuideCenter(
      result.crystalPreviewMeshData?.[1],
    );

    expect(baseCenter).not.toBeNull();
    expect(derivedCenter).not.toBeNull();
    expect(derivedCenter!.y - baseCenter!.y).toBeCloseTo(0);
    expect(derivedCenter!.z - baseCenter!.z).toBeCloseTo(0);
  });
});

function createMockContactMeshData(
  faceId: string,
  normal: { x: number; y: number; z: number },
) {
  return {
    positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
    vertices: [
      { x: -1, y: -1, z: 0 },
      { x: 1, y: -1, z: 0 },
      { x: 0, y: 1, z: 0 },
    ],
    faces: [
      {
        id: faceId,
        normal,
        vertices: [
          { x: -1, y: -1, z: 0 },
          { x: 1, y: -1, z: 0 },
          { x: 0, y: 1, z: 0 },
        ],
      },
    ],
    axisGuides: [
      {
        label: "a",
        start: { x: -1, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
      {
        label: "b",
        start: { x: 0, y: -1, z: 0 },
        end: { x: 0, y: 1, z: 0 },
      },
      {
        label: "c",
        start: { x: 0, y: 0, z: -1 },
        end: { x: 0, y: 0, z: 1 },
      },
    ],
    faceVertexCounts: [{ id: faceId, vertexCount: 3 }],
  };
}

function createMockMeshDataWithAxisCenter(center: THREE.Vector3) {
  return {
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    vertices: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ],
    faces: [
      {
        id: "face-1",
        normal: { x: 0, y: 0, z: 1 },
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
        ],
      },
    ],
    axisGuides: [
      {
        label: "a",
        start: { x: center.x - 1, y: center.y, z: center.z },
        end: { x: center.x + 1, y: center.y, z: center.z },
      },
      {
        label: "b",
        start: { x: center.x, y: center.y - 1, z: center.z },
        end: { x: center.x, y: center.y + 1, z: center.z },
      },
      {
        label: "c",
        start: { x: center.x, y: center.y, z: center.z - 1 },
        end: { x: center.x, y: center.y, z: center.z + 1 },
      },
    ],
    faceVertexCounts: [{ id: "face-1", vertexCount: 3 }],
  };
}

interface PointLike {
  x: number;
  y: number;
  z: number;
}

interface AxisGuideLike {
  label: string;
  start: PointLike;
  end: PointLike;
}

interface FaceLike {
  id: string;
  vertices: PointLike[];
}

function axisGuideDirection(axis: AxisGuideLike | null | undefined) {
  if (!axis) {
    return null;
  }
  return new THREE.Vector3(
    axis.end.x - axis.start.x,
    axis.end.y - axis.start.y,
    axis.end.z - axis.start.z,
  ).normalize();
}

function resultFaceCenter(
  meshData: { faces?: FaceLike[] | null } | null | undefined,
  faceId: string,
) {
  const face = meshData?.faces?.find(
    (candidate: FaceLike) => candidate.id === faceId,
  );
  if (!face) {
    return null;
  }
  return face.vertices
    .reduce(
      (sum: THREE.Vector3, vertex: { x: number; y: number; z: number }) =>
        sum.add(new THREE.Vector3(vertex.x, vertex.y, vertex.z)),
      new THREE.Vector3(),
    )
    .divideScalar(face.vertices.length);
}

function resultAxisGuideCenter(
  meshData:
    | {
        axisGuides?: {
          start: { x: number; y: number; z: number };
          end: { x: number; y: number; z: number };
        }[];
      }
    | null
    | undefined,
) {
  const axisGuides = meshData?.axisGuides ?? [];
  if (axisGuides.length === 0) {
    return null;
  }
  const sum = axisGuides.reduce((accumulator, axis) => {
    return accumulator.add(
      new THREE.Vector3(axis.start.x, axis.start.y, axis.start.z)
        .add(new THREE.Vector3(axis.end.x, axis.end.y, axis.end.z))
        .multiplyScalar(0.5),
    );
  }, new THREE.Vector3());
  return sum.divideScalar(axisGuides.length);
}

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
