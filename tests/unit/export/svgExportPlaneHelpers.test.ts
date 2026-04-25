import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  buildBoundaryExportLineKey,
  buildCanonicalExportPlaneKey,
  buildExportEdgeKey,
  buildExportVertexKey,
  buildMergedExportPaths,
  canonicalizeExportPlane,
  computeConvexHull2D,
  doesBoundaryApplyToExportPlane,
  findMatchingExportPlaneGroup,
  getVectorSvgBodyWorkSize,
  traceDirectedPolygonLoops,
} from "../../../src/export/svgExportPlaneHelpers.ts";

/**
 * export/svgExportPlaneHelpers の plane grouping / path 化 helper を確認する unit test。
 */
describe("export/svgExportPlaneHelpers", () => {
  it("基本 key / plane helper は正常系で canonical 化し、異常系寄りでも判定できる", () => {
    expect(buildExportVertexKey({ x: 1.2345, y: 2, z: 3 })).toBe(
      "1.234|2.000|3.000",
    );
    expect(buildExportEdgeKey("b", "a")).toBe("a::b");

    const plane = canonicalizeExportPlane(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0, -2),
    );
    expect(plane.normal.z).toBe(1);
    expect(
      buildCanonicalExportPlaneKey(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, 2),
      ),
    ).toContain("|");
    expect(
      doesBoundaryApplyToExportPlane(
        {
          planeKeys: [
            buildCanonicalExportPlaneKey(
              new THREE.Vector3(0, 0, 1),
              new THREE.Vector3(0, 0, 2),
            ),
          ],
        },
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, 2),
      ),
    ).toBe(true);
    expect(
      doesBoundaryApplyToExportPlane(
        { planeKeys: ["other"] },
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, 2),
      ),
    ).toBe(false);
  });

  it("findMatchingExportPlaneGroup / boundary key / work size は正常系で一致とサイズを返す", () => {
    const group = {
      fill: "#f00",
      fillOpacity: 1,
      normal: new THREE.Vector3(0, 0, 1),
      distance: 2,
    };
    expect(
      findMatchingExportPlaneGroup([group], {
        fill: "#f00",
        fillOpacity: 1,
        normal: new THREE.Vector3(0, 0, 1),
        worldPoints: [new THREE.Vector3(0, 0, 2)],
      }),
    ).toBe(group);
    expect(
      buildBoundaryExportLineKey({
        x1: 0,
        y1: 0,
        x2: 1,
        y2: 1,
        planeKeys: ["b", "a"],
      }),
    ).toContain("a||b");
    expect(getVectorSvgBodyWorkSize(200, 50, 100)).toEqual({
      width: 100,
      height: 200,
    });
  });

  it("traceDirectedPolygonLoops / computeConvexHull2D は正常系で loop と hull を作る", () => {
    expect(
      traceDirectedPolygonLoops([
        { startKey: "a", endKey: "b" },
        { startKey: "b", endKey: "c" },
        { startKey: "c", endKey: "a" },
      ]),
    ).toEqual([["a", "b", "c"]]);
    expect(
      computeConvexHull2D([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0.5, y: 0.2 },
        { x: 0, y: 1 },
      ]).length,
    ).toBe(3);
  });

  it("buildMergedExportPaths は正常系で path を返し、異常系寄りの空入力では空配列になる", () => {
    const paths = buildMergedExportPaths(
      [
        {
          fill: "#f00",
          fillOpacity: 1,
          normal: new THREE.Vector3(0, 0, 1),
          worldPoints: [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 1, 0),
          ],
          projectedPoints: [
            { x: 0, y: 0, cameraZ: -1 },
            { x: 1, y: 0, cameraZ: -1 },
            { x: 0, y: 1, cameraZ: -1 },
          ],
        },
      ],
      100,
      100,
      new Set(),
      {
        buildPlaneBasis: () => ({
          tangent: new THREE.Vector3(1, 0, 0),
          bitangent: new THREE.Vector3(0, 1, 0),
        }),
        projectFaceVerticesToPlane: (points) =>
          points.map((point) => ({ x: point.x, y: point.y })),
        projectWorldPointToExport: (point) => ({ x: point.x, y: point.y }),
      },
    );
    expect(paths).toHaveLength(1);
    expect(paths[0].d).toContain("M");

    expect(
      buildMergedExportPaths([], 100, 100, new Set(), {
        buildPlaneBasis: () => ({
          tangent: new THREE.Vector3(1, 0, 0),
          bitangent: new THREE.Vector3(0, 1, 0),
        }),
        projectFaceVerticesToPlane: () => [],
        projectWorldPointToExport: () => ({ x: 0, y: 0 }),
      }),
    ).toEqual([]);
  });
});
