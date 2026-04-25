import { describe, expect, it } from "vitest";
import { buildXrayLineDebugSummary } from "../../../src/preview/previewLineDebug.ts";

describe("preview/previewLineDebug", () => {
  it("surface と occludedInterior を分けた交差 debug summary を返す", () => {
    const summary = buildXrayLineDebugSummary(
      {
        surfacePositions: [0, 0, 0, 2, 0, 0],
        occludedInteriorPositions: [1, 0, 0, 1, 1, 0],
      },
      [1, -1, 0, 1, 2, 0],
      "custom",
    );

    expect(summary.schema).toBe("twin-preview-line-debug-v1");
    expect(summary.faceDisplayMode).toBe("custom");
    expect(summary.ridgeSegmentCount).toBe(2);
    expect(summary.occludedInteriorSegmentCount).toBe(1);
    expect(summary.intersectionSegmentCount).toBe(1);
    expect(summary.surface.ridgeSegmentCount).toBe(1);
    expect(summary.occludedInterior.ridgeSegmentCount).toBe(1);
    expect(summary.surface.ridgeSegmentsStillCrossingCount).toBe(1);
    expect(summary.occludedInterior.ridgeEndpointsNearIntersectionCount).toBe(
      2,
    );
  });
});
