import { describe, expect, it } from "vitest";
import {
  buildSvgExportFaceDebugList,
  buildSvgPathFromLoops,
  buildSvgPolygonEdgeKey,
  buildSvgPolygonVertexKey,
  buildSvgSortTieDebugSummary,
  buildTwinSvgEdgeDebugSummary,
  createTwinSvgMergeFace,
  mergeAdjacentSplitPolygonsByFill,
  scaleExportPathCoordinates,
  scaleExportPolygonCoordinates,
  scaleOpaqueExportTriangles,
  tracePolygonLoopsFromBoundaryEdges,
} from "../../../src/export/svgMergeHelpers.ts";

/**
 * export/svgMergeHelpers の merge / debug / scale helper を確認する unit test。
 */
describe("export/svgMergeHelpers", () => {
  it("基本 helper は正常系で key / path / loop を作り、異常系寄りの単純入力でも動く", () => {
    expect(buildSvgPolygonVertexKey({ x: 1.234, y: 5.678 })).toBe("1.23|5.68");
    expect(buildSvgPolygonEdgeKey("b", "a")).toBe("a::b");
    expect(
      buildSvgPathFromLoops([
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
        ],
      ]),
    ).toContain("M 0 0");
    expect(
      tracePolygonLoopsFromBoundaryEdges([
        {
          start: { x: 0, y: 0 },
          end: { x: 1, y: 0 },
          startKey: "0,0",
          endKey: "1,0",
        },
        {
          start: { x: 1, y: 0 },
          end: { x: 0, y: 1 },
          startKey: "1,0",
          endKey: "0,1",
        },
        {
          start: { x: 0, y: 1 },
          end: { x: 0, y: 0 },
          startKey: "0,1",
          endKey: "0,0",
        },
      ]).length,
    ).toBe(1);
  });

  it("debug helper は正常系で face/path summary を返す", () => {
    expect(
      buildSvgExportFaceDebugList(
        [{ points: "0,0 1,0 0,1", fill: "#f00", fillOpacity: 1 }],
        [{ d: "M 0 0 L 1 0 L 0 1 Z", fill: "#0f0", fillOpacity: 1 }],
      ),
    ).toHaveLength(2);

    expect(
      buildSvgSortTieDebugSummary([
        { sortDepth: 1, backSortDepth: 2, fill: "#f00" },
        { sortDepth: 1, backSortDepth: 3, fill: "#0f0" },
      ]).duplicateSortDepthGroupCount,
    ).toBe(1);
  });

  it("createTwinSvgMergeFace / buildTwinSvgEdgeDebugSummary は正常系で edge 情報を作る", () => {
    const face = createTwinSvgMergeFace(
      {
        points: "0,0 1,0 0,1",
        fill: "#f00",
        fillOpacity: 1,
        sortDepth: 1,
      },
      [],
    );
    expect(face.edges).toHaveLength(3);
    expect(buildTwinSvgEdgeDebugSummary([face]).groupCount).toBe(1);
  });

  it("mergeAdjacentSplitPolygonsByFill は正常系で隣接 polygon をまとめ、単独入力ではそのまま返す", () => {
    const result = mergeAdjacentSplitPolygonsByFill(
      [
        { points: "0,0 1,0 0,1", fill: "#f00", fillOpacity: 1, sortDepth: 1 },
        { points: "1,0 1,1 0,1", fill: "#f00", fillOpacity: 1, sortDepth: 1 },
      ],
      [],
    );
    expect(result.polygons.length).toBeLessThanOrEqual(2);
    expect(result.debug.inputPolygonCount).toBe(2);

    expect(
      mergeAdjacentSplitPolygonsByFill(
        [{ points: "0,0 1,0 0,1", fill: "#f00", fillOpacity: 1 }],
        [],
      ).polygons,
    ).toHaveLength(1);
  });

  it("scale helper は正常系で座標を拡大し、異常系寄りの値でも shape を保つ", () => {
    expect(
      scaleExportPolygonCoordinates(
        {
          points: "1,2 3,4",
          points2d: [
            { x: 1, y: 2 },
            { x: 3, y: 4 },
          ],
        },
        2,
        3,
      ).points,
    ).toBe("2,6 6,12");
    expect(scaleExportPathCoordinates({ d: "M 1 2 L 3 4 Z" }, 2, 3).d).toBe(
      "M 2 6 L 6 12 Z",
    );
    expect(
      scaleOpaqueExportTriangles(
        [{ p1: { x: 1, y: 2 }, p2: { x: 3, y: 4 }, p3: { x: 5, y: 6 } }],
        2,
        3,
      )[0],
    ).toEqual({
      p1: { x: 2, y: 6 },
      p2: { x: 6, y: 12 },
      p3: { x: 10, y: 18 },
    });
  });
});
