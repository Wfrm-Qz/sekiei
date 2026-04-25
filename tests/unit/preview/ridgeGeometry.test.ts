import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createTwinRidgeGeometryActions } from "../../../src/preview/ridgeGeometry.ts";

/**
 * preview/ridgeGeometry の公開 helper を確認する smoke unit test。
 */
describe("preview/ridgeGeometry", () => {
  function createActions(shouldKeepOccludedRidgeSegments = false) {
    return createTwinRidgeGeometryActions({
      shouldKeepOccludedRidgeSegments: vi.fn(
        () => shouldKeepOccludedRidgeSegments,
      ),
    });
  }

  it("正常系として intersection segment を flat positions から復元できる", () => {
    const actions = createActions();

    const segments = actions.buildIntersectionSegments([0, 0, 0, 1, 1, 1]);

    expect(segments).toHaveLength(1);
    expect(segments[0].start).toBeInstanceOf(THREE.Vector3);
    expect(segments[0].end).toBeInstanceOf(THREE.Vector3);
  });

  it("異常系寄りとして空 positions では空配列を返す", () => {
    const actions = createActions();

    expect(actions.buildIntersectionSegments([])).toEqual([]);
  });

  it("浅い角度の near miss でも ridge split parameter を拾える", () => {
    const actions = createActions();
    const segment = {
      start: new THREE.Vector3(0, 0, 0),
      end: new THREE.Vector3(1, 0, 0),
    };
    const intersectionSegments = [
      {
        start: new THREE.Vector3(0.5, -0.2, 0.0005),
        end: new THREE.Vector3(0.5, 0.2, -0.0005),
      },
    ];

    const params = actions.collectRidgeSplitParameters(
      segment,
      intersectionSegments,
      1e-5,
    );

    expect(params.length).toBeGreaterThan(2);
    expect(params.some((value) => Math.abs(value - 0.5) < 1e-3)).toBe(true);
  });

  it("稜線データは surface と occludedInterior を分けて返し、wrapper は profile に応じて合成する", () => {
    const visibleCrystalEntries = [
      {
        meshData: {
          faces: [
            {
              vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
              ],
              normal: { x: 0, y: 0, z: 1 },
            },
          ],
        },
      },
      {
        meshData: {
          faces: [
            {
              vertices: [
                { x: -1, y: -1, z: 1 },
                { x: 2, y: -1, z: 1 },
                { x: -1, y: 2, z: 1 },
              ],
              normal: { x: 0, y: 0, z: -1 },
            },
            {
              vertices: [
                { x: -1, y: -1, z: -1 },
                { x: -1, y: 2, z: -1 },
                { x: 2, y: -1, z: -1 },
              ],
              normal: { x: 0, y: 0, z: 1 },
            },
            {
              vertices: [
                { x: -1, y: -1, z: -1 },
                { x: -1, y: -1, z: 1 },
                { x: -1, y: 2, z: -1 },
              ],
              normal: { x: -1, y: 0, z: 0 },
            },
            {
              vertices: [
                { x: 2, y: -1, z: -1 },
                { x: 2, y: 2, z: -1 },
                { x: 2, y: -1, z: 1 },
              ],
              normal: { x: 1, y: 0, z: 0 },
            },
            {
              vertices: [
                { x: -1, y: -1, z: -1 },
                { x: 2, y: -1, z: -1 },
                { x: -1, y: -1, z: 1 },
              ],
              normal: { x: 0, y: -1, z: 0 },
            },
            {
              vertices: [
                { x: -1, y: 2, z: -1 },
                { x: -1, y: 2, z: 1 },
                { x: 2, y: 2, z: -1 },
              ],
              normal: { x: 0, y: 1, z: 0 },
            },
          ],
        },
      },
    ];
    const withoutOccluded = createActions(false);
    const withOccluded = createActions(true);

    const ridgeData = withoutOccluded.buildVisibleRidgeLineData(
      visibleCrystalEntries,
      [],
    );

    expect(ridgeData.surfacePositions.length).toBeGreaterThan(0);
    expect(ridgeData.occludedInteriorPositions.length).toBeGreaterThan(0);
    expect(
      withoutOccluded.buildVisibleRidgeLinePositions(visibleCrystalEntries, []),
    ).toEqual(ridgeData.surfacePositions);
    expect(
      withOccluded.buildVisibleRidgeLinePositions(visibleCrystalEntries, [])
        .length,
    ).toBe(
      ridgeData.surfacePositions.length +
        ridgeData.occludedInteriorPositions.length,
    );
  });
});
