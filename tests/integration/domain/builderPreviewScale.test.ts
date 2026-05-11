import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildTwinMeshData } from "../../../src/domain/builder.ts";
import { createDefaultTwinParameters } from "../../../src/domain/parameters.ts";

/**
 * domain/builder の preview 用 meshData 座標系を確認する integration test。
 *
 * 距離指定では、等価面グループを折り畳んだ状態でまとめて距離変更すると
 * raw geometry 全体が拡大縮小する場合がある。preview meshData は最終 model size
 * と同じ座標系へ正規化し、軸ガイドだけが raw scale に引きずられないようにする。
 */
describe("domain/builder preview scale", () => {
  function axisGuideLengthForUniformDistance(distance: number) {
    const parameters = createDefaultTwinParameters();
    parameters.faces = parameters.faces.map((face) => ({
      ...face,
      distance,
    }));
    parameters.twin.crystals[0].faces = parameters.twin.crystals[0].faces.map(
      (face) => ({
        ...face,
        distance,
      }),
    );

    const result = buildTwinMeshData(parameters);
    const axisGuide = result.crystalPreviewMeshData?.[0]?.axisGuides?.find(
      (axis) => axis.label === "a",
    );
    expect(axisGuide).toBeTruthy();

    return new THREE.Vector3(
      axisGuide!.end.x - axisGuide!.start.x,
      axisGuide!.end.y - axisGuide!.start.y,
      axisGuide!.end.z - axisGuide!.start.z,
    ).length();
  }

  it("全等価面の距離を同倍率で変えても preview 軸ガイド長は変わらない", () => {
    const baseline = axisGuideLengthForUniformDistance(1);
    const scaled = axisGuideLengthForUniformDistance(2);

    expect(scaled).toBeCloseTo(baseline, 6);
  });
});
