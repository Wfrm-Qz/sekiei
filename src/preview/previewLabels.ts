import * as THREE from "three";
import {
  resolveTwinPreviewResponsiveFontSizePx,
  type TwinPreviewResponsiveTextRole,
} from "./previewStyleSettings.js";

import {
  createAxisLabelAnchors as createPreviewAxisLabelAnchors,
  createFaceLabelAnchors as createPreviewFaceLabelAnchors,
} from "./previewLabelAnchors.js";

/**
 * 双晶 preview の面ラベル / 軸ラベル / 双晶則ラベルの配置処理をまとめる module。
 *
 * ここは `main.ts` の中でも DOM overlay と screen-space 計算が密結合だった部分で、
 * 幾何 build や export 本体から分離しても挙動を変えにくい範囲を先に切り出している。
 */

/** 面指数表示の 1 token 分を表す。 */
export interface TwinIndexLabelPart {
  text: string;
  negative: boolean;
}

/** 面ラベル DOM と 3D 上の対応点を表す。 */
export interface TwinFaceLabelAnchor {
  element: HTMLDivElement;
  normal: THREE.Vector3;
  position: THREE.Vector3;
  sourceName: string;
  styleKind?: "face";
}

/** 軸ラベルや双晶則ラベルのように、方向付きで逃がす overlay を表す。 */
export interface TwinDirectionalLabelAnchor {
  element: HTMLDivElement;
  tipPosition?: THREE.Vector3 | null;
  direction?: THREE.Vector3 | null;
  oppositeTipPosition?: THREE.Vector3 | null;
  oppositeDirection?: THREE.Vector3 | null;
  positiveText?: string;
  negativeText?: string;
  positiveLabelParts?: TwinIndexLabelPart[];
  negativeLabelParts?: TwinIndexLabelPart[];
  position?: THREE.Vector3;
  styleKind?: "axis" | "twinRule";
  defaultColor?: string;
  axisStyleKey?: "a" | "b" | "a3" | "c";
}

/** preview label helper が参照する DOM 要素。 */
export interface TwinPreviewLabelElementsLike {
  faceLabelLayer: HTMLElement;
  previewStage: HTMLElement;
}

/** preview label helper が参照する state の最小集合。 */
export interface TwinPreviewLabelStateLike {
  previewRoot: THREE.Object3D | null;
  facePickTargets: THREE.Object3D[];
  faceLabelAnchors: TwinFaceLabelAnchor[];
  axisLabelAnchors: TwinDirectionalLabelAnchor[];
  twinRuleLabelAnchors: TwinDirectionalLabelAnchor[];
  previewStyleSettings: {
    faceLabel: {
      color: string;
      fontFamily: string;
      fontSizePx: number;
      offset: number;
    };
    axisLabel: {
      color?: string;
      colors?: {
        a: string;
        b: string;
        a3: string;
        c: string;
      };
      fontFamily: string;
      fontSizePx: number;
    };
    twinRuleLabel: {
      color: string;
      fontFamily: string;
      fontSizePx: number;
    };
  };
  showFaceLabels: boolean;
  showAxisLabels: boolean;
  showTwinRuleGuide: boolean;
  isPreviewDragging: boolean;
  previewInertiaActive: boolean;
}

/** preview label helper に外から渡す依存関係。 */
export interface TwinPreviewLabelContext {
  state: TwinPreviewLabelStateLike;
  elements: TwinPreviewLabelElementsLike;
  camera: THREE.Camera;
  raycaster: THREE.Raycaster;
  previewHelperNames: Set<string>;
  axisLabelInitialOuterOffset: number;
  axisLabelSideGap: number;
}

interface TwinScreenPoint {
  x: number;
  y: number;
  z: number;
}

interface TwinScreenTrianglePoint {
  x: number;
  y: number;
}

interface TwinScreenRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

interface TwinDirectionalPlacement {
  tipWorld: THREE.Vector3;
  offsetWorld: THREE.Vector3;
}

/** 指数表示用の符号付き token 列を作る。 */
export function buildIndexLabelParts(
  indexes: { h?: number; k?: number; i?: number; l?: number } | null,
  useFourAxis: boolean,
): TwinIndexLabelPart[] {
  const values = useFourAxis
    ? [indexes?.h, indexes?.k, indexes?.i, indexes?.l]
    : [indexes?.h, indexes?.k, indexes?.l];
  return values.map((value) => {
    const numeric = Number(value ?? 0);
    return {
      text: String(Math.abs(numeric)),
      negative: numeric < 0,
    };
  });
}

/** 指数 token を DOM へ append する。 */
export function appendIndexLabelTokens(
  element: HTMLElement,
  labelParts: TwinIndexLabelPart[],
) {
  labelParts.forEach((part, index) => {
    const token = document.createElement("span");
    token.className = part.negative
      ? "face-index-token overline"
      : "face-index-token";
    token.textContent = part.text;
    element.append(token);
    if (index < labelParts.length - 1) {
      element.append(document.createTextNode(" "));
    }
  });
}

/** 指数 token の符号を反転した表示用配列を返す。 */
export function invertIndexLabelParts(
  labelParts: TwinIndexLabelPart[],
): TwinIndexLabelPart[] {
  return (labelParts ?? []).map((part) => ({
    text: part.text,
    negative: part.text === "0" ? false : !part.negative,
  }));
}

/**
 * preview label 操作用の action 群を返す。
 *
 * 戻り値の関数は DOM 更新の副作用を持つが、`main.ts` 側からは
 * 「いつ呼ぶか」だけが見える形にして責務を軽くする。
 */
export function createTwinPreviewLabelActions(
  context: TwinPreviewLabelContext,
) {
  function applyLabelTextStyle(
    element: HTMLElement,
    style: { color: string; fontFamily: string; fontSizePx: number },
    role: TwinPreviewResponsiveTextRole,
  ) {
    element.style.color = style.color;
    element.style.fontFamily = style.fontFamily;
    element.style.fontSize = `${resolveTwinPreviewResponsiveFontSizePx(style.fontSizePx, role)}px`;
  }

  function applyAnchorStyle(
    anchor: TwinFaceLabelAnchor | TwinDirectionalLabelAnchor,
  ) {
    if (anchor.styleKind === "face") {
      applyLabelTextStyle(
        anchor.element,
        context.state.previewStyleSettings.faceLabel,
        "faceLabel",
      );
      return;
    }
    if (anchor.styleKind === "twinRule") {
      applyLabelTextStyle(
        anchor.element,
        context.state.previewStyleSettings.twinRuleLabel,
        "twinRuleLabel",
      );
      return;
    }
    const axisLabelStyle = context.state.previewStyleSettings.axisLabel;
    const resolvedAxisLabelColor =
      axisLabelStyle.colors?.[anchor.axisStyleKey ?? "a"] ??
      axisLabelStyle.color ??
      "#003f78";
    applyLabelTextStyle(
      anchor.element,
      {
        ...axisLabelStyle,
        color: resolvedAxisLabelColor,
      },
      "axisLabel",
    );
  }

  /** 面指数ラベル DOM の token 表示を更新する。 */
  function setIndexLabelText(
    element: HTMLElement,
    labelParts: TwinIndexLabelPart[],
  ) {
    element.replaceChildren();
    appendIndexLabelTokens(element, labelParts);
  }

  /** 軸ラベル DOM の text を更新する。 */
  function setAxisLabelText(element: HTMLElement, text: string) {
    element.textContent = text;
  }

  /** world 座標を preview stage 座標へ射影する。 */
  function projectWorldToStage(
    worldPosition: THREE.Vector3,
    width: number,
    height: number,
  ): TwinScreenPoint {
    const projected = worldPosition.clone().project(context.camera);
    return {
      x: (projected.x + 1) * 0.5 * width,
      y: (1 - projected.y) * 0.5 * height,
      z: projected.z,
    };
  }

  /** 中心点とサイズから矩形を作る。 */
  function buildCenteredRect(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
  ): TwinScreenRect {
    return {
      left: centerX - width * 0.5,
      right: centerX + width * 0.5,
      top: centerY - height * 0.5,
      bottom: centerY + height * 0.5,
      width,
      height,
      centerX,
      centerY,
    };
  }

  /** 矩形が stage 内に完全に収まっているかを返す。 */
  function isRectInsideStage(
    rect: TwinScreenRect,
    width: number,
    height: number,
  ) {
    return (
      rect.left >= 0 &&
      rect.top >= 0 &&
      rect.right <= width &&
      rect.bottom <= height
    );
  }

  /** 指定 world 点が結晶本体に遮蔽されているかを preview 深度で判定する。 */
  function isWorldPointOccludedByPreviewBody(worldPosition: THREE.Vector3) {
    if (!context.state.facePickTargets.length) {
      return false;
    }

    const projected = worldPosition.clone().project(context.camera);
    if (projected.z < -1 || projected.z > 1) {
      return false;
    }

    context.raycaster.setFromCamera(
      new THREE.Vector2(projected.x, projected.y),
      context.camera,
    );
    const intersections = context.raycaster.intersectObjects(
      context.state.facePickTargets,
      false,
    );
    if (intersections.length === 0) {
      return false;
    }

    const tipDistance = worldPosition
      .clone()
      .sub(context.raycaster.ray.origin)
      .dot(context.raycaster.ray.direction);
    if (!Number.isFinite(tipDistance) || tipDistance <= 0) {
      return false;
    }

    return intersections[0].distance < tipDistance - 1e-3;
  }

  /** 指定 world 点が現在の view frustum 内にあるかを判定する。 */
  function isWorldPointInsideView(worldPosition: THREE.Vector3) {
    const projected = worldPosition.clone().project(context.camera);
    return (
      projected.x >= -1 &&
      projected.x <= 1 &&
      projected.y >= -1 &&
      projected.y <= 1 &&
      projected.z >= -1 &&
      projected.z <= 1
    );
  }

  /** 2 つの矩形の共通部分面積を返す。 */
  function computeRectIntersectionArea(
    left: TwinScreenRect | null,
    right: TwinScreenRect | null,
  ) {
    if (!left || !right) {
      return 0;
    }
    const width = Math.max(
      0,
      Math.min(left.right, right.right) - Math.max(left.left, right.left),
    );
    const height = Math.max(
      0,
      Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top),
    );
    return width * height;
  }

  /** 矩形どうしの重なり度合いを 0..1 で返す。 */
  function computeRectOverlapRatio(
    rect: TwinScreenRect | null,
    otherRect: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    } | null,
  ) {
    if (!rect || !otherRect) {
      return 0;
    }
    const intersectionArea = computeRectIntersectionArea(rect, {
      ...otherRect,
      width: otherRect.right - otherRect.left,
      height: otherRect.bottom - otherRect.top,
      centerX: (otherRect.left + otherRect.right) * 0.5,
      centerY: (otherRect.top + otherRect.bottom) * 0.5,
    });
    const rectArea = Math.max(rect.width * rect.height, 1);
    return intersectionArea / rectArea;
  }

  /** 2D 点が三角形内部にあるかを符号付き面積ベースで判定する。 */
  function isPointInTriangle2D(
    point: TwinScreenTrianglePoint,
    triangle: TwinScreenTrianglePoint[],
  ) {
    const [a, b, c] = triangle;
    const area = (
      p1: TwinScreenTrianglePoint,
      p2: TwinScreenTrianglePoint,
      p3: TwinScreenTrianglePoint,
    ) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    const d1 = area(point, a, b);
    const d2 = area(point, b, c);
    const d3 = area(point, c, a);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  /**
   * preview 本体を画面上へ投影した polygon 群を返す。
   *
   * 軸ラベルや face label を body と重ねすぎないため、screen-space の当たり判定に使う。
   */
  function getPreviewBodyScreenPolygons(
    width: number,
    height: number,
    cameraDirection: THREE.Vector3,
  ) {
    const polygons: TwinScreenTrianglePoint[][] = [];
    context.state.facePickTargets.forEach((pickMesh) => {
      if (!pickMesh?.visible) {
        return;
      }
      const faceNormal = pickMesh.userData.faceNormal;
      if (faceNormal instanceof THREE.Vector3) {
        const worldNormal = faceNormal
          .clone()
          .transformDirection(pickMesh.matrixWorld);
        if (worldNormal.dot(cameraDirection) >= -0.05) {
          return;
        }
      }
      const positions = pickMesh.geometry?.getAttribute?.("position");
      if (!positions) {
        return;
      }
      for (let index = 0; index + 8 < positions.array.length; index += 9) {
        const triangle: TwinScreenTrianglePoint[] = [];
        let visible = true;
        for (let vertexIndex = 0; vertexIndex < 3; vertexIndex += 1) {
          const point = new THREE.Vector3(
            positions.array[index + vertexIndex * 3],
            positions.array[index + vertexIndex * 3 + 1],
            positions.array[index + vertexIndex * 3 + 2],
          );
          const screen = projectWorldToStage(
            pickMesh.localToWorld(point),
            width,
            height,
          );
          if (screen.z < -1 || screen.z > 1) {
            visible = false;
            break;
          }
          triangle.push({ x: screen.x, y: screen.y });
        }
        if (visible && triangle.length === 3) {
          polygons.push(triangle);
        }
      }
    });
    return polygons;
  }

  /** ラベル矩形が body polygon 群とどれだけ重なるかを score 化する。 */
  function computeRectPolygonOverlapScore(
    rect: TwinScreenRect,
    polygons: TwinScreenTrianglePoint[][],
  ) {
    if (!polygons?.length) {
      return 0;
    }
    const sampleColumns = 10;
    const sampleRows = 8;
    let hits = 0;
    let total = 0;
    for (let row = 0; row < sampleRows; row += 1) {
      for (let column = 0; column < sampleColumns; column += 1) {
        const point = {
          x: rect.left + ((column + 0.5) / sampleColumns) * rect.width,
          y: rect.top + ((row + 0.5) / sampleRows) * rect.height,
        };
        total += 1;
        if (polygons.some((triangle) => isPointInTriangle2D(point, triangle))) {
          hits += 1;
        }
      }
    }
    return hits / Math.max(total, 1);
  }

  /** preview 本体全体を覆う screen-space の bounding rect を返す。 */
  function getPreviewBodyScreenRect(width: number, height: number) {
    if (!context.state.previewRoot) {
      return null;
    }

    const bounds = {
      left: Infinity,
      top: Infinity,
      right: -Infinity,
      bottom: -Infinity,
    };

    context.state.previewRoot.traverse((node: THREE.Object3D) => {
      const meshNode = node as THREE.Mesh;
      if (!meshNode.isMesh || !meshNode.visible) {
        return;
      }
      if (
        context.previewHelperNames.has(meshNode.name) ||
        meshNode.name === "preview-ridge-lines"
      ) {
        return;
      }
      const geometry = meshNode.geometry;
      if (!geometry) {
        return;
      }
      if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
      }
      const box = geometry.boundingBox;
      if (!box) {
        return;
      }
      const corners = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z),
      ];
      corners.forEach((corner) => {
        const screen = projectWorldToStage(
          meshNode.localToWorld(corner),
          width,
          height,
        );
        if (screen.z < -1.2 || screen.z > 1.2) {
          return;
        }
        bounds.left = Math.min(bounds.left, screen.x);
        bounds.top = Math.min(bounds.top, screen.y);
        bounds.right = Math.max(bounds.right, screen.x);
        bounds.bottom = Math.max(bounds.bottom, screen.y);
      });
    });

    if (!Number.isFinite(bounds.left)) {
      return null;
    }

    return bounds;
  }

  /** 軸ラベルを軸端付近へ置くときの候補矩形を作る。 */
  function buildAxialAxisLabelRect(
    tipScreen: TwinScreenPoint,
    directionScreen: THREE.Vector2,
    labelWidth: number,
    labelHeight: number,
    offset: number,
  ) {
    const normalizedDirection =
      directionScreen.lengthSq() > 1e-6
        ? directionScreen.clone().normalize()
        : new THREE.Vector2(1, 0);
    const radialHalfExtent =
      Math.abs(normalizedDirection.x) * labelWidth * 0.5 +
      Math.abs(normalizedDirection.y) * labelHeight * 0.5;
    return buildCenteredRect(
      tipScreen.x + normalizedDirection.x * (radialHalfExtent + offset),
      tipScreen.y + normalizedDirection.y * (radialHalfExtent + offset),
      labelWidth,
      labelHeight,
    );
  }

  /** 元のオフセット方向をできるだけ保ったまま、矩形を stage 内へ収める。 */
  function clampRectToStagePreservingOffset(
    rect: TwinScreenRect,
    anchorX: number,
    anchorY: number,
    width: number,
    height: number,
  ) {
    void anchorX;
    void anchorY;
    const halfWidth = rect.width * 0.5;
    const halfHeight = rect.height * 0.5;
    let centerX = rect.centerX;
    let centerY = rect.centerY;

    if (rect.left < 0 || rect.right > width) {
      centerX = THREE.MathUtils.clamp(centerX, halfWidth, width - halfWidth);
    }
    if (rect.top < 0 || rect.bottom > height) {
      centerY = THREE.MathUtils.clamp(centerY, halfHeight, height - halfHeight);
    }

    return buildCenteredRect(centerX, centerY, rect.width, rect.height);
  }

  /** 矩形が stage からどれだけはみ出しているかを総和で返す。 */
  function computeRectOverflow(
    rect: TwinScreenRect,
    width: number,
    height: number,
  ) {
    return (
      Math.max(0, -rect.left) +
      Math.max(0, -rect.top) +
      Math.max(0, rect.right - width) +
      Math.max(0, rect.bottom - height)
    );
  }

  /** 軸ラベル候補矩形を、overflow と body overlap をもとに順位付けする。 */
  function rankAxisLabelRectCandidate(
    rect: TwinScreenRect,
    stageWidth: number,
    stageHeight: number,
    bodyRect: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    } | null,
    bodyPolygons: TwinScreenTrianglePoint[][],
  ) {
    return {
      rect,
      overflow: computeRectOverflow(rect, stageWidth, stageHeight),
      overlap: Math.max(
        computeRectPolygonOverlapScore(rect, bodyPolygons),
        computeRectOverlapRatio(rect, bodyRect),
      ),
    };
  }

  /** 軸ラベル候補の順位情報を比較し、より良い候補が先に来るよう整列する。 */
  function sortAxisLabelCandidates(
    left: { overflow: number; overlap: number; offset?: number },
    right: { overflow: number; overlap: number; offset?: number },
  ) {
    if (left.overflow !== right.overflow) {
      return left.overflow - right.overflow;
    }
    if (left.overlap !== right.overlap) {
      return left.overlap - right.overlap;
    }
    return (left.offset ?? 0) - (right.offset ?? 0);
  }

  /** 軸ラベルの横逃がし / 縦逃がし候補を組み立てる。 */
  function buildAxisLabelEscapeCandidates(
    clampedAxialRect: TwinScreenRect,
    labelWidth: number,
    labelHeight: number,
    desiredOffset: number,
    preferredHorizontalSide: "left" | "right" | null,
    preferredVerticalSide: "top" | "bottom" | null,
    allowHorizontal: boolean,
    allowVertical: boolean,
  ) {
    const horizontalCandidates = allowHorizontal
      ? [
          ...(preferredHorizontalSide !== "left"
            ? [
                {
                  rect: buildCenteredRect(
                    clampedAxialRect.centerX +
                      labelWidth * 0.5 +
                      context.axisLabelSideGap +
                      desiredOffset,
                    clampedAxialRect.centerY,
                    labelWidth,
                    labelHeight,
                  ),
                  offset: desiredOffset,
                },
              ]
            : []),
          ...(preferredHorizontalSide !== "right"
            ? [
                {
                  rect: buildCenteredRect(
                    clampedAxialRect.centerX -
                      labelWidth * 0.5 -
                      context.axisLabelSideGap -
                      desiredOffset,
                    clampedAxialRect.centerY,
                    labelWidth,
                    labelHeight,
                  ),
                  offset: desiredOffset,
                },
              ]
            : []),
        ]
      : [];
    const verticalCandidates = allowVertical
      ? [
          ...(preferredVerticalSide !== "bottom"
            ? [
                {
                  rect: buildCenteredRect(
                    clampedAxialRect.centerX,
                    clampedAxialRect.centerY -
                      labelHeight * 0.5 -
                      context.axisLabelSideGap -
                      desiredOffset,
                    labelWidth,
                    labelHeight,
                  ),
                  offset: desiredOffset,
                },
              ]
            : []),
          ...(preferredVerticalSide !== "top"
            ? [
                {
                  rect: buildCenteredRect(
                    clampedAxialRect.centerX,
                    clampedAxialRect.centerY +
                      labelHeight * 0.5 +
                      context.axisLabelSideGap +
                      desiredOffset,
                    labelWidth,
                    labelHeight,
                  ),
                  offset: desiredOffset,
                },
              ]
            : []),
        ]
      : [];
    return { horizontalCandidates, verticalCandidates };
  }

  /**
   * 軸ラベル候補群から最も良い矩形を選ぶ。
   *
   * stage からのはみ出し、body overlap、他ラベルとの衝突をまとめて評価する。
   */
  function chooseAxisLabelRect(
    tipScreen: TwinScreenPoint,
    directionScreen: THREE.Vector2,
    labelWidth: number,
    labelHeight: number,
    stageWidth: number,
    stageHeight: number,
    bodyRect: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    } | null,
    bodyPolygons: TwinScreenTrianglePoint[][],
    preferredHorizontalSide: "left" | "right" | null = null,
    preferredVerticalSide: "top" | "bottom" | null = null,
  ) {
    const axialOffsetCandidates = Array.from(
      { length: context.axisLabelInitialOuterOffset + 1 },
      (_, index) => context.axisLabelInitialOuterOffset - index,
    );
    const originalAxialRect = buildAxialAxisLabelRect(
      tipScreen,
      directionScreen,
      labelWidth,
      labelHeight,
      context.axisLabelInitialOuterOffset,
    );

    let lastAxialRect: TwinScreenRect | null = null;
    let firstInsideAxial: { rect: TwinScreenRect; offset: number } | null =
      null;
    for (const offset of axialOffsetCandidates) {
      const rect = buildAxialAxisLabelRect(
        tipScreen,
        directionScreen,
        labelWidth,
        labelHeight,
        offset,
      );
      lastAxialRect = rect;
      if (isRectInsideStage(rect, stageWidth, stageHeight)) {
        firstInsideAxial ??= { rect, offset };
        if (offset > 0) {
          return rect;
        }
      }
    }

    const bestAxialInside = firstInsideAxial
      ? {
          ...firstInsideAxial,
          overlap: Math.max(
            computeRectPolygonOverlapScore(firstInsideAxial.rect, bodyPolygons),
            computeRectOverlapRatio(firstInsideAxial.rect, bodyRect),
          ),
        }
      : null;
    const axialLimitReached = bestAxialInside?.offset === 0 || !bestAxialInside;

    if (!axialLimitReached) {
      return (
        bestAxialInside?.rect ??
        lastAxialRect ??
        buildCenteredRect(tipScreen.x, tipScreen.y, labelWidth, labelHeight)
      );
    }

    const clampedAxialRect = clampRectToStagePreservingOffset(
      bestAxialInside?.rect ??
        lastAxialRect ??
        buildCenteredRect(tipScreen.x, tipScreen.y, labelWidth, labelHeight),
      tipScreen.x,
      tipScreen.y,
      stageWidth,
      stageHeight,
    );

    const horizontalOverflow =
      originalAxialRect.left < 0 || originalAxialRect.right > stageWidth;
    const verticalOverflow =
      originalAxialRect.top < 0 || originalAxialRect.bottom > stageHeight;

    let allowedHorizontal = true;
    let allowedVertical = true;
    if (horizontalOverflow && !verticalOverflow) {
      allowedHorizontal = false;
    } else if (verticalOverflow && !horizontalOverflow) {
      allowedVertical = false;
    }

    const axialOverlap = Math.max(
      computeRectPolygonOverlapScore(clampedAxialRect, bodyPolygons),
      computeRectOverlapRatio(clampedAxialRect, bodyRect),
    );
    const desiredOffset = Math.round(
      THREE.MathUtils.clamp(axialOverlap, 0, 1) *
        context.axisLabelInitialOuterOffset,
    );
    const { horizontalCandidates, verticalCandidates } =
      buildAxisLabelEscapeCandidates(
        clampedAxialRect,
        labelWidth,
        labelHeight,
        desiredOffset,
        preferredHorizontalSide,
        preferredVerticalSide,
        allowedHorizontal,
        allowedVertical,
      );

    const horizontalBest =
      horizontalCandidates
        .map((candidate) => ({
          ...candidate,
          ...rankAxisLabelRectCandidate(
            candidate.rect,
            stageWidth,
            stageHeight,
            bodyRect,
            bodyPolygons,
          ),
        }))
        .sort(sortAxisLabelCandidates)[0] ?? null;
    const verticalBest =
      verticalCandidates
        .map((candidate) => ({
          ...candidate,
          ...rankAxisLabelRectCandidate(
            candidate.rect,
            stageWidth,
            stageHeight,
            bodyRect,
            bodyPolygons,
          ),
        }))
        .sort(sortAxisLabelCandidates)[0] ?? null;

    const rankedCandidates = [
      ...(horizontalBest ? [{ ...horizontalBest, kind: "horizontal" }] : []),
      ...(verticalBest ? [{ ...verticalBest, kind: "vertical" }] : []),
    ].sort((left, right) => {
      if (left.overlap !== right.overlap) {
        return left.overlap - right.overlap;
      }
      return left.offset - right.offset;
    });

    const fallback = rankedCandidates[0] ??
      [...horizontalCandidates, ...verticalCandidates]
        .map((candidate) => ({
          ...candidate,
          ...rankAxisLabelRectCandidate(
            candidate.rect,
            stageWidth,
            stageHeight,
            bodyRect,
            bodyPolygons,
          ),
        }))
        .sort(sortAxisLabelCandidates)[0] ?? {
        rect: clampedAxialRect,
        offset: 0,
        overlap: axialOverlap,
      };

    const finalRect = fallback?.rect ?? clampedAxialRect;
    if (computeRectOverflow(finalRect, stageWidth, stageHeight) === 0) {
      return finalRect;
    }

    return clampRectToStagePreservingOffset(
      finalRect,
      tipScreen.x,
      tipScreen.y,
      stageWidth,
      stageHeight,
    );
  }

  /** ラベルの逃がし方向を既存配置情報から決める。 */
  function resolveDirectionalAnchorPlacement(
    anchor: TwinDirectionalLabelAnchor,
  ): TwinDirectionalPlacement | null {
    const positiveTipLocal = anchor.tipPosition;
    const positiveDirectionLocal = anchor.direction;
    if (
      !positiveTipLocal ||
      !positiveDirectionLocal ||
      !context.state.previewRoot
    ) {
      return null;
    }

    const positiveTipWorld = context.state.previewRoot.localToWorld(
      positiveTipLocal.clone(),
    );
    const oppositeTipWorld = anchor.oppositeTipPosition
      ? context.state.previewRoot.localToWorld(
          anchor.oppositeTipPosition.clone(),
        )
      : null;
    const positiveTipVisible = isWorldPointInsideView(positiveTipWorld);
    const oppositeTipVisible = oppositeTipWorld
      ? isWorldPointInsideView(oppositeTipWorld)
      : false;
    const oppositeTipOccluded = oppositeTipWorld
      ? isWorldPointOccludedByPreviewBody(oppositeTipWorld)
      : false;
    const shouldUseOppositeTip = Boolean(
      anchor.oppositeTipPosition &&
      anchor.oppositeDirection &&
      (isWorldPointOccludedByPreviewBody(positiveTipWorld) ||
        (!positiveTipVisible && oppositeTipVisible && !oppositeTipOccluded)),
    );

    const activeTipLocal = shouldUseOppositeTip
      ? anchor.oppositeTipPosition
      : positiveTipLocal;
    const activeDirectionLocal = shouldUseOppositeTip
      ? anchor.oppositeDirection
      : positiveDirectionLocal;
    if (!activeTipLocal || !activeDirectionLocal) {
      return null;
    }

    if (anchor.positiveText !== undefined) {
      setAxisLabelText(
        anchor.element,
        shouldUseOppositeTip
          ? (anchor.negativeText ?? "")
          : anchor.positiveText,
      );
    } else if (anchor.positiveLabelParts) {
      setIndexLabelText(
        anchor.element,
        shouldUseOppositeTip
          ? (anchor.negativeLabelParts ?? anchor.positiveLabelParts)
          : anchor.positiveLabelParts,
      );
    }

    const tipWorld = context.state.previewRoot.localToWorld(
      activeTipLocal.clone(),
    );
    const offsetWorld = context.state.previewRoot.localToWorld(
      activeTipLocal
        .clone()
        .add(activeDirectionLocal.clone().multiplyScalar(0.45)),
    );

    return { tipWorld, offsetWorld };
  }

  /** 軸ラベル 1 件の screen-space 配置を計算する。 */
  function positionDirectionalOverlayLabel(
    anchor: TwinDirectionalLabelAnchor,
    tipWorld: THREE.Vector3,
    offsetWorld: THREE.Vector3,
    width: number,
    height: number,
    previewBodyRect: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    } | null,
    previewBodyPolygons: TwinScreenTrianglePoint[][],
  ) {
    const tipScreen = projectWorldToStage(tipWorld, width, height);
    const offsetScreen = projectWorldToStage(offsetWorld, width, height);
    const visible = tipScreen.z >= -1 && tipScreen.z <= 1;
    anchor.element.style.display = visible ? "block" : "none";
    if (!visible) {
      return;
    }
    const currentLeft = Number.parseFloat(anchor.element.style.left ?? "");
    const currentTop = Number.parseFloat(anchor.element.style.top ?? "");
    const currentWidth = Math.max(anchor.element.offsetWidth, 1);
    const currentHeight = Math.max(anchor.element.offsetHeight, 1);
    let preferredHorizontalSide: "left" | "right" | null = null;
    let preferredVerticalSide: "top" | "bottom" | null = null;
    if (Number.isFinite(currentLeft) && Number.isFinite(currentTop)) {
      const currentCenterX = currentLeft;
      const currentCenterY = currentTop;
      if (Math.abs(currentCenterX - tipScreen.x) > currentWidth * 0.25) {
        preferredHorizontalSide =
          currentCenterX > tipScreen.x ? "right" : "left";
      }
      if (Math.abs(currentCenterY - tipScreen.y) > currentHeight * 0.25) {
        preferredVerticalSide = currentCenterY < tipScreen.y ? "top" : "bottom";
      }
    }
    anchor.element.style.left = "-10000px";
    anchor.element.style.top = "-10000px";
    const labelWidth = Math.max(anchor.element.offsetWidth, 1);
    const labelHeight = Math.max(anchor.element.offsetHeight, 1);
    const rect = chooseAxisLabelRect(
      tipScreen,
      new THREE.Vector2(
        offsetScreen.x - tipScreen.x,
        offsetScreen.y - tipScreen.y,
      ),
      labelWidth,
      labelHeight,
      width,
      height,
      previewBodyRect,
      previewBodyPolygons,
      preferredHorizontalSide,
      preferredVerticalSide,
    );
    anchor.element.style.left = `${rect.centerX}px`;
    anchor.element.style.top = `${rect.centerY}px`;
  }

  /** 面ラベル DOM と対象面の対応表を作る。 */
  function createFaceLabelAnchors(
    meshData: {
      faces?: {
        labelParts?: TwinIndexLabelPart[];
        vertices?: { x: number; y: number; z: number }[];
        normal: { x: number; y: number; z: number };
      }[];
    } | null,
    sourceName: string,
  ) {
    return createPreviewFaceLabelAnchors({
      elements: context.elements,
      state: context.state,
      meshData,
      sourceName,
    });
  }

  /** 軸ラベル DOM と対象軸の対応表を作る。 */
  function createAxisLabelAnchors(
    axisGuides:
      | {
          start: { x: number; y: number; z: number };
          end: { x: number; y: number; z: number };
          color: string;
          label: string;
        }[]
      | null
      | undefined,
  ) {
    return createPreviewAxisLabelAnchors({
      elements: context.elements,
      axisGuides,
    });
  }

  /** メタデータ overlay と各ラベル層の表示状態を更新する。 */
  function applyLabelLayerVisibility() {
    context.elements.faceLabelLayer.style.display =
      !context.state.isPreviewDragging &&
      !context.state.previewInertiaActive &&
      (context.state.showFaceLabels ||
        context.state.showAxisLabels ||
        context.state.showTwinRuleGuide)
        ? "block"
        : "none";
  }

  /** 面ラベル DOM の screen-space 位置を更新する。 */
  function updateFaceLabelOverlay() {
    const width = context.elements.previewStage.clientWidth;
    const height = context.elements.previewStage.clientHeight;
    const cameraDirection = context.camera.getWorldDirection(
      new THREE.Vector3(),
    );
    const previewBodyRect = getPreviewBodyScreenRect(width, height);
    const previewBodyPolygons = getPreviewBodyScreenPolygons(
      width,
      height,
      cameraDirection,
    );

    if (
      context.state.previewRoot &&
      context.state.faceLabelAnchors.length > 0
    ) {
      context.state.faceLabelAnchors.forEach((anchor) => {
        applyAnchorStyle(anchor);
        const sourceObject = context.state.previewRoot?.getObjectByName(
          anchor.sourceName,
        );
        if (!sourceObject || !context.state.showFaceLabels) {
          anchor.element.style.display = "none";
          return;
        }
        const worldPosition = sourceObject.localToWorld(
          anchor.position.clone(),
        );
        const worldNormal = anchor.normal
          .clone()
          .transformDirection(sourceObject.matrixWorld);
        const projected = worldPosition.project(context.camera);
        const visible =
          projected.z >= -1 &&
          projected.z <= 1 &&
          worldNormal.dot(cameraDirection) < -0.05;
        anchor.element.style.display = visible ? "block" : "none";
        if (!visible) {
          return;
        }
        anchor.element.style.left = `${(projected.x + 1) * 0.5 * width}px`;
        anchor.element.style.top = `${(1 - projected.y) * 0.5 * height}px`;
      });
    }

    if (
      context.state.previewRoot &&
      context.state.axisLabelAnchors.length > 0
    ) {
      context.state.axisLabelAnchors.forEach((anchor) => {
        applyAnchorStyle(anchor);
        if (!context.state.showAxisLabels) {
          anchor.element.style.display = "none";
          return;
        }
        const placement = resolveDirectionalAnchorPlacement(anchor);
        if (!placement) {
          anchor.element.style.display = "none";
          return;
        }
        positionDirectionalOverlayLabel(
          anchor,
          placement.tipWorld,
          placement.offsetWorld,
          width,
          height,
          previewBodyRect,
          previewBodyPolygons,
        );
      });
    }

    if (
      context.state.previewRoot &&
      context.state.twinRuleLabelAnchors.length > 0
    ) {
      context.state.twinRuleLabelAnchors.forEach((anchor) => {
        applyAnchorStyle(anchor);
        if (!context.state.showTwinRuleGuide) {
          anchor.element.style.display = "none";
          return;
        }
        if (anchor.tipPosition && anchor.direction) {
          const placement = resolveDirectionalAnchorPlacement(anchor);
          if (!placement) {
            anchor.element.style.display = "none";
            return;
          }
          positionDirectionalOverlayLabel(
            anchor,
            placement.tipWorld,
            placement.offsetWorld,
            width,
            height,
            previewBodyRect,
            previewBodyPolygons,
          );
          return;
        }
        if (!anchor.position || !context.state.previewRoot) {
          anchor.element.style.display = "none";
          return;
        }
        const worldPosition = context.state.previewRoot.localToWorld(
          anchor.position.clone(),
        );
        const projected = worldPosition.project(context.camera);
        const visible = projected.z >= -1 && projected.z <= 1;
        anchor.element.style.display = visible ? "block" : "none";
        if (!visible) {
          return;
        }
        anchor.element.style.left = `${(projected.x + 1) * 0.5 * width}px`;
        anchor.element.style.top = `${(1 - projected.y) * 0.5 * height}px`;
      });
    }
  }

  return {
    createFaceLabelAnchors,
    createAxisLabelAnchors,
    applyLabelLayerVisibility,
    updateFaceLabelOverlay,
  };
}
