import { describe, expect, it } from "vitest";
import leftQuartzDocument from "../../fixtures/face-text/leftQuartz.withText.v2.json";
import { normalizeTwinParameters } from "../../../src/domain/parameters.ts";
import {
  buildCrystalMeshData,
  buildCrystalStlCompositeMeshData,
  buildCrystalStlMeshData,
  buildCrystalStlTextShellData,
} from "../../../src/geometry/crystalGeometry.ts";
import { buildThreeGeometry } from "../../../src/io/exporters.ts";
import { prepareGeometryForStlExport } from "../../../src/io/formats/stl.ts";
import {
  buildFaceClosedShellWithText,
  buildFaceTrianglesWithText,
} from "../../../src/text/faceTextGeometry.ts";

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
    [
      edgeKey(triangle[0], triangle[1]),
      edgeKey(triangle[1], triangle[2]),
      edgeKey(triangle[2], triangle[0]),
    ].forEach((key) => {
      edgeOwners.set(key, (edgeOwners.get(key) ?? 0) + 1);
    });
  }

  const counts = [...edgeOwners.values()];
  return {
    openEdgeCount: counts.filter((count) => count === 1).length,
    multiOwnerEdgeCount: counts.filter((count) => count > 2).length,
  };
}

describe("text/faceTextGeometry integration", () => {
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
  const resolveMockFont = () => mockFont;

  it("左水晶 fixture の実 face でも closed shell builder は単一 face を閉じた shell として組める", () => {
    const normalized = normalizeTwinParameters(leftQuartzDocument);
    const sourceFace = normalized.twin.crystals[0].faces.find(
      (face) => String(face.text?.content ?? "").trim().length > 0,
    );
    expect(sourceFace).toBeTruthy();
    if (!sourceFace) {
      throw new Error("fixture に文字入り face が見つかりません");
    }

    const singleCrystalParameters = {
      ...normalized,
      faces: structuredClone(normalized.twin.crystals[0].faces),
    };
    const previewResult = buildCrystalMeshData(singleCrystalParameters, {
      normalizeSize: false,
    });
    expect(previewResult.geometry).toBeTruthy();

    const previewFace = previewResult.geometry?.faces.find(
      (face) => face.id === sourceFace.id,
    );
    expect(previewFace).toBeTruthy();
    if (!previewFace) {
      throw new Error("preview face が見つかりません");
    }

    const validation = { errors: [] as string[], warnings: [] as string[] };
    const previewPatch = buildFaceTrianglesWithText(
      previewFace,
      sourceFace,
      mockFont,
      validation,
      "左水晶-面1-preview",
    );
    const shell = buildFaceClosedShellWithText(
      previewFace,
      sourceFace,
      mockFont,
      validation,
      "左水晶-面1",
    );
    const previewTopology = measureTopology(previewPatch.positions);
    const topology = measureTopology(shell.positions);

    expect(shell.positions.length).toBeGreaterThan(0);
    expect(shell.debug?.cavityBottomTriangleCount).toBeGreaterThan(0);
    expect(topology.openEdgeCount).toBeLessThan(previewTopology.openEdgeCount);
    expect(topology.multiOwnerEdgeCount).toBe(0);
  });

  it("左水晶 fixture の単結晶 STL 候補では textless base と text shell を分離して比較準備できる", () => {
    const normalized = normalizeTwinParameters(leftQuartzDocument);
    const singleCrystalParameters = {
      ...normalized,
      faces: structuredClone(normalized.twin.crystals[0].faces),
    };

    const previewResult = buildCrystalMeshData(singleCrystalParameters, {
      normalizeSize: false,
      resolveFaceTextFont: resolveMockFont,
    });
    const stlResult = buildCrystalStlMeshData(singleCrystalParameters, {
      normalizeSize: false,
      resolveFaceTextFont: resolveMockFont,
    });
    const shellResult = buildCrystalStlTextShellData(singleCrystalParameters, {
      normalizeSize: false,
      resolveFaceTextFont: resolveMockFont,
    });
    const compositeResult = buildCrystalStlCompositeMeshData(
      singleCrystalParameters,
      {
        normalizeSize: false,
        resolveFaceTextFont: resolveMockFont,
      },
    );

    expect(previewResult.geometry).toBeTruthy();
    expect(stlResult.geometry).toBeTruthy();
    expect(shellResult.baseGeometry).toBeTruthy();
    expect(shellResult.textShells.length).toBeGreaterThan(0);
    expect(compositeResult.geometry).toBeTruthy();
    if (
      !previewResult.geometry ||
      !stlResult.geometry ||
      !shellResult.baseGeometry ||
      !compositeResult.geometry
    ) {
      throw new Error("fixture から geometry を組み立てられませんでした");
    }

    const previewPrepared = prepareGeometryForStlExport(
      buildThreeGeometry(previewResult.geometry),
    );
    const stlPrepared = prepareGeometryForStlExport(
      buildThreeGeometry(stlResult.geometry),
    );
    const textlessPrepared = prepareGeometryForStlExport(
      buildThreeGeometry(shellResult.baseGeometry),
    );
    const shellPrepared = prepareGeometryForStlExport(
      buildThreeGeometry({
        positions: shellResult.textShells.flatMap((shell) => shell.positions),
      }),
    );
    const compositePrepared = prepareGeometryForStlExport(
      buildThreeGeometry(compositeResult.geometry),
    );

    const previewTopology = previewPrepared.debug.topologyAfterOrientation;
    const stlTopology = stlPrepared.debug.topologyAfterOrientation;
    const textlessTopology = textlessPrepared.debug.topologyAfterOrientation;
    const shellTopology = shellPrepared.debug.topologyAfterOrientation;
    const compositeTopology = compositePrepared.debug.topologyAfterOrientation;

    expect(previewTopology.openEdgeCount).toBeGreaterThan(0);
    expect(stlTopology.multiOwnerEdgeCount).toBeGreaterThan(0);
    expect(textlessTopology.openEdgeCount).toBe(0);
    expect(textlessTopology.multiOwnerEdgeCount).toBe(0);
    expect(shellTopology.openEdgeCount).toBe(0);
    expect(shellTopology.multiOwnerEdgeCount).toBe(0);
    expect(compositeTopology.openEdgeCount).toBeLessThanOrEqual(
      previewTopology.openEdgeCount,
    );
    expect(compositeTopology.multiOwnerEdgeCount).toBeLessThan(
      stlTopology.multiOwnerEdgeCount,
    );
  });
});
