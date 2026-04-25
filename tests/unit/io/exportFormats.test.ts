import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  EXPORT_FORMATS,
  buildExportArtifact,
  getExportFormat,
} from "../../../src/io/exportFormats.ts";

/**
 * exportFormats の format registry と fallback を確認する unit test。
 */
describe("io/exportFormats", () => {
  function createGeometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    return geometry;
  }

  it("EXPORT_FORMATS は UI 公開用の format 定義だけを持つ", () => {
    expect(EXPORT_FORMATS[0].id).toBe("stl");
    expect(EXPORT_FORMATS[0]).not.toHaveProperty("buildArtifact");
  });

  it("getExportFormat は正常系で該当 format を返し、不明 id では先頭を fallback にする", () => {
    expect(getExportFormat("stl").id).toBe("stl");
    expect(getExportFormat("unknown").id).toBe("stl");
  });

  it("buildExportArtifact は正常系で artifact を作り、不明 id でも fallback format で出力する", () => {
    const normal = buildExportArtifact("stl", createGeometry());
    const fallback = buildExportArtifact("unknown", createGeometry());

    expect(normal.extension).toBe("stl");
    expect(normal.content).toContain("solid");
    expect(fallback.id).toBe("stl");
    expect(fallback.content).toContain("solid");
  });
});
