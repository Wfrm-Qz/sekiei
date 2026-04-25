import * as THREE from "three";
import fs from "node:fs/promises";
import path from "node:path";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { describe, expect, it } from "vitest";
import leftQuartzDocument from "../../fixtures/face-text/leftQuartz.withText.v2.json";
import helvetikerFontJson from "../../../assets/fonts/helvetiker_regular.typeface.json";
import { normalizeTwinParameters } from "../../../src/domain/parameters.ts";
import { buildCrystalStlCompositeMeshData } from "../../../src/geometry/crystalGeometry.ts";
import { buildTwinMeshData } from "../../../src/domain/builder.ts";
import { buildThreeGeometry } from "../../../src/io/exporters.ts";
import { prepareGeometryForStlExport } from "../../../src/io/formats/stl.ts";

const mockFont = {
  generateShapes: () => [
    {
      getPoints: () => [
        { x: -0.8, y: -0.6 },
        { x: 0.8, y: -0.6 },
        { x: 0.8, y: 0.6 },
        { x: -0.8, y: 0.6 },
        { x: -0.8, y: -0.6 },
      ],
      holes: [],
    },
  ],
};
const actualFont = new FontLoader().parse(helvetikerFontJson);

function getGeometryMaxDimension(geometry: THREE.BufferGeometry | null) {
  if (!geometry) {
    return 0;
  }
  geometry.computeBoundingBox();
  const size = geometry.boundingBox?.getSize(new THREE.Vector3());
  if (!size) {
    return 0;
  }
  return Math.max(size.x, size.y, size.z, 0);
}

function mergeGeometriesForStlExport(
  geometries: (THREE.BufferGeometry | null | undefined)[],
) {
  const mergedPositions: number[] = [];
  geometries.filter(Boolean).forEach((geometry) => {
    if (!geometry) {
      return;
    }
    const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    const positionAttribute = source.getAttribute("position");
    if (!positionAttribute) {
      return;
    }
    mergedPositions.push(...positionAttribute.array);
  });

  if (mergedPositions.length === 0) {
    return null;
  }

  const mergedGeometry = new THREE.BufferGeometry();
  mergedGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(mergedPositions, 3),
  );
  mergedGeometry.computeVertexNormals();
  mergedGeometry.computeBoundingBox();
  mergedGeometry.computeBoundingSphere();
  return mergedGeometry;
}

describe("domain/builder face text STL groundwork", () => {
  it("左水晶 fixture の各 active crystal から closed-shell ベースの STL 候補を作れる", () => {
    const normalized = normalizeTwinParameters(leftQuartzDocument);
    const activeCrystals = normalized.twin.crystals.filter(
      (crystal, index) => index === 0 || crystal.enabled !== false,
    );

    const candidates = activeCrystals.map((crystal) => {
      const crystalParameters = {
        ...normalized,
        faces: structuredClone(crystal.faces),
      };
      return buildCrystalStlCompositeMeshData(crystalParameters, {
        normalizeSize: false,
        resolveFaceTextFont: () => mockFont,
      });
    });

    expect(candidates.length).toBe(activeCrystals.length);
    candidates.forEach((candidate) => {
      expect(candidate.geometry).toBeTruthy();
      expect(candidate.textShells.length).toBeGreaterThan(0);
      if (!candidate.geometry) {
        throw new Error("crystal STL composite candidate が null です");
      }

      const prepared = prepareGeometryForStlExport(
        buildThreeGeometry(candidate.geometry),
      );
      const topology = prepared.debug.topologyAfterOrientation;
      expect(topology.openEdgeCount).toBeLessThanOrEqual(8);
    });
  });

  it("左水晶 fixture の双晶 build result は比較用 composite geometry 群も保持する", () => {
    const normalized = normalizeTwinParameters(leftQuartzDocument);
    const buildResult = buildTwinMeshData(normalized, {
      resolveFaceTextFont: () => mockFont,
    });

    expect(buildResult.crystalPreviewGeometries.length).toBeGreaterThan(0);
    expect(buildResult.crystalStlCompositeGeometries.length).toBeGreaterThan(0);
    expect(buildResult.crystalStlCompositeGeometries.some(Boolean)).toBe(true);
  });

  it("左水晶 fixture の双晶では fallback candidate と composite candidate の topology を比較できる", async () => {
    const normalized = normalizeTwinParameters(leftQuartzDocument);
    const buildResult = buildTwinMeshData(normalized, {
      resolveFaceTextFont: () => actualFont,
    });

    expect(buildResult.previewFinalGeometry).toBeTruthy();
    expect(buildResult.finalGeometry).toBeTruthy();
    const previewMaxDimension = getGeometryMaxDimension(
      buildResult.previewFinalGeometry,
    );
    const finalMaxDimension = getGeometryMaxDimension(
      buildResult.finalGeometry,
    );
    const scaleFactor =
      previewMaxDimension > 0 ? finalMaxDimension / previewMaxDimension : 1;

    const fallbackGeometry = mergeGeometriesForStlExport(
      (buildResult.crystalPreviewGeometries ?? []).map((geometry) => {
        if (!geometry) {
          return null;
        }
        const clone = geometry.clone();
        clone.scale(scaleFactor, scaleFactor, scaleFactor);
        clone.computeVertexNormals();
        clone.computeBoundingBox();
        clone.computeBoundingSphere();
        return clone;
      }),
    );
    const compositeGeometry = mergeGeometriesForStlExport(
      (buildResult.crystalStlCompositeGeometries ?? []).map((geometry) => {
        if (!geometry) {
          return null;
        }
        const clone = geometry.clone();
        clone.scale(scaleFactor, scaleFactor, scaleFactor);
        clone.computeVertexNormals();
        clone.computeBoundingBox();
        clone.computeBoundingSphere();
        return clone;
      }),
    );

    expect(fallbackGeometry).toBeTruthy();
    expect(compositeGeometry).toBeTruthy();
    if (!fallbackGeometry || !compositeGeometry) {
      throw new Error("比較用 STL geometry を作れませんでした");
    }

    const fallbackTopology =
      prepareGeometryForStlExport(fallbackGeometry).debug
        .topologyAfterOrientation;
    const compositeTopology =
      prepareGeometryForStlExport(compositeGeometry).debug
        .topologyAfterOrientation;
    const summary = {
      fallbackTopology,
      compositeTopology,
    };
    await fs.mkdir(path.join(process.cwd(), "test-results"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(
        process.cwd(),
        "test-results",
        "leftQuartz-twin-stl-comparison.json",
      ),
      JSON.stringify(summary, null, 2),
      "utf8",
    );

    expect(fallbackTopology).toBeTruthy();
    expect(compositeTopology).toBeTruthy();
  });
});
