import * as THREE from "three";

/**
 * 双晶 preview の稜線 / 双晶交線に関する幾何 helper。
 *
 * preview scene と SVG export の両方から使われるため、page entry に置いたままだと
 * 依存が絡みやすい。ここでは 3D 線分処理と交線抽出を 1 か所へ集約する。
 */

interface RidgeGeometryVisibleCrystalEntryLike {
  meshData: {
    faces?:
      | {
          vertices?: { x: number; y: number; z: number }[];
          normal?: { x: number; y: number; z: number } | null;
        }[]
      | null;
  } | null;
}

export interface TwinRidgeGeometryContext {
  shouldKeepOccludedRidgeSegments: () => boolean;
}

export interface TwinPreviewRidgeLineData {
  surfacePositions: number[];
  occludedInteriorPositions: number[];
}

/** 線分の向きに依らない outline segment key を作る。 */
function buildOutlineSegmentKey(start: THREE.Vector3, end: THREE.Vector3) {
  const pointKey = (point: THREE.Vector3) =>
    [point.x, point.y, point.z].map((value) => value.toFixed(5)).join("|");
  const startKey = pointKey(start);
  const endKey = pointKey(end);
  return startKey < endKey
    ? `${startKey}::${endKey}`
    : `${endKey}::${startKey}`;
}

/** meshData.faces から重複なしの outline segment 群を取り出す。 */
function collectOutlineSegments(
  meshData: RidgeGeometryVisibleCrystalEntryLike["meshData"],
) {
  const edgeMap = new Map<
    string,
    { start: THREE.Vector3; end: THREE.Vector3 }
  >();
  for (const face of meshData?.faces ?? []) {
    const vertices = face.vertices ?? [];
    for (let index = 0; index < vertices.length; index += 1) {
      const start = vertices[index];
      const end = vertices[(index + 1) % vertices.length];
      if (!start || !end) {
        continue;
      }
      const edgeKey = buildOutlineSegmentKey(
        new THREE.Vector3(start.x, start.y, start.z),
        new THREE.Vector3(end.x, end.y, end.z),
      );
      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, {
          start: new THREE.Vector3(start.x, start.y, start.z),
          end: new THREE.Vector3(end.x, end.y, end.z),
        });
      }
    }
  }
  return [...edgeMap.values()];
}

/** 3D 線分どうしの内部交点があれば、A 側の parameter を返す。 */
function segmentIntersectionParameter3D(
  startA: THREE.Vector3,
  endA: THREE.Vector3,
  startB: THREE.Vector3,
  endB: THREE.Vector3,
  epsilon = 1e-5,
) {
  const directionA = endA.clone().sub(startA);
  const directionB = endB.clone().sub(startB);
  const offset = startA.clone().sub(startB);
  const a = directionA.dot(directionA);
  const b = directionA.dot(directionB);
  const c = directionB.dot(directionB);
  const d = directionA.dot(offset);
  const e = directionB.dot(offset);
  const denominator = a * c - b * b;
  if (Math.abs(denominator) < epsilon) {
    return null;
  }
  const tA = (b * e - c * d) / denominator;
  const tB = (a * e - b * d) / denominator;
  if (
    tA <= epsilon ||
    tA >= 1 - epsilon ||
    tB <= epsilon ||
    tB >= 1 - epsilon
  ) {
    return null;
  }
  const pointA = startA.clone().addScaledVector(directionA, tA);
  const pointB = startB.clone().addScaledVector(directionB, tB);
  if (pointA.distanceToSquared(pointB) > epsilon * epsilon) {
    return null;
  }
  return tA;
}

/**
 * 数値誤差で厳密交差にならない浅角度ケース向けに、線分どうしの最近接点から A 側 parameter を返す。
 *
 * xray では交差付近の ridge が少し先まで伸びて見えることがあるため、
 * 「厳密には交わっていないが十分近い」場合も split 候補として扱う。
 */
function segmentNearMissParameter3D(
  startA: THREE.Vector3,
  endA: THREE.Vector3,
  startB: THREE.Vector3,
  endB: THREE.Vector3,
  distanceEpsilon = 1e-3,
  boundaryEpsilon = 1e-4,
) {
  const directionA = endA.clone().sub(startA);
  const directionB = endB.clone().sub(startB);
  const offset = startA.clone().sub(startB);
  const a = directionA.dot(directionA);
  const b = directionA.dot(directionB);
  const c = directionB.dot(directionB);
  const d = directionA.dot(offset);
  const e = directionB.dot(offset);
  const denominator = a * c - b * b;
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }

  const tA = (b * e - c * d) / denominator;
  const tB = (a * e - b * d) / denominator;
  if (
    tA <= boundaryEpsilon ||
    tA >= 1 - boundaryEpsilon ||
    tB <= boundaryEpsilon ||
    tB >= 1 - boundaryEpsilon
  ) {
    return null;
  }

  const pointA = startA.clone().addScaledVector(directionA, tA);
  const pointB = startB.clone().addScaledVector(directionB, tB);
  if (pointA.distanceToSquared(pointB) > distanceEpsilon * distanceEpsilon) {
    return null;
  }
  return tA;
}

/** 点が線分内部に載る場合だけ、その parameter を返す。 */
function pointOnSegmentParameter3D(
  point: THREE.Vector3,
  start: THREE.Vector3,
  end: THREE.Vector3,
  epsilon = 1e-4,
) {
  const direction = end.clone().sub(start);
  const lengthSq = direction.lengthSq();
  if (lengthSq < epsilon * epsilon) {
    return null;
  }
  const t = point.clone().sub(start).dot(direction) / lengthSq;
  if (t <= epsilon || t >= 1 - epsilon) {
    return null;
  }
  const projected = start.clone().addScaledVector(direction, t);
  if (projected.distanceToSquared(point) > epsilon * epsilon) {
    return null;
  }
  return t;
}

/** 点が convex な crystal meshData の内部または境界上にあるかを返す。 */
function isPointInsideCrystalMeshData(
  meshData: RidgeGeometryVisibleCrystalEntryLike["meshData"],
  point: THREE.Vector3,
  epsilon = 1e-5,
) {
  for (const face of meshData?.faces ?? []) {
    if (!face?.vertices?.length || !face?.normal) {
      continue;
    }
    const facePoint = face.vertices[0];
    const normal = new THREE.Vector3(
      face.normal.x,
      face.normal.y,
      face.normal.z,
    );
    const signedDistance =
      normal.dot(point) -
      normal.dot(new THREE.Vector3(facePoint.x, facePoint.y, facePoint.z));
    if (signedDistance > epsilon) {
      return false;
    }
  }
  return true;
}

/** 線分の代表サンプル点がすべて内部にあるとき、深く埋もれているとみなす。 */
function isSegmentDeepInsideCrystalMeshData(
  meshData: RidgeGeometryVisibleCrystalEntryLike["meshData"],
  start: THREE.Vector3,
  end: THREE.Vector3,
  epsilon = 1e-5,
) {
  const quarter = start.clone().lerp(end, 0.25);
  const midpoint = start.clone().lerp(end, 0.5);
  const threeQuarter = start.clone().lerp(end, 0.75);
  return (
    isPointInsideCrystalMeshData(meshData, quarter, epsilon) &&
    isPointInsideCrystalMeshData(meshData, midpoint, epsilon) &&
    isPointInsideCrystalMeshData(meshData, threeQuarter, epsilon)
  );
}

// preview 交線は flat な position 配列で保持されている。
// 先に名前付き segment 群へ直すと、この後の稜線分割ロジックがかなり追いやすくなる。
/** flat な交線 position 配列を、start/end を持つ segment 配列へ直す。 */
function buildIntersectionSegments(intersectionPositions: number[]) {
  const segments: { start: THREE.Vector3; end: THREE.Vector3 }[] = [];
  for (let index = 0; index + 5 < intersectionPositions.length; index += 6) {
    segments.push({
      start: new THREE.Vector3(
        intersectionPositions[index],
        intersectionPositions[index + 1],
        intersectionPositions[index + 2],
      ),
      end: new THREE.Vector3(
        intersectionPositions[index + 3],
        intersectionPositions[index + 4],
        intersectionPositions[index + 5],
      ),
    });
  }
  return segments;
}

// 厳密な 3D 線分交差だけでは split 点が足りなかった。
// 交線 endpoint が稜線上に載るだけのケースも有効なので、その両方を拾っている。
/** 稜線を交線で分割するための parameter 群を、交差点と endpoint 両方から集める。 */
function collectRidgeSplitParameters(
  segment: { start: THREE.Vector3; end: THREE.Vector3 },
  intersectionSegments: { start: THREE.Vector3; end: THREE.Vector3 }[],
  epsilon: number,
) {
  const splitParams = [0, 1];

  intersectionSegments.forEach((intersectionSegment) => {
    const parameter = segmentIntersectionParameter3D(
      segment.start,
      segment.end,
      intersectionSegment.start,
      intersectionSegment.end,
      epsilon,
    );
    if (parameter !== null) {
      splitParams.push(parameter);
    }

    const nearMissParameter = segmentNearMissParameter3D(
      segment.start,
      segment.end,
      intersectionSegment.start,
      intersectionSegment.end,
      Math.max(epsilon * 100, 1e-3),
      epsilon * 10,
    );
    if (nearMissParameter !== null) {
      splitParams.push(nearMissParameter);
    }

    const startParameter = pointOnSegmentParameter3D(
      intersectionSegment.start,
      segment.start,
      segment.end,
      epsilon * 10,
    );
    if (startParameter !== null) {
      splitParams.push(startParameter);
    }

    const endParameter = pointOnSegmentParameter3D(
      intersectionSegment.end,
      segment.start,
      segment.end,
      epsilon * 10,
    );
    if (endParameter !== null) {
      splitParams.push(endParameter);
    }
  });

  return [...new Set(splitParams.map((value) => value.toFixed(6)))]
    .map(Number)
    .sort((left, right) => left - right);
}

/** 稜線の小片が別結晶の内部に埋もれているかを返す。 */
function isRidgeSegmentOccludedByOtherCrystal(
  visibleCrystalEntries: RidgeGeometryVisibleCrystalEntryLike[],
  entryIndex: number,
  start: THREE.Vector3,
  end: THREE.Vector3,
  epsilon: number,
) {
  return visibleCrystalEntries.some(
    (candidate, candidateIndex) =>
      candidateIndex !== entryIndex &&
      isSegmentDeepInsideCrystalMeshData(
        candidate.meshData,
        start,
        end,
        epsilon,
      ),
  );
}

/**
 * 可視稜線を split・重複除去しつつ、
 * 「外表面に残る線」と「別結晶内部に埋もれる稜線小片」を分けて返す。
 *
 * front / hiddenSurface の判定は camera 依存なのでここでは行わず、
 * 後段で共通に扱えるよう surface / occludedInterior の2系統に整理する。
 */
function buildVisibleRidgeLineData(
  visibleCrystalEntries: RidgeGeometryVisibleCrystalEntryLike[],
  intersectionPositions: number[],
) {
  const surfacePositions: number[] = [];
  const occludedInteriorPositions: number[] = [];
  const emitted = new Set<string>();
  const epsilon = 1e-5;
  const intersectionSegments = buildIntersectionSegments(intersectionPositions);

  // 貫入双晶の通常稜線は双晶交線で止まるべきだが、消しすぎても破綻する。
  // 現在は保守的に、まず稜線を分割し、その後で「複数サンプル点が他結晶内部に残る部分だけ」を消す。
  visibleCrystalEntries.forEach((entry, entryIndex) => {
    const outlineSegments = collectOutlineSegments(entry.meshData);
    outlineSegments.forEach((segment) => {
      const params = collectRidgeSplitParameters(
        segment,
        intersectionSegments,
        epsilon,
      );

      for (let index = 0; index < params.length - 1; index += 1) {
        const startT = params[index];
        const endT = params[index + 1];
        if (endT - startT < epsilon) {
          continue;
        }

        const start = segment.start.clone().lerp(segment.end, startT);
        const end = segment.start.clone().lerp(segment.end, endT);
        const isOccludedInterior = isRidgeSegmentOccludedByOtherCrystal(
          visibleCrystalEntries,
          entryIndex,
          start,
          end,
          epsilon,
        );
        const segmentKey = buildOutlineSegmentKey(start, end);
        if (emitted.has(segmentKey)) {
          continue;
        }
        emitted.add(segmentKey);
        if (isOccludedInterior) {
          occludedInteriorPositions.push(
            start.x,
            start.y,
            start.z,
            end.x,
            end.y,
            end.z,
          );
          continue;
        }
        surfacePositions.push(start.x, start.y, start.z, end.x, end.y, end.z);
      }
    });
  });

  return {
    surfacePositions,
    occludedInteriorPositions,
  };
}

/** profile 現状に合わせて必要な稜線だけを flat position 配列で返す。 */
function buildVisibleRidgeLinePositions(
  context: TwinRidgeGeometryContext,
  visibleCrystalEntries: RidgeGeometryVisibleCrystalEntryLike[],
  intersectionPositions: number[],
) {
  const { surfacePositions, occludedInteriorPositions } =
    buildVisibleRidgeLineData(visibleCrystalEntries, intersectionPositions);
  if (!context.shouldKeepOccludedRidgeSegments()) {
    return surfacePositions;
  }
  return [...surfacePositions, ...occludedInteriorPositions];
}

/** 2 平面の交線上にある 1 点を、法線と plane 点から求める。 */
function buildIntersectionLinePoint(
  planePointA: THREE.Vector3,
  normalA: THREE.Vector3,
  planePointB: THREE.Vector3,
  normalB: THREE.Vector3,
  direction: THREE.Vector3,
) {
  const directionLengthSq = direction.lengthSq();
  if (directionLengthSq < 1e-12) {
    return null;
  }
  const d1 = normalA.dot(planePointA);
  const d2 = normalB.dot(planePointB);
  const termA = new THREE.Vector3()
    .crossVectors(normalB, direction)
    .multiplyScalar(d1);
  const termB = new THREE.Vector3()
    .crossVectors(direction, normalA)
    .multiplyScalar(d2);
  return termA.add(termB).multiplyScalar(1 / directionLengthSq);
}

/** 無限直線を convex face の内部区間だけへ切り詰める。 */
function clipLineToConvexFace(
  linePoint: THREE.Vector3,
  lineDirection: THREE.Vector3,
  vertices: { x: number; y: number; z: number }[],
  faceNormal: THREE.Vector3,
) {
  if (!Array.isArray(vertices) || vertices.length < 3) {
    return null;
  }

  const center = vertices
    .reduce(
      (accumulator, vertex) =>
        accumulator.add(new THREE.Vector3(vertex.x, vertex.y, vertex.z)),
      new THREE.Vector3(),
    )
    .multiplyScalar(1 / vertices.length);

  let minT = -Infinity;
  let maxT = Infinity;
  const epsilon = 1e-6;

  for (let index = 0; index < vertices.length; index += 1) {
    const startVertex = vertices[index];
    const endVertex = vertices[(index + 1) % vertices.length];
    const start = new THREE.Vector3(
      startVertex.x,
      startVertex.y,
      startVertex.z,
    );
    const end = new THREE.Vector3(endVertex.x, endVertex.y, endVertex.z);
    const edge = end.clone().sub(start);
    if (edge.lengthSq() < epsilon) {
      continue;
    }

    const inwardNormal = new THREE.Vector3().crossVectors(faceNormal, edge);
    if (inwardNormal.dot(center.clone().sub(start)) < 0) {
      inwardNormal.negate();
    }

    const numerator = inwardNormal.dot(start.clone().sub(linePoint));
    const denominator = inwardNormal.dot(lineDirection);

    if (Math.abs(denominator) < epsilon) {
      if (numerator > epsilon) {
        return null;
      }
      continue;
    }

    const t = numerator / denominator;
    if (denominator > 0) {
      minT = Math.max(minT, t);
    } else {
      maxT = Math.min(maxT, t);
    }

    if (minT - maxT > epsilon) {
      return null;
    }
  }

  if (!Number.isFinite(minT) || !Number.isFinite(maxT)) {
    return null;
  }

  return { minT, maxT };
}

/** 結晶どうしの面交線を抽出し、flat position 配列で返す。 */
function buildCrossCrystalIntersectionLinePositions(
  visibleCrystalEntries: RidgeGeometryVisibleCrystalEntryLike[],
) {
  const positions: number[] = [];
  const seen = new Set<string>();
  const epsilon = 1e-5;

  for (
    let leftIndex = 0;
    leftIndex < visibleCrystalEntries.length - 1;
    leftIndex += 1
  ) {
    const leftFaces = visibleCrystalEntries[leftIndex].meshData?.faces ?? [];
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < visibleCrystalEntries.length;
      rightIndex += 1
    ) {
      const rightFaces =
        visibleCrystalEntries[rightIndex].meshData?.faces ?? [];
      for (const leftFace of leftFaces) {
        if (!leftFace?.vertices?.length || !leftFace?.normal) {
          continue;
        }
        const leftNormal = new THREE.Vector3(
          leftFace.normal.x,
          leftFace.normal.y,
          leftFace.normal.z,
        ).normalize();
        const leftPoint = new THREE.Vector3(
          leftFace.vertices[0].x,
          leftFace.vertices[0].y,
          leftFace.vertices[0].z,
        );

        for (const rightFace of rightFaces) {
          if (!rightFace?.vertices?.length || !rightFace?.normal) {
            continue;
          }
          const rightNormal = new THREE.Vector3(
            rightFace.normal.x,
            rightFace.normal.y,
            rightFace.normal.z,
          ).normalize();
          const rawDirection = new THREE.Vector3().crossVectors(
            leftNormal,
            rightNormal,
          );
          if (rawDirection.lengthSq() < 1e-8) {
            continue;
          }
          const direction = rawDirection.clone().normalize();

          const rightPoint = new THREE.Vector3(
            rightFace.vertices[0].x,
            rightFace.vertices[0].y,
            rightFace.vertices[0].z,
          );
          const linePoint = buildIntersectionLinePoint(
            leftPoint,
            leftNormal,
            rightPoint,
            rightNormal,
            rawDirection,
          );
          if (!linePoint) {
            continue;
          }

          const leftInterval = clipLineToConvexFace(
            linePoint,
            direction,
            leftFace.vertices,
            leftNormal,
          );
          if (!leftInterval) {
            continue;
          }
          const rightInterval = clipLineToConvexFace(
            linePoint,
            direction,
            rightFace.vertices,
            rightNormal,
          );
          if (!rightInterval) {
            continue;
          }

          const minT = Math.max(leftInterval.minT, rightInterval.minT);
          const maxT = Math.min(leftInterval.maxT, rightInterval.maxT);
          if (
            !Number.isFinite(minT) ||
            !Number.isFinite(maxT) ||
            maxT - minT < epsilon
          ) {
            continue;
          }

          const start = linePoint.clone().addScaledVector(direction, minT);
          const end = linePoint.clone().addScaledVector(direction, maxT);
          if (start.distanceToSquared(end) < epsilon * epsilon) {
            continue;
          }

          const ordered = [start, end].sort((a, b) =>
            a.x !== b.x ? a.x - b.x : a.y !== b.y ? a.y - b.y : a.z - b.z,
          );
          const key = ordered
            .map((point) =>
              [point.x, point.y, point.z]
                .map((value) => value.toFixed(4))
                .join(","),
            )
            .join("|");
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
        }
      }
    }
  }

  return positions;
}

export function createTwinRidgeGeometryActions(
  context: TwinRidgeGeometryContext,
) {
  return {
    buildOutlineSegmentKey,
    buildIntersectionSegments,
    collectRidgeSplitParameters,
    buildIntersectionLinePoint,
    clipLineToConvexFace,
    buildCrossCrystalIntersectionLinePositions,
    buildVisibleRidgeLineData,
    buildVisibleRidgeLinePositions: (
      visibleCrystalEntries: RidgeGeometryVisibleCrystalEntryLike[],
      intersectionPositions: number[],
    ) =>
      buildVisibleRidgeLinePositions(
        context,
        visibleCrystalEntries,
        intersectionPositions,
      ),
  };
}
