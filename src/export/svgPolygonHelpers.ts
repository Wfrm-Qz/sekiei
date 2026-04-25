/**
 * 双晶 SVG export で使う 2D polygon 計算と局所深度ソートをまとめる。
 *
 * ここに置くのは `state` や DOM を触らない純粋関数に限定し、
 * `main.ts` から安全に切り出せる範囲だけを集約する。
 */

export function roundSvgDebugNumber(value) {
  return Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : null;
}

export function serializeSvgDebugPoint(point) {
  return {
    x: roundSvgDebugNumber(point?.x),
    y: roundSvgDebugNumber(point?.y),
  };
}

export function computeSignedPolygonArea2D(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area * 0.5;
}

export function ensureCounterClockwise(points) {
  return computeSignedPolygonArea2D(points) < 0
    ? [...points].reverse()
    : points;
}

export function distanceSquared2D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function segmentIntersectionInclusive2D(
  segmentA,
  segmentB,
  epsilon = 1e-6,
) {
  const p = segmentA.start;
  const r = {
    x: segmentA.end.x - segmentA.start.x,
    y: segmentA.end.y - segmentA.start.y,
  };
  const q = segmentB.start;
  const s = {
    x: segmentB.end.x - segmentB.start.x,
    y: segmentB.end.y - segmentB.start.y,
  };
  const denominator = r.x * s.y - r.y * s.x;
  if (Math.abs(denominator) < epsilon) {
    return null;
  }
  const qp = {
    x: q.x - p.x,
    y: q.y - p.y,
  };
  const t = (qp.x * s.y - qp.y * s.x) / denominator;
  const u = (qp.x * r.y - qp.y * r.x) / denominator;
  if (t < -epsilon || t > 1 + epsilon || u < -epsilon || u > 1 + epsilon) {
    return null;
  }
  const clampedT = Math.max(0, Math.min(1, t));
  const clampedU = Math.max(0, Math.min(1, u));
  return {
    t: clampedT,
    u: clampedU,
    point: {
      x: p.x + r.x * clampedT,
      y: p.y + r.y * clampedT,
    },
  };
}

export function isPointInConvexPolygon2D(point, polygon, epsilon = 1e-6) {
  if (polygon.length < 3) {
    return false;
  }
  const oriented = ensureCounterClockwise(polygon);
  for (let index = 0; index < oriented.length; index += 1) {
    const start = oriented[index];
    const end = oriented[(index + 1) % oriented.length];
    const cross =
      (end.x - start.x) * (point.y - start.y) -
      (end.y - start.y) * (point.x - start.x);
    if (cross < -epsilon) {
      return false;
    }
  }
  return true;
}

export function collectLinePolygonIntersectionPoints(line, polygon) {
  const points = [];
  const pushUnique = (point) => {
    if (
      points.some((candidate) => distanceSquared2D(candidate, point) < 1e-6)
    ) {
      return;
    }
    points.push(point);
  };

  if (isPointInConvexPolygon2D(line.start, polygon)) {
    pushUnique(line.start);
  }
  if (isPointInConvexPolygon2D(line.end, polygon)) {
    pushUnique(line.end);
  }
  for (let index = 0; index < polygon.length; index += 1) {
    const edge = {
      start: polygon[index],
      end: polygon[(index + 1) % polygon.length],
    };
    const intersection = segmentIntersectionInclusive2D(line, edge);
    if (intersection) {
      pushUnique(intersection.point);
    }
  }
  return points;
}

export function clipPolygonByLineSide(
  polygon,
  lineStart,
  lineEnd,
  keepPositive,
) {
  const result = [];
  const signedDistance = (point) =>
    (lineEnd.x - lineStart.x) * (point.y - lineStart.y) -
    (lineEnd.y - lineStart.y) * (point.x - lineStart.x);
  const isInside = (point) => {
    const distance = signedDistance(point);
    return keepPositive ? distance >= -1e-6 : distance <= 1e-6;
  };
  const intersect = (start, end) => {
    const startDistance = signedDistance(start);
    const endDistance = signedDistance(end);
    const denominator = startDistance - endDistance;
    if (Math.abs(denominator) < 1e-8) {
      return end;
    }
    const t = startDistance / denominator;
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      cameraZ:
        Number.isFinite(start.cameraZ) && Number.isFinite(end.cameraZ)
          ? start.cameraZ + (end.cameraZ - start.cameraZ) * t
          : undefined,
    };
  };

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentInside = isInside(current);
    const nextInside = isInside(next);
    if (currentInside && nextInside) {
      result.push(next);
    } else if (currentInside && !nextInside) {
      result.push(intersect(current, next));
    } else if (!currentInside && nextInside) {
      result.push(intersect(current, next));
      result.push(next);
    }
  }
  return result.filter(
    (point, index, array) =>
      index === 0 || distanceSquared2D(point, array[index - 1]) > 1e-6,
  );
}

export function splitConvexPolygonByLineSegment(polygon, line) {
  if (polygon.length < 3 || distanceSquared2D(line.start, line.end) <= 1e-6) {
    return [polygon];
  }
  const intersectionPoints = collectLinePolygonIntersectionPoints(
    line,
    polygon,
  );
  if (intersectionPoints.length < 2) {
    return [polygon];
  }
  const positive = clipPolygonByLineSide(polygon, line.start, line.end, true);
  const negative = clipPolygonByLineSide(polygon, line.start, line.end, false);
  const output = [positive, negative]
    .map((candidate) => ensureCounterClockwise(candidate))
    .filter(
      (candidate) =>
        candidate.length >= 3 &&
        Math.abs(computeSignedPolygonArea2D(candidate)) > 1e-2,
    );
  return output.length === 2 ? output : [polygon];
}

export function createExportSplitDebugAccumulator() {
  return {
    inputPolygonCount: 0,
    polygonWithoutApplicableBoundaryCount: 0,
    polygonWithApplicableBoundaryCount: 0,
    lineApplicationCount: 0,
    lineSplitSuccessCount: 0,
    lineSplitNoEffectCount: 0,
    droppedTooFewPointsCount: 0,
    droppedSmallAreaCount: 0,
    droppedSamples: [],
  };
}

export function appendExportSplitDroppedSample(
  debug,
  reason,
  points,
  extra = {},
) {
  if (!debug || debug.droppedSamples.length >= 20) {
    return;
  }
  debug.droppedSamples.push({
    reason,
    pointCount: points.length,
    area: Math.abs(computeSignedPolygonArea2D(points)),
    points: points.map((point) => ({ x: point.x, y: point.y })),
    ...extra,
  });
}

export function normalizeSplitPolygonPoints(points, debug = null) {
  if (points.length < 3) {
    if (debug) {
      debug.droppedTooFewPointsCount += 1;
      appendExportSplitDroppedSample(debug, "too-few-points", points);
    }
    return [];
  }
  const area = Math.abs(computeSignedPolygonArea2D(points));
  if (area <= 1e-4) {
    if (debug) {
      debug.droppedSmallAreaCount += 1;
      appendExportSplitDroppedSample(
        debug,
        "small-area-after-normalize",
        points,
        { area },
      );
    }
    return [];
  }
  return ensureCounterClockwise(points);
}

export function computeExportPolygonRepresentativeDepth(
  points,
  fallbackDepth = 0,
) {
  const cameraZValues = points
    .map((point) => Number(point.cameraZ))
    .filter((value) => Number.isFinite(value));
  if (!cameraZValues.length) {
    return fallbackDepth;
  }
  return Math.max(...cameraZValues);
}

export function computeExportPolygonBackDepth(points, fallbackDepth = 0) {
  const cameraZValues = points
    .map((point) => Number(point.cameraZ))
    .filter((value) => Number.isFinite(value));
  if (!cameraZValues.length) {
    return fallbackDepth;
  }
  return Math.min(...cameraZValues);
}

export function buildExportPolygonBounds2D(polygon) {
  const points = polygon.points2d ?? [];
  if (!points.length) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  points.forEach((point) => {
    minX = Math.min(minX, Number(point.x));
    minY = Math.min(minY, Number(point.y));
    maxX = Math.max(maxX, Number(point.x));
    maxY = Math.max(maxY, Number(point.y));
  });
  return { minX, minY, maxX, maxY };
}

export function doExportPolygonBoundsOverlap(
  leftBounds,
  rightBounds,
  epsilon = 1e-6,
) {
  if (!leftBounds || !rightBounds) {
    return false;
  }
  return !(
    leftBounds.maxX <= rightBounds.minX + epsilon ||
    rightBounds.maxX <= leftBounds.minX + epsilon ||
    leftBounds.maxY <= rightBounds.minY + epsilon ||
    rightBounds.maxY <= leftBounds.minY + epsilon
  );
}

function isPointInsideTriangleWithBarycentric(point, triangle) {
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

export function interpolateCameraZForExportPolygon(polygon, point) {
  const points = polygon.points2d ?? [];
  if (points.length < 3) {
    return null;
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    const triangle = {
      p1: points[0],
      p2: points[index],
      p3: points[index + 1],
    };
    const barycentric = isPointInsideTriangleWithBarycentric(point, triangle);
    if (!barycentric) {
      continue;
    }
    return (
      triangle.p1.cameraZ * barycentric.alpha +
      triangle.p2.cameraZ * barycentric.beta +
      triangle.p3.cameraZ * barycentric.gamma
    );
  }
  return null;
}

function isInsideClipEdge(point, edgeStart, edgeEnd) {
  return (
    (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) -
      (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x) >=
    -1e-6
  );
}

function intersectClipEdges(start, end, edgeStart, edgeEnd) {
  const lineA1 = end.y - start.y;
  const lineA2 = start.x - end.x;
  const lineB1 = edgeEnd.y - edgeStart.y;
  const lineB2 = edgeStart.x - edgeEnd.x;
  const determinant = lineA1 * lineB2 - lineB1 * lineA2;
  if (Math.abs(determinant) < 1e-8) {
    return end;
  }
  const c1 = lineA1 * start.x + lineA2 * start.y;
  const c2 = lineB1 * edgeStart.x + lineB2 * edgeStart.y;
  return {
    x: (lineB2 * c1 - lineA2 * c2) / determinant,
    y: (lineA1 * c2 - lineB1 * c1) / determinant,
  };
}

export function clipConvexPolygon2D(subjectPolygon, clipPolygon) {
  let output = [...subjectPolygon];
  for (let index = 0; index < clipPolygon.length; index += 1) {
    const clipStart = clipPolygon[index];
    const clipEnd = clipPolygon[(index + 1) % clipPolygon.length];
    const input = output;
    output = [];
    if (input.length === 0) {
      break;
    }
    let previous = input[input.length - 1];
    for (const current of input) {
      const currentInside = isInsideClipEdge(current, clipStart, clipEnd);
      const previousInside = isInsideClipEdge(previous, clipStart, clipEnd);
      if (currentInside) {
        if (!previousInside) {
          output.push(
            intersectClipEdges(previous, current, clipStart, clipEnd),
          );
        }
        output.push(current);
      } else if (previousInside) {
        output.push(intersectClipEdges(previous, current, clipStart, clipEnd));
      }
      previous = current;
    }
  }
  return output;
}

export function computePolygonAveragePoint2D(points) {
  const count = Math.max(points.length, 1);
  return points.reduce(
    (sum, point) => ({
      x: sum.x + point.x / count,
      y: sum.y + point.y / count,
      cameraZ: sum.cameraZ + (Number(point.cameraZ) || 0) / count,
    }),
    { x: 0, y: 0, cameraZ: 0 },
  );
}

export function applyLocalOverlapDepthSort(
  polygons,
  options: {
    overlapAreaEpsilon?: number;
    depthEpsilon?: number;
    maxSamplePairs?: number;
  } = {},
) {
  const {
    overlapAreaEpsilon = 1e-4,
    depthEpsilon = 1e-6,
    maxSamplePairs = 24,
  } = options;
  if (polygons.length < 2) {
    return {
      polygons,
      debug: {
        polygonCount: polygons.length,
        bboxCandidatePairCount: 0,
        overlapPairCount: 0,
        decisivePairCount: 0,
        ambiguousPairCount: 0,
        invalidDepthPairCount: 0,
        edgeCount: 0,
        cycleFallbackNodeCount: 0,
        reorderedPolygonCount: 0,
        samplePairs: [],
      },
    };
  }

  const entries = polygons.map((polygon, index) => ({
    polygon,
    index,
    bounds: buildExportPolygonBounds2D(polygon),
    points: ensureCounterClockwise(polygon.points2d ?? []),
  }));
  const sortedByMinX = [...entries].sort(
    (left, right) => (left.bounds?.minX ?? 0) - (right.bounds?.minX ?? 0),
  );
  const outgoing = Array.from({ length: polygons.length }, () => []);
  const indegree = new Array(polygons.length).fill(0);
  const edgeKeys = new Set();
  const debug = {
    polygonCount: polygons.length,
    bboxCandidatePairCount: 0,
    overlapPairCount: 0,
    decisivePairCount: 0,
    ambiguousPairCount: 0,
    invalidDepthPairCount: 0,
    edgeCount: 0,
    cycleFallbackNodeCount: 0,
    reorderedPolygonCount: 0,
    samplePairs: [],
  };

  const addEdge = (backIndex, frontIndex) => {
    if (backIndex === frontIndex) {
      return;
    }
    const edgeKey = `${backIndex}->${frontIndex}`;
    if (edgeKeys.has(edgeKey)) {
      return;
    }
    edgeKeys.add(edgeKey);
    outgoing[backIndex].push(frontIndex);
    indegree[frontIndex] += 1;
  };

  const active = [];
  sortedByMinX.forEach((entry) => {
    for (let index = active.length - 1; index >= 0; index -= 1) {
      const candidate = active[index];
      if (
        (candidate.bounds?.maxX ?? -Infinity) <
        (entry.bounds?.minX ?? Infinity) - 1e-6
      ) {
        active.splice(index, 1);
      }
    }

    active.forEach((candidate) => {
      if (!doExportPolygonBoundsOverlap(candidate.bounds, entry.bounds)) {
        return;
      }
      debug.bboxCandidatePairCount += 1;
      const overlapPolygon = clipConvexPolygon2D(
        candidate.points,
        entry.points,
      );
      if (overlapPolygon.length < 3) {
        return;
      }
      const overlapArea = Math.abs(computeSignedPolygonArea2D(overlapPolygon));
      if (overlapArea <= overlapAreaEpsilon) {
        return;
      }
      debug.overlapPairCount += 1;
      const samplePoint = computePolygonAveragePoint2D(overlapPolygon);
      const candidateDepth = interpolateCameraZForExportPolygon(
        candidate.polygon,
        samplePoint,
      );
      const entryDepth = interpolateCameraZForExportPolygon(
        entry.polygon,
        samplePoint,
      );
      if (!Number.isFinite(candidateDepth) || !Number.isFinite(entryDepth)) {
        debug.invalidDepthPairCount += 1;
        if (debug.samplePairs.length < maxSamplePairs) {
          debug.samplePairs.push({
            leftIndex: candidate.index,
            rightIndex: entry.index,
            result: "invalid-depth",
            overlapArea: roundSvgDebugNumber(overlapArea),
            samplePoint: serializeSvgDebugPoint(samplePoint),
            leftDepth: Number.isFinite(candidateDepth)
              ? roundSvgDebugNumber(candidateDepth)
              : null,
            rightDepth: Number.isFinite(entryDepth)
              ? roundSvgDebugNumber(entryDepth)
              : null,
          });
        }
        return;
      }
      const depthDelta = candidateDepth - entryDepth;
      if (Math.abs(depthDelta) <= depthEpsilon) {
        debug.ambiguousPairCount += 1;
        if (debug.samplePairs.length < maxSamplePairs) {
          debug.samplePairs.push({
            leftIndex: candidate.index,
            rightIndex: entry.index,
            result: "ambiguous",
            overlapArea: roundSvgDebugNumber(overlapArea),
            samplePoint: serializeSvgDebugPoint(samplePoint),
            leftDepth: roundSvgDebugNumber(candidateDepth),
            rightDepth: roundSvgDebugNumber(entryDepth),
          });
        }
        return;
      }

      debug.decisivePairCount += 1;
      const frontIndex = depthDelta > 0 ? candidate.index : entry.index;
      const backIndex = depthDelta > 0 ? entry.index : candidate.index;
      addEdge(backIndex, frontIndex);
      if (debug.samplePairs.length < maxSamplePairs) {
        debug.samplePairs.push({
          leftIndex: candidate.index,
          rightIndex: entry.index,
          result: "decisive",
          frontIndex,
          backIndex,
          overlapArea: roundSvgDebugNumber(overlapArea),
          samplePoint: serializeSvgDebugPoint(samplePoint),
          leftDepth: roundSvgDebugNumber(candidateDepth),
          rightDepth: roundSvgDebugNumber(entryDepth),
        });
      }
    });

    active.push(entry);
  });

  debug.edgeCount = edgeKeys.size;
  const emitted = new Array(polygons.length).fill(false);
  const outputOrder = [];
  for (const polygon of polygons) {
    void polygon;
    let nextIndex = -1;
    for (let index = 0; index < polygons.length; index += 1) {
      if (!emitted[index] && indegree[index] === 0) {
        nextIndex = index;
        break;
      }
    }
    if (nextIndex < 0) {
      break;
    }
    emitted[nextIndex] = true;
    outputOrder.push(nextIndex);
    outgoing[nextIndex].forEach((targetIndex) => {
      indegree[targetIndex] -= 1;
    });
  }

  if (outputOrder.length < polygons.length) {
    const remaining = [];
    for (let index = 0; index < polygons.length; index += 1) {
      if (!emitted[index]) {
        remaining.push(index);
      }
    }
    debug.cycleFallbackNodeCount = remaining.length;
    outputOrder.push(...remaining);
  }

  debug.reorderedPolygonCount = outputOrder.reduce(
    (count, polygonIndex, outputIndex) =>
      count + (polygonIndex !== outputIndex ? 1 : 0),
    0,
  );

  return {
    polygons: outputOrder.map((polygonIndex) => polygons[polygonIndex]),
    debug,
  };
}
