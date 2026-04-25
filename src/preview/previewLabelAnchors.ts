import * as THREE from "three";
import { resolveTwinAxisStyleKey } from "./previewStyleSettings.js";

interface TwinIndexLabelPart {
  text: string;
  negative: boolean;
}

interface TwinPreviewLabelAnchorElementsLike {
  faceLabelLayer: HTMLElement;
}

interface TwinPreviewLabelAnchorStateLike {
  previewStyleSettings: {
    faceLabel: {
      offset: number;
    };
  };
}

interface TwinFaceLabelAnchor {
  element: HTMLDivElement;
  normal: THREE.Vector3;
  position: THREE.Vector3;
  sourceName: string;
  styleKind?: "face";
}

interface TwinDirectionalLabelAnchor {
  element: HTMLDivElement;
  tipPosition?: THREE.Vector3 | null;
  direction?: THREE.Vector3 | null;
  oppositeTipPosition?: THREE.Vector3 | null;
  oppositeDirection?: THREE.Vector3 | null;
  positiveText?: string;
  negativeText?: string;
  styleKind?: "axis" | "twinRule";
  defaultColor?: string;
  axisStyleKey?: "a" | "b" | "a3" | "c";
}

function appendIndexLabelTokens(
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

/** 面ラベル DOM と対象面の対応表を作る。 */
export function createFaceLabelAnchors(options: {
  elements: TwinPreviewLabelAnchorElementsLike;
  state: TwinPreviewLabelAnchorStateLike;
  meshData: {
    faces?: {
      labelParts?: TwinIndexLabelPart[];
      vertices?: { x: number; y: number; z: number }[];
      normal: { x: number; y: number; z: number };
    }[];
  } | null;
  sourceName: string;
}) {
  const anchors: TwinFaceLabelAnchor[] = [];
  for (const face of options.meshData?.faces ?? []) {
    if (!face.labelParts?.length || !face.vertices?.length) {
      continue;
    }
    const center = new THREE.Vector3();
    face.vertices.forEach((vertex) => {
      center.add(new THREE.Vector3(vertex.x, vertex.y, vertex.z));
    });
    center.divideScalar(face.vertices.length);
    const normal = new THREE.Vector3(
      face.normal.x,
      face.normal.y,
      face.normal.z,
    ).normalize();
    const element = document.createElement("div");
    element.className = "face-index-label";
    element.dataset.source = options.sourceName;
    appendIndexLabelTokens(element, face.labelParts);
    options.elements.faceLabelLayer.append(element);
    anchors.push({
      element,
      normal,
      position: center.add(
        normal.multiplyScalar(
          Number(options.state.previewStyleSettings.faceLabel.offset ?? 0.05),
        ),
      ),
      sourceName: options.sourceName,
      styleKind: "face",
    });
  }
  return anchors;
}

/** 軸ラベル DOM と対象軸の対応表を作る。 */
export function createAxisLabelAnchors(options: {
  elements: TwinPreviewLabelAnchorElementsLike;
  axisGuides:
    | {
        start: { x: number; y: number; z: number };
        end: { x: number; y: number; z: number };
        color: string;
        label: string;
      }[]
    | null
    | undefined;
}) {
  const anchors: TwinDirectionalLabelAnchor[] = [];
  for (const axis of options.axisGuides ?? []) {
    const start = new THREE.Vector3(axis.start.x, axis.start.y, axis.start.z);
    const end = new THREE.Vector3(axis.end.x, axis.end.y, axis.end.z);
    const direction = end.clone().sub(start).normalize();
    const element = document.createElement("div");
    element.className = "axis-overlay-label";
    element.textContent = axis.label;
    options.elements.faceLabelLayer.append(element);
    anchors.push({
      element,
      positiveText: axis.label,
      negativeText: `-${axis.label}`,
      tipPosition: end,
      direction,
      oppositeTipPosition: start,
      oppositeDirection: direction.clone().negate(),
      styleKind: "axis",
      defaultColor:
        typeof axis.color === "string"
          ? axis.color
          : new THREE.Color(axis.color ?? 0xffffff).getStyle(),
      axisStyleKey: resolveTwinAxisStyleKey(axis.label),
    });
  }
  return anchors;
}
