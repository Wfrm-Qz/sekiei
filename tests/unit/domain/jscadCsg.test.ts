import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  splitBufferGeometryByPlaneWithJscad,
  unionBufferGeometriesWithJscad,
} from "../../../src/domain/jscadCsg.ts";
import { prepareGeometryForStlExport } from "../../../src/io/formats/stl.ts";

/**
 * JSCAD CSG helper のうち、平面 2 分割が最低限 closed shell を返せるか確認する。
 */
describe("domain/jscadCsg", () => {
  it("box geometry を平面で 2 分割できる", () => {
    const source = new THREE.BoxGeometry(10, 10, 10);
    const result = splitBufferGeometryByPlaneWithJscad(
      source,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 1, 1).normalize(),
      60,
    );

    const positiveCount = result.positive?.getAttribute("position")?.count ?? 0;
    const negativeCount = result.negative?.getAttribute("position")?.count ?? 0;

    expect(positiveCount).toBeGreaterThan(0);
    expect(negativeCount).toBeGreaterThan(0);
  });

  it("複数 geometry を union した 1 geometry を返せる", () => {
    const left = new THREE.BoxGeometry(10, 10, 10);
    left.translate(-2, 0, 0);
    const right = new THREE.BoxGeometry(10, 10, 10);
    right.translate(2, 0, 0);

    const result = unionBufferGeometriesWithJscad([left, right]);
    const vertexCount = result?.getAttribute("position")?.count ?? 0;

    expect(vertexCount).toBeGreaterThan(0);
  });

  it("union 後 split した貫入双晶相当の形状でも closed shell を返せる", () => {
    const base = new THREE.BoxGeometry(30, 30, 30);
    const derived = new THREE.BoxGeometry(30, 30, 30);
    const axis = new THREE.Vector3(1, 1, 1).normalize();
    derived.applyMatrix4(
      new THREE.Matrix4().makeRotationAxis(axis, THREE.MathUtils.degToRad(60)),
    );

    const unionGeometry = unionBufferGeometriesWithJscad([base, derived]);
    expect(unionGeometry).not.toBeNull();

    const split = splitBufferGeometryByPlaneWithJscad(
      unionGeometry,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
      180,
    );

    const positivePrepared = prepareGeometryForStlExport(split.positive!);
    const negativePrepared = prepareGeometryForStlExport(split.negative!);

    expect(
      positivePrepared.debug.topologyAfterOrientation.openEdgeCount,
    ).toBe(0);
    expect(
      negativePrepared.debug.topologyAfterOrientation.openEdgeCount,
    ).toBe(0);
  });
});
