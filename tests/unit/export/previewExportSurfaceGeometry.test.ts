import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  buildXrayExportSurfaceGeometry,
  collectTransparentXrayExportTriangles,
  mergeExportSurfaceGeometries,
} from "../../../src/export/previewExportSurfaceGeometry.ts";

describe("export/previewExportSurfaceGeometry", () => {
  it("mergeExportSurfaceGeometries は複数 geometry を position/color ごと連結する", () => {
    const g1 = new THREE.BufferGeometry();
    g1.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    g1.setAttribute(
      "color",
      new THREE.Float32BufferAttribute([1, 0, 0, 1, 0, 0, 1, 0, 0], 3),
    );
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 1, 1, 0, 1, 0, 1, 1], 3),
    );

    const merged = mergeExportSurfaceGeometries([g1, g2]);

    expect(merged?.getAttribute("position")?.count).toBe(6);
    expect(merged?.getAttribute("color")).toBeUndefined();
  });

  it("buildXrayExportSurfaceGeometry は grouped / flat color の分岐を保つ", () => {
    const flatGeometry = new THREE.BufferGeometry();
    flatGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    const meshData = {
      faces: [
        {
          id: "a",
          normal: { x: 0, y: 0, z: 1 },
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
          ],
        },
      ],
    };
    const buildFlatFaceColors = vi.fn(() => [1, 0, 0, 1, 0, 0, 1, 0, 0]);
    const grouped = buildXrayExportSurfaceGeometry({
      visibleCrystalEntries: [{ index: 0, meshData }],
      useGroupedColors: true,
      getTwinCrystalFaces: vi.fn(() => [{ id: "a" }]),
      buildDisplayGeometry: vi.fn(() => flatGeometry),
      buildFlatFaceColors: vi.fn(() => []),
      getCrystalAccentColor: vi.fn(() => "#ff0000"),
    });
    const flat = buildXrayExportSurfaceGeometry({
      visibleCrystalEntries: [{ index: 0, meshData }],
      useGroupedColors: false,
      getTwinCrystalFaces: vi.fn(() => [{ id: "a" }]),
      buildDisplayGeometry: vi.fn(() => null),
      buildFlatFaceColors,
      getCrystalAccentColor: vi.fn(() => "#ff0000"),
    });

    expect(grouped.useVertexColors).toBe(true);
    expect(grouped.geometry).not.toBeNull();
    expect(flat.useVertexColors).toBe(false);
    expect(buildFlatFaceColors).toHaveBeenCalledOnce();
  });

  it("collectTransparentXrayExportTriangles は各 face を triangle 化する", () => {
    const result = collectTransparentXrayExportTriangles({
      width: 100,
      height: 100,
      previewRoot: new THREE.Group(),
      visibleCrystalEntries: [
        {
          index: 0,
          meshData: {
            faces: [
              {
                id: "f1",
                normal: { x: 0, y: 0, z: 1 },
                vertices: [
                  { x: 0, y: 0, z: 0 },
                  { x: 1, y: 0, z: 0 },
                  { x: 0, y: 1, z: 0 },
                ],
              },
            ],
          },
        },
      ],
      fillOpacity: 0.5,
      usesFaceGroupPalette: false,
      getTwinCrystalFaces: vi.fn(() => [{ id: "f1" }]),
      getCrystalAccentColor: vi.fn(() => "#00ff00"),
      resolveXrayPreviewFaceColor: vi.fn(() => "#ffffff"),
      projectWorldPointToExport: vi.fn((point: THREE.Vector3) => ({
        x: point.x * 10,
        y: point.y * 10,
        projectedZ: point.z,
        cameraZ: point.z,
      })),
    });

    expect(result.triangleEntries).toHaveLength(1);
    expect(result.rawTrianglePolygons).toHaveLength(1);
    expect(result.opaqueTriangles).toHaveLength(1);
    expect(result.triangleEntries[0].fill).toBe("#00ff00");
  });
});
