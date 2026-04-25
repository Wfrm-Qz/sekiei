import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import type { CrystalSystemId } from "../domain/crystalSystems.js";
import type { TwinPreviewLineProfile } from "./previewProfiles.js";
import {
  resolveTwinPreviewFaceOpacity,
  resolveTwinPreviewFaceProfile,
} from "./previewProfiles.js";
import type { TwinPreviewStyleSettings } from "./previewStyleSettings.js";
import { buildTwinFaceGroupPalette } from "../ui/faceTable/faceTable.js";

/**
 * preview の xray 表示責務をまとめた module。
 *
 * 線 object factory と xray 面の state ルールはどちらも「半透明表示をどう見せるか」に
 * 属するため、ここへ集約して main.ts 側の import 粒度を揃える。
 */
export interface TwinPreviewLineContext {
  elements: {
    previewStage: HTMLElement;
    canvas?: HTMLCanvasElement | null;
  };
  getPreviewLineProfile: () => TwinPreviewLineProfile;
}

export interface TwinXrayPreviewStateContext {
  state: {
    faceDisplayMode: string;
    previewStyleSettings?: TwinPreviewStyleSettings;
    parameters: {
      crystalSystem: CrystalSystemId;
    };
    previewXraySortDebugFrame: number;
    previewRoot: THREE.Object3D | null;
  };
  camera: THREE.OrthographicCamera;
  getCrystalAccentColor: (crystalIndex: number) => THREE.ColorRepresentation;
}

/** xray 背後線に使う減衰色を返す。 */
function getTranslucentHiddenLineColor(color: THREE.ColorRepresentation) {
  return new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.22);
}

/** layered 線表示で使う hiddenSurface 線色を mode ごとに返す。 */
function getLayeredHiddenSurfaceLineColor(
  profile: TwinPreviewLineProfile,
  color: THREE.ColorRepresentation,
) {
  if (profile.hiddenSurfaceLineColorMode === "same-as-front") {
    return color;
  }
  if (profile.hiddenSurfaceLineColorMode === "custom") {
    return profile.hiddenSurfaceLineCustomColor;
  }
  return getTranslucentHiddenLineColor(color);
}

/** layered 線表示で使う hiddenSurface 線 opacity を mode ごとに返す。 */
function getLayeredHiddenSurfaceLineOpacity(
  profile: TwinPreviewLineProfile,
  opacity: number,
) {
  return opacity * profile.hiddenSurfaceLineOpacityScale;
}

/** layered 線表示で使う occludedInterior 線色を mode ごとに返す。 */
function getLayeredOccludedInteriorLineColor(
  profile: TwinPreviewLineProfile,
  color: THREE.ColorRepresentation,
) {
  if (profile.occludedInteriorLineColorMode === "same-as-front") {
    return color;
  }
  if (profile.occludedInteriorLineColorMode === "custom") {
    return profile.occludedInteriorLineCustomColor;
  }
  return getTranslucentHiddenLineColor(color);
}

/** layered 線表示で使う occludedInterior 線 opacity を mode ごとに返す。 */
function getLayeredOccludedInteriorLineOpacity(
  profile: TwinPreviewLineProfile,
  opacity: number,
) {
  return opacity * profile.occludedInteriorLineOpacityScale;
}

/** xray 表示時の線幅補正値を返す。 */
function getXrayPreviewLinewidth(linewidth: number) {
  return linewidth;
}

/** 線種ごとの style を解決し、単層描画でも hidden/内部線の見た目を揃える。 */
function resolvePreviewLineStyle(
  profile: TwinPreviewLineProfile,
  options: {
    color: THREE.ColorRepresentation;
    opacity: number;
    linewidth: number;
    ridgeSegmentKind: "surface" | "occludedInterior";
  },
) {
  if (options.ridgeSegmentKind === "occludedInterior") {
    return {
      color: getLayeredOccludedInteriorLineColor(profile, options.color),
      opacity: getLayeredOccludedInteriorLineOpacity(profile, options.opacity),
      linewidth: getXrayPreviewLinewidth(
        profile.occludedInteriorLineWidthScale,
      ),
    };
  }
  return {
    color: options.color,
    opacity: options.opacity,
    linewidth: getXrayPreviewLinewidth(options.linewidth),
  };
}

/** depth mask の offset は xray と transparent で要求が違うため、モード別に返す。 */
function getPreviewLineDepthMaskOffset(profile: TwinPreviewLineProfile) {
  return {
    factor: profile.depthMaskOffsetFactor,
    units: profile.depthMaskOffsetUnits,
  };
}

/** line profile と線種から、単層表示でその線を描くべきかを返す。 */
function shouldRenderSingleLayerPreviewLine(
  profile: TwinPreviewLineProfile,
  options: {
    lineKind: "ridge" | "intersection" | "generic";
    ridgeSegmentKind: "surface" | "occludedInterior";
  },
) {
  if (options.lineKind === "generic") {
    return true;
  }
  if (options.lineKind === "intersection") {
    return profile.showFrontLines;
  }
  if (options.ridgeSegmentKind === "occludedInterior") {
    return profile.showOccludedInteriorLines;
  }
  return profile.showFrontLines;
}

/** wide line material の解像度を現在の preview stage に合わせる。 */
function configurePreviewWideLineMaterial(
  material: LineMaterial,
  previewStage: HTMLElement,
  profile: TwinPreviewLineProfile,
  previewCanvas?: HTMLCanvasElement | null,
) {
  if (profile.resolutionMode === "stage-css-pixel") {
    material.resolution.set(
      Math.max(previewStage.clientWidth, 1),
      Math.max(previewStage.clientHeight, 1),
    );
    return;
  }
  const devicePixelRatio =
    typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio)
      ? Math.max(window.devicePixelRatio, 1)
      : 1;
  const resolutionWidth =
    previewCanvas?.width &&
    Number.isFinite(previewCanvas.width) &&
    previewCanvas.width > 0
      ? previewCanvas.width
      : Math.max(Math.round(previewStage.clientWidth * devicePixelRatio), 1);
  const resolutionHeight =
    previewCanvas?.height &&
    Number.isFinite(previewCanvas.height) &&
    previewCanvas.height > 0
      ? previewCanvas.height
      : Math.max(Math.round(previewStage.clientHeight * devicePixelRatio), 1);
  material.resolution.set(resolutionWidth, resolutionHeight);
}

/** LineSegments2 を生成し、renderOrder と resolution を適用する。 */
function createLineSegments2WithMaterial(
  lineGeometry: LineSegmentsGeometry,
  material: LineMaterial,
  renderOrder: number,
  previewStage: HTMLElement,
  profile: TwinPreviewLineProfile,
  previewCanvas?: HTMLCanvasElement | null,
) {
  configurePreviewWideLineMaterial(
    material,
    previewStage,
    profile,
    previewCanvas,
  );
  const line = new LineSegments2(lineGeometry, material);
  line.renderOrder = renderOrder;
  return line;
}

/** 通常表示向けに、position attribute から素直な LineSegments を作る。 */
function createBasicLineSegments(
  positionAttribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  options: {
    color?: THREE.ColorRepresentation;
    opacity?: number;
    depthTest?: boolean;
    renderOrder?: number;
  } = {},
) {
  const {
    color = 0x181818,
    opacity = 1,
    depthTest = true,
    renderOrder = 1,
  } = options;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(Array.from(positionAttribute.array), 3),
  );
  const line = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthTest,
      depthWrite: false,
    }),
  );
  line.renderOrder = renderOrder;
  return line;
}

/**
 * preview 用 wide line object を作る。
 *
 * xray では前面線と背後線を分けて 2 層構成にし、通常表示では単層 line を返す。
 */
function createPreviewWideLineObject(
  lineGeometry: LineSegmentsGeometry,
  getPreviewLineProfile: () => TwinPreviewLineProfile,
  previewStage: HTMLElement,
  previewCanvas: HTMLCanvasElement | null | undefined,
  options: {
    color?: THREE.ColorRepresentation;
    opacity?: number;
    linewidth?: number;
    depthTest?: boolean;
    renderOrder?: number;
    lineKind?: "ridge" | "intersection" | "generic";
    ridgeSegmentKind?: "surface" | "occludedInterior";
  } = {},
) {
  const {
    color = 0x181818,
    opacity = 1,
    linewidth = 2,
    depthTest = !getPreviewLineProfile().useLayeredLines,
    renderOrder = getPreviewLineProfile().useLayeredLines ? 8 : 1,
    ridgeSegmentKind = "surface",
  } = options;
  const profile = getPreviewLineProfile();

  if (!profile.useLayeredLines) {
    if (
      !shouldRenderSingleLayerPreviewLine(profile, {
        lineKind: options.lineKind ?? "generic",
        ridgeSegmentKind,
      })
    ) {
      return null;
    }
    const resolvedStyle = resolvePreviewLineStyle(profile, {
      color,
      opacity,
      linewidth,
      ridgeSegmentKind,
    });
    const material = new LineMaterial({
      color: resolvedStyle.color,
      transparent: true,
      opacity: resolvedStyle.opacity,
      linewidth: resolvedStyle.linewidth,
      dashed: false,
      depthTest,
    });
    return createLineSegments2WithMaterial(
      lineGeometry,
      material,
      renderOrder,
      previewStage,
      profile,
      previewCanvas,
    );
  }

  const group = new THREE.Group();
  const hiddenColor =
    ridgeSegmentKind === "occludedInterior"
      ? getLayeredOccludedInteriorLineColor(profile, color)
      : getLayeredHiddenSurfaceLineColor(profile, color);
  const hiddenOpacity =
    ridgeSegmentKind === "occludedInterior"
      ? getLayeredOccludedInteriorLineOpacity(profile, opacity)
      : getLayeredHiddenSurfaceLineOpacity(profile, opacity);
  const hiddenLinewidth =
    ridgeSegmentKind === "occludedInterior"
      ? getXrayPreviewLinewidth(profile.occludedInteriorLineWidthScale)
      : getXrayPreviewLinewidth(profile.hiddenSurfaceLineWidthScale);
  const hiddenMaterial = new LineMaterial({
    color: hiddenColor,
    transparent: true,
    opacity: hiddenOpacity,
    linewidth: hiddenLinewidth,
    dashed: false,
    depthTest: false,
  });
  hiddenMaterial.depthWrite = false;
  const resolvedHiddenLine = createLineSegments2WithMaterial(
    lineGeometry,
    hiddenMaterial,
    2,
    previewStage,
    profile,
    previewCanvas,
  );
  resolvedHiddenLine.userData.previewLineLayer = "hidden";
  group.add(resolvedHiddenLine);

  if (ridgeSegmentKind !== "occludedInterior") {
    const frontMaterial = new LineMaterial({
      color,
      transparent: true,
      opacity,
      linewidth: getXrayPreviewLinewidth(linewidth),
      dashed: false,
      depthTest: true,
    });
    frontMaterial.depthWrite = false;
    const frontLine = createLineSegments2WithMaterial(
      lineGeometry,
      frontMaterial,
      renderOrder,
      previewStage,
      profile,
      previewCanvas,
    );
    frontLine.userData.previewLineLayer = "front";
    group.add(frontLine);
  }
  return group;
}

/**
 * preview 用の線 object factory 群を返す。
 *
 * 入力は 3D 点列や position attribute、出力は preview scene にそのまま積める
 * THREE object。material 解像度追従も同 module に閉じ込める。
 */
export function createTwinPreviewLineActions({
  elements,
  getPreviewLineProfile,
}: TwinPreviewLineContext) {
  /** 通常の THREE.Line を使う細線 preview object を points から作る。 */
  function createPreviewLineFromPoints(
    points: THREE.Vector3[],
    color: THREE.ColorRepresentation,
    opacity: number,
    depthTest: boolean,
    renderOrder: number,
  ) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const profile = getPreviewLineProfile();

    if (!profile.useLayeredLines) {
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthTest,
        }),
      );
      line.renderOrder = renderOrder;
      return line;
    }

    const group = new THREE.Group();
    const hiddenLine = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: getLayeredHiddenSurfaceLineColor(profile, color),
        transparent: true,
        opacity: getLayeredHiddenSurfaceLineOpacity(profile, opacity),
        depthTest: false,
        depthWrite: false,
      }),
    );
    hiddenLine.renderOrder = 2;
    hiddenLine.userData.previewLineLayer = "hidden";
    group.add(hiddenLine);

    const frontLine = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthTest: true,
        depthWrite: false,
      }),
    );
    frontLine.renderOrder = renderOrder;
    frontLine.userData.previewLineLayer = "front";
    group.add(frontLine);
    return group;
  }

  /**
   * xray 前面線の depth 判定用に、色を書かない depth mask mesh 群を作る。
   *
   * 面本体は depthWrite=false だが、線の前面/背面判定だけは残したいため別 group にしている。
   */
  function createXrayLineDepthMaskGroup(object: THREE.Object3D | null) {
    const profile = getPreviewLineProfile();
    if (!profile.useDepthMask || !object) {
      return null;
    }
    const depthMaskOffset = getPreviewLineDepthMaskOffset(profile);

    const maskGroup = new THREE.Group();
    maskGroup.name = "xray-line-depth-mask";
    maskGroup.renderOrder = 6;

    object.updateMatrixWorld(true);
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.geometry) {
        return;
      }

      const mask = new THREE.Mesh(
        child.geometry,
        new THREE.MeshBasicMaterial({
          colorWrite: false,
          depthWrite: true,
          depthTest: true,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: depthMaskOffset.factor,
          polygonOffsetUnits: depthMaskOffset.units,
        }),
      );
      mask.name = "xray-line-depth-mask-mesh";
      mask.renderOrder = 6;
      mask.matrixAutoUpdate = false;
      mask.matrix.copy(child.matrixWorld);
      mask.matrixWorld.copy(child.matrixWorld);
      maskGroup.add(mask);
    });

    return maskGroup.children.length > 0 ? maskGroup : null;
  }

  /** flat position 配列から preview 用 wireframe object を作る。 */
  function createWireframeFromPositions(
    positions: number[],
    options: {
      color?: THREE.ColorRepresentation;
      opacity?: number;
      linewidth?: number;
      depthTest?: boolean;
      renderOrder?: number;
      lineKind?: "ridge" | "intersection" | "generic";
      ridgeSegmentKind?: "surface" | "occludedInterior";
    } = {},
  ) {
    if (!Array.isArray(positions) || positions.length < 6) {
      return null;
    }
    const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
    return createWireframeFromPositionAttribute(positionAttribute, options);
  }

  /** position attribute から preview 用 wide line object を作る。 */
  function createWireframeFromPositionAttribute(
    positionAttribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    options: {
      color?: THREE.ColorRepresentation;
      opacity?: number;
      linewidth?: number;
      depthTest?: boolean;
      renderOrder?: number;
      lineKind?: "ridge" | "intersection" | "generic";
      ridgeSegmentKind?: "surface" | "occludedInterior";
    } = {},
  ) {
    const profile = getPreviewLineProfile();
    const {
      color = 0x181818,
      opacity = 1,
      linewidth = 2,
      depthTest = !profile.useLayeredLines,
      renderOrder = profile.useLayeredLines ? 8 : 1,
      lineKind = "generic",
      ridgeSegmentKind = "surface",
    } = options;
    if (
      !profile.useLayeredLines &&
      !shouldRenderSingleLayerPreviewLine(profile, {
        lineKind,
        ridgeSegmentKind,
      })
    ) {
      return null;
    }
    if (!profile.useLayeredLines && linewidth <= 1) {
      return createBasicLineSegments(positionAttribute, {
        color,
        opacity,
        depthTest,
        renderOrder,
      });
    }
    const lineGeometry = new LineSegmentsGeometry();
    lineGeometry.setPositions(positionAttribute.array);
    return createPreviewWideLineObject(
      lineGeometry,
      getPreviewLineProfile,
      elements.previewStage,
      elements.canvas,
      {
        color,
        opacity,
        linewidth,
        depthTest,
        renderOrder,
        lineKind,
        ridgeSegmentKind,
      },
    );
  }

  /** 連続 points を wide line 用 segment 配列へ変換して object を作る。 */
  function createWideLineFromPoints(
    points: THREE.Vector3[],
    color: THREE.ColorRepresentation,
    opacity: number,
    depthTest: boolean,
    linewidth: number,
  ) {
    const positionArray: number[] = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      positionArray.push(start.x, start.y, start.z, end.x, end.y, end.z);
    }
    const lineGeometry = new LineSegmentsGeometry();
    lineGeometry.setPositions(positionArray);
    return createPreviewWideLineObject(
      lineGeometry,
      getPreviewLineProfile,
      elements.previewStage,
      elements.canvas,
      {
        color,
        opacity,
        linewidth,
        depthTest,
      },
    );
  }

  /** preview 内の LineMaterial 解像度を resize 後に更新する。 */
  function updateWideLineResolutions(root: THREE.Object3D | null) {
    if (!root) {
      return;
    }
    const profile = getPreviewLineProfile();
    root.traverse((node) => {
      const material = Array.isArray(node.material)
        ? node.material[0]
        : node.material;
      if ((material as LineMaterial | undefined)?.isLineMaterial) {
        configurePreviewWideLineMaterial(
          material as LineMaterial,
          elements.previewStage,
          profile,
          elements.canvas,
        );
      }
    });
  }

  return {
    createPreviewLineFromPoints,
    createXrayLineDepthMaskGroup,
    createWireframeFromPositions,
    createWireframeFromPositionAttribute,
    createWideLineFromPoints,
    updateWideLineResolutions,
  };
}

/**
 * xray preview の見え方を制御する action 群を返す。
 *
 * 色・opacity・mesh state・renderOrder sort を 1 か所へ集めておくことで、
 * preview scene / overlay / export surface から同じ規則を参照できるようにする。
 */
export function createTwinXrayPreviewStateActions({
  state,
  camera,
  getCrystalAccentColor,
}: TwinXrayPreviewStateContext) {
  function getFaceProfile() {
    return resolveTwinPreviewFaceProfile(
      state.faceDisplayMode,
      state.previewStyleSettings?.customFaceProfile,
    );
  }

  /** 現在の面表示が xray 系かを返す。 */
  function isXrayFaceDisplayMode() {
    return getFaceProfile().usesScreenSpaceFaceOverlay;
  }

  /** xray preview で使う面 opacity を、最終和集合の有無込みで返す。 */
  function getXrayPreviewFaceOpacity(hasFinal: boolean) {
    const faceProfile = getFaceProfile();
    return resolveTwinPreviewFaceOpacity(faceProfile, {
      hasFinal,
      preferGroupedFaceComponentOpacity: faceProfile.usesFaceGroupPalette,
    });
  }

  /** xray preview で face ごとに使う色を grouped/solid モードに応じて返す。 */
  function resolveXrayPreviewFaceColor(
    faceId: string,
    sourceFaces: { id?: string }[],
    crystalIndex: number,
  ) {
    if (getFaceProfile().usesFaceGroupPalette) {
      const { faceColors } = buildTwinFaceGroupPalette(
        sourceFaces,
        state.parameters.crystalSystem,
      );
      return (
        faceColors.get(faceId)?.preview ??
        `#${new THREE.Color(getCrystalAccentColor(crystalIndex)).getHexString()}`
      );
    }
    return `#${new THREE.Color(getCrystalAccentColor(crystalIndex)).getHexString()}`;
  }

  /** xray 表示用 mesh 群へ depthWrite/renderOrder の共通設定を入れる。 */
  function applyXrayPreviewMeshState(object: THREE.Object3D | null) {
    if (!isXrayFaceDisplayMode() || !object) {
      return;
    }

    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.filter(Boolean).forEach((material) => {
        material.depthWrite = false;
      });
      child.renderOrder = 4;
    });
  }

  /**
   * xray 面 mesh を cameraZ 順へ並べ直し、簡易的な透明順序を合わせる。
   *
   * 完全解は screen-space 合成だが、mesh 側の renderOrder も合わせておくと preview の
   * 安定性が少し上がる。
   */
  function updateXrayTransparentFaceRenderOrder(root: THREE.Object3D | null) {
    if (!isXrayFaceDisplayMode() || !root) {
      return;
    }

    const sortableMeshes: {
      mesh: THREE.Mesh;
      cameraZ: number;
      facingDot: number;
    }[] = [];
    let backFacingCount = 0;
    let frontFacingCount = 0;
    root.traverse((child) => {
      if (
        !(child instanceof THREE.Mesh) ||
        child.userData?.xrayTransparentFace !== true
      ) {
        return;
      }
      const localCenter = child.userData?.xrayFaceCenter;
      const localNormal = child.userData?.xrayFaceNormal;
      if (
        !(localCenter instanceof THREE.Vector3) ||
        !(localNormal instanceof THREE.Vector3)
      ) {
        return;
      }
      const worldCenter = child.localToWorld(localCenter.clone());
      const cameraCenter = worldCenter.applyMatrix4(camera.matrixWorldInverse);
      const worldNormal = localNormal
        .clone()
        .transformDirection(child.matrixWorld)
        .normalize();
      const toCamera = camera.position.clone().sub(worldCenter).normalize();
      const facingDot = worldNormal.dot(toCamera);
      if (facingDot >= 0) {
        frontFacingCount += 1;
      } else {
        backFacingCount += 1;
      }
      sortableMeshes.push({
        mesh: child,
        cameraZ: cameraCenter.z,
        facingDot,
      });
    });

    sortableMeshes
      .sort((left, right) => left.cameraZ - right.cameraZ)
      .forEach((entry, index) => {
        entry.mesh.renderOrder = 4 + index * 0.0001;
      });

    state.previewXraySortDebugFrame += 1;
    const summary = {
      frame: state.previewXraySortDebugFrame,
      mode: state.faceDisplayMode,
      meshCount: sortableMeshes.length,
      frontFacingCount,
      backFacingCount,
      nearestCameraZ: sortableMeshes.length
        ? sortableMeshes[sortableMeshes.length - 1].cameraZ
        : null,
      farthestCameraZ: sortableMeshes.length ? sortableMeshes[0].cameraZ : null,
      sample: sortableMeshes.slice(0, 5).map((entry, index) => ({
        index,
        cameraZ: Number(entry.cameraZ.toFixed(6)),
        facingDot: Number(entry.facingDot.toFixed(6)),
        renderOrder: Number(entry.mesh.renderOrder.toFixed(6)),
        parentName: entry.mesh.parent?.name ?? null,
        vertexCount:
          entry.mesh.geometry?.getAttribute?.("position")?.count ?? 0,
      })),
    };
    if (state.previewRoot?.userData) {
      state.previewRoot.userData.xraySortDebug = summary;
    }
    globalThis.__twinXraySortDebug = summary;
    if (state.previewXraySortDebugFrame <= 5) {
      console.info("[Twin Xray Sort]", summary);
    }
  }

  return {
    isXrayFaceDisplayMode,
    getXrayPreviewFaceOpacity,
    resolveXrayPreviewFaceColor,
    applyXrayPreviewMeshState,
    updateXrayTransparentFaceRenderOrder,
  };
}
