import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import contactTwinSample from "../../fixtures/domain/twin-contact-cubic.json";
import penetrationTwinSample from "../../fixtures/domain/twin-penetration-cubic.json";
import { normalizeTwinParameters } from "../../../src/domain/parameters.ts";
import { buildTwinMeshData } from "../../../src/domain/builder.ts";

vi.mock("../../../src/domain/jscadCsg.ts", () => ({
  unionMeshDataWithJscad: () => new THREE.BoxGeometry(1, 1, 1),
}));

/**
 * builder の主要な統合経路を固定する integration test。
 *
 * 接触双晶・貫入双晶・単一結晶 fallback は、仕様書と作業ログで何度も
 * 調整が入っているため、純粋関数 unit test より一段広い粒度で守る。
 */

/**
 * sample JSON を現在の parameter 形式へ正規化して返す。
 *
 * 保存互換や face id 付与も同時に通したいので、builder へ直接渡さず
 * 毎回 normalizeTwinParameters を経由する。
 */
function buildNormalizedTwinParameters(sample: unknown) {
  const cloned = structuredClone(sample) as Record<string, unknown> | null;
  const parameters =
    cloned &&
    typeof cloned === "object" &&
    cloned.schema === "sekiei-twin-preview-document-v1" &&
    "parameters" in cloned
      ? cloned.parameters
      : cloned;
  return normalizeTwinParameters(parameters);
}

/**
 * builder 結果が preview / export の両 geometry を持ち、重大エラーなしで
 * 返っていることをまとめて検証する。
 */
function expectSuccessfulTwinBuild(
  result: ReturnType<typeof buildTwinMeshData>,
) {
  expect(result.finalGeometry).not.toBeNull();
  expect(result.previewFinalGeometry).not.toBeNull();
  expect(result.metrics.maxDimensionMm).toBeGreaterThan(0);
  expect(result.validation.errors).toHaveLength(0);
}

describe("domain/builder integration", () => {
  beforeEach(() => {
    // CSG fallback や warning の console 出力は test の可読性を落とすだけなので抑制する。
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("接触双晶 sample から preview / export geometry を構築できる", () => {
    const parameters = buildNormalizedTwinParameters(contactTwinSample);

    const result = buildTwinMeshData(parameters);

    expectSuccessfulTwinBuild(result);
    expect(result.basePreviewGeometry).not.toBeNull();
    expect(result.derivedPreviewGeometry).not.toBeNull();
    expect(result.basePreviewMeshData).not.toBeNull();
    expect(result.derivedPreviewMeshData).not.toBeNull();
    expect(result.crystalPreviewGeometries).toHaveLength(2);
    expect(result.crystalPreviewMeshData).toHaveLength(2);
  });

  it("貫入双晶 sample から preview / export geometry を構築できる", () => {
    const parameters = buildNormalizedTwinParameters(penetrationTwinSample);

    const result = buildTwinMeshData(parameters);

    expectSuccessfulTwinBuild(result);
    expect(result.basePreviewGeometry).not.toBeNull();
    expect(result.derivedPreviewGeometry).not.toBeNull();
    expect(result.basePreviewMeshData).not.toBeNull();
    expect(result.derivedPreviewMeshData).not.toBeNull();
    expect(result.crystalPreviewGeometries.filter(Boolean)).toHaveLength(2);
    expect(result.crystalPreviewMeshData.filter(Boolean)).toHaveLength(2);
  });

  it("有効結晶が 1 つだけのときは fallback でも geometry を返す", () => {
    const parameters = buildNormalizedTwinParameters(contactTwinSample);
    parameters.twin.crystals[1].enabled = false;
    parameters.twin.crystals[0].faces = parameters.twin.crystals[0].faces.map(
      (face, index) =>
        index === 0
          ? {
              ...face,
              text: {
                ...(face.text ?? {}),
                content: "A",
                depth: 1,
              },
            }
          : face,
    );

    const result = buildTwinMeshData(parameters);

    expectSuccessfulTwinBuild(result);
    expect(result.basePreviewGeometry).not.toBeNull();
    expect(result.basePreviewMeshData).not.toBeNull();
    expect(result.derivedPreviewGeometry).toBeNull();
    expect(result.derivedPreviewMeshData).toBeNull();
    expect(result.crystalPreviewGeometries.filter(Boolean)).toHaveLength(1);
    expect(result.crystalPreviewMeshData.filter(Boolean)).toHaveLength(1);
    expect(result.crystalStlCompositeGeometries.filter(Boolean)).toHaveLength(
      1,
    );
    expect(result.crystalStlCompositeMeshData.filter(Boolean)).toHaveLength(1);
  });
});
