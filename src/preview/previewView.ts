import * as THREE from "three";
import type { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { usesFourAxisMiller } from "../constants.js";
import type { CrystalSystemId } from "../domain/crystalSystems.js";
import { getTwinCrystals } from "../state/stateHelpers.js";

/**
 * 双晶 preview の「見る」責務をまとめた module。
 *
 * lifecycle、camera 操作、reset / fit、照明切り替えを 1 か所へ寄せ、
 * main.ts からは preview の見え方制御をまとめて扱えるようにする。
 */

interface PreviewLifecycleAxisGuideLike {
  label?: string;
  start?: { x: number; y: number; z: number };
  end?: { x: number; y: number; z: number };
}

interface PreviewLifecycleMeshDataLike {
  axisGuides?: PreviewLifecycleAxisGuideLike[] | null;
}

interface TwinPreviewLifecycleStateLike {
  parameters: {
    crystalSystem: CrystalSystemId;
  };
  buildResult: {
    basePreviewMeshData?: PreviewLifecycleMeshDataLike | null;
  } | null;
  previewRoot: THREE.Group | null;
  axisGuideGroup: THREE.Group | null;
  twinRuleGuideGroup: THREE.Group | null;
  facePickTargetGroup: THREE.Group | null;
  facePickTargets: THREE.Object3D[];
  ridgeLines: THREE.Object3D | null;
  axisLabelAnchors: unknown[];
  twinRuleLabelAnchors: unknown[];
  previewViewState: {
    position: THREE.Vector3;
    target: THREE.Vector3;
    zoom: number;
    up: THREE.Vector3;
  } | null;
  pendingInitialPreviewFit?: boolean;
  pendingPreviewRefit?: boolean;
}

export interface TwinPreviewLifecycleContext {
  state: TwinPreviewLifecycleStateLike;
  scene: THREE.Scene;
  elements: {
    faceLabelLayer: HTMLElement;
  };
  initialBAxisRotationRad: number;
  initialCAxisRotationRad: number;
  fitPreviewToObject: (root: THREE.Group) => void;
  capturePreviewViewState: () => {
    position: THREE.Vector3;
    target: THREE.Vector3;
    zoom: number;
    up: THREE.Vector3;
  };
  renderAxisViewButtons: () => void;
  requestPreviewOverlayUpdate: () => void;
  requestPreviewRender: () => void;
}

interface TwinPreviewVertexLike {
  x: number;
  y: number;
  z: number;
}

interface TwinPreviewMeshDataLike {
  vertices?: TwinPreviewVertexLike[] | null;
}

interface TwinPreviewBuildResultLike {
  crystalPreviewMeshData?: TwinPreviewMeshDataLike[] | null;
}

interface TwinPreviewFacePickUserDataLike {
  userData?: {
    faceNormal?: THREE.Vector3;
    crystalIndex?: number;
    faceId?: string;
    faceGroupKey?: string;
  };
}

interface TwinPreviewAxisGuideLike {
  label: string;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
}

interface TwinPreviewControlsStateLike {
  parameters: {
    crystals?: { enabled?: boolean }[];
  };
  buildResult: TwinPreviewBuildResultLike | null;
  previewRoot: THREE.Group | null;
  previewViewState: {
    position: THREE.Vector3;
    target: THREE.Vector3;
    zoom: number;
    up: THREE.Vector3;
  } | null;
  pendingInitialPreviewFit?: boolean;
  pendingPreviewRefit?: boolean;
  facePickTargets: THREE.Object3D[];
  isPreviewDragging: boolean;
  previewDragButton: number | null;
  previewInertiaActive: boolean;
  faceDisplayMode: string;
}

interface TwinPreviewControlsElementsLike {
  canvas: HTMLCanvasElement;
  previewStage: HTMLElement;
  xrayFaceCanvas: HTMLElement | null;
}

export interface TwinPreviewControlsContext {
  state: TwinPreviewControlsStateLike;
  elements: TwinPreviewControlsElementsLike;
  camera: THREE.OrthographicCamera;
  controls: TrackballControls;
  renderer: THREE.WebGLRenderer;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  previewHelperNames: Set<string>;
  orthoCameraDistance: number;
  fitMargin: number;
  initialPreviewZoomMultiplier: number;
  requestPreviewRender: () => void;
  requestPreviewOverlayUpdate: () => void;
  syncFaceListToPreviewFace: (
    crystalIndex: number,
    faceId: string | undefined,
    groupKey: string | undefined,
  ) => void;
  getPreviewAxisGuides: () => TwinPreviewAxisGuideLike[];
  shouldUseScreenSpaceXrayFaceOverlay: () => boolean;
  isCrystalVisible: (
    crystal: { enabled?: boolean } | null,
    index: number,
  ) => boolean;
  updateWideLineResolutions: (root: THREE.Object3D | null) => void;
}

export interface TwinPreviewLightingContext {
  previewAmbientLight: THREE.AmbientLight;
  previewKeyLight: THREE.DirectionalLight;
  previewFillLight: THREE.DirectionalLight;
}

interface TrackballControlsInternalLike extends TrackballControls {
  _target0?: THREE.Vector3;
  _position0?: THREE.Vector3;
  _up0?: THREE.Vector3;
  _zoom0?: number;
  _lastPosition?: THREE.Vector3;
  _lastZoom?: number;
  _eye?: THREE.Vector3;
  _movePrev?: THREE.Vector2;
  _moveCurr?: THREE.Vector2;
  _zoomStart?: THREE.Vector2;
  _zoomEnd?: THREE.Vector2;
  _panStart?: THREE.Vector2;
  _panEnd?: THREE.Vector2;
  _lastAngle?: number;
  state?: number;
  keyState?: number;
}

/** 直交 3 軸の軸ガイドから preview 用基底変換を作る。 */
function createPreviewBaseTransform(
  axisGuides: PreviewLifecycleAxisGuideLike[] | null | undefined,
) {
  const aAxis =
    axisGuides?.find((axis) => axis.label === "a") ??
    axisGuides?.find((axis) => axis.label === "a1");
  const bAxis =
    axisGuides?.find((axis) => axis.label === "b") ??
    axisGuides?.find((axis) => axis.label === "a2");
  const cAxis = axisGuides?.find((axis) => axis.label === "c");

  if (!aAxis || !bAxis || !cAxis) {
    return new THREE.Matrix4().identity();
  }

  const forward = new THREE.Vector3(
    aAxis.end.x - aAxis.start.x,
    aAxis.end.y - aAxis.start.y,
    aAxis.end.z - aAxis.start.z,
  ).normalize();
  const bVector = new THREE.Vector3(
    bAxis.end.x - bAxis.start.x,
    bAxis.end.y - bAxis.start.y,
    bAxis.end.z - bAxis.start.z,
  );
  const cVector = new THREE.Vector3(
    cAxis.end.x - cAxis.start.x,
    cAxis.end.y - cAxis.start.y,
    cAxis.end.z - cAxis.start.z,
  );

  if (forward.lengthSq() === 0 || cVector.lengthSq() === 0) {
    return new THREE.Matrix4().identity();
  }

  const up = cVector.clone().projectOnPlane(forward);
  if (up.lengthSq() === 0) {
    up.set(0, 1, 0).projectOnPlane(forward);
  }
  if (up.lengthSq() === 0) {
    up.set(0, 0, 1).projectOnPlane(forward);
  }
  up.normalize();

  const right = new THREE.Vector3().crossVectors(up, forward).normalize();
  const bProjected = bVector.clone().projectOnPlane(forward);
  if (bProjected.lengthSq() > 0 && bProjected.dot(right) < 0) {
    right.multiplyScalar(-1);
    up.multiplyScalar(-1);
  }

  return new THREE.Matrix4().set(
    right.x,
    right.y,
    right.z,
    0,
    up.x,
    up.y,
    up.z,
    0,
    forward.x,
    forward.y,
    forward.z,
    0,
    0,
    0,
    0,
    1,
  );
}

/** 四指数系の軸ガイドから preview 用基底変換を作る。 */
function createFourAxisPreviewBaseTransform(
  axisGuides: PreviewLifecycleAxisGuideLike[] | null | undefined,
) {
  if (!Array.isArray(axisGuides) || axisGuides.length === 0) {
    return new THREE.Matrix4().identity();
  }

  const a1Axis = axisGuides.find((axis) => axis.label === "a1") ?? null;
  const a2Axis = axisGuides.find((axis) => axis.label === "a2") ?? null;
  const cAxis = axisGuides.find((axis) => axis.label === "c") ?? null;
  if (
    !a1Axis?.start ||
    !a1Axis.end ||
    !a2Axis?.start ||
    !a2Axis.end ||
    !cAxis?.start ||
    !cAxis.end
  ) {
    return new THREE.Matrix4().identity();
  }

  const right = new THREE.Vector3(
    a2Axis.end.x - a2Axis.start.x,
    a2Axis.end.y - a2Axis.start.y,
    a2Axis.end.z - a2Axis.start.z,
  ).normalize();
  const cVector = new THREE.Vector3(
    cAxis.end.x - cAxis.start.x,
    cAxis.end.y - cAxis.start.y,
    cAxis.end.z - cAxis.start.z,
  );
  const a1Vector = new THREE.Vector3(
    a1Axis.end.x - a1Axis.start.x,
    a1Axis.end.y - a1Axis.start.y,
    a1Axis.end.z - a1Axis.start.z,
  );

  if (right.lengthSq() === 0 || cVector.lengthSq() === 0) {
    return new THREE.Matrix4().identity();
  }

  const up = cVector.clone().projectOnPlane(right);
  if (up.lengthSq() === 0) {
    return new THREE.Matrix4().identity();
  }
  up.normalize();

  const forward = new THREE.Vector3().crossVectors(right, up).normalize();
  const a1Projected = a1Vector.clone().projectOnPlane(right);
  if (a1Projected.lengthSq() > 0 && a1Projected.dot(forward) < 0) {
    forward.multiplyScalar(-1);
  }

  return new THREE.Matrix4().set(
    right.x,
    right.y,
    right.z,
    0,
    up.x,
    up.y,
    up.z,
    0,
    forward.x,
    forward.y,
    forward.z,
    0,
    0,
    0,
    0,
    1,
  );
}

/**
 * 基底変換直後の c 軸方向を見て、まず world X、次に world Z の順で回し +Y へ揃える。
 *
 * これにより単斜・三斜でも c 軸が screen 上下方向の基準になり、
 * 後段の固定 Y/X 回転が結晶系ごとに大きくぶれにくくなる。
 */
function alignPreviewCAxisToY(
  previewRoot: THREE.Group,
  axisGuides: PreviewLifecycleAxisGuideLike[] | null | undefined,
  crystalSystem: string,
) {
  if (crystalSystem !== "monoclinic" && crystalSystem !== "triclinic") {
    return;
  }

  const cAxis = axisGuides?.find((axis) => axis.label === "c");
  if (!cAxis?.start || !cAxis.end) {
    return;
  }

  const cVector = new THREE.Vector3(
    cAxis.end.x - cAxis.start.x,
    cAxis.end.y - cAxis.start.y,
    cAxis.end.z - cAxis.start.z,
  );
  if (cVector.lengthSq() === 0) {
    return;
  }

  const currentCDirection = cVector
    .clone()
    .applyQuaternion(previewRoot.quaternion);
  if (currentCDirection.lengthSq() === 0) {
    return;
  }
  currentCDirection.normalize();

  const rotateX = -Math.atan2(currentCDirection.z, currentCDirection.y);
  if (Math.abs(rotateX) > 1e-8) {
    previewRoot.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), rotateX);
  }

  const xAlignedCDirection = cVector
    .clone()
    .applyQuaternion(previewRoot.quaternion);
  if (xAlignedCDirection.lengthSq() === 0) {
    return;
  }
  xAlignedCDirection.normalize();

  const rotateZ = Math.atan2(xAlignedCDirection.x, xAlignedCDirection.y);
  if (Math.abs(rotateZ) > 1e-8) {
    previewRoot.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), rotateZ);
  }
}

/** 結晶系に応じた preview 初期姿勢を previewRoot へ適用する。 */
function applyPreviewOrientation(
  previewRoot: THREE.Group,
  meshData: PreviewLifecycleMeshDataLike | null | undefined,
  crystalSystem: string,
  initialBAxisRotationRad: number,
  initialCAxisRotationRad: number,
) {
  if (usesFourAxisMiller(crystalSystem)) {
    previewRoot.applyMatrix4(
      createFourAxisPreviewBaseTransform(meshData?.axisGuides),
    );
  } else {
    previewRoot.applyMatrix4(createPreviewBaseTransform(meshData?.axisGuides));
  }
  alignPreviewCAxisToY(previewRoot, meshData?.axisGuides, crystalSystem);
  previewRoot.rotateOnWorldAxis(
    new THREE.Vector3(0, 1, 0),
    initialCAxisRotationRad,
  );
  previewRoot.rotateOnWorldAxis(
    new THREE.Vector3(1, 0, 0),
    initialBAxisRotationRad,
  );
}

/** 現在の preview camera / controls 状態を保存する。 */
function capturePreviewViewState(
  camera: THREE.OrthographicCamera,
  controls: TrackballControls,
) {
  return {
    position: camera.position.clone(),
    target: controls.target.clone(),
    zoom: camera.zoom,
    up: camera.up.clone(),
  };
}

/**
 * TrackballControls は pan / zoom の差分を内部 field に持っているため、
 * camera と target を手動で置き直しただけでは、次の update で古い差分を再適用しうる。
 * ここでは fit / reset / 軸方向切替などの直後に内部基準点も現在姿勢へ揃え、
 * 「一度でも動かすと次の fit がずれる」系の不具合を防ぐ。
 */
function syncTrackballControlsInternalState(
  camera: THREE.OrthographicCamera,
  controls: TrackballControls,
) {
  const internalControls = controls as TrackballControlsInternalLike;

  internalControls._target0?.copy(controls.target);
  internalControls._position0?.copy(camera.position);
  internalControls._up0?.copy(camera.up);
  if (typeof internalControls._zoom0 === "number") {
    internalControls._zoom0 = camera.zoom;
  }

  internalControls._lastPosition?.copy(camera.position);
  if (typeof internalControls._lastZoom === "number") {
    internalControls._lastZoom = camera.zoom;
  }
  internalControls._eye?.subVectors(camera.position, controls.target);

  if (internalControls._movePrev && internalControls._moveCurr) {
    internalControls._movePrev.copy(internalControls._moveCurr);
  }
  if (internalControls._zoomStart && internalControls._zoomEnd) {
    internalControls._zoomStart.copy(internalControls._zoomEnd);
  }
  if (internalControls._panStart && internalControls._panEnd) {
    internalControls._panStart.copy(internalControls._panEnd);
  }
  if (typeof internalControls._lastAngle === "number") {
    internalControls._lastAngle = 0;
  }
  if (typeof internalControls.state === "number") {
    internalControls.state = -1;
  }
  if (typeof internalControls.keyState === "number") {
    internalControls.keyState = -1;
  }
}

/** 面法線に対して自然な上方向ベクトルを作る。 */
function projectUpOntoFace(
  normal: THREE.Vector3,
  camera: THREE.OrthographicCamera,
) {
  const candidates = [
    camera.up.clone(),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 0, 0),
  ];
  for (const candidate of candidates) {
    const projected = candidate.sub(
      normal.clone().multiplyScalar(candidate.dot(normal)),
    );
    if (projected.lengthSq() > 1e-8) {
      return projected.normalize();
    }
  }
  return new THREE.Vector3(0, 1, 0);
}

/** 方向ベクトルに対して UI 用の上方向を投影して求める。 */
function projectUpOntoDirection(
  direction: THREE.Vector3,
  axisDirections: THREE.Vector3[],
  camera: THREE.OrthographicCamera,
  preferredUp: THREE.Vector3 | null = null,
) {
  const candidateVectors = [
    ...(preferredUp ? [preferredUp.clone()] : []),
    ...axisDirections.map((axisDirection) => axisDirection.clone()),
    camera.up.clone(),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 0, 0),
  ];

  for (const candidate of candidateVectors) {
    const projected = candidate.sub(
      direction.clone().multiplyScalar(candidate.dot(direction)),
    );
    if (projected.lengthSq() > 1e-8) {
      return projected.normalize();
    }
  }

  return new THREE.Vector3(0, 1, 0);
}

/**
 * axis guide の中点から、preview 上で使う結晶中心（各軸の交点）を求める。
 *
 * guide の `start` / `end` は軸線の両端で、交点そのものではない。
 * そのため、回転中心や fit target は各 guide の中点を使う。
 */
function buildPreviewOrbitTargetFromAxisGuides(
  axisGuides: TwinPreviewAxisGuideLike[],
) {
  if (!Array.isArray(axisGuides) || axisGuides.length === 0) {
    return null;
  }

  const uniqueOrigins: THREE.Vector3[] = [];
  axisGuides.forEach((axis) => {
    const origin = new THREE.Vector3(
      (axis.start.x + axis.end.x) / 2,
      (axis.start.y + axis.end.y) / 2,
      (axis.start.z + axis.end.z) / 2,
    );
    const hasSamePoint = uniqueOrigins.some(
      (point) => point.distanceToSquared(origin) < 1e-12,
    );
    if (!hasSamePoint) {
      uniqueOrigins.push(origin);
    }
  });

  if (uniqueOrigins.length === 0) {
    return null;
  }

  return uniqueOrigins
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .divideScalar(uniqueOrigins.length);
}

/** 可視 preview meshData 全体を包む bounding box を作る。 */
function expandBoxByVisiblePreviewMeshData(
  box: THREE.Box3,
  state: TwinPreviewControlsStateLike,
  isCrystalVisible: TwinPreviewControlsContext["isCrystalVisible"],
) {
  const root = state.previewRoot;
  if (!root || !state.buildResult?.crystalPreviewMeshData?.length) {
    return false;
  }

  root.updateMatrixWorld(true);
  const rootMatrix = root.matrixWorld.clone();
  const crystals = getTwinCrystals(state.parameters);
  let hasBounds = false;
  state.buildResult.crystalPreviewMeshData.forEach((meshData, index) => {
    const crystal = crystals[index] ?? null;
    const isEnabled = index === 0 || crystal?.enabled !== false;
    if (!isEnabled || !isCrystalVisible(crystal, index)) {
      return;
    }
    (meshData?.vertices ?? []).forEach((vertex) => {
      box.expandByPoint(
        new THREE.Vector3(vertex.x, vertex.y, vertex.z).applyMatrix4(
          rootMatrix,
        ),
      );
      hasBounds = true;
    });
  });
  return hasBounds;
}

/** preview 照明 action 群を返す。 */
export function createTwinPreviewLightingActions(
  context: TwinPreviewLightingContext,
) {
  /** 現在の面表示モードに合わせて照明設定を切り替える。 */
  function applyPreviewLightingMode() {
    context.previewAmbientLight.color.set(0xffffff);
    context.previewKeyLight.color.set(0xffffff);
    context.previewFillLight.color.set(0xffffff);
  }

  return {
    applyPreviewLightingMode,
  };
}

export function createTwinPreviewLifecycleActions(
  context: TwinPreviewLifecycleContext,
) {
  /** 旧 preview child を破棄し、root 自体は再利用する。 */
  function clearPreviewRootChildren() {
    if (!context.state.previewRoot) {
      return;
    }
    context.state.previewRoot.userData.xrayScreenOverlayLogged = false;
    context.state.previewRoot.userData.xrayScreenOverlayDebug = null;
    const staleChildren = [...context.state.previewRoot.children];
    staleChildren.forEach((child) => {
      context.state.previewRoot?.remove(child);
      child.traverse((node) => {
        if (node.geometry) {
          node.geometry.dispose();
        }
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach((material) => material.dispose());
          } else {
            node.material.dispose();
          }
        }
      });
    });
  }

  /** preview group が組めなかった場合の state を初期化する。 */
  function resetPreviewLifecycleState() {
    context.state.axisGuideGroup = null;
    context.state.twinRuleGuideGroup = null;
    context.state.facePickTargetGroup = null;
    context.state.facePickTargets = [];
    context.state.ridgeLines = null;
    context.state.axisLabelAnchors = [];
    context.state.twinRuleLabelAnchors = [];
    context.elements.faceLabelLayer.innerHTML = "";
    context.renderAxisViewButtons();
  }

  /** previewRoot が必要なら生成して scene へ追加する。 */
  function ensurePreviewRoot(nextPreviewGroup: THREE.Group | null) {
    if (!context.state.previewRoot && nextPreviewGroup) {
      context.state.previewRoot = new THREE.Group();
      context.scene.add(context.state.previewRoot);
    }
  }

  /** preview group 再構築時は毎回初期姿勢を作り直す。 */
  function restorePreviewOrientation() {
    if (!context.state.previewRoot) {
      return;
    }
    context.state.previewRoot.quaternion.identity();
    applyPreviewOrientation(
      context.state.previewRoot,
      context.state.buildResult?.basePreviewMeshData,
      context.state.parameters.crystalSystem,
      context.initialBAxisRotationRad,
      context.initialCAxisRotationRad,
    );
  }

  /**
   * 新しく組んだ preview group を root へ適用する。
   *
   * 戻り値は「previewRoot が以前から存在していたか」で、初回 fit 判定に使う。
   */
  function applyPreviewGroup(nextPreviewGroup: THREE.Group | null) {
    const hadPreviewRoot = Boolean(context.state.previewRoot);
    const shouldFitToRoot =
      !hadPreviewRoot || context.state.pendingPreviewRefit;
    ensurePreviewRoot(nextPreviewGroup);
    clearPreviewRootChildren();

    if (!nextPreviewGroup || !context.state.previewRoot) {
      resetPreviewLifecycleState();
      return { hadPreviewRoot };
    }

    restorePreviewOrientation();
    context.state.previewRoot.add(...nextPreviewGroup.children);
    if (shouldFitToRoot) {
      context.fitPreviewToObject(context.state.previewRoot);
      context.state.previewViewState = context.capturePreviewViewState();
      context.state.pendingInitialPreviewFit = true;
      context.state.pendingPreviewRefit = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (
            !context.state.pendingInitialPreviewFit ||
            !context.state.previewRoot
          ) {
            return;
          }
          context.fitPreviewToObject(context.state.previewRoot);
          context.state.previewViewState = context.capturePreviewViewState();
          context.state.pendingInitialPreviewFit = false;
          context.requestPreviewOverlayUpdate();
        });
      });
    }
    context.renderAxisViewButtons();
    context.requestPreviewOverlayUpdate();
    context.requestPreviewRender();
    return { hadPreviewRoot };
  }

  return {
    applyPreviewGroup,
  };
}

export function createTwinPreviewControlActions(
  context: TwinPreviewControlsContext,
) {
  /** ダブルクリックした面へ preview を正対させる。 */
  function orientPreviewToFace(intersection: THREE.Intersection) {
    const intersectionObject = intersection?.object as
      | (THREE.Object3D & TwinPreviewFacePickUserDataLike)
      | undefined;
    if (!intersectionObject?.userData?.faceNormal) {
      return;
    }

    const faceNormal = intersectionObject.userData.faceNormal
      .clone()
      .transformDirection(intersectionObject.matrixWorld)
      .normalize();
    const orbitTarget = context.controls.target.clone();
    const distance = Math.max(
      context.camera.position.distanceTo(orbitTarget),
      1,
    );

    // 面ダブルクリックは「視線方向を面法線へ合わせる」機能として扱う。
    // ここで OrbitControls の target を面中心へ移すと、その後の回転中心まで
    // 面中心へ変わってしまうため、回転中心は現在の target のまま維持する。
    context.camera.up.copy(projectUpOntoFace(faceNormal, context.camera));
    context.camera.position.copy(
      orbitTarget.clone().add(faceNormal.multiplyScalar(distance)),
    );
    context.camera.lookAt(orbitTarget);
    context.camera.updateProjectionMatrix();
    syncTrackballControlsInternalState(context.camera, context.controls);
    context.controls.update();
    context.state.previewViewState = capturePreviewViewState(
      context.camera,
      context.controls,
    );
    context.requestPreviewOverlayUpdate();
    context.syncFaceListToPreviewFace(
      Number(intersectionObject.userData.crystalIndex),
      intersectionObject.userData.faceId,
      intersectionObject.userData.faceGroupKey,
    );
  }

  /** preview 上のダブルクリックを面選択として処理する。 */
  function handlePreviewDoubleClick(event: MouseEvent) {
    if (
      !context.state.previewRoot ||
      context.state.facePickTargets.length === 0
    ) {
      return;
    }

    const rect = context.elements.canvas.getBoundingClientRect();
    context.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    context.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    context.raycaster.setFromCamera(context.pointer, context.camera);
    const intersections = context.raycaster.intersectObjects(
      context.state.facePickTargets,
      false,
    );
    if (intersections.length === 0) {
      return;
    }

    orientPreviewToFace(intersections[0]);
  }

  /** 指定軸方向から見る camera 姿勢へ切り替える。 */
  function orientPreviewToAxis(axisLabel: string) {
    if (!context.state.previewRoot) {
      return;
    }

    const axisGuides = context.getPreviewAxisGuides();
    const selectedAxis = axisGuides.find((axis) => axis.label === axisLabel);
    if (!selectedAxis) {
      return;
    }

    const axisOrigin =
      buildPreviewOrbitTargetFromAxisGuides(axisGuides) ??
      new THREE.Vector3(0, 0, 0);
    const target = context.state.previewRoot.localToWorld(axisOrigin);
    const direction = context.state.previewRoot
      .localToWorld(
        new THREE.Vector3(
          selectedAxis.end.x,
          selectedAxis.end.y,
          selectedAxis.end.z,
        ),
      )
      .sub(
        context.state.previewRoot.localToWorld(
          new THREE.Vector3(
            selectedAxis.start.x,
            selectedAxis.start.y,
            selectedAxis.start.z,
          ),
        ),
      );

    if (direction.lengthSq() === 0) {
      return;
    }

    direction.normalize();
    const aAxis =
      axisGuides.find((axis) => axis.label === "a") ??
      axisGuides.find((axis) => axis.label === "a1");
    const cAxis = axisGuides.find((axis) => axis.label === "c");
    const axisDirections = axisGuides
      .filter((axis) => axis.label !== axisLabel)
      .map((axis) =>
        context.state
          .previewRoot!.localToWorld(
            new THREE.Vector3(axis.end.x, axis.end.y, axis.end.z),
          )
          .sub(
            context.state.previewRoot!.localToWorld(
              new THREE.Vector3(axis.start.x, axis.start.y, axis.start.z),
            ),
          )
          .normalize(),
      )
      .filter((axisDirection) => axisDirection.lengthSq() > 0);
    const shouldPreferCAxisUp =
      ["a", "b", "a1", "a2", "a3"].includes(axisLabel) && cAxis;
    const preferredUp = shouldPreferCAxisUp
      ? context.state.previewRoot
          .localToWorld(
            new THREE.Vector3(cAxis.end.x, cAxis.end.y, cAxis.end.z),
          )
          .sub(
            context.state.previewRoot.localToWorld(
              new THREE.Vector3(cAxis.start.x, cAxis.start.y, cAxis.start.z),
            ),
          )
          .normalize()
      : axisLabel === "c" && aAxis
        ? context.state.previewRoot
            .localToWorld(
              new THREE.Vector3(aAxis.start.x, aAxis.start.y, aAxis.start.z),
            )
            .sub(
              context.state.previewRoot.localToWorld(
                new THREE.Vector3(aAxis.end.x, aAxis.end.y, aAxis.end.z),
              ),
            )
            .normalize()
        : null;

    const distance = Math.max(
      context.camera.position.distanceTo(context.controls.target),
      1,
    );
    context.controls.target.copy(target);
    context.camera.up.copy(
      projectUpOntoDirection(
        direction,
        axisDirections,
        context.camera,
        preferredUp,
      ),
    );
    context.camera.position.copy(
      target.clone().add(direction.multiplyScalar(distance)),
    );
    context.camera.lookAt(target);
    context.camera.updateProjectionMatrix();
    syncTrackballControlsInternalState(context.camera, context.controls);
    context.controls.update();
    context.state.previewViewState = capturePreviewViewState(
      context.camera,
      context.controls,
    );
    context.requestPreviewOverlayUpdate();
  }

  /** 可視 preview object 全体が収まるよう camera を再フィットする。 */
  function fitPreviewToObject(object: THREE.Object3D) {
    const box = new THREE.Box3();
    let hasRenderableBounds = false;

    if (context.shouldUseScreenSpaceXrayFaceOverlay()) {
      hasRenderableBounds = expandBoxByVisiblePreviewMeshData(
        box,
        context.state,
        context.isCrystalVisible,
      );
    }

    object.children.forEach((child) => {
      if (context.previewHelperNames.has(child.name)) {
        return;
      }
      box.expandByObject(child);
      hasRenderableBounds = true;
    });

    if (!hasRenderableBounds) {
      box.setFromObject(object);
    }

    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const axisOrigin =
      buildPreviewOrbitTargetFromAxisGuides(context.getPreviewAxisGuides()) ??
      new THREE.Vector3(0, 0, 0);
    const orbitTarget = object.localToWorld(axisOrigin);
    context.camera.up.set(0, 1, 0);
    context.camera.position.set(
      orbitTarget.x,
      orbitTarget.y,
      orbitTarget.z + context.orthoCameraDistance,
    );
    context.camera.lookAt(orbitTarget);
    context.controls.target.copy(orbitTarget);
    const diameter = Math.max(sphere.radius * 2, 1);
    const { clientWidth, clientHeight } = context.elements.previewStage;
    context.camera.zoom =
      (Math.min(clientWidth, clientHeight) / (diameter * context.fitMargin)) *
      context.initialPreviewZoomMultiplier;
    context.camera.updateProjectionMatrix();
    syncTrackballControlsInternalState(context.camera, context.controls);
    context.controls.update();
    context.requestPreviewRender();
  }

  /** 現在の preview root を画面へ収める標準視点へ戻す。 */
  function resetPreviewViewToFit() {
    if (!context.state.previewRoot) {
      return;
    }
    context.state.pendingInitialPreviewFit = false;
    context.state.pendingPreviewRefit = false;
    context.state.previewInertiaActive = false;
    context.state.isPreviewDragging = false;
    context.state.previewDragButton = null;
    fitPreviewToObject(context.state.previewRoot);
    context.state.previewViewState = capturePreviewViewState(
      context.camera,
      context.controls,
    );
    const summary = {
      mode: context.state.faceDisplayMode,
      position: {
        x: Number(context.camera.position.x.toFixed(6)),
        y: Number(context.camera.position.y.toFixed(6)),
        z: Number(context.camera.position.z.toFixed(6)),
      },
      target: {
        x: Number(context.controls.target.x.toFixed(6)),
        y: Number(context.controls.target.y.toFixed(6)),
        z: Number(context.controls.target.z.toFixed(6)),
      },
      zoom: Number(context.camera.zoom.toFixed(6)),
    };
    globalThis.__twinPreviewResetDebug = summary;
    console.info("[Twin Preview Reset]", summary);
  }

  /** preview stage の実サイズに合わせて renderer / camera / wide line 解像度を更新する。 */
  function resizeRenderer() {
    const width = Math.max(context.elements.previewStage.clientWidth, 1);
    const height = Math.max(context.elements.previewStage.clientHeight, 1);
    context.renderer.setSize(width, height, false);
    if (context.elements.xrayFaceCanvas instanceof HTMLCanvasElement) {
      context.elements.xrayFaceCanvas.width = width;
      context.elements.xrayFaceCanvas.height = height;
    }
    context.camera.left = -width / 2;
    context.camera.right = width / 2;
    context.camera.top = height / 2;
    context.camera.bottom = -height / 2;
    context.camera.updateProjectionMatrix();
    context.controls.handleResize();
    context.updateWideLineResolutions(context.state.previewRoot);
    context.requestPreviewOverlayUpdate();
    context.requestPreviewRender();
  }

  return {
    capturePreviewViewState: () =>
      capturePreviewViewState(context.camera, context.controls),
    fitPreviewToObject,
    orientPreviewToAxis,
    orientPreviewToFace,
    handlePreviewDoubleClick,
    resetPreviewViewToFit,
    resizeRenderer,
  };
}
