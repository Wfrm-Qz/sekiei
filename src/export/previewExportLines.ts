import * as THREE from "three";
import {
  resolveTwinPreviewLineProfile,
  type TwinPreviewHiddenLineColorMode,
} from "../preview/previewProfiles.js";
import type { TwinPreviewStyleSettings } from "../preview/previewStyleSettings.js";
import {
  buildExportEdgeKey,
  buildExportVertexKey,
} from "./svgExportPlaneHelpers.js";

export type TwinPreviewBoundaryLineCategory =
  | "ridge-surface"
  | "ridge-occluded-interior"
  | "intersection";

interface BoundaryExportLine {
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface PreviewExportLineStateLike {
  previewRoot: THREE.Group | null;
  faceDisplayMode: string;
  previewStyleSettings?: TwinPreviewStyleSettings;
}

interface PreviewExportLineMaterialLike {
  color?: THREE.ColorRepresentation;
  transparent?: boolean;
  opacity?: number;
  linewidth?: number;
  depthTest?: boolean;
}

interface CollectPreviewExportLinesOptions {
  state: PreviewExportLineStateLike;
  width: number;
  height: number;
  surface: unknown;
  includeObject?: ((object: THREE.Object3D) => boolean) | null;
  hasNamedAncestor: (object: THREE.Object3D | null, name: string) => boolean;
  getExportMaterial: (
    object: THREE.Object3D & { material?: unknown },
  ) => unknown;
  collectVisibleWorldLineSegments: (
    startPoint: THREE.Vector3,
    endPoint: THREE.Vector3,
    width: number,
    height: number,
    surface: unknown,
  ) => { x1: number; y1: number; x2: number; y2: number }[];
  projectWorldPointToExport: (
    worldPoint: THREE.Vector3,
    width: number,
    height: number,
  ) => { x: number; y: number };
}

interface CollectBlockingExportEdgeKeysOptions {
  previewRoot: THREE.Group | null;
  hasNamedAncestor: (object: THREE.Object3D | null, name: string) => boolean;
}

/** hidden 線 style の color mode を実色へ解決する。 */
export function resolveHiddenLineStrokeColor(
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

/** 稜線または交線として triangle split に使う line object かを返す。 */
export function isBoundaryExportLineObject(
  hasNamedAncestor: (object: THREE.Object3D | null, name: string) => boolean,
  object: THREE.Object3D | null,
) {
  return (
    object?.name === "preview-ridge-lines" ||
    object?.name === "preview-intersection-ridge-lines" ||
    hasNamedAncestor(object, "preview-ridge-lines") ||
    hasNamedAncestor(object, "preview-intersection-ridge-lines")
  );
}

/** export line object がどの境界カテゴリかを返す。 */
export function getBoundaryExportLineCategory(
  hasNamedAncestor: (object: THREE.Object3D | null, name: string) => boolean,
  object: THREE.Object3D,
): TwinPreviewBoundaryLineCategory | null {
  const isRidgeLine =
    object.name === "preview-ridge-lines" ||
    hasNamedAncestor(object, "preview-ridge-lines");
  const isIntersectionLine =
    object.name === "preview-intersection-ridge-lines" ||
    hasNamedAncestor(object, "preview-intersection-ridge-lines");
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

/** preview line profile を SVG line export にも反映する。 */
export function applyBoundaryLineExportStyle(
  state: PreviewExportLineStateLike,
  hasNamedAncestor: (object: THREE.Object3D | null, name: string) => boolean,
  object: THREE.Object3D,
  line: BoundaryExportLine,
) {
  const lineLayer = object.userData?.previewLineLayer;
  if (lineLayer !== "hidden") {
    return line;
  }
  const category = getBoundaryExportLineCategory(hasNamedAncestor, object);
  if (!category || category === "intersection") {
    return line;
  }
  const lineProfile = resolveTwinPreviewLineProfile(
    state.faceDisplayMode,
    state.previewStyleSettings?.customLineProfile,
  );
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
  return {
    ...line,
    stroke: resolveHiddenLineStrokeColor(
      style.colorMode,
      line.stroke,
      style.customColor,
    ),
    strokeOpacity: line.strokeOpacity * style.opacityScale,
    strokeWidth: style.width,
  };
}

/** 面結合時に消してはいけない稜線/交線の edge key を収集する。 */
export function collectBlockingExportEdgeKeys({
  previewRoot,
  hasNamedAncestor,
}: CollectBlockingExportEdgeKeysOptions) {
  const blocked = new Set<string>();
  if (!previewRoot) {
    return blocked;
  }

  previewRoot.traverseVisible((object) => {
    const inRidgeLines =
      hasNamedAncestor(object, "preview-ridge-lines") ||
      object.name === "preview-ridge-lines";
    const inIntersectionLines =
      hasNamedAncestor(object, "preview-intersection-ridge-lines") ||
      object.name === "preview-intersection-ridge-lines";
    if (!inRidgeLines && !inIntersectionLines) {
      return;
    }

    const instanceStart = object.geometry?.getAttribute?.("instanceStart");
    const instanceEnd = object.geometry?.getAttribute?.("instanceEnd");
    if (instanceStart && instanceEnd) {
      for (let index = 0; index < instanceStart.count; index += 1) {
        const startPoint = new THREE.Vector3(
          instanceStart.getX(index),
          instanceStart.getY(index),
          instanceStart.getZ(index),
        ).applyMatrix4(object.matrixWorld);
        const endPoint = new THREE.Vector3(
          instanceEnd.getX(index),
          instanceEnd.getY(index),
          instanceEnd.getZ(index),
        ).applyMatrix4(object.matrixWorld);
        blocked.add(
          buildExportEdgeKey(
            buildExportVertexKey(startPoint),
            buildExportVertexKey(endPoint),
          ),
        );
      }
      return;
    }

    const position = object.geometry?.getAttribute?.("position");
    if (!position || (!object.isLine && !object.isLineSegments)) {
      return;
    }
    const step = object.isLineSegments ? 2 : 1;
    for (let index = 0; index < position.count - 1; index += step) {
      const nextIndex = index + 1;
      const startPoint = new THREE.Vector3(
        position.getX(index),
        position.getY(index),
        position.getZ(index),
      ).applyMatrix4(object.matrixWorld);
      const endPoint = new THREE.Vector3(
        position.getX(nextIndex),
        position.getY(nextIndex),
        position.getZ(nextIndex),
      ).applyMatrix4(object.matrixWorld);
      blocked.add(
        buildExportEdgeKey(
          buildExportVertexKey(startPoint),
          buildExportVertexKey(endPoint),
        ),
      );
    }
  });

  return blocked;
}

/** preview 上の line object 群を SVG line 群へ変換する。 */
export function collectPreviewExportLines({
  state,
  width,
  height,
  surface,
  includeObject = null,
  hasNamedAncestor,
  getExportMaterial,
  collectVisibleWorldLineSegments,
  projectWorldPointToExport,
}: CollectPreviewExportLinesOptions) {
  const lines: BoundaryExportLine[] = [];

  if (!state.previewRoot) {
    return lines;
  }

  const appendLineSegments = (
    object: THREE.Object3D,
    material: PreviewExportLineMaterialLike,
    segmentSource: [THREE.Vector3, THREE.Vector3][],
    shouldClipToOpaque: boolean,
  ) => {
    const stroke = `#${new THREE.Color(material.color ?? 0x000000).getHexString()}`;
    const strokeOpacity = material.transparent ? (material.opacity ?? 1) : 1;
    const strokeWidth = Number.isFinite(Number(material.linewidth))
      ? Number(material.linewidth)
      : 1;

    for (const [startPoint, endPoint] of segmentSource) {
      const segments = shouldClipToOpaque
        ? collectVisibleWorldLineSegments(
            startPoint,
            endPoint,
            width,
            height,
            surface,
          )
        : (() => {
            const start = projectWorldPointToExport(startPoint, width, height);
            const end = projectWorldPointToExport(endPoint, width, height);
            return [{ x1: start.x, y1: start.y, x2: end.x, y2: end.y }];
          })();

      segments.forEach((segment) => {
        lines.push(
          applyBoundaryLineExportStyle(state, hasNamedAncestor, object, {
            stroke,
            strokeOpacity,
            strokeWidth,
            ...segment,
          }),
        );
      });
    }
  };

  state.previewRoot.traverseVisible((object) => {
    if (includeObject && !includeObject(object)) {
      return;
    }
    if (hasNamedAncestor(object, "face-pick-targets")) {
      return;
    }

    const material = getExportMaterial(object as never) as
      | PreviewExportLineMaterialLike
      | undefined;
    if (!material || !object.geometry?.getAttribute) {
      return;
    }

    const instanceStart = object.geometry.getAttribute("instanceStart");
    const instanceEnd = object.geometry.getAttribute("instanceEnd");
    if (instanceStart && instanceEnd) {
      const segmentSource: [THREE.Vector3, THREE.Vector3][] = [];
      for (let index = 0; index < instanceStart.count; index += 1) {
        const startPoint = new THREE.Vector3(
          instanceStart.getX(index),
          instanceStart.getY(index),
          instanceStart.getZ(index),
        ).applyMatrix4(object.matrixWorld);
        const endPoint = new THREE.Vector3(
          instanceEnd.getX(index),
          instanceEnd.getY(index),
          instanceEnd.getZ(index),
        ).applyMatrix4(object.matrixWorld);
        segmentSource.push([startPoint, endPoint]);
      }
      appendLineSegments(
        object,
        material,
        segmentSource,
        material.depthTest !== false,
      );
      return;
    }

    const positionAttribute = object.geometry.getAttribute("position");
    if (!positionAttribute || (!object.isLine && !object.isLineSegments)) {
      return;
    }

    const step = object.isLineSegments ? 2 : 1;
    const segmentSource: [THREE.Vector3, THREE.Vector3][] = [];
    for (let index = 0; index < positionAttribute.count - 1; index += step) {
      const nextIndex = index + 1;
      if (nextIndex >= positionAttribute.count) {
        continue;
      }
      const startPoint = new THREE.Vector3(
        positionAttribute.getX(index),
        positionAttribute.getY(index),
        positionAttribute.getZ(index),
      ).applyMatrix4(object.matrixWorld);
      const endPoint = new THREE.Vector3(
        positionAttribute.getX(nextIndex),
        positionAttribute.getY(nextIndex),
        positionAttribute.getZ(nextIndex),
      ).applyMatrix4(object.matrixWorld);
      segmentSource.push([startPoint, endPoint]);
    }
    appendLineSegments(
      object,
      material,
      segmentSource,
      material.depthTest !== false,
    );
  });

  return lines;
}
