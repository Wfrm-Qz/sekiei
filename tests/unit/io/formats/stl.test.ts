import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { prepareGeometryForStlExport } from "../../../../src/io/formats/stl.ts";

/**
 * STL 出力前の geometry 正規化を固定する unit test。
 *
 * 貫入双晶の CSG 後 geometry では、退化三角形や微小 seam が slicer 側で
 * 穴として見えることがあるため、STL 専用前処理の契約をここで守る。
 */
describe("io/formats/stl", () => {
  it("退化三角形を除去して STL 用 geometry を返す", () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          // 有効 triangle
          0, 0, 0, 1, 0, 0, 0, 1, 0,
          // 退化 triangle
          0, 0, 0, 0, 0, 0, 0, 0, 0,
        ],
        3,
      ),
    );

    const prepared = prepareGeometryForStlExport(geometry);

    expect(prepared.debug.sourceTriangleCount).toBe(2);
    expect(prepared.debug.droppedTriangleCount).toBe(1);
    expect(prepared.debug.exportedTriangleCount).toBe(1);
    expect(prepared.geometry.getAttribute("position")?.count).toBe(3);
  });

  it("微小にずれた頂点を weld して indexed vertex 数を減らせる", () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          0, 0, 0, 1, 0, 0, 0, 1, 0, 0.0000002, 0, 0, 1.0000001, 0, 0, 0,
          1.0000001, 0,
        ],
        3,
      ),
    );

    const prepared = prepareGeometryForStlExport(geometry);

    expect(prepared.debug.sourceTriangleCount).toBe(2);
    expect(prepared.debug.droppedTriangleCount).toBe(0);
    expect(prepared.debug.indexedVertexCount).toBeLessThan(6);
    expect(prepared.debug.exportedTriangleCount).toBe(2);
  });

  it("隣接 triangle の winding がそろっていない場合でも export 前に整列できる", () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          // 1 枚目
          0, 0, 0, 1, 0, 0, 0, 1, 0,
          // 2 枚目: 共有辺 (1,0,0) -> (0,1,0) を 1 枚目と同じ向きで持つ
          1, 0, 0, 0, 1, 0, 1, 1, 0,
        ],
        3,
      ),
    );

    const prepared = prepareGeometryForStlExport(geometry);

    expect(
      prepared.debug.orientationRepair.locallyFlippedTriangleCount,
    ).toBeGreaterThanOrEqual(1);
    expect(prepared.debug.topologyAfterOrientation.multiOwnerEdgeCount).toBe(0);
  });
});
