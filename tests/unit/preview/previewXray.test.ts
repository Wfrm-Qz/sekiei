import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createDefaultEditableTwinPreviewLineProfile,
  resolveTwinPreviewLineProfile,
} from "../../../src/preview/previewProfiles.ts";
import {
  createTwinPreviewLineActions,
  createTwinXrayPreviewStateActions,
} from "../../../src/preview/previewXray.ts";

/**
 * previewXray module の line factory と xray state の回帰を防ぐ unit test。
 */
describe("preview/previewXray", () => {
  function createPreviewStage() {
    const previewStage = document.createElement("div");
    Object.defineProperty(previewStage, "clientWidth", {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(previewStage, "clientHeight", {
      configurable: true,
      value: 360,
    });
    return previewStage;
  }

  function createBaseXrayContext(faceDisplayMode: string) {
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    const state = {
      faceDisplayMode,
      parameters: {
        crystalSystem: "cubic",
      },
      previewXraySortDebugFrame: 0,
      previewRoot: new THREE.Group(),
    };

    const actions = createTwinXrayPreviewStateActions({
      state,
      camera,
      getCrystalAccentColor: (crystalIndex) =>
        crystalIndex === 0 ? "#ff0000" : "#0000ff",
    });

    return { camera, state, actions };
  }

  it("通常表示では wide line を単層 object として作る", () => {
    const actions = createTwinPreviewLineActions({
      elements: { previewStage: createPreviewStage() },
      getPreviewLineProfile: () => resolveTwinPreviewLineProfile("grouped"),
    });

    const line = actions.createWideLineFromPoints(
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)],
      0xff0000,
      1,
      true,
      1,
    );

    expect(line).toBeInstanceOf(THREE.Object3D);
    expect(line).not.toBeInstanceOf(THREE.Group);
  });

  it("xray 表示では wide line を hidden/front の 2 層 group として作る", () => {
    const actions = createTwinPreviewLineActions({
      elements: { previewStage: createPreviewStage() },
      getPreviewLineProfile: () => resolveTwinPreviewLineProfile("xray-solid"),
    });

    const line = actions.createWideLineFromPoints(
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)],
      0xff0000,
      1,
      true,
      8,
    );

    expect(line).toBeInstanceOf(THREE.Group);
    const layers = (line as THREE.Group).children.map(
      (child) => child.userData.previewLineLayer,
    );
    expect(layers).toEqual(["hidden", "front"]);
  });

  it("transparent 相当の線表示では hidden/front の 2 層 group を作り、hidden 色は使わない", () => {
    const actions = createTwinPreviewLineActions({
      elements: { previewStage: createPreviewStage() },
      getPreviewLineProfile: () => resolveTwinPreviewLineProfile("transparent"),
    });

    const line = actions.createWideLineFromPoints(
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)],
      0xff0000,
      1,
      true,
      2,
    );

    expect(line).toBeInstanceOf(THREE.Group);
    const layers = (line as THREE.Group).children.map(
      (child) => child.userData.previewLineLayer,
    );
    expect(layers).toEqual(["hidden", "front"]);
    const hiddenMaterial = (line as THREE.Group).children[0]
      .material as THREE.Material & {
      color?: THREE.Color;
      opacity?: number;
    };
    const frontMaterial = (line as THREE.Group).children[1]
      .material as THREE.Material & {
      color?: THREE.Color;
      opacity?: number;
    };
    expect(hiddenMaterial.color?.getHex()).toBe(frontMaterial.color?.getHex());
    expect(hiddenMaterial.opacity).toBeLessThan(frontMaterial.opacity ?? 0);
  });

  it("xray line depth mask は mesh ごとに mask mesh を作る", () => {
    const actions = createTwinPreviewLineActions({
      elements: { previewStage: createPreviewStage() },
      getPreviewLineProfile: () => resolveTwinPreviewLineProfile("xray-solid"),
    });

    const sourceGroup = new THREE.Group();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    sourceGroup.add(mesh);

    const maskGroup = actions.createXrayLineDepthMaskGroup(sourceGroup);

    expect(maskGroup).toBeInstanceOf(THREE.Group);
    expect(maskGroup?.children).toHaveLength(1);
    expect(maskGroup?.children[0].name).toBe("xray-line-depth-mask-mesh");
  });

  it("transparent 相当の線表示でも depth mask mesh を作る", () => {
    const actions = createTwinPreviewLineActions({
      elements: { previewStage: createPreviewStage() },
      getPreviewLineProfile: () => resolveTwinPreviewLineProfile("transparent"),
    });

    const sourceGroup = new THREE.Group();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    sourceGroup.add(mesh);

    const maskGroup = actions.createXrayLineDepthMaskGroup(sourceGroup);

    expect(maskGroup).toBeInstanceOf(THREE.Group);
    expect(maskGroup?.children).toHaveLength(1);
  });

  it("layered 3D 線でも occludedInterior は hiddenSurface と別 opacity/width を使う", () => {
    const customLine = createDefaultEditableTwinPreviewLineProfile();
    customLine.useLayeredLines = true;
    customLine.hiddenSurfaceLineOpacityScale = 0.9;
    customLine.hiddenSurfaceLineWidthScale = 2;
    customLine.occludedInteriorLineOpacityScale = 0.3;
    customLine.occludedInteriorLineWidthScale = 1;
    customLine.occludedInteriorLineColorMode = "same-as-front";
    customLine.hiddenSurfaceLineColorMode = "same-as-front";

    const actions = createTwinPreviewLineActions({
      elements: { previewStage: createPreviewStage() },
      getPreviewLineProfile: () =>
        resolveTwinPreviewLineProfile("custom", customLine),
    });

    const line = actions.createWireframeFromPositions([0, 0, 0, 1, 0, 0], {
      color: 0xff0000,
      opacity: 1,
      linewidth: 2,
      lineKind: "ridge",
      ridgeSegmentKind: "occludedInterior",
    }) as THREE.Group;
    const hiddenMaterial = line.children[0].material as THREE.Material & {
      opacity?: number;
      linewidth?: number;
    };
    expect(line.children).toHaveLength(1);
    expect(line.children[0].userData.previewLineLayer).toBe("hidden");
    expect(hiddenMaterial.opacity).toBeCloseTo(0.3);
    expect(hiddenMaterial.linewidth).toBeCloseTo(1);
  });

  it("layered 3D 線では custom hidden color も使える", () => {
    const customLine = createDefaultEditableTwinPreviewLineProfile();
    customLine.useLayeredLines = true;
    customLine.hiddenSurfaceLineColorMode = "custom";
    customLine.hiddenSurfaceLineCustomColor = "#123456";

    const actions = createTwinPreviewLineActions({
      elements: { previewStage: createPreviewStage() },
      getPreviewLineProfile: () =>
        resolveTwinPreviewLineProfile("custom", customLine),
    });

    const line = actions.createWireframeFromPositions([0, 0, 0, 1, 0, 0], {
      color: 0xff0000,
      opacity: 1,
      linewidth: 2,
      lineKind: "ridge",
      ridgeSegmentKind: "surface",
    }) as THREE.Group;

    const hiddenMaterial = line.children[0].material as THREE.Material & {
      color?: THREE.Color;
    };
    expect(hiddenMaterial.color?.getHexString()).toBe("123456");
  });

  it("non-layered では showFrontLines=false の surface ridge を作らない", () => {
    const customLine = createDefaultEditableTwinPreviewLineProfile();
    customLine.useLayeredLines = false;
    customLine.showFrontLines = false;

    const actions = createTwinPreviewLineActions({
      elements: { previewStage: createPreviewStage() },
      getPreviewLineProfile: () =>
        resolveTwinPreviewLineProfile("custom", customLine),
    });

    const line = actions.createWireframeFromPositions([0, 0, 0, 1, 0, 0], {
      color: 0xff0000,
      opacity: 1,
      linewidth: 2,
      lineKind: "ridge",
      ridgeSegmentKind: "surface",
    });

    expect(line).toBeNull();
  });

  it("non-layered では showFrontLines=false の intersection も作らない", () => {
    const customLine = createDefaultEditableTwinPreviewLineProfile();
    customLine.useLayeredLines = false;
    customLine.showFrontLines = false;

    const actions = createTwinPreviewLineActions({
      elements: { previewStage: createPreviewStage() },
      getPreviewLineProfile: () =>
        resolveTwinPreviewLineProfile("custom", customLine),
    });

    const line = actions.createWireframeFromPositions([0, 0, 0, 1, 0, 0], {
      color: 0xff0000,
      opacity: 1,
      linewidth: 2,
      lineKind: "intersection",
    });

    expect(line).toBeNull();
  });

  it("non-layered でも occludedInterior は showOccludedInteriorLines=true なら作る", () => {
    const customLine = createDefaultEditableTwinPreviewLineProfile();
    customLine.useLayeredLines = false;
    customLine.showFrontLines = false;
    customLine.showOccludedInteriorLines = true;

    const actions = createTwinPreviewLineActions({
      elements: { previewStage: createPreviewStage() },
      getPreviewLineProfile: () =>
        resolveTwinPreviewLineProfile("custom", customLine),
    });

    const line = actions.createWireframeFromPositions([0, 0, 0, 1, 0, 0], {
      color: 0xff0000,
      opacity: 1,
      linewidth: 2,
      lineKind: "ridge",
      ridgeSegmentKind: "occludedInterior",
    });

    expect(line).not.toBeNull();
  });

  it("grouped/solid に応じて xray face opacity を切り替える", () => {
    const grouped = createBaseXrayContext("xray-grouped");
    const solid = createBaseXrayContext("xray-solid");

    expect(grouped.actions.getXrayPreviewFaceOpacity(true)).toBe(0.58);
    expect(solid.actions.getXrayPreviewFaceOpacity(true)).toBe(0.28);
    expect(solid.actions.getXrayPreviewFaceOpacity(false)).toBe(0.45);
  });

  it("xray-grouped では等価面 group color を face ごとに返す", () => {
    const { actions } = createBaseXrayContext("xray-grouped");
    const sourceFaces = [
      { id: "face-a", h: 1, k: 0, l: 0, enabled: true, coefficient: 1 },
      { id: "face-b", h: 0, k: 1, l: 0, enabled: true, coefficient: 1 },
    ];

    const colorA = actions.resolveXrayPreviewFaceColor(
      "face-a",
      sourceFaces,
      0,
    );
    const colorB = actions.resolveXrayPreviewFaceColor(
      "face-b",
      sourceFaces,
      0,
    );

    expect(colorA).toBe(colorB);
  });

  it("xray mesh state は depthWrite を無効化して renderOrder をそろえる", () => {
    const { actions } = createBaseXrayContext("xray-solid");
    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial(),
    );

    actions.applyXrayPreviewMeshState(mesh);

    expect((mesh.material as THREE.Material).depthWrite).toBe(false);
    expect(mesh.renderOrder).toBe(4);
  });

  it("xray transparent face は cameraZ 順に renderOrder を並べ替える", () => {
    const { state, actions } = createBaseXrayContext("xray-solid");
    const root = new THREE.Group();

    const farMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial(),
    );
    farMesh.userData.xrayTransparentFace = true;
    farMesh.userData.xrayFaceCenter = new THREE.Vector3(0, 0, -2);
    farMesh.userData.xrayFaceNormal = new THREE.Vector3(0, 0, 1);

    const nearMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial(),
    );
    nearMesh.userData.xrayTransparentFace = true;
    nearMesh.userData.xrayFaceCenter = new THREE.Vector3(0, 0, 0);
    nearMesh.userData.xrayFaceNormal = new THREE.Vector3(0, 0, 1);

    root.add(farMesh);
    root.add(nearMesh);
    state.previewRoot = root;

    actions.updateXrayTransparentFaceRenderOrder(root);

    expect(farMesh.renderOrder).toBeLessThan(nearMesh.renderOrder);
    expect(state.previewRoot.userData.xraySortDebug.meshCount).toBe(2);
  });
});
