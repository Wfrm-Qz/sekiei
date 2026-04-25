import * as THREE from "three";
import { buildPreviewCompositeSvg } from "../io/exporters.js";
import { t } from "../i18n.js";
import {
  resolveTwinPreviewFaceProfile,
  resolveTwinPreviewLineProfile,
} from "../preview/previewProfiles.js";
import type { TwinPreviewStyleSettings } from "../preview/previewStyleSettings.js";

/**
 * preview 由来 export builder を `main.ts` から切り離す module。
 *
 * ここでは preview 表示中の canvas / overlay / scene を使って、SVG / PNG / JPEG の
 * 生成物を組み立てる。download 実行自体は `exportActions.ts` 側へ残す。
 *
 * 主に扱う日本語文言:
 * - 書き出し用 canvas を生成できませんでした。
 * - PNG blob を生成できませんでした。
 * - JPEG blob を生成できませんでした。
 */

interface PreviewTextOverlayLike {
  text?: string;
  x: number;
  y: number;
  color?: string;
  fontSize?: number | string;
  fontWeight?: string;
  fontFamily?: string;
  align?: string;
}

interface PreviewSurfaceLike {
  dispose?: () => void;
  [key: string]: unknown;
}

interface PreviewExportPolygonCollectionLike {
  polygons: unknown[];
  paths: unknown[];
  opaqueTriangles: unknown[];
  helperPolygons: unknown[];
  debugLog: Record<string, unknown>;
}

interface PreviewExportStateLike {
  previewRoot: THREE.Object3D | null;
  ridgeLines: THREE.Object3D | null;
  intersectionRidgeLines: THREE.Object3D | null;
  axisGuideGroup: THREE.Object3D | null;
  twinRuleGuideGroup: THREE.Object3D | null;
  faceDisplayMode: string;
  previewStyleSettings?: TwinPreviewStyleSettings;
}

type TwinPreviewBoundaryLineCategory =
  | "ridge-surface"
  | "ridge-occluded-interior"
  | "intersection";

export interface TwinPreviewExportContext {
  state: PreviewExportStateLike;
  elements: {
    previewStage: HTMLElement;
    canvas: HTMLCanvasElement;
    xrayFaceCanvas?: HTMLCanvasElement | null;
  };
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  requestPreviewRender: () => void;
  hasNamedAncestor: (
    object: THREE.Object3D | null | undefined,
    name: string,
  ) => boolean;
  getExportSurfaceData: (
    width?: number | null,
    height?: number | null,
  ) => PreviewSurfaceLike | null;
  collectPreviewExportPolygons: (
    width: number,
    height: number,
    surface: PreviewSurfaceLike | null,
    options?: { mergeFaces?: boolean },
  ) => PreviewExportPolygonCollectionLike;
  collectPreviewExportLines: (
    width: number,
    height: number,
    opaqueTriangles: unknown[],
    surface: PreviewSurfaceLike | null,
    options?: {
      includeObject?: (object: THREE.Object3D) => boolean;
    },
  ) => unknown[];
  getPreviewTextOverlays: () => PreviewTextOverlayLike[];
  shouldMergeVectorSvgBodyFacesForExport: () => boolean;
  hasVisibleContactTwinForSvgExport: () => boolean;
}

/** preview 由来 export builder 群を返す。 */
export function createTwinPreviewExportActions(
  context: TwinPreviewExportContext,
) {
  function getBoundaryPreviewLineCategory(
    object: THREE.Object3D,
  ): TwinPreviewBoundaryLineCategory | null {
    const isRidgeLine =
      object.name === "preview-ridge-lines" ||
      context.hasNamedAncestor(object, "preview-ridge-lines");
    const isIntersectionLine =
      object.name === "preview-intersection-ridge-lines" ||
      context.hasNamedAncestor(object, "preview-intersection-ridge-lines");
    if (isIntersectionLine) {
      return "intersection";
    }
    if (!isRidgeLine) {
      return null;
    }
    let current: THREE.Object3D | null = object;
    while (current) {
      const segmentKind = current.userData?.previewRidgeSegmentKind;
      if (segmentKind === "occludedInterior") {
        return "ridge-occluded-interior";
      }
      if (segmentKind === "surface") {
        return "ridge-surface";
      }
      current = current.parent;
    }
    return "ridge-surface";
  }

  function shouldShowBoundaryLineLayer(
    lineProfile: ReturnType<typeof resolveTwinPreviewLineProfile>,
    lineLayer: "front" | "hidden",
    category: TwinPreviewBoundaryLineCategory | null,
  ) {
    if (category === "intersection") {
      return (
        Boolean(context.state.intersectionRidgeLines?.visible) &&
        (lineLayer !== "front" || lineProfile.showFrontLines)
      );
    }
    if (category === "ridge-occluded-interior") {
      return (
        lineLayer === "hidden" &&
        Boolean(context.state.ridgeLines?.visible) &&
        lineProfile.showOccludedInteriorLines
      );
    }
    if (category === "ridge-surface") {
      if (lineLayer === "front") {
        return (
          Boolean(context.state.ridgeLines?.visible) &&
          lineProfile.showFrontLines
        );
      }
      return (
        Boolean(context.state.ridgeLines?.visible) &&
        lineProfile.showHiddenSurfaceLines
      );
    }
    return true;
  }

  /** xray face overlay canvas が見えているときだけ合成対象へ重ねる。 */
  function drawVisibleXrayFaceOverlay(
    drawContext: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    const overlayCanvas = context.elements.xrayFaceCanvas;
    if (!(overlayCanvas instanceof HTMLCanvasElement)) {
      return;
    }
    const computedStyle = window.getComputedStyle(overlayCanvas);
    const overlayOpacity = Number.parseFloat(computedStyle.opacity);
    if (
      computedStyle.display === "none" ||
      computedStyle.visibility === "hidden" ||
      (Number.isFinite(overlayOpacity) && overlayOpacity === 0)
    ) {
      return;
    }
    drawContext.drawImage(overlayCanvas, 0, 0, width, height);
  }

  /**
   * xray preview export では screen-space overlay 用に front line が隠れていることがある。
   *
   * export 側は現在の preview overlay 内部状態ではなく、本来の front/hidden 両方を
   * 線 collector に渡したいので、一時的に可視状態を復元してから callback を実行する。
   */
  function withXrayPreviewLineExportVisibility<T>(callback: () => T) {
    const faceProfile = resolveTwinPreviewFaceProfile(
      context.state.faceDisplayMode,
      context.state.previewStyleSettings?.customFaceProfile,
    );
    const lineProfile = resolveTwinPreviewLineProfile(
      context.state.faceDisplayMode,
      context.state.previewStyleSettings?.customLineProfile,
    );
    if (!context.state.previewRoot || !faceProfile.usesScreenSpaceFaceOverlay) {
      return callback();
    }
    const visibilitySnapshot: { object: THREE.Object3D; visible: boolean }[] =
      [];
    context.state.previewRoot.traverse((object) => {
      const lineLayer = object.userData?.previewLineLayer;
      if (lineLayer !== "front" && lineLayer !== "hidden") {
        return;
      }
      const category = getBoundaryPreviewLineCategory(object);
      visibilitySnapshot.push({
        object,
        visible: object.visible,
      });
      object.visible = shouldShowBoundaryLineLayer(
        lineProfile,
        lineLayer,
        category,
      );
    });
    try {
      return callback();
    } finally {
      visibilitySnapshot.forEach(({ object, visible }) => {
        object.visible = visible;
      });
    }
  }

  /**
   * 現在の preview canvas と text overlay を 1 枚の canvas に合成する。
   *
   * PNG/JPEG 出力だけでなく、raster-backed SVG の本体画像化にも使う。
   */
  function buildPreviewCompositeCanvas(background: string | null = null) {
    const width = Math.max(
      1,
      Math.round(context.elements.previewStage.clientWidth),
    );
    const height = Math.max(
      1,
      Math.round(context.elements.previewStage.clientHeight),
    );
    const exportWidth = Math.max(1, context.elements.canvas.width);
    const exportHeight = Math.max(1, context.elements.canvas.height);
    const scale = exportWidth / width;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    const drawContext = exportCanvas.getContext("2d");
    if (!drawContext) {
      throw new Error(t("export.error.exportCanvas"));
    }
    if (background) {
      drawContext.fillStyle = background;
      drawContext.fillRect(0, 0, exportWidth, exportHeight);
    } else {
      drawContext.clearRect(0, 0, exportWidth, exportHeight);
    }
    drawContext.drawImage(
      context.elements.canvas,
      0,
      0,
      exportWidth,
      exportHeight,
    );
    drawVisibleXrayFaceOverlay(drawContext, exportWidth, exportHeight);

    const overlays = context.getPreviewTextOverlays();
    drawContext.scale(scale, scale);
    overlays.forEach((overlay) => {
      const fontSize = Number(overlay.fontSize) || 16;
      const fontWeight = overlay.fontWeight || "400";
      const fontFamily = overlay.fontFamily || "sans-serif";
      const lines = String(overlay.text ?? "").split(/\r?\n/);
      drawContext.fillStyle = overlay.color ?? "#000000";
      drawContext.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      drawContext.textAlign = overlay.align === "center" ? "center" : "left";
      drawContext.textBaseline = "middle";
      const lineHeight = fontSize * 1.1;
      const startY = overlay.y - (lines.length - 1) * lineHeight * 0.5;
      lines.forEach((line, index) => {
        drawContext.fillText(line, overlay.x, startY + index * lineHeight);
      });
    });

    drawContext.setTransform(1, 0, 0, 1, 0, 0);
    return {
      exportCanvas,
      width,
      height,
      exportWidth,
      exportHeight,
      scale,
      overlays,
    };
  }

  /**
   * 結晶本体だけを raster 化した data URL を返す。
   *
   * 線や guide を一時的に隠して描き直し、SVG では body を画像、線と文字を vector として
   * 合成できるようにする。
   */
  function capturePreviewBodyImageHref({
    keepRasterLineObjects = [],
  }: {
    keepRasterLineObjects?: THREE.Object3D[];
  } = {}) {
    if (!context.state.previewRoot) {
      return "";
    }

    const width = Math.max(1, context.elements.canvas.width);
    const height = Math.max(1, context.elements.canvas.height);
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = width;
    exportCanvas.height = height;
    const drawContext = exportCanvas.getContext("2d");
    if (!drawContext) {
      throw new Error(t("export.error.exportCanvas"));
    }
    drawContext.clearRect(0, 0, width, height);

    const rasterLineSet = new Set(keepRasterLineObjects.filter(Boolean));
    const hiddenTargets = [
      context.state.ridgeLines,
      context.state.intersectionRidgeLines,
      context.state.axisGuideGroup,
      context.state.twinRuleGuideGroup,
    ].filter((target): target is THREE.Object3D =>
      Boolean(target && !rasterLineSet.has(target)),
    );
    const visibilitySnapshot = hiddenTargets.map((target) => ({
      target,
      visible: target.visible,
    }));

    try {
      visibilitySnapshot.forEach(({ target }) => {
        target.visible = false;
      });
      context.renderer.render(context.scene, context.camera);
      drawContext.drawImage(context.elements.canvas, 0, 0, width, height);
    } finally {
      visibilitySnapshot.forEach(({ target, visible }) => {
        target.visible = visible;
      });
      context.requestPreviewRender();
    }

    return exportCanvas.toDataURL("image/png");
  }

  /** 現在の preview から vector/raster 混在 SVG を組み立てる。 */
  function buildPreviewExportSvg({
    includeDebug = false,
  }: { includeDebug?: boolean } = {}) {
    const width = Math.max(
      1,
      Math.round(context.elements.previewStage.clientWidth),
    );
    const height = Math.max(
      1,
      Math.round(context.elements.previewStage.clientHeight),
    );
    const surface = context.getExportSurfaceData(width, height);
    try {
      const { polygons, paths, opaqueTriangles, helperPolygons, debugLog } =
        context.collectPreviewExportPolygons(width, height, surface, {
          mergeFaces: context.shouldMergeVectorSvgBodyFacesForExport(),
        });
      const lines = withXrayPreviewLineExportVisibility(() =>
        context.collectPreviewExportLines(
          width,
          height,
          opaqueTriangles,
          surface,
        ),
      );
      const textOverlays = context.getPreviewTextOverlays();
      const svgMarkup = buildPreviewCompositeSvg({
        width,
        height,
        background: null,
        paths,
        polygons: [...polygons, ...helperPolygons],
        lines,
        textOverlays,
      });
      if (!includeDebug) {
        return svgMarkup;
      }
      return {
        svgMarkup,
        debugLog: {
          ...debugLog,
          generatedAt: new Date().toISOString(),
          helperLineCount: lines.length,
          textOverlayCount: textOverlays.length,
        },
      };
    } finally {
      surface?.dispose?.();
    }
  }

  /**
   * 保守的な raster-backed SVG を組み立てる。
   *
   * full-vector 経路で不安定になりやすいケースの fallback として、body を raster 画像、
   * 線と文字を SVG 要素で保持する。
   */
  function buildPreviewRasterBackedSvg() {
    const width = Math.max(
      1,
      Math.round(context.elements.previewStage.clientWidth),
    );
    const height = Math.max(
      1,
      Math.round(context.elements.previewStage.clientHeight),
    );
    const surface = context.getExportSurfaceData(width, height);
    const keepContactRidgeLinesInRaster =
      context.hasVisibleContactTwinForSvgExport();
    try {
      const { opaqueTriangles } = context.collectPreviewExportPolygons(
        width,
        height,
        surface,
      );
      const lines = withXrayPreviewLineExportVisibility(() =>
        keepContactRidgeLinesInRaster
          ? context.collectPreviewExportLines(
              width,
              height,
              opaqueTriangles,
              surface,
              {
                includeObject(object) {
                  return (
                    context.hasNamedAncestor(object, "axis-guides") ||
                    object.name === "axis-guides" ||
                    context.hasNamedAncestor(object, "twin-rule-guides") ||
                    object.name === "twin-rule-guides"
                  );
                },
              },
            )
          : context.collectPreviewExportLines(
              width,
              height,
              opaqueTriangles,
              surface,
            ),
      );
      return buildPreviewCompositeSvg({
        width,
        height,
        background: null,
        imageHref: capturePreviewBodyImageHref({
          keepRasterLineObjects: keepContactRidgeLinesInRaster
            ? ([
                context.state.ridgeLines,
                context.state.intersectionRidgeLines,
              ].filter(Boolean) as THREE.Object3D[])
            : [],
        }),
        lines,
        textOverlays: context.getPreviewTextOverlays(),
      });
    } finally {
      surface?.dispose?.();
    }
  }

  /** 現在の preview を PNG Blob として取得する。 */
  async function buildPreviewPngBlob() {
    const { exportCanvas } = buildPreviewCompositeCanvas();

    return await new Promise<Blob>((resolve, reject) => {
      exportCanvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error(t("export.error.pngBlob")));
      }, "image/png");
    });
  }

  /** 現在の preview を白背景 JPEG Blob として取得する。 */
  async function buildPreviewJpegBlob() {
    const { exportCanvas } = buildPreviewCompositeCanvas("#ffffff");

    return await new Promise<Blob>((resolve, reject) => {
      exportCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }
          reject(new Error(t("export.error.jpegBlob")));
        },
        "image/jpeg",
        0.92,
      );
    });
  }

  return {
    buildPreviewExportSvg,
    buildPreviewRasterBackedSvg,
    buildPreviewPngBlob,
    buildPreviewJpegBlob,
  };
}

interface PreviewExportRuntimeCrystalLike {
  enabled?: boolean;
  twinType?: string;
  id?: string | null;
}

type PreviewExportRuntimeMeshDataLike = Record<string, unknown>;

interface PreviewExportRuntimeStateLike {
  parameters: {
    crystalSystem: string;
  };
  buildResult: {
    crystalPreviewMeshData?: PreviewExportRuntimeMeshDataLike[] | null;
  } | null;
  previewRoot: THREE.Group | null;
  faceDisplayMode: string;
  previewStyleSettings?: TwinPreviewStyleSettings;
}

interface PreviewExportRuntimeElementsLike {
  previewStage: HTMLElement;
  faceLabelLayer: HTMLElement;
  presetMetadataName: HTMLElement;
  presetMetadataShortDescription: HTMLElement;
}

export interface TwinPreviewExportRuntimeContext {
  state: PreviewExportRuntimeStateLike;
  elements: PreviewExportRuntimeElementsLike;
  camera: THREE.Camera;
  raycaster: THREE.Raycaster;
  isCrystalVisible: (
    crystal: PreviewExportRuntimeCrystalLike | null,
    index: number,
  ) => boolean;
  getTwinCrystals: (
    parameters: PreviewExportRuntimeStateLike["parameters"],
  ) => PreviewExportRuntimeCrystalLike[];
}

/** 名前付き parent をたどって helper object を除外する。 */
function hasNamedAncestor(object: THREE.Object3D | null, name: string) {
  let current = object;
  while (current) {
    if (current.name === name) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/** export 判定に使う material を安全に取り出す。 */
function getExportMaterial(object: THREE.Object3D & { material?: unknown }) {
  return Array.isArray(object.material) ? object.material[0] : object.material;
}

/** world 座標点を SVG export 用 2D 座標へ投影する。 */
function projectWorldPointToExport(
  camera: THREE.Camera,
  worldPoint: THREE.Vector3,
  width: number,
  height: number,
) {
  const projected = worldPoint.clone().project(camera);
  const cameraSpace = worldPoint
    .clone()
    .applyMatrix4(camera.matrixWorldInverse);
  return {
    x: (projected.x + 1) * 0.5 * width,
    y: (1 - projected.y) * 0.5 * height,
    projectedZ: projected.z,
    cameraZ: cameraSpace.z,
  };
}

/** world 線分上の点を線形補間する。 */
function interpolateWorldPoint(
  start: THREE.Vector3,
  end: THREE.Vector3,
  t: number,
) {
  return start.clone().lerp(end, t);
}

/** preview overlay のテキストを export 用に収集する。 */
function getPreviewTextOverlays(elements: PreviewExportRuntimeElementsLike) {
  const stageRect = elements.previewStage.getBoundingClientRect();
  const overlays: {
    text: string;
    x: number;
    y: number;
    align: "left" | "center";
    color: string;
    fontSize: number;
    fontWeight: string;
    fontFamily: string;
  }[] = [];

  const appendTextOverlay = (element: HTMLElement | null | undefined) => {
    if (!element || element.hidden || element.style.display === "none") {
      return;
    }
    const computedStyle = window.getComputedStyle(element);
    if (
      computedStyle.display === "none" ||
      computedStyle.visibility === "hidden" ||
      Number(computedStyle.opacity) === 0
    ) {
      return;
    }
    const text = String(element.textContent ?? "").trim();
    if (!text) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const isCentered =
      element.classList.contains("face-index-label") ||
      element.classList.contains("axis-overlay-label");
    overlays.push({
      text,
      x: rect.left - stageRect.left + (isCentered ? rect.width / 2 : 0),
      y: rect.top - stageRect.top + rect.height / 2,
      align: isCentered ? "center" : "left",
      color: computedStyle.color,
      fontSize: Number.parseFloat(computedStyle.fontSize) || 16,
      fontWeight: computedStyle.fontWeight || "400",
      fontFamily: computedStyle.fontFamily || "sans-serif",
    });
  };

  Array.from(elements.faceLabelLayer.children).forEach((element) =>
    appendTextOverlay(element as HTMLElement),
  );
  appendTextOverlay(elements.presetMetadataName);
  appendTextOverlay(elements.presetMetadataShortDescription);
  return overlays;
}

/** 2D 点が export 三角形の内部にある場合だけ barycentric を返す。 */
function isPointInsideExportTriangle(
  point: { x: number; y: number },
  triangle: {
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    p3: { x: number; y: number };
  },
) {
  const denominator =
    (triangle.p2.y - triangle.p3.y) * (triangle.p1.x - triangle.p3.x) +
    (triangle.p3.x - triangle.p2.x) * (triangle.p1.y - triangle.p3.y);
  if (Math.abs(denominator) < 1e-8) {
    return null;
  }
  const alpha =
    ((triangle.p2.y - triangle.p3.y) * (point.x - triangle.p3.x) +
      (triangle.p3.x - triangle.p2.x) * (point.y - triangle.p3.y)) /
    denominator;
  const beta =
    ((triangle.p3.y - triangle.p1.y) * (point.x - triangle.p3.x) +
      (triangle.p1.x - triangle.p3.x) * (point.y - triangle.p3.y)) /
    denominator;
  const gamma = 1 - alpha - beta;
  if (alpha < -1e-6 || beta < -1e-6 || gamma < -1e-6) {
    return null;
  }
  return { alpha, beta, gamma };
}

/** 指定点を覆う不透明三角形群のうち最も手前の cameraZ を返す。 */
function getClosestOpaqueTriangleDepth(
  point: { x: number; y: number },
  opaqueTriangles: {
    p1: { x: number; y: number; cameraZ: number };
    p2: { x: number; y: number; cameraZ: number };
    p3: { x: number; y: number; cameraZ: number };
  }[],
) {
  let closestDepth = -Infinity;
  for (const triangle of opaqueTriangles) {
    const barycentric = isPointInsideExportTriangle(point, triangle);
    if (!barycentric) {
      continue;
    }
    const depth =
      triangle.p1.cameraZ * barycentric.alpha +
      triangle.p2.cameraZ * barycentric.beta +
      triangle.p3.cameraZ * barycentric.gamma;
    if (depth > closestDepth) {
      closestDepth = depth;
    }
  }
  return closestDepth;
}

/** export 用 visibility 判定に使う occlusion mesh を surface から作る。 */
function buildPreviewExportOcclusionMesh(surface: {
  geometry?: THREE.BufferGeometry | null;
  rootMatrix?: THREE.Matrix4 | null;
  occlusionMesh?: THREE.Mesh | null;
  occlusionMaterial?: THREE.Material | null;
}) {
  if (!surface?.geometry || !surface?.rootMatrix) {
    return null;
  }
  if (surface.occlusionMesh) {
    return surface.occlusionMesh;
  }

  const mesh = new THREE.Mesh(
    surface.geometry,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(surface.rootMatrix);
  mesh.matrixWorld.copy(surface.rootMatrix);
  mesh.visible = true;
  surface.occlusionMesh = mesh;
  surface.occlusionMaterial = mesh.material;
  return mesh;
}

/** world 線分上の点が preview body に隠れていないかを返す。 */
function isWorldLinePointVisibleForExport(
  camera: THREE.Camera,
  raycaster: THREE.Raycaster,
  worldPoint: THREE.Vector3,
  surface: unknown,
  occlusionMesh: THREE.Object3D | null,
  visibilityEpsilon = 1e-4,
) {
  if (!surface || !occlusionMesh) {
    return true;
  }

  const projected = worldPoint.clone().project(camera);
  raycaster.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
  const intersections = raycaster.intersectObject(occlusionMesh, false);
  if (!intersections.length) {
    return true;
  }

  const sampleDistance = worldPoint
    .clone()
    .sub(raycaster.ray.origin)
    .dot(raycaster.ray.direction);
  const closestHit = intersections[0];
  return closestHit.distance >= sampleDistance - visibilityEpsilon;
}

/** 可視/不可視の切替境界を二分探索で近似する。 */
function findWorldVisibilityBoundary(
  camera: THREE.Camera,
  raycaster: THREE.Raycaster,
  startPoint: THREE.Vector3,
  endPoint: THREE.Vector3,
  startVisible: boolean,
  surface: unknown,
  occlusionMesh: THREE.Object3D | null,
) {
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const mid = (low + high) * 0.5;
    const midPoint = interpolateWorldPoint(startPoint, endPoint, mid);
    const midVisible = isWorldLinePointVisibleForExport(
      camera,
      raycaster,
      midPoint,
      surface,
      occlusionMesh,
    );
    if (midVisible === startVisible) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return interpolateWorldPoint(startPoint, endPoint, (low + high) * 0.5);
}

/** world 線分を export 視点で可視な部分だけへ切り分ける。 */
function collectVisibleWorldLineSegments(
  camera: THREE.Camera,
  raycaster: THREE.Raycaster,
  startPoint: THREE.Vector3,
  endPoint: THREE.Vector3,
  width: number,
  height: number,
  surface: unknown,
) {
  const occlusionMesh = buildPreviewExportOcclusionMesh(
    surface as {
      geometry?: THREE.BufferGeometry | null;
      rootMatrix?: THREE.Matrix4 | null;
      occlusionMesh?: THREE.Mesh | null;
      occlusionMaterial?: THREE.Material | null;
    },
  );
  if (!occlusionMesh) {
    const start = projectWorldPointToExport(camera, startPoint, width, height);
    const end = projectWorldPointToExport(camera, endPoint, width, height);
    return [{ x1: start.x, y1: start.y, x2: end.x, y2: end.y }];
  }

  const sampleCount = 48;
  const visibleSegments: { x1: number; y1: number; x2: number; y2: number }[] =
    [];
  let currentSegmentStartWorld: THREE.Vector3 | null = null;
  let previousPointWorld = startPoint.clone();
  let previousVisible = isWorldLinePointVisibleForExport(
    camera,
    raycaster,
    previousPointWorld,
    surface,
    occlusionMesh,
  );

  if (previousVisible) {
    currentSegmentStartWorld = previousPointWorld.clone();
  }

  for (let index = 1; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    const pointWorld = interpolateWorldPoint(startPoint, endPoint, t);
    const pointVisible = isWorldLinePointVisibleForExport(
      camera,
      raycaster,
      pointWorld,
      surface,
      occlusionMesh,
    );

    if (pointVisible !== previousVisible) {
      const boundaryPoint = findWorldVisibilityBoundary(
        camera,
        raycaster,
        previousPointWorld,
        pointWorld,
        previousVisible,
        surface,
        occlusionMesh,
      );

      if (previousVisible && currentSegmentStartWorld) {
        const projectedStart = projectWorldPointToExport(
          camera,
          currentSegmentStartWorld,
          width,
          height,
        );
        const projectedEnd = projectWorldPointToExport(
          camera,
          boundaryPoint,
          width,
          height,
        );
        if (
          Math.abs(projectedEnd.x - projectedStart.x) > 0.25 ||
          Math.abs(projectedEnd.y - projectedStart.y) > 0.25
        ) {
          visibleSegments.push({
            x1: projectedStart.x,
            y1: projectedStart.y,
            x2: projectedEnd.x,
            y2: projectedEnd.y,
          });
        }
        currentSegmentStartWorld = null;
      }

      if (pointVisible) {
        currentSegmentStartWorld = boundaryPoint;
      }
    }

    if (index === sampleCount && pointVisible && currentSegmentStartWorld) {
      const projectedStart = projectWorldPointToExport(
        camera,
        currentSegmentStartWorld,
        width,
        height,
      );
      const projectedEnd = projectWorldPointToExport(
        camera,
        pointWorld,
        width,
        height,
      );
      if (
        Math.abs(projectedEnd.x - projectedStart.x) > 0.25 ||
        Math.abs(projectedEnd.y - projectedStart.y) > 0.25
      ) {
        visibleSegments.push({
          x1: projectedStart.x,
          y1: projectedStart.y,
          x2: projectedEnd.x,
          y2: projectedEnd.y,
        });
      }
    }

    previousPointWorld = pointWorld;
    previousVisible = pointVisible;
  }

  return visibleSegments;
}

/** export 対象として現在表示中の結晶と preview meshData を返す。 */
function getVisibleCrystalEntriesForExport(
  state: PreviewExportRuntimeStateLike,
  isCrystalVisible: (
    crystal: PreviewExportRuntimeCrystalLike | null,
    index: number,
  ) => boolean,
  getTwinCrystals: (
    parameters: PreviewExportRuntimeStateLike["parameters"],
  ) => PreviewExportRuntimeCrystalLike[],
) {
  const crystals = getTwinCrystals(state.parameters);
  const crystalMeshData = state.buildResult?.crystalPreviewMeshData ?? [];
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
  return activeCrystalEntries.filter(({ crystal, index }) =>
    isCrystalVisible(crystal, index),
  );
}

/** xray 表示系で screen-space face overlay canvas を有効化する。 */
function shouldUseScreenSpaceXrayFaceOverlay(
  state: PreviewExportRuntimeStateLike,
) {
  return resolveTwinPreviewFaceProfile(
    state.faceDisplayMode,
    state.previewStyleSettings?.customFaceProfile,
  ).usesScreenSpaceFaceOverlay;
}

/** 双晶 preview export の runtime helper 群を返す。 */
export function createTwinPreviewExportRuntimeActions(
  context: TwinPreviewExportRuntimeContext,
) {
  return {
    hasNamedAncestor,
    getExportMaterial,
    projectWorldPointToExport: (
      worldPoint: THREE.Vector3,
      width: number,
      height: number,
    ) => projectWorldPointToExport(context.camera, worldPoint, width, height),
    interpolateWorldPoint,
    getPreviewTextOverlays: () => getPreviewTextOverlays(context.elements),
    isPointInsideExportTriangle,
    getClosestOpaqueTriangleDepth,
    buildPreviewExportOcclusionMesh,
    isWorldLinePointVisibleForExport: (
      worldPoint: THREE.Vector3,
      surface: unknown,
      occlusionMesh: THREE.Object3D | null,
      visibilityEpsilon = 1e-4,
    ) =>
      isWorldLinePointVisibleForExport(
        context.camera,
        context.raycaster,
        worldPoint,
        surface,
        occlusionMesh,
        visibilityEpsilon,
      ),
    collectVisibleWorldLineSegments: (
      startPoint: THREE.Vector3,
      endPoint: THREE.Vector3,
      width: number,
      height: number,
      surface: unknown,
    ) =>
      collectVisibleWorldLineSegments(
        context.camera,
        context.raycaster,
        startPoint,
        endPoint,
        width,
        height,
        surface,
      ),
    getVisibleCrystalEntriesForExport: () =>
      getVisibleCrystalEntriesForExport(
        context.state,
        context.isCrystalVisible,
        context.getTwinCrystals,
      ),
    shouldUseScreenSpaceXrayFaceOverlay: () =>
      shouldUseScreenSpaceXrayFaceOverlay(context.state),
  };
}
