import * as THREE from "three";
import {
  resolveTwinPreviewFaceProfile,
  resolveTwinPreviewLineProfile,
  type TwinPreviewHiddenLineColorMode,
} from "./previewProfiles.js";
import type { TwinPreviewStyleSettings } from "./previewStyleSettings.js";

/**
 * 双晶 preview の screen-space xray overlay を担当する module。
 *
 * 半透明表示時の面色合成は per-pixel depth 合成で重く、表示条件や debug も絡む。
 * page entry から本体を切り離して、xray overlay の責務をこの file に集約する。
 */

interface TwinXrayOverlayStateLike {
  faceDisplayMode: string;
  previewStyleSettings?: TwinPreviewStyleSettings;
  previewRoot: (THREE.Group & { userData?: Record<string, unknown> }) | null;
  ridgeLines: THREE.Object3D | null;
  intersectionRidgeLines: THREE.Object3D | null;
  showRidgeLines: boolean;
  showIntersectionRidgeLines: boolean;
  buildResult: {
    previewFinalGeometry?: THREE.BufferGeometry | null;
    finalGeometry?: THREE.BufferGeometry | null;
  } | null;
}

interface TwinXrayOverlayVisibleCrystalEntryLike {
  index: number;
  meshData: {
    faces?:
      | {
          id?: string | null;
          vertices?: { x: number; y: number; z: number }[];
        }[]
      | null;
  } | null;
}

export interface TwinXrayOverlayContext {
  state: TwinXrayOverlayStateLike;
  previewStage: HTMLElement;
  xrayFaceCanvas: HTMLElement | null;
  isPreviewRotating: () => boolean;
  shouldUseScreenSpaceXrayFaceOverlay: () => boolean;
  getVisibleCrystalEntriesForExport: () => TwinXrayOverlayVisibleCrystalEntryLike[];
  getSourceFacesForCrystalIndex: (crystalIndex: number) => unknown[];
  resolveXrayPreviewFaceColor: (
    faceId: string | null | undefined,
    sourceFaces: unknown[],
    crystalIndex: number,
  ) => string;
  projectWorldPointToExport: (
    worldPoint: THREE.Vector3,
    width: number,
    height: number,
  ) => { x: number; y: number; cameraZ: number };
  getXrayPreviewFaceOpacity: (hasFinal: boolean) => number;
  hasNamedAncestor: (object: THREE.Object3D | null, name: string) => boolean;
  getExportSurfaceData: (
    width: number,
    height: number,
  ) => { dispose?: (() => void) | null } | null;
  collectTransparentXrayExportTriangles: (
    width: number,
    height: number,
    rootMatrix?: THREE.Matrix4 | null,
  ) => {
    opaqueTriangles: {
      p1: { x: number; y: number; cameraZ: number };
      p2: { x: number; y: number; cameraZ: number };
      p3: { x: number; y: number; cameraZ: number };
    }[];
  };
  collectPreviewExportLines: (
    width: number,
    height: number,
    opaqueTriangles: {
      p1: { x: number; y: number; cameraZ: number };
      p2: { x: number; y: number; cameraZ: number };
      p3: { x: number; y: number; cameraZ: number };
    }[],
    surface: unknown,
    options?: {
      includeObject?: ((object: THREE.Object3D) => boolean) | null;
    },
  ) => {
    stroke: string;
    strokeOpacity: number;
    strokeWidth: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }[];
}

/** 現在 mode の overlay 利用 profile を返す。 */
function getOverlayProfiles(context: TwinXrayOverlayContext) {
  const faceProfile = resolveTwinPreviewFaceProfile(
    context.state.faceDisplayMode,
    context.state.previewStyleSettings?.customFaceProfile,
  );
  const lineProfile = resolveTwinPreviewLineProfile(
    context.state.faceDisplayMode,
    context.state.previewStyleSettings?.customLineProfile,
  );
  return { faceProfile, lineProfile };
}

/** profile と runtime 条件から screen-space overlay を使うかを返す。 */
function shouldUseScreenSpaceComposite(context: TwinXrayOverlayContext) {
  const { faceProfile, lineProfile } = getOverlayProfiles(context);
  return (
    (context.shouldUseScreenSpaceXrayFaceOverlay() &&
      faceProfile.usesScreenSpaceFaceOverlay) ||
    lineProfile.useScreenSpaceLineOverlay
  );
}

/**
 * xray overlay の表示状態だけを軽量に同期する。
 *
 * 回転中は重い per-pixel 合成を止めるが、canvas の表示/非表示だけはここで同期する。
 */
function applyXrayOverlaySceneVisibility(
  context: TwinXrayOverlayContext,
  useScreenSpaceFaceOverlay: boolean,
) {
  context.state.previewRoot?.traverse((object) => {
    if (object.userData?.previewXrayBodyMesh === true) {
      object.visible = !useScreenSpaceFaceOverlay;
    }
    const lineLayer = object.userData?.previewLineLayer;
    if (lineLayer !== "front" && lineLayer !== "hidden") {
      return;
    }
    const category = getBoundaryPreviewLineCategory(context, object);
    if (!category) {
      object.visible = true;
      return;
    }
    object.visible =
      shouldShowBoundaryLineLayer(context, lineLayer, category) &&
      !useScreenSpaceFaceOverlay;
  });
}

function syncXrayFaceOverlayVisibility(context: TwinXrayOverlayContext) {
  const canvas = context.xrayFaceCanvas;
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }
  const useScreenSpaceFaceOverlay =
    !context.isPreviewRotating() && shouldUseScreenSpaceComposite(context);
  canvas.style.display = useScreenSpaceFaceOverlay ? "block" : "none";
}

/** xray 系 preview で screen-space 線 overlay を使うかを返す。 */
function shouldUseScreenSpaceXrayLineOverlay(context: TwinXrayOverlayContext) {
  return getOverlayProfiles(context).lineProfile.useScreenSpaceLineOverlay;
}

type TwinPreviewBoundaryLineCategory =
  | "ridge-surface"
  | "ridge-occluded-interior"
  | "intersection";

/** 線 layer とカテゴリごとに、現在表示すべきかを返す。 */
function shouldShowBoundaryLineLayer(
  context: TwinXrayOverlayContext,
  lineLayer: "front" | "hidden",
  category: TwinPreviewBoundaryLineCategory | null,
) {
  const lineProfile = resolveTwinPreviewLineProfile(
    context.state.faceDisplayMode,
    context.state.previewStyleSettings?.customLineProfile,
  );
  if (category === "intersection") {
    return (
      context.state.showIntersectionRidgeLines &&
      (lineLayer !== "front" || lineProfile.showFrontLines)
    );
  }
  if (category === "ridge-occluded-interior") {
    return (
      lineLayer === "hidden" &&
      context.state.showRidgeLines &&
      lineProfile.showOccludedInteriorLines
    );
  }
  if (category === "ridge-surface") {
    if (lineLayer === "front") {
      return context.state.showRidgeLines && lineProfile.showFrontLines;
    }
    return context.state.showRidgeLines && lineProfile.showHiddenSurfaceLines;
  }
  return true;
}

/** hidden 線 style の color mode を実色へ解決する。 */
function resolveHiddenLineStrokeColor(
  colorMode: TwinPreviewHiddenLineColorMode,
  frontStroke: string,
  customColor?: string,
) {
  if (colorMode === "same-as-front") {
    return frontStroke;
  }
  if (colorMode === "custom" && customColor) {
    return customColor;
  }
  const base = new THREE.Color(frontStroke);
  return `#${base.lerp(new THREE.Color(0xffffff), 0.22).getHexString()}`;
}

/** overlay 用 line を category / layer ごとの style へ変換する。 */
function applyOverlayLineCategoryStyle(
  lineProfile: ReturnType<typeof resolveTwinPreviewLineProfile>,
  category: TwinPreviewBoundaryLineCategory,
  lineLayer: "front" | "hidden",
  lines: {
    stroke: string;
    strokeOpacity: number;
    strokeWidth: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }[],
) {
  if (lineLayer === "front") {
    return lines;
  }
  const style =
    category === "ridge-occluded-interior"
      ? {
          colorMode: lineProfile.occludedInteriorLineColorMode,
          customColor: lineProfile.occludedInteriorLineCustomColor,
          opacityScale: lineProfile.occludedInteriorLineOpacityScale,
          width: lineProfile.occludedInteriorLineWidthScale,
        }
      : {
          colorMode: lineProfile.hiddenSurfaceLineColorMode,
          customColor: lineProfile.hiddenSurfaceLineCustomColor,
          opacityScale: lineProfile.hiddenSurfaceLineOpacityScale,
          width: lineProfile.hiddenSurfaceLineWidthScale,
        };
  return lines.map((line) => ({
    ...line,
    stroke: resolveHiddenLineStrokeColor(
      style.colorMode,
      line.stroke,
      style.customColor,
    ),
    strokeOpacity: line.strokeOpacity * style.opacityScale,
    strokeWidth: style.width,
  }));
}

/** ridge/intersection の preview line object だけを export line collector に渡す。 */
function isBoundaryPreviewLineObject(
  context: TwinXrayOverlayContext,
  object: THREE.Object3D,
  lineLayer: "front" | "hidden" | "any" = "any",
) {
  const category = getBoundaryPreviewLineCategory(context, object);
  if (!category) {
    return false;
  }
  const resolvedLineLayer =
    lineLayer === "any" ? object.userData?.previewLineLayer : lineLayer;
  if (resolvedLineLayer !== "front" && resolvedLineLayer !== "hidden") {
    return false;
  }
  return (
    (lineLayer === "any" || object.userData?.previewLineLayer === lineLayer) &&
    shouldShowBoundaryLineLayer(context, resolvedLineLayer, category)
  );
}

/** overlay collector 用に、preview 線 object がどの境界カテゴリかを返す。 */
function getBoundaryPreviewLineCategory(
  context: TwinXrayOverlayContext,
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

/** xray preview では保存画像と同じ 2D line collector を使って境界線を上描きする。 */
function renderScreenSpaceXrayLineOverlay(
  context: TwinXrayOverlayContext,
  canvasContext: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const setLineDebug = (summary: Record<string, unknown>) => {
    (globalThis as Record<string, unknown>).__twinXrayScreenOverlayLineDebug =
      summary;
    return summary;
  };
  if (
    !shouldUseScreenSpaceXrayLineOverlay(context) ||
    !context.state.previewRoot
  ) {
    return setLineDebug({
      enabled: false,
      reason: !shouldUseScreenSpaceXrayLineOverlay(context)
        ? "line-overlay-disabled"
        : "no-preview-root",
      mode: context.state.faceDisplayMode,
    });
  }

  const surface = context.getExportSurfaceData(width, height);
  if (!surface) {
    return setLineDebug({
      enabled: false,
      reason: "no-export-surface",
      mode: context.state.faceDisplayMode,
      width,
      height,
    });
  }
  const lineProfile = resolveTwinPreviewLineProfile(
    context.state.faceDisplayMode,
    context.state.previewStyleSettings?.customLineProfile,
  );
  const visibilityTargets = [
    context.state.ridgeLines,
    context.state.intersectionRidgeLines,
  ].filter(Boolean) as THREE.Object3D[];
  const visibilitySnapshot = visibilityTargets.map((target) => ({
    target,
    visible: target.visible,
  }));
  const lineLayerVisibilitySnapshot: {
    object: THREE.Object3D;
    visible: boolean;
  }[] = [];

  try {
    visibilityTargets.forEach((target) => {
      target.visible = true;
    });
    const setLineLayerVisibility = (targetLineLayer: "front" | "hidden") => {
      context.state.previewRoot?.traverse((object) => {
        const lineLayer = object.userData?.previewLineLayer;
        if (lineLayer !== "front" && lineLayer !== "hidden") {
          return;
        }
        const category = getBoundaryPreviewLineCategory(context, object);
        lineLayerVisibilitySnapshot.push({
          object,
          visible: object.visible,
        });
        object.visible =
          object.userData?.previewLineLayer === targetLineLayer &&
          shouldShowBoundaryLineLayer(context, targetLineLayer, category);
      });
    };

    const collectLineLayerByCategory = (
      targetLineLayer: "front" | "hidden",
      targetCategory: TwinPreviewBoundaryLineCategory,
    ) => {
      setLineLayerVisibility(targetLineLayer);
      return context.collectPreviewExportLines(
        width,
        height,
        opaqueTriangles,
        surface,
        {
          includeObject: (object) =>
            isBoundaryPreviewLineObject(context, object, targetLineLayer) &&
            getBoundaryPreviewLineCategory(context, object) === targetCategory,
        },
      );
    };

    const { opaqueTriangles } = context.collectTransparentXrayExportTriangles(
      width,
      height,
      context.state.previewRoot.matrixWorld,
    );
    const hiddenLines = {
      ridgeSurface: applyOverlayLineCategoryStyle(
        lineProfile,
        "ridge-surface",
        "hidden",
        collectLineLayerByCategory("hidden", "ridge-surface"),
      ),
      ridgeOccludedInterior: applyOverlayLineCategoryStyle(
        lineProfile,
        "ridge-occluded-interior",
        "hidden",
        collectLineLayerByCategory("hidden", "ridge-occluded-interior"),
      ),
      intersection: applyOverlayLineCategoryStyle(
        lineProfile,
        "intersection",
        "hidden",
        collectLineLayerByCategory("hidden", "intersection"),
      ),
    };
    const frontLines = {
      ridgeSurface: collectLineLayerByCategory("front", "ridge-surface"),
      ridgeOccludedInterior: collectLineLayerByCategory(
        "front",
        "ridge-occluded-interior",
      ),
      intersection: collectLineLayerByCategory("front", "intersection"),
    };
    const lines = [
      ...hiddenLines.ridgeSurface,
      ...hiddenLines.ridgeOccludedInterior,
      ...hiddenLines.intersection,
      ...frontLines.ridgeSurface,
      ...frontLines.ridgeOccludedInterior,
      ...frontLines.intersection,
    ];
    const lineSummary = {
      lineCount: lines.length,
      hiddenLineCount:
        hiddenLines.ridgeSurface.length +
        hiddenLines.ridgeOccludedInterior.length +
        hiddenLines.intersection.length,
      frontLineCount:
        frontLines.ridgeSurface.length +
        frontLines.ridgeOccludedInterior.length +
        frontLines.intersection.length,
      hiddenSurfaceCount: hiddenLines.ridgeSurface.length,
      hiddenOccludedInteriorCount: hiddenLines.ridgeOccludedInterior.length,
      hiddenIntersectionCount: hiddenLines.intersection.length,
      frontSurfaceCount: frontLines.ridgeSurface.length,
      frontOccludedInteriorCount: frontLines.ridgeOccludedInterior.length,
      frontIntersectionCount: frontLines.intersection.length,
      sample: lines.slice(0, 8).map((line, index) => ({
        index,
        stroke: line.stroke,
        strokeOpacity: Number(line.strokeOpacity.toFixed(6)),
        strokeWidth: Number(line.strokeWidth.toFixed(6)),
        length: Number(
          Math.hypot(line.x2 - line.x1, line.y2 - line.y1).toFixed(6),
        ),
      })),
    };
    canvasContext.save();
    canvasContext.lineCap = "butt";
    canvasContext.lineJoin = "miter";
    lines.forEach((line) => {
      canvasContext.beginPath();
      canvasContext.strokeStyle = line.stroke;
      canvasContext.globalAlpha = line.strokeOpacity;
      canvasContext.lineWidth = line.strokeWidth;
      canvasContext.moveTo(line.x1, line.y1);
      canvasContext.lineTo(line.x2, line.y2);
      canvasContext.stroke();
    });
    canvasContext.restore();
    return setLineDebug(lineSummary);
  } finally {
    lineLayerVisibilitySnapshot.forEach(({ object, visible }) => {
      object.visible = visible;
    });
    visibilitySnapshot.forEach(({ target, visible }) => {
      target.visible = visible;
    });
    surface.dispose?.();
  }
}

/**
 * xray screen-space 合成用に、各面 polygon を投影済み配列として集める。
 *
 * preview 側では pixel 単位の depth 合成を使うため、ここで各 face の projectedPoints と
 * sortDepth を先に組み立てる。
 */
function collectScreenSpaceXrayFacePolygons(
  context: TwinXrayOverlayContext,
  width: number,
  height: number,
) {
  const visibleCrystalEntries = context.getVisibleCrystalEntriesForExport();
  const polygons: {
    fill: string;
    sortDepth: number;
    projectedPoints: { x: number; y: number; cameraZ: number }[];
  }[] = [];
  const rootMatrix = context.state.previewRoot?.matrixWorld;
  if (!rootMatrix) {
    return polygons;
  }

  visibleCrystalEntries.forEach(({ index, meshData }) => {
    const sourceFaces = context.getSourceFacesForCrystalIndex(index);
    (meshData?.faces ?? []).forEach((face) => {
      const vertices = face.vertices ?? [];
      if (vertices.length < 3) {
        return;
      }

      const worldPoints = vertices.map((vertex) =>
        new THREE.Vector3(vertex.x, vertex.y, vertex.z).applyMatrix4(
          rootMatrix,
        ),
      );
      const projectedPoints = worldPoints.map((point) =>
        context.projectWorldPointToExport(point, width, height),
      );
      const fill = context.resolveXrayPreviewFaceColor(
        face.id,
        sourceFaces,
        index,
      );
      const sortDepth =
        projectedPoints.reduce((sum, point) => sum + point.cameraZ, 0) /
        projectedPoints.length;

      polygons.push({
        fill,
        sortDepth,
        projectedPoints,
      });
    });
  });
  return polygons;
}

/** `#rrggbb` / `#rgb` を screen-space 合成用の 0..1 RGB へ展開する。 */
function parseScreenSpaceXrayFillColor(fill: string) {
  const normalized = fill.startsWith("#") ? fill.slice(1) : fill;
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((component) => `${component}${component}`)
          .join("")
      : normalized;
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16) / 255,
    g: Number.parseInt(expanded.slice(2, 4), 16) / 255,
    b: Number.parseInt(expanded.slice(4, 6), 16) / 255,
  };
}

/** 三角形を走査して、pixel ごとの fragment bucket へ depth と色を積む。 */
function rasterizeScreenSpaceXrayTriangle(
  fragmentBuckets: Map<
    number,
    { depth: number; color: { r: number; g: number; b: number } }[]
  >,
  triangle: {
    p1: { x: number; y: number; cameraZ: number };
    p2: { x: number; y: number; cameraZ: number };
    p3: { x: number; y: number; cameraZ: number };
  },
  color: { r: number; g: number; b: number },
  width: number,
  height: number,
) {
  const minX = Math.max(
    0,
    Math.floor(Math.min(triangle.p1.x, triangle.p2.x, triangle.p3.x)),
  );
  const maxX = Math.min(
    width - 1,
    Math.ceil(Math.max(triangle.p1.x, triangle.p2.x, triangle.p3.x)),
  );
  const minY = Math.max(
    0,
    Math.floor(Math.min(triangle.p1.y, triangle.p2.y, triangle.p3.y)),
  );
  const maxY = Math.min(
    height - 1,
    Math.ceil(Math.max(triangle.p1.y, triangle.p2.y, triangle.p3.y)),
  );

  const getBarycentric = (pointX: number, pointY: number) => {
    const denominator =
      (triangle.p2.y - triangle.p3.y) * (triangle.p1.x - triangle.p3.x) +
      (triangle.p3.x - triangle.p2.x) * (triangle.p1.y - triangle.p3.y);
    if (Math.abs(denominator) < 1e-8) {
      return null;
    }
    const alpha =
      ((triangle.p2.y - triangle.p3.y) * (pointX - triangle.p3.x) +
        (triangle.p3.x - triangle.p2.x) * (pointY - triangle.p3.y)) /
      denominator;
    const beta =
      ((triangle.p3.y - triangle.p1.y) * (pointX - triangle.p3.x) +
        (triangle.p1.x - triangle.p3.x) * (pointY - triangle.p3.y)) /
      denominator;
    const gamma = 1 - alpha - beta;
    if (alpha < -1e-6 || beta < -1e-6 || gamma < -1e-6) {
      return null;
    }
    return { alpha, beta, gamma };
  };

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const barycentric = getBarycentric(x + 0.5, y + 0.5);
      if (!barycentric) {
        continue;
      }
      const depth =
        triangle.p1.cameraZ * barycentric.alpha +
        triangle.p2.cameraZ * barycentric.beta +
        triangle.p3.cameraZ * barycentric.gamma;
      const pixelIndex = y * width + x;
      if (!fragmentBuckets.has(pixelIndex)) {
        fragmentBuckets.set(pixelIndex, []);
      }
      fragmentBuckets.get(pixelIndex)?.push({ depth, color });
    }
  }
}

/**
 * xray 面 polygon 群を pixel ごとに depth ソートし、1 枚の ImageData へ合成する。
 *
 * SVG 側では vector 近似を使うが、preview 側はここで per-pixel 合成して見え方を安定させる。
 */
function compositeScreenSpaceXrayPolygons(
  polygons: {
    fill: string;
    projectedPoints: { x: number; y: number; cameraZ: number }[];
  }[],
  width: number,
  height: number,
  opacity: number,
) {
  const fragmentBuckets = new Map<
    number,
    { depth: number; color: { r: number; g: number; b: number } }[]
  >();
  let fragmentCount = 0;

  polygons.forEach((polygon) => {
    if (
      !polygon.projectedPoints?.length ||
      polygon.projectedPoints.length < 3
    ) {
      return;
    }
    const color = parseScreenSpaceXrayFillColor(polygon.fill);
    for (
      let index = 1;
      index < polygon.projectedPoints.length - 1;
      index += 1
    ) {
      rasterizeScreenSpaceXrayTriangle(
        fragmentBuckets,
        {
          p1: polygon.projectedPoints[0],
          p2: polygon.projectedPoints[index],
          p3: polygon.projectedPoints[index + 1],
        },
        color,
        width,
        height,
      );
      fragmentCount += 1;
    }
  });

  const imageData = new ImageData(width, height);
  let filledPixelCount = 0;
  let maxLayerCount = 0;

  fragmentBuckets.forEach((fragments, pixelIndex) => {
    if (!fragments.length) {
      return;
    }
    fragments.sort((left, right) => left.depth - right.depth);
    maxLayerCount = Math.max(maxLayerCount, fragments.length);

    let outAlpha = 0;
    let outRedPremul = 0;
    let outGreenPremul = 0;
    let outBluePremul = 0;

    fragments.forEach((fragment) => {
      const srcAlpha = opacity;
      outRedPremul =
        fragment.color.r * srcAlpha + outRedPremul * (1 - srcAlpha);
      outGreenPremul =
        fragment.color.g * srcAlpha + outGreenPremul * (1 - srcAlpha);
      outBluePremul =
        fragment.color.b * srcAlpha + outBluePremul * (1 - srcAlpha);
      outAlpha = srcAlpha + outAlpha * (1 - srcAlpha);
    });

    if (outAlpha <= 1e-6) {
      return;
    }

    const dataIndex = pixelIndex * 4;
    imageData.data[dataIndex] = Math.round((outRedPremul / outAlpha) * 255);
    imageData.data[dataIndex + 1] = Math.round(
      (outGreenPremul / outAlpha) * 255,
    );
    imageData.data[dataIndex + 2] = Math.round(
      (outBluePremul / outAlpha) * 255,
    );
    imageData.data[dataIndex + 3] = Math.round(outAlpha * 255);
    filledPixelCount += 1;
  });

  return {
    imageData,
    fragmentTriangleCount: fragmentCount,
    filledPixelCount,
    fragmentPixelCount: fragmentBuckets.size,
    maxLayerCount,
  };
}

/**
 * xray preview の面色を別 canvas に screen-space 合成して描画する。
 *
 * 回転中は重い per-pixel 合成を止め、停止後にだけ再計算する。
 */
function renderScreenSpaceXrayFaceOverlay(context: TwinXrayOverlayContext) {
  const canvas = context.xrayFaceCanvas;
  if (!(canvas instanceof HTMLCanvasElement)) {
    globalThis.__twinXrayScreenOverlayDebug = {
      enabled: false,
      reason: "no-canvas",
      mode: context.state.faceDisplayMode,
    };
    return;
  }
  if (context.isPreviewRotating()) {
    canvas.style.display = "none";
    globalThis.__twinXrayScreenOverlayDebug = {
      enabled: false,
      reason: "preview-rotating",
      mode: context.state.faceDisplayMode,
    };
    return;
  }
  const canvasContext = canvas.getContext("2d");
  if (!canvasContext) {
    globalThis.__twinXrayScreenOverlayDebug = {
      enabled: false,
      reason: "no-canvas-context",
      mode: context.state.faceDisplayMode,
    };
    return;
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(
    1,
    Math.round(context.previewStage.clientWidth * pixelRatio),
  );
  const height = Math.max(
    1,
    Math.round(context.previewStage.clientHeight * pixelRatio),
  );
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  canvasContext.clearRect(0, 0, width, height);
  const useScreenSpaceComposite =
    !context.isPreviewRotating() && shouldUseScreenSpaceComposite(context);
  canvas.style.display = useScreenSpaceComposite ? "block" : "none";
  if (!useScreenSpaceComposite || !context.state.previewRoot) {
    globalThis.__twinXrayScreenOverlayDebug = {
      enabled: false,
      reason: !useScreenSpaceComposite
        ? "screen-space-composite-disabled"
        : "no-preview-root",
      mode: context.state.faceDisplayMode,
    };
    return;
  }

  const polygons = collectScreenSpaceXrayFacePolygons(context, width, height);
  const opacity = context.getXrayPreviewFaceOpacity(
    Boolean(
      context.state.buildResult?.previewFinalGeometry ??
      context.state.buildResult?.finalGeometry,
    ),
  );
  const composite = compositeScreenSpaceXrayPolygons(
    polygons,
    width,
    height,
    opacity,
  );
  canvasContext.putImageData(composite.imageData, 0, 0);
  const lineSummary = renderScreenSpaceXrayLineOverlay(
    context,
    canvasContext,
    width,
    height,
  );
  const summary = {
    method: "per-pixel-depth-composite",
    polygonCount: polygons.length,
    opacity,
    pixelRatio,
    canvasWidth: width,
    canvasHeight: height,
    fragmentTriangleCount: composite.fragmentTriangleCount,
    filledPixelCount: composite.filledPixelCount,
    fragmentPixelCount: composite.fragmentPixelCount,
    maxLayerCount: composite.maxLayerCount,
    mode: context.state.faceDisplayMode,
    lineOverlay: lineSummary ?? null,
    sample: polygons.slice(0, 5).map((polygon, index) => ({
      index,
      fill: polygon.fill,
      sortDepth: Number(polygon.sortDepth.toFixed(6)),
      vertexCount: polygon.projectedPoints.length,
    })),
  };
  globalThis.__twinXrayScreenOverlayDebug = summary;
  if (!context.state.previewRoot.userData.xrayScreenOverlayLogged) {
    context.state.previewRoot.userData.xrayScreenOverlayLogged = true;
    console.info("[Twin Xray Screen Overlay]", summary);
  }
}

/** xray overlay の表示同期と描画を返す。 */
export function createTwinXrayOverlayActions(context: TwinXrayOverlayContext) {
  return {
    syncXrayFaceOverlayVisibility: () => syncXrayFaceOverlayVisibility(context),
    applyXrayOverlaySceneVisibility: (useScreenSpaceFaceOverlay: boolean) =>
      applyXrayOverlaySceneVisibility(context, useScreenSpaceFaceOverlay),
    renderScreenSpaceXrayFaceOverlay: () =>
      renderScreenSpaceXrayFaceOverlay(context),
  };
}
