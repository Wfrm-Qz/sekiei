import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createDefaultTwinPreviewStyleSettings } from "../../../src/preview/previewStyleSettings.ts";
import {
  applyBoundaryLineExportStyle,
  collectBlockingExportEdgeKeys,
  collectPreviewExportLines,
  getBoundaryExportLineCategory,
  resolveHiddenLineStrokeColor,
} from "../../../src/export/previewExportLines.ts";

describe("export/previewExportLines", () => {
  function hasNamedAncestor(object: THREE.Object3D | null, name: string) {
    let current = object?.parent ?? null;
    while (current) {
      if (current.name === name) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  it("resolveHiddenLineStrokeColor は same/custom/tinted を解決する", () => {
    expect(resolveHiddenLineStrokeColor("same-as-front", "#123456")).toBe(
      "#123456",
    );
    expect(resolveHiddenLineStrokeColor("custom", "#123456", "#abcdef")).toBe(
      "#abcdef",
    );
    expect(resolveHiddenLineStrokeColor("tinted", "#000000")).not.toBe(
      "#000000",
    );
  });

  it("getBoundaryExportLineCategory は occludedInterior と intersection を判定できる", () => {
    const root = new THREE.Group();
    const ridgeGroup = new THREE.Group();
    ridgeGroup.name = "preview-ridge-lines";
    const segmentKind = new THREE.Group();
    segmentKind.userData.previewRidgeSegmentKind = "occludedInterior";
    const line = new THREE.Line();
    root.add(ridgeGroup);
    ridgeGroup.add(segmentKind);
    segmentKind.add(line);

    expect(getBoundaryExportLineCategory(hasNamedAncestor, line)).toBe(
      "ridge-occluded-interior",
    );

    const intersectionGroup = new THREE.Group();
    intersectionGroup.name = "preview-intersection-ridge-lines";
    const intersectionLine = new THREE.Line();
    root.add(intersectionGroup);
    intersectionGroup.add(intersectionLine);
    expect(
      getBoundaryExportLineCategory(hasNamedAncestor, intersectionLine),
    ).toBe("intersection");
  });

  it("applyBoundaryLineExportStyle は hidden occludedInterior に custom style を反映する", () => {
    const settings = createDefaultTwinPreviewStyleSettings();
    settings.customLineProfile.showOccludedInteriorLines = true;
    settings.customLineProfile.occludedInteriorLineColorMode = "custom";
    settings.customLineProfile.occludedInteriorLineCustomColor = "#123456";
    settings.customLineProfile.occludedInteriorLineOpacityScale = 0.25;
    settings.customLineProfile.occludedInteriorLineWidthScale = 5;

    const ridgeGroup = new THREE.Group();
    ridgeGroup.name = "preview-ridge-lines";
    const segmentKind = new THREE.Group();
    segmentKind.userData.previewRidgeSegmentKind = "occludedInterior";
    const line = new THREE.Line();
    line.userData.previewLineLayer = "hidden";
    ridgeGroup.add(segmentKind);
    segmentKind.add(line);

    const styled = applyBoundaryLineExportStyle(
      {
        previewRoot: null,
        faceDisplayMode: "custom",
        previewStyleSettings: settings,
      },
      hasNamedAncestor,
      line,
      {
        stroke: "#abcdef",
        strokeOpacity: 1,
        strokeWidth: 1,
        x1: 0,
        y1: 0,
        x2: 1,
        y2: 1,
      },
    );

    expect(styled.stroke).toBe("#123456");
    expect(styled.strokeOpacity).toBe(0.25);
    expect(styled.strokeWidth).toBe(5);
  });

  it("collectPreviewExportLines は line object を export line へ変換し hidden style を適用する", () => {
    const previewRoot = new THREE.Group();
    const ridgeGroup = new THREE.Group();
    ridgeGroup.name = "preview-ridge-lines";
    const segmentKind = new THREE.Group();
    segmentKind.userData.previewRidgeSegmentKind = "surface";
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 2, 0),
    ]);
    const line = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: "#ff0000",
        transparent: true,
        opacity: 0.6,
        depthTest: false,
      }),
    );
    line.userData.previewLineLayer = "hidden";
    ridgeGroup.add(segmentKind);
    segmentKind.add(line);
    previewRoot.add(ridgeGroup);

    const settings = createDefaultTwinPreviewStyleSettings();
    settings.customLineProfile.showHiddenSurfaceLines = true;
    settings.customLineProfile.hiddenSurfaceLineColorMode = "custom";
    settings.customLineProfile.hiddenSurfaceLineCustomColor = "#00ff00";
    settings.customLineProfile.hiddenSurfaceLineOpacityScale = 0.5;
    settings.customLineProfile.hiddenSurfaceLineWidthScale = 4;

    const lines = collectPreviewExportLines({
      state: {
        previewRoot,
        faceDisplayMode: "custom",
        previewStyleSettings: settings,
      },
      width: 100,
      height: 100,
      surface: null,
      hasNamedAncestor,
      getExportMaterial: (object) => object.material,
      collectVisibleWorldLineSegments: vi.fn(() => []),
      projectWorldPointToExport: (worldPoint) => ({
        x: worldPoint.x,
        y: worldPoint.y,
      }),
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      stroke: "#00ff00",
      strokeOpacity: 0.3,
      strokeWidth: 4,
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 2,
    });
  });

  it("collectBlockingExportEdgeKeys は line geometry から edge key を集める", () => {
    const previewRoot = new THREE.Group();
    const line = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 0, 0),
      ]),
      new THREE.LineBasicMaterial(),
    );
    const ridgeGroup = new THREE.Group();
    ridgeGroup.name = "preview-ridge-lines";
    ridgeGroup.add(line);
    previewRoot.add(ridgeGroup);

    const blocked = collectBlockingExportEdgeKeys({
      previewRoot,
      hasNamedAncestor,
    });

    expect(blocked.size).toBe(1);
  });
});
