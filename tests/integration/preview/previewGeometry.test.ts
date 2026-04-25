import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createTwinPreviewGeometryActions } from "../../../src/preview/previewGeometry.ts";

describe("preview/previewGeometry", () => {
  it("preview geometry actions は軸 segment と表示 geometry をまとめて構築できる", () => {
    const actions = createTwinPreviewGeometryActions({
      state: {
        faceDisplayMode: "solid",
        parameters: { crystalSystem: "cubic" },
      },
      getCrystalAccentColor: () => "#d35b53",
      createWireframeFromPositionAttribute: (positionAttribute) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", positionAttribute);
        return new THREE.LineSegments(
          geometry,
          new THREE.LineBasicMaterial({ color: 0xffffff }),
        );
      },
    });

    const meshData = {
      positions: [0, 0, 0, 2, 0, 0, 0, 2, 0],
      faceVertexCounts: [{ id: "face-1", vertexCount: 3 }],
      faces: [
        {
          id: "face-1",
          normal: { x: 0, y: 0, z: 1 },
          vertices: [
            { x: -1, y: -1, z: 0 },
            { x: 1, y: -1, z: 0 },
            { x: 0, y: 1, z: 0 },
          ],
        },
      ],
    };

    const geometry = actions.buildDisplayGeometry(meshData, [{ id: "face-1" }]);
    const wireframe = actions.createWireframeFromGeometry(geometry!);
    const inner = actions.buildAxisInnerSegment(
      {
        start: { x: 0, y: 0, z: -2 },
        end: { x: 0, y: 0, z: 2 },
      },
      meshData.faces,
    );

    expect(geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(wireframe).toBeInstanceOf(THREE.Object3D);
    expect(inner).not.toBeNull();
  });

  it("不完全な入力では安全に null / 空配列へ寄る", () => {
    const actions = createTwinPreviewGeometryActions({
      state: {
        faceDisplayMode: "solid",
        parameters: { crystalSystem: "cubic" },
      },
      getCrystalAccentColor: () => "#d35b53",
      createWireframeFromPositionAttribute: () => new THREE.Group(),
    });

    expect(actions.buildDisplayGeometry(null, [])).toBeNull();
    expect(actions.buildAxisOuterSegments({}, [])).toEqual([]);
    expect(actions.buildAxisInnerSegment({}, [])).toBeNull();
  });
});
