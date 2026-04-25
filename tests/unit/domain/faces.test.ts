import { describe, expect, it } from "vitest";
import {
  createDefaultFacesForSystem,
  createFace,
  createMissingEquivalentFaces,
  getEquivalentFaceGroupKey,
  normalizeFaceForSystem,
} from "../../../src/domain/faces.ts";

/**
 * 面定義と等価面軌道の基礎ロジックを確認する unit test。
 *
 * 面一覧の grouping、等価面追加、結晶系ごとの初期面セットは
 * この module に依存するため、結晶系別の代表ケースをここで固定する。
 */
describe("domain/faces", () => {
  it("createFace は id と text 既定値を含む face を返す", () => {
    const face = createFace({ h: 2 });

    expect(typeof face.id).toBe("string");
    expect(face.h).toBe(2);
    expect(face.text.fontId).toBe("helvetiker");
  });

  it("4 指数系では i を -(h + k) に正規化する", () => {
    const face = normalizeFaceForSystem(
      createFace({ h: 1, k: 2, i: 99, l: 0 }),
      "hexagonal",
    );

    expect(face.i).toBe(-3);
  });

  it("立方晶系では等価な面が同じ group key を持つ", () => {
    const faceA = normalizeFaceForSystem(
      createFace({ h: 1, k: 0, l: 0 }),
      "cubic",
    );
    const faceB = normalizeFaceForSystem(
      createFace({ h: 0, k: 1, l: 0 }),
      "cubic",
    );

    expect(getEquivalentFaceGroupKey(faceA, "cubic")).toBe(
      getEquivalentFaceGroupKey(faceB, "cubic"),
    );
  });

  it("既存面にあるものと元面自身を除いて不足等価面だけ返す", () => {
    const source = normalizeFaceForSystem(
      createFace({ h: 1, k: 0, l: 0 }),
      "cubic",
    );
    const existing = [
      source,
      normalizeFaceForSystem(createFace({ h: -1, k: 0, l: 0 }), "cubic"),
    ];

    const missing = createMissingEquivalentFaces(existing, source, "cubic");
    const faceKeys = missing.map((face) => `${face.h},${face.k},${face.l}`);

    expect(missing).toHaveLength(4);
    expect(faceKeys).toEqual(
      expect.arrayContaining(["0,1,0", "0,-1,0", "0,0,1", "0,0,-1"]),
    );
  });

  it("単斜晶系では 0,1,0 と 0,-1,0 を同じ等価面 group として扱う", () => {
    const faceA = normalizeFaceForSystem(
      createFace({ h: 0, k: 1, l: 0 }),
      "monoclinic",
    );
    const faceB = normalizeFaceForSystem(
      createFace({ h: 0, k: -1, l: 0 }),
      "monoclinic",
    );

    expect(getEquivalentFaceGroupKey(faceA, "monoclinic")).toBe(
      getEquivalentFaceGroupKey(faceB, "monoclinic"),
    );
  });

  it("三斜晶系では 0,0,1 と 0,0,-1 を同じ等価面 group として扱う", () => {
    const faceA = normalizeFaceForSystem(
      createFace({ h: 0, k: 0, l: 1 }),
      "triclinic",
    );
    const faceB = normalizeFaceForSystem(
      createFace({ h: 0, k: 0, l: -1 }),
      "triclinic",
    );

    expect(getEquivalentFaceGroupKey(faceA, "triclinic")).toBe(
      getEquivalentFaceGroupKey(faceB, "triclinic"),
    );
  });

  it("初期面セットは crystal system ごとの代表 faces を返す", () => {
    expect(createDefaultFacesForSystem("trigonal")).toHaveLength(6);
    expect(createDefaultFacesForSystem("hexagonal")).toHaveLength(8);
  });

  it("未知の crystal system では立方体型の 6 面を返す", () => {
    expect(createDefaultFacesForSystem("unknown")).toHaveLength(6);
  });
});
