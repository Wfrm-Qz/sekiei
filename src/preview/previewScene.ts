import * as THREE from "three";
import { getEquivalentFaceGroupKey, usesFourAxisMiller } from "../constants.js";
import { twinAxisDirection, twinPlaneNormal } from "../domain/crystalFrame.js";
import {
  buildIndexLabelParts,
  invertIndexLabelParts,
} from "./previewLabels.js";
import {
  resolveTwinPreviewResponsiveFontSizePx,
  resolveTwinAxisStyleKey,
  type TwinPreviewStyleSettings,
} from "./previewStyleSettings.js";
import {
  getGuideCrystalIndex,
  getTwinCrystalFaces,
  getTwinCrystals,
  isTwinEnabled,
  twinRuleTypeForTwinType,
} from "../state/stateHelpers.js";
import type { TwinStlSplitSettings } from "../state/stlSplitSettings.js";
import {
  resolveTwinPreviewFaceBaseColor,
  resolveTwinPreviewFaceOpacity,
  resolveTwinPreviewFaceProfile,
  resolveTwinPreviewLineProfile,
} from "./previewProfiles.js";
import { buildXrayLineDebugSummary } from "./previewLineDebug.js";

/**
 * 双晶 preview scene の object 構築を `main.ts` から切り離す module。
 *
 * ここでは preview mesh / 稜線 / 軸ガイド / 双晶則ガイド / pick target の組み立てを扱い、
 * scene への差し替えや camera/view state の保持は entry 側へ残す。
 */

interface PreviewVertexLike {
  x: number;
  y: number;
  z: number;
}

interface PreviewFaceLike {
  id?: string | null;
  coefficient?: number;
  normal?: PreviewVertexLike;
  vertices?: PreviewVertexLike[];
  textUpVector?: PreviewVertexLike;
  text?: {
    content?: string;
    fontId?: string;
    fontSize?: number;
    depth?: number;
    offsetU?: number;
    offsetV?: number;
    rotationDeg?: number;
  } | null;
}

interface PreviewAxisGuideLike {
  label?: string;
  color?: number | string;
}

interface PreviewMeshDataLike {
  vertices?: PreviewVertexLike[];
  faces?: PreviewFaceLike[];
  axisGuides?: PreviewAxisGuideLike[];
}

interface PreviewCrystalLike {
  enabled?: boolean;
  twinType?: string;
  from?: number;
  axis?: unknown;
  contact?: {
    baseFaceRef?: string | null;
    derivedFaceRef?: string | null;
  } | null;
  id?: string | null;
}

interface PreviewParametersLike {
  crystalSystem: string;
  axes?: {
    a?: number | string;
    b?: number | string;
    c?: number | string;
  } | null;
  angles?: {
    alpha?: number | string;
    beta?: number | string;
    gamma?: number | string;
  } | null;
  twin?: {
    enabled?: boolean;
    crystals?: PreviewCrystalLike[];
  } | null;
}

interface PreviewDomAnchorLike {
  element: HTMLElement;
  [key: string]: unknown;
}

/** preview scene builder が参照する最小限の state。 */
export interface TwinPreviewSceneStateLike {
  parameters: PreviewParametersLike;
  stlSplit: TwinStlSplitSettings;
  buildResult: {
    previewFinalGeometry?: THREE.BufferGeometry | null;
    finalGeometry?: THREE.BufferGeometry | null;
    crystalPreviewMeshData?: PreviewMeshDataLike[];
    basePreviewMeshData?: PreviewMeshDataLike;
  } | null;
  previewRoot: THREE.Group | null;
  activeFaceCrystalIndex: number;
  axisGuideGroup: THREE.Group | null;
  splitPlaneGuideGroup: THREE.Group | null;
  twinRuleGuideGroup: THREE.Group | null;
  facePickTargetGroup: THREE.Group | null;
  facePickTargets: THREE.Object3D[];
  ridgeLines: THREE.Object3D | null;
  intersectionRidgeLines: THREE.Object3D | null;
  faceLabelAnchors: PreviewDomAnchorLike[];
  axisLabelAnchors: PreviewDomAnchorLike[];
  twinRuleLabelAnchors: PreviewDomAnchorLike[];
  faceDisplayMode: string;
  previewStyleSettings?: TwinPreviewStyleSettings;
  showRidgeLines: boolean;
  showIntersectionRidgeLines: boolean;
  showTwinRuleGuide: boolean;
  showSplitPlaneGuide: boolean;
  showAxisLinesInner: boolean;
  showAxisLinesOuter: boolean;
  showAxisLabels: boolean;
}

/** preview scene builder に渡す依存関係。 */
export interface TwinPreviewSceneContext {
  state: TwinPreviewSceneStateLike;
  elements: {
    faceLabelLayer: HTMLElement;
  };
  getCrystalAccentColor: (crystalIndex: number) => THREE.ColorRepresentation;
  isCrystalVisible: (crystal: PreviewCrystalLike, index: number) => boolean;
  requestPreviewRender: () => void;
  applyLabelLayerVisibility: () => void;
  createAxisLabelAnchors: (
    axisGuides: PreviewAxisGuideLike[] | undefined,
  ) => PreviewDomAnchorLike[];
  createFaceLabelAnchors: (
    meshData: PreviewMeshDataLike,
    sourceName: string,
  ) => PreviewDomAnchorLike[];
  createWideLineFromPoints: (
    points: THREE.Vector3[],
    color: number | string,
    opacity: number,
    useDepthCue: boolean,
    linewidth: number,
  ) => THREE.Object3D;
  createPreviewLineFromPoints: (
    points: THREE.Vector3[],
    color: number | string,
    opacity: number,
    useDepthCue: boolean,
    linewidth: number,
  ) => THREE.Object3D;
  createGroupedFaceMeshGroup: (
    meshData: PreviewMeshDataLike,
    sourceName: string,
    sourceFaces: PreviewFaceLike[],
    crystalIndex: number,
  ) => THREE.Object3D;
  createXraySolidFaceMeshGroup: (
    meshData: PreviewMeshDataLike,
    sourceName: string,
    index: number,
    hasFinal: boolean,
  ) => THREE.Object3D;
  buildDisplayGeometry: (
    meshData: PreviewMeshDataLike,
    sourceFaces: PreviewFaceLike[],
    options?: unknown,
  ) => THREE.BufferGeometry;
  buildFlatFaceColors: (
    meshData: PreviewMeshDataLike,
    colorHex: string,
  ) => Float32Array;
  createWireframeFromGeometry: (
    geometry: THREE.BufferGeometry,
  ) => THREE.Object3D;
  buildVisibleRidgeLineData: (
    visibleCrystalEntries: {
      crystal: PreviewCrystalLike;
      index: number;
      meshData: PreviewMeshDataLike;
    }[],
    intersectionPositions: number[],
  ) => {
    surfacePositions: number[];
    occludedInteriorPositions: number[];
  };
  createWireframeFromPositions: (
    positions: number[],
    options?: unknown,
  ) => THREE.Object3D | null;
  buildVisibleRidgeLinePositions: (
    visibleCrystalEntries: {
      crystal: PreviewCrystalLike;
      index: number;
      meshData: PreviewMeshDataLike;
    }[],
    intersectionPositions: number[],
  ) => number[];
  buildCrossCrystalIntersectionLinePositions: (
    visibleCrystalEntries: {
      crystal: PreviewCrystalLike;
      index: number;
      meshData: PreviewMeshDataLike;
    }[],
  ) => number[];
  buildFaceTextIntersectionLinePositions?: (
    face: PreviewFaceLike,
    sourceFace: PreviewFaceLike | null | undefined,
  ) => number[];
  buildSharedSolidFaceColorMap: (
    visibleCrystalEntries: {
      crystal: PreviewCrystalLike;
      index: number;
      meshData: PreviewMeshDataLike;
    }[],
  ) => Map<number, string> | null;
  buildSolidSharedFaceOverlayGroup: (
    visibleCrystalEntries: {
      crystal: PreviewCrystalLike;
      index: number;
      meshData: PreviewMeshDataLike;
    }[],
  ) => THREE.Group | null;
  createXrayLineDepthMaskGroup: (object: THREE.Object3D) => THREE.Group | null;
  applyXrayPreviewMeshState: (object: THREE.Object3D) => void;
  buildFaceCenter: (vertices: PreviewVertexLike[]) => THREE.Vector3;
  buildAxisInnerSegment: (
    axis: PreviewAxisGuideLike,
    clipFaces: PreviewFaceLike[] | undefined,
  ) => {
    start: THREE.Vector3;
    end: THREE.Vector3;
  } | null;
  buildAxisOuterSegments: (
    axis: PreviewAxisGuideLike,
    clipFaces: PreviewFaceLike[] | undefined,
  ) => { start: THREE.Vector3; end: THREE.Vector3 }[];
}

/** preview scene の構築 action 群を返す。 */
export function createTwinPreviewSceneActions(
  context: TwinPreviewSceneContext,
) {
  /** 現在の表示 mode から面/線 profile を返す。 */
  function getPreviewProfiles() {
    return {
      faceProfile: resolveTwinPreviewFaceProfile(
        context.state.faceDisplayMode,
        context.state.previewStyleSettings?.customFaceProfile,
      ),
      lineProfile: resolveTwinPreviewLineProfile(
        context.state.faceDisplayMode,
        context.state.previewStyleSettings?.customLineProfile,
      ),
    };
  }

  /** 現在 preview に出している軸線 guide を返す。 */
  function getPreviewAxisGuides() {
    return (
      context.state.buildResult?.crystalPreviewMeshData?.[0]?.axisGuides ?? []
    );
  }

  /** 軸線表示 toggle 状態を preview object へ反映する。 */
  function applyAxisGuideVisibility() {
    if (!context.state.axisGuideGroup) {
      return;
    }
    context.state.axisGuideGroup.children.forEach((child) => {
      if (child.userData.axisGuideType === "line") {
        child.visible =
          (child.userData.axisGuideVariant === "inner" &&
            context.state.showAxisLinesInner) ||
          (child.userData.axisGuideVariant === "outer" &&
            context.state.showAxisLinesOuter);
      }
    });
    context.state.axisLabelAnchors.forEach((anchor) => {
      anchor.element.style.display = context.state.showAxisLabels
        ? "block"
        : "none";
    });
    context.requestPreviewRender();
  }

  /** 現在の preview object 全体を包む bounding sphere を返す。 */
  function buildPreviewBoundsSphere() {
    const box = new THREE.Box3();
    let hasBounds = false;

    for (const meshData of context.state.buildResult?.crystalPreviewMeshData ??
      []) {
      for (const vertex of meshData?.vertices ?? []) {
        box.expandByPoint(new THREE.Vector3(vertex.x, vertex.y, vertex.z));
        hasBounds = true;
      }
    }

    if (!hasBounds) {
      const geometry =
        context.state.buildResult?.previewFinalGeometry ??
        context.state.buildResult?.finalGeometry;
      if (geometry) {
        geometry.computeBoundingBox();
        if (geometry.boundingBox) {
          box.copy(geometry.boundingBox);
          hasBounds = true;
        }
      }
    }

    return hasBounds
      ? box.getBoundingSphere(new THREE.Sphere())
      : new THREE.Sphere(new THREE.Vector3(), 1);
  }

  /** 面頂点の重心を返す。 */
  function getFaceCenter(face) {
    const center = new THREE.Vector3();
    const vertices = face?.vertices ?? [];
    if (vertices.length === 0) {
      return center;
    }
    vertices.forEach((vertex) => {
      center.add(new THREE.Vector3(vertex.x, vertex.y, vertex.z));
    });
    return center.divideScalar(vertices.length);
  }

  /** 結晶1中心の基準に使うため、meshData 全体の bounding-box center を返す。 */
  function getMeshDataCenter(meshData) {
    const vertices = meshData?.vertices ?? [];
    if (vertices.length === 0) {
      return new THREE.Vector3();
    }
    const box = new THREE.Box3();
    vertices.forEach((vertex) => {
      box.expandByPoint(new THREE.Vector3(vertex.x, vertex.y, vertex.z));
    });
    return box.getCenter(new THREE.Vector3());
  }

  /** 双晶 preview 用の軸線 group を作る。 */
  function createAxisGuideGroup(axisGuides, clipFaces) {
    const group = new THREE.Group();
    for (const axis of axisGuides ?? []) {
      const axisStyleKey = resolveTwinAxisStyleKey(axis.label);
      const axisColor =
        axisStyleKey === "a3"
          ? typeof axis.color === "string"
            ? axis.color
            : "#c08a2d"
          : context.state.previewStyleSettings.axisLines.colors[axisStyleKey];
      const innerSegment = context.buildAxisInnerSegment(axis, clipFaces);
      if (innerSegment) {
        const innerLine = context.createWideLineFromPoints(
          [innerSegment.start, innerSegment.end],
          axisColor,
          0.95,
          false,
          context.state.previewStyleSettings.axisLines.innerWidth,
        );
        innerLine.userData.axisGuideType = "line";
        innerLine.userData.axisGuideVariant = "inner";
        group.add(innerLine);
      }
      const outerSegments = context.buildAxisOuterSegments(axis, clipFaces);
      outerSegments.forEach((outerSegment) => {
        const outerLine = context.createWideLineFromPoints(
          [outerSegment.start, outerSegment.end],
          axisColor,
          0.95,
          true,
          context.state.previewStyleSettings.axisLines.outerWidth,
        );
        outerLine.userData.axisGuideType = "line";
        outerLine.userData.axisGuideVariant = "outer";
        group.add(outerLine);
      });
    }
    return group;
  }

  /** 双晶軸 / 双晶面ガイド line object を作る。 */
  function createTwinRuleGuideGroup(parameters) {
    const group = new THREE.Group();
    const labelAnchors: PreviewDomAnchorLike[] = [];

    if (!isTwinEnabled(parameters)) {
      return { group, labelAnchors };
    }

    const boundsSphere = buildPreviewBoundsSphere();
    const radius = Math.max(boundsSphere.radius, 1);
    const guideCrystalIndex = getGuideCrystalIndex(
      parameters,
      context.state.activeFaceCrystalIndex,
    );
    const guideCrystal =
      getTwinCrystals(parameters)?.[guideCrystalIndex] ?? null;
    if (!guideCrystal || guideCrystalIndex < 1) {
      return { group, labelAnchors };
    }
    const ruleType = twinRuleTypeForTwinType(guideCrystal.twinType);

    if (ruleType === "axis") {
      const axis = twinAxisDirection(guideCrystal.axis, parameters);
      if (Number.isFinite(axis.lengthSq()) && axis.lengthSq() > 0) {
        const direction = axis.clone().normalize();
        const length = radius * 2.0;
        const start = direction.clone().multiplyScalar(-length * 0.5);
        const end = direction.clone().multiplyScalar(length * 0.5);
        const line = context.createWideLineFromPoints(
          [start, end],
          context.state.previewStyleSettings.twinRuleLabel.color,
          0.96,
          true,
          context.state.previewStyleSettings.axisLines.outerWidth,
        );
        group.add(line);

        const labelElement = document.createElement("div");
        labelElement.className = "axis-overlay-label axis-index-label";
        labelElement.style.color =
          context.state.previewStyleSettings.twinRuleLabel.color;
        labelElement.style.fontFamily =
          context.state.previewStyleSettings.twinRuleLabel.fontFamily;
        labelElement.style.fontSize = `${resolveTwinPreviewResponsiveFontSizePx(
          context.state.previewStyleSettings.twinRuleLabel.fontSizePx,
          "twinRuleLabel",
        )}px`;
        const positiveLabelParts = buildIndexLabelParts(
          guideCrystal.axis,
          usesFourAxisMiller(parameters.crystalSystem),
        );
        const negativeLabelParts = invertIndexLabelParts(positiveLabelParts);
        context.elements.faceLabelLayer.append(labelElement);
        labelAnchors.push({
          element: labelElement,
          positiveLabelParts,
          negativeLabelParts,
          tipPosition: end.clone(),
          direction: direction.clone(),
          oppositeTipPosition: start.clone(),
          oppositeDirection: direction.clone().negate(),
          styleKind: "twinRule",
        });
      }
      return { group, labelAnchors };
    }

    const parentIndex = Math.max(
      0,
      Math.min(Number(guideCrystal.from ?? 0), guideCrystalIndex - 1),
    );
    const parentContactFace =
      context.state.buildResult?.crystalPreviewMeshData?.[
        parentIndex
      ]?.faces?.find((face) => face.id === guideCrystal?.contact?.baseFaceRef);
    const derivedContactFace =
      context.state.buildResult?.crystalPreviewMeshData?.[
        guideCrystalIndex
      ]?.faces?.find(
        (face) => face.id === guideCrystal?.contact?.derivedFaceRef,
      );
    const contactFace = parentContactFace ?? derivedContactFace;
    if (!contactFace?.normal || !contactFace.vertices?.length) {
      return { group, labelAnchors };
    }
    const normal = new THREE.Vector3(
      contactFace.normal.x,
      contactFace.normal.y,
      contactFace.normal.z,
    ).normalize();
    const center = getFaceCenter(contactFace);

    const planeSize = radius * 2.1;
    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x2b8c82,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    planeMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal.clone().normalize(),
    );
    planeMesh.position.copy(center);
    planeMesh.renderOrder = 3;
    group.add(planeMesh);

    const half = planeSize * 0.5;
    const outlinePoints = [
      new THREE.Vector3(-half, -half, 0),
      new THREE.Vector3(half, -half, 0),
      new THREE.Vector3(half, half, 0),
      new THREE.Vector3(-half, half, 0),
      new THREE.Vector3(-half, -half, 0),
    ].map((point) => point.applyQuaternion(planeMesh.quaternion).add(center));
    const outline = context.createPreviewLineFromPoints(
      outlinePoints,
      0x2b8c82,
      0.8,
      false,
      4,
    );
    group.add(outline);

    return { group, labelAnchors };
  }

  /** 分割平面 helper を現在の指数指定で組み立てる。 */
  function createSplitPlaneGuideGroup(stlSplit, parameters, crystalMeshData) {
    const group = new THREE.Group();
    if (!crystalMeshData || !parameters?.axes || !parameters?.angles) {
      return group;
    }

    const normal = twinPlaneNormal(
      stlSplit?.plane ?? { h: 1, k: 1, l: 1 },
      parameters,
    );
    if (!Number.isFinite(normal.lengthSq()) || normal.lengthSq() === 0) {
      return group;
    }

    const center = getMeshDataCenter(crystalMeshData);
    const box = new THREE.Box3();
    for (const vertex of crystalMeshData.vertices ?? []) {
      box.expandByPoint(new THREE.Vector3(vertex.x, vertex.y, vertex.z));
    }
    const boxSize = box.getSize(new THREE.Vector3());
    const planeSize = Math.max(
      Math.max(boxSize.x, boxSize.y, boxSize.z, 12) * 0.5,
      6,
    );
    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xd97706,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    planeMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal.clone().normalize(),
    );
    planeMesh.position.copy(center);
    planeMesh.renderOrder = 3;
    group.add(planeMesh);

    const half = planeSize * 0.5;
    const outlinePoints = [
      new THREE.Vector3(-half, -half, 0),
      new THREE.Vector3(half, -half, 0),
      new THREE.Vector3(half, half, 0),
      new THREE.Vector3(-half, half, 0),
      new THREE.Vector3(-half, -half, 0),
    ].map((point) => point.applyQuaternion(planeMesh.quaternion).add(center));
    const outline = context.createPreviewLineFromPoints(
      outlinePoints,
      0xd97706,
      0.86,
      false,
      3,
    );
    group.add(outline);
    return group;
  }

  /** 不透明表示向けの preview material を作る。 */
  function createPreviewMaterial() {
    const { faceProfile } = getPreviewProfiles();
    const color = resolveTwinPreviewFaceBaseColor(faceProfile);
    const baseOptions = {
      color,
      side: THREE.DoubleSide,
      transparent:
        faceProfile.opacityWhenHasFinal < 1 ||
        faceProfile.opacityWhenNoFinal < 1,
      opacity: faceProfile.opacityWhenHasFinal,
      depthWrite: faceProfile.depthWrite,
      polygonOffset: faceProfile.usePolygonOffset,
      polygonOffsetFactor: faceProfile.polygonOffsetFactor,
      polygonOffsetUnits: faceProfile.polygonOffsetUnits,
    };
    if (faceProfile.materialKind === "basic") {
      return new THREE.MeshBasicMaterial(baseOptions);
    }
    return new THREE.MeshPhysicalMaterial({
      ...baseOptions,
      vertexColors: faceProfile.useVertexColorsOnMergedGeometry,
      roughness: 0.35,
      metalness: 0.08,
      clearcoat: 0.28,
    });
  }

  /** 結晶ごとの表示モードに応じた preview material を作る。 */
  function createCrystalPreviewMaterial(
    color,
    hasFinal,
    useVertexColors = false,
  ) {
    const { faceProfile } = getPreviewProfiles();
    const resolvedColor = resolveTwinPreviewFaceBaseColor(faceProfile, {
      crystalAccentColor: color,
      useVertexColors,
    });
    const resolvedOpacity = resolveTwinPreviewFaceOpacity(faceProfile, {
      hasFinal,
    });
    const baseOptions = {
      color: resolvedColor,
      vertexColors: useVertexColors,
      transparent: resolvedOpacity < 1,
      opacity: resolvedOpacity,
      depthWrite: faceProfile.depthWrite,
      side: THREE.DoubleSide,
      polygonOffset: faceProfile.usePolygonOffset,
      polygonOffsetFactor: faceProfile.polygonOffsetFactor,
      polygonOffsetUnits: faceProfile.polygonOffsetUnits,
    };
    if (faceProfile.materialKind === "basic") {
      return new THREE.MeshBasicMaterial(baseOptions);
    }
    return new THREE.MeshPhysicalMaterial({
      ...baseOptions,
      roughness: 0.35,
      metalness: 0.08,
      clearcoat: 0.28,
    });
  }

  /** preview helper 群の表示状態を現在の toggle に合わせて更新する。 */
  function applyPreviewHelperVisibility() {
    if (context.state.ridgeLines) {
      context.state.ridgeLines.visible = context.state.showRidgeLines;
    }
    if (context.state.intersectionRidgeLines) {
      context.state.intersectionRidgeLines.visible =
        context.state.showIntersectionRidgeLines;
    }
    if (context.state.twinRuleGuideGroup) {
      context.state.twinRuleGuideGroup.visible =
        context.state.showTwinRuleGuide;
    }
    if (context.state.splitPlaneGuideGroup) {
      context.state.splitPlaneGuideGroup.visible =
        context.state.showSplitPlaneGuide;
    }
    context.requestPreviewRender();
  }

  /** preview scene graph を最初から組み立てる。 */
  function buildPreviewGroup() {
    const { faceProfile, lineProfile } = getPreviewProfiles();
    const displayFinalGeometry =
      context.state.buildResult?.previewFinalGeometry ??
      context.state.buildResult?.finalGeometry;
    const hasFinal = Boolean(displayFinalGeometry);
    const crystals = getTwinCrystals(context.state.parameters);
    const crystalMeshData =
      context.state.buildResult?.crystalPreviewMeshData ?? [];
    const activeCrystalEntries = crystals
      .map((crystal, index) => ({
        crystal,
        index,
        meshData: crystalMeshData[index] ?? null,
      }))
      .filter(
        ({ crystal, index, meshData }) =>
          (index === 0 || crystal?.enabled !== false) && meshData,
      );
    const visibleCrystalEntries = activeCrystalEntries.filter(
      ({ crystal, index }) => context.isCrystalVisible(crystal, index),
    );
    const hasComponents = visibleCrystalEntries.length > 0;

    if (!hasFinal && !hasComponents) {
      return null;
    }

    const group = new THREE.Group();
    context.elements.faceLabelLayer.innerHTML = "";
    context.state.faceLabelAnchors = [];
    context.state.axisLabelAnchors = [];
    context.state.twinRuleLabelAnchors = [];
    context.state.facePickTargets = [];
    context.state.ridgeLines = null;
    context.state.intersectionRidgeLines = null;
    context.state.splitPlaneGuideGroup = null;
    const hasPenetrationTwin = visibleCrystalEntries.some(
      ({ crystal, index }) => index > 0 && crystal?.twinType === "penetration",
    );
    const sharedSolidFaceColorMap =
      faceProfile.allowSharedSolidFaceColorMap &&
      hasPenetrationTwin &&
      visibleCrystalEntries.length > 1
        ? context.buildSharedSolidFaceColorMap(visibleCrystalEntries)
        : null;
    const sharedSolidFaceOverlayGroup =
      faceProfile.allowSharedSolidFaceOverlay &&
      hasPenetrationTwin &&
      visibleCrystalEntries.length > 1
        ? context.buildSolidSharedFaceOverlayGroup(visibleCrystalEntries)
        : null;
    const sharedXrayFaceOverlayGroup = null;
    const canUseFinalWireframe = false;
    const showFinalMesh =
      hasFinal &&
      visibleCrystalEntries.length === activeCrystalEntries.length &&
      visibleCrystalEntries.length > 1 &&
      faceProfile.preferFinalMergedGeometry;

    if (showFinalMesh) {
      const finalMesh = new THREE.Mesh(
        displayFinalGeometry,
        createPreviewMaterial(),
      );
      finalMesh.name = "final-mesh";
      group.add(finalMesh);

      const outline = context.createWireframeFromGeometry(displayFinalGeometry);
      outline.name = "preview-ridge-lines";
      group.add(outline);
      context.state.ridgeLines = outline;
    }

    if (!showFinalMesh) {
      const ridgeLinesGroup = new THREE.Group();
      const intersectionRidgeLinesGroup = new THREE.Group();
      const faceTextIntersectionRidgeLinesGroup = new THREE.Group();
      const facePickTargetGroup = new THREE.Group();
      facePickTargetGroup.name = "face-pick-targets";
      const crossCrystalIntersectionPositions =
        hasFinal &&
        visibleCrystalEntries.length === activeCrystalEntries.length &&
        visibleCrystalEntries.length > 1
          ? context.buildCrossCrystalIntersectionLinePositions(
              visibleCrystalEntries,
            )
          : [];
      const ridgeLineData = !canUseFinalWireframe
        ? context.buildVisibleRidgeLineData(
            visibleCrystalEntries,
            crossCrystalIntersectionPositions,
          )
        : { surfacePositions: [], occludedInteriorPositions: [] };
      const ridgePositions = lineProfile.showOccludedInteriorLines
        ? [
            ...ridgeLineData.surfacePositions,
            ...ridgeLineData.occludedInteriorPositions,
          ]
        : ridgeLineData.surfacePositions;
      const faceTextIntersectionPositions: number[] = [];
      visibleCrystalEntries.forEach(({ index, meshData }) => {
        const sourceName = `crystal-mesh-${index}`;
        const sourceFaces = getTwinCrystalFaces(
          context.state.parameters,
          index,
        );
        const validSourceFaces = sourceFaces.filter(
          (face) => Number(face.coefficient) > 0,
        );
        const object =
          faceProfile.componentBuildMode === "grouped-face-group"
            ? context.createGroupedFaceMeshGroup(
                meshData,
                sourceName,
                sourceFaces,
                index,
              )
            : faceProfile.componentBuildMode === "xray-solid-face-group"
              ? context.createXraySolidFaceMeshGroup(
                  meshData,
                  sourceName,
                  index,
                  hasFinal,
                )
              : (() => {
                  const geometry = context.buildDisplayGeometry(
                    meshData,
                    sourceFaces,
                    {
                      faceColorHexByFaceId: sharedSolidFaceColorMap,
                      crystalIndex: index,
                      crystalAccentColor: context.getCrystalAccentColor(index),
                    },
                  );
                  const useVertexColors = Boolean(
                    sharedSolidFaceColorMap?.size,
                  );
                  const mesh = new THREE.Mesh(
                    geometry,
                    createCrystalPreviewMaterial(
                      context.getCrystalAccentColor(index),
                      hasFinal,
                      useVertexColors,
                    ),
                  );
                  mesh.name = sourceName;
                  return mesh;
                })();

        group.add(object);
        if (faceProfile.usesScreenSpaceFaceOverlay) {
          object.userData.previewXrayBodyMesh = true;
        }
        context.applyXrayPreviewMeshState(object);
        const xrayDepthMask = context.createXrayLineDepthMaskGroup(object);
        if (xrayDepthMask) {
          group.add(xrayDepthMask);
        }
        (meshData.faces ?? []).forEach((face, faceIndex) => {
          const vertices = face.vertices ?? [];
          if (vertices.length < 3) {
            return;
          }

          const positions: number[] = [];
          for (
            let vertexIndex = 1;
            vertexIndex < vertices.length - 1;
            vertexIndex += 1
          ) {
            [
              vertices[0],
              vertices[vertexIndex],
              vertices[vertexIndex + 1],
            ].forEach((vertex) => {
              positions.push(vertex.x, vertex.y, vertex.z);
            });
          }

          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(positions, 3),
          );
          geometry.computeBoundingBox();
          geometry.computeBoundingSphere();
          const fallbackFace =
            sourceFaces.find((candidate) => candidate.id === face.id) ??
            validSourceFaces[faceIndex] ??
            sourceFaces[faceIndex] ??
            null;
          if (context.buildFaceTextIntersectionLinePositions) {
            // 面文字輪郭は既存の交線レイヤーへ相乗りさせ、試作段階では UI を増やさない。
            faceTextIntersectionPositions.push(
              ...context.buildFaceTextIntersectionLinePositions(
                face,
                fallbackFace,
              ),
            );
          }
          const faceId = face.id ?? fallbackFace?.id ?? null;
          const faceGroupKey = getEquivalentFaceGroupKey(
            fallbackFace ?? face,
            context.state.parameters.crystalSystem,
          );

          const pickMesh = new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({
              transparent: true,
              opacity: 0,
              side: THREE.DoubleSide,
              depthWrite: false,
              colorWrite: false,
            }),
          );
          pickMesh.userData.faceCenter = context.buildFaceCenter(vertices);
          pickMesh.userData.faceNormal = new THREE.Vector3(
            face.normal.x,
            face.normal.y,
            face.normal.z,
          ).normalize();
          pickMesh.userData.faceId = faceId;
          pickMesh.userData.faceGroupKey = faceGroupKey;
          pickMesh.userData.crystalIndex = index;
          facePickTargetGroup.add(pickMesh);
          context.state.facePickTargets.push(pickMesh);
        });
        context.state.faceLabelAnchors.push(
          ...context.createFaceLabelAnchors(meshData, sourceName),
        );
      });
      if (
        ridgePositions.length > 0 ||
        crossCrystalIntersectionPositions.length > 0 ||
        faceTextIntersectionPositions.length > 0
      ) {
        const summary = {
          ...buildXrayLineDebugSummary(
            ridgeLineData,
            crossCrystalIntersectionPositions,
            context.state.faceDisplayMode,
          ),
          faceTextIntersectionSegmentCount:
            faceTextIntersectionPositions.length / 6,
        };
        group.userData.previewLineDebug = summary;
        (globalThis as Record<string, unknown>).__twinPreviewLineDebug =
          summary;
        console.info("[Twin Preview Lines]", summary);
      }

      if (sharedSolidFaceOverlayGroup) {
        sharedSolidFaceOverlayGroup.name = "shared-solid-face-overlays";
        group.add(sharedSolidFaceOverlayGroup);
      }
      if (sharedXrayFaceOverlayGroup) {
        sharedXrayFaceOverlayGroup.name = "shared-xray-face-overlays";
        group.add(sharedXrayFaceOverlayGroup);
      }

      if (!canUseFinalWireframe) {
        const ridgeLineRenderOrder = lineProfile.useScreenSpaceLineOverlay
          ? 7
          : undefined;
        const appendRidgeLines = (
          positions: number[],
          segmentKind: "surface" | "occludedInterior",
        ) => {
          const ridgeLines = context.createWireframeFromPositions(positions, {
            color: context.state.previewStyleSettings.ridgeLines.color,
            linewidth: context.state.previewStyleSettings.ridgeLines.width,
            opacity: context.state.previewStyleSettings.ridgeLines.opacity,
            renderOrder: ridgeLineRenderOrder,
            lineKind: "ridge",
            ridgeSegmentKind: segmentKind,
          });
          if (!ridgeLines) {
            return;
          }
          ridgeLines.name =
            segmentKind === "surface"
              ? "preview-ridge-lines-surface"
              : "preview-ridge-lines-occluded-interior";
          ridgeLines.userData.previewRidgeSegmentKind = segmentKind;
          ridgeLinesGroup.add(ridgeLines);
        };

        appendRidgeLines(ridgeLineData.surfacePositions, "surface");
        if (lineProfile.showOccludedInteriorLines) {
          appendRidgeLines(
            ridgeLineData.occludedInteriorPositions,
            "occludedInterior",
          );
        }
      }

      if (crossCrystalIntersectionPositions.length > 0) {
        const intersectionLineRenderOrder =
          lineProfile.useScreenSpaceLineOverlay ? 9 : undefined;
        const intersectionLines = context.createWireframeFromPositions(
          crossCrystalIntersectionPositions,
          {
            color: context.state.previewStyleSettings.intersectionLines.color,
            linewidth:
              context.state.previewStyleSettings.intersectionLines.width,
            opacity:
              context.state.previewStyleSettings.intersectionLines.opacity,
            renderOrder: intersectionLineRenderOrder,
            lineKind: "intersection",
          },
        );
        if (intersectionLines) {
          intersectionLines.name = "preview-intersection-ridge-lines";
          intersectionRidgeLinesGroup.add(intersectionLines);
        }
      }

      if (faceTextIntersectionPositions.length > 0) {
        const faceTextLineRenderOrder = lineProfile.useScreenSpaceLineOverlay
          ? 9
          : undefined;
        const faceTextIntersectionLines = context.createWireframeFromPositions(
          faceTextIntersectionPositions,
          {
            color: context.state.previewStyleSettings.intersectionLines.color,
            linewidth:
              context.state.previewStyleSettings.intersectionLines.width,
            opacity:
              context.state.previewStyleSettings.intersectionLines.opacity,
            renderOrder: faceTextLineRenderOrder,
            lineKind: "intersection",
          },
        );
        if (faceTextIntersectionLines) {
          faceTextIntersectionLines.name =
            "preview-face-text-intersection-ridge-lines";
          faceTextIntersectionRidgeLinesGroup.add(faceTextIntersectionLines);
        }
      }

      if (ridgeLinesGroup.children.length > 0) {
        ridgeLinesGroup.name = "preview-ridge-lines";
        group.add(ridgeLinesGroup);
        context.state.ridgeLines = ridgeLinesGroup;
      }
      if (faceTextIntersectionRidgeLinesGroup.children.length > 0) {
        // 既定で見える面文字輪郭。交線トグルとは独立させつつ、xray/export 側の
        // 既存判定に乗るよう祖先名は preview-intersection-ridge-lines を流用する。
        faceTextIntersectionRidgeLinesGroup.name =
          "preview-intersection-ridge-lines";
        group.add(faceTextIntersectionRidgeLinesGroup);
      }
      if (intersectionRidgeLinesGroup.children.length > 0) {
        intersectionRidgeLinesGroup.name = "preview-intersection-ridge-lines";
        group.add(intersectionRidgeLinesGroup);
        context.state.intersectionRidgeLines = intersectionRidgeLinesGroup;
      }
      context.state.facePickTargetGroup = facePickTargetGroup;
      group.add(facePickTargetGroup);
    }

    context.state.axisGuideGroup = createAxisGuideGroup(
      context.state.buildResult?.crystalPreviewMeshData?.[0]?.axisGuides,
      context.state.buildResult?.crystalPreviewMeshData?.[0]?.faces,
    );
    context.state.axisGuideGroup.name = "axis-guides";
    group.add(context.state.axisGuideGroup);
    context.state.axisLabelAnchors = context.createAxisLabelAnchors(
      context.state.buildResult?.crystalPreviewMeshData?.[0]?.axisGuides,
    );
    applyAxisGuideVisibility();

    context.state.splitPlaneGuideGroup = createSplitPlaneGuideGroup(
      context.state.stlSplit,
      context.state.parameters,
      context.state.buildResult?.crystalPreviewMeshData?.[0] ?? null,
    );
    context.state.splitPlaneGuideGroup.name = "split-plane-guides";
    group.add(context.state.splitPlaneGuideGroup);

    const twinRuleGuide = createTwinRuleGuideGroup(context.state.parameters);
    context.state.twinRuleGuideGroup = twinRuleGuide.group;
    context.state.twinRuleGuideGroup.name = "twin-rule-guides";
    context.state.twinRuleLabelAnchors = twinRuleGuide.labelAnchors;
    group.add(context.state.twinRuleGuideGroup);

    applyPreviewHelperVisibility();
    context.applyLabelLayerVisibility();

    return group;
  }

  return {
    getPreviewAxisGuides,
    applyAxisGuideVisibility,
    applyPreviewHelperVisibility,
    buildPreviewBoundsSphere,
    buildPreviewGroup,
  };
}
