import { describe, expect, it } from "vitest";
import {
  applyLocalOverlapDepthSort,
  clipConvexPolygon2D,
  collectLinePolygonIntersectionPoints,
  computeExportPolygonBackDepth,
  computeExportPolygonRepresentativeDepth,
  computePolygonAveragePoint2D,
  computeSignedPolygonArea2D,
  distanceSquared2D,
  ensureCounterClockwise,
  isPointInConvexPolygon2D,
  normalizeSplitPolygonPoints,
  roundSvgDebugNumber,
  segmentIntersectionInclusive2D,
  serializeSvgDebugPoint,
  splitConvexPolygonByLineSegment,
} from "../../../src/export/svgPolygonHelpers.ts";

/**
 * export/svgPolygonHelpers の 2D polygon 計算 helper を確認する unit test。
 */
describe("export/svgPolygonHelpers", () => {
  it("基本 helper は正常系で面積・距離・交点を返し、異常系では null / false を返す", () => {
    expect(roundSvgDebugNumber(1.23456789)).toBe(1.234568);
    expect(roundSvgDebugNumber(Number.NaN)).toBeNull();
    expect(serializeSvgDebugPoint({ x: 1.234567, y: 8.7654321 })).toEqual({
      x: 1.234567,
      y: 8.765432,
    });
    expect(
      computeSignedPolygonArea2D([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]),
    ).toBeCloseTo(0.5);
    expect(
      ensureCounterClockwise([
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 0 },
      ]),
    ).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]);
    expect(distanceSquared2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);

    expect(
      segmentIntersectionInclusive2D(
        { start: { x: 0, y: 0 }, end: { x: 2, y: 2 } },
        { start: { x: 0, y: 2 }, end: { x: 2, y: 0 } },
      )?.point,
    ).toEqual({ x: 1, y: 1 });
    expect(
      segmentIntersectionInclusive2D(
        { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
        { start: { x: 0, y: 1 }, end: { x: 1, y: 1 } },
      ),
    ).toBeNull();
    expect(
      isPointInConvexPolygon2D({ x: 0.5, y: 0.5 }, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ]),
    ).toBe(true);
    expect(isPointInConvexPolygon2D({ x: 2, y: 2 }, [{ x: 0, y: 0 }])).toBe(
      false,
    );
  });

  it("line / polygon split helper は正常系で交差点と split 結果を返し、効果なしでは元 polygon を維持する", () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    const line = { start: { x: 1, y: -1 }, end: { x: 1, y: 3 } };

    const points = collectLinePolygonIntersectionPoints(line, polygon);
    expect(points.length).toBeGreaterThanOrEqual(2);

    const split = splitConvexPolygonByLineSegment(polygon, line);
    expect(split).toHaveLength(2);
    expect(split.every((part) => part.length >= 3)).toBe(true);

    expect(
      splitConvexPolygonByLineSegment(polygon, {
        start: { x: 3, y: 0 },
        end: { x: 3, y: 2 },
      }),
    ).toEqual([polygon]);
  });

  it("normalize / depth / clip / average は正常系で値を返し、異常系では空や fallback を返す", () => {
    expect(
      normalizeSplitPolygonPoints([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]),
    ).toHaveLength(3);
    expect(
      normalizeSplitPolygonPoints([
        { x: 0, y: 0 },
        { x: 0.000001, y: 0 },
        { x: 0, y: 0.000001 },
      ]),
    ).toEqual([]);

    expect(
      computeExportPolygonRepresentativeDepth(
        [{ cameraZ: -2 }, { cameraZ: -1 }],
        0,
      ),
    ).toBe(-1);
    expect(computeExportPolygonRepresentativeDepth([], 5)).toBe(5);
    expect(
      computeExportPolygonBackDepth([{ cameraZ: -2 }, { cameraZ: -1 }], 0),
    ).toBe(-2);
    expect(computeExportPolygonBackDepth([], 6)).toBe(6);

    expect(
      clipConvexPolygon2D(
        [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 2, y: 2 },
          { x: 0, y: 2 },
        ],
        [
          { x: 1, y: -1 },
          { x: 3, y: -1 },
          { x: 3, y: 3 },
          { x: 1, y: 3 },
        ],
      ).length,
    ).toBeGreaterThanOrEqual(3);

    expect(
      computePolygonAveragePoint2D([
        { x: 0, y: 0, cameraZ: -1 },
        { x: 2, y: 0, cameraZ: -3 },
      ]),
    ).toEqual({ x: 1, y: 0, cameraZ: -2 });
  });

  it("applyLocalOverlapDepthSort は正常系で front/back の順を決め、異常系寄りの単独 polygon ではそのまま返す", () => {
    const polygons = [
      {
        points2d: [
          { x: 0, y: 0, cameraZ: -2 },
          { x: 2, y: 0, cameraZ: -2 },
          { x: 0, y: 2, cameraZ: -2 },
        ],
      },
      {
        points2d: [
          { x: 0, y: 0, cameraZ: -1 },
          { x: 2, y: 0, cameraZ: -1 },
          { x: 0, y: 2, cameraZ: -1 },
        ],
      },
    ];
    const sorted = applyLocalOverlapDepthSort(polygons);
    expect(sorted.polygons).toHaveLength(2);
    expect(sorted.debug.decisivePairCount).toBeGreaterThanOrEqual(1);
    expect(applyLocalOverlapDepthSort([polygons[0]])).toEqual({
      polygons: [polygons[0]],
      debug: {
        polygonCount: 1,
        bboxCandidatePairCount: 0,
        overlapPairCount: 0,
        decisivePairCount: 0,
        ambiguousPairCount: 0,
        invalidDepthPairCount: 0,
        edgeCount: 0,
        cycleFallbackNodeCount: 0,
        reorderedPolygonCount: 0,
        samplePairs: [],
      },
    });
  });
});
