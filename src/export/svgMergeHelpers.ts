/**
 * 双晶 SVG export の merge/debug/scale 系 helper をまとめる。
 *
 * ここには 2D polygon の merge、debug 情報整形、work-size と export-size の
 * 座標変換など、`state` や DOM に依存しない純粋関数だけを置く。
 */

import {
  computeSignedPolygonArea2D,
  distanceSquared2D,
  ensureCounterClockwise,
  roundSvgDebugNumber,
  serializeSvgDebugPoint,
} from "./svgPolygonHelpers.js";

const SVG_EXPORT_DEBUG_EDGE_LIMIT = 120;

interface TwinSvgMergeGroupDebug {
  groupKey: string;
  fill: string | null;
  fillOpacity: number;
  inputFaceCount: number;
  outputFaceCount?: number;
  outputEdgeSummary?: ReturnType<typeof buildTwinSvgEdgeDebugSummary>;
  iterations?: number;
  exactMergeCount?: number;
  partialMergeCount?: number;
  failedExactCandidateCount?: number;
  failedPartialCandidateCount?: number;
  hitIterationGuard?: boolean;
}

interface TwinSvgMergeDebug {
  inputPolygonCount: number;
  boundaryLineCount: number;
  boundarySegmentCount: number;
  inputEdgeSummary: ReturnType<typeof buildTwinSvgEdgeDebugSummary>;
  groups: TwinSvgMergeGroupDebug[];
  outputPolygonCount?: number;
  outputEdgeSummary?: ReturnType<typeof buildTwinSvgEdgeDebugSummary>;
}

export function buildSvgPolygonVertexKey(point) {
  // 数学的には同一点の split 交点でも、work-space pixel の 1/1000 未満ずれることがある。
  // その微差で共有辺が別 SVG polygon として残らないよう、merge key は少し粗めにしている。
  return `${point.x.toFixed(2)}|${point.y.toFixed(2)}`;
}

export function buildSvgPolygonEdgeKey(startKey, endKey) {
  return startKey < endKey
    ? `${startKey}::${endKey}`
    : `${endKey}::${startKey}`;
}

function parameterForPointOnSegment2D(point, segment, epsilon = 1e-4) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < epsilon * epsilon) {
    return null;
  }
  const t =
    ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) /
    lengthSq;
  if (t < -epsilon || t > 1 + epsilon) {
    return null;
  }
  const projection = {
    x: segment.start.x + dx * t,
    y: segment.start.y + dy * t,
  };
  if (distanceSquared2D(point, projection) > epsilon * epsilon) {
    return null;
  }
  return Math.max(0, Math.min(1, t));
}

export function isSegmentOnBoundarySplitLine(start, end, boundarySegments) {
  return boundarySegments.some(
    (segment) =>
      parameterForPointOnSegment2D(start, segment, 1e-3) !== null &&
      parameterForPointOnSegment2D(end, segment, 1e-3) !== null,
  );
}

export function buildSvgPathFromLoops(loops) {
  return loops
    .map((loop) =>
      loop
        .map(
          (point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
        )
        .join(" ")
        .concat(" Z"),
    )
    .join(" ");
}

export function tracePolygonLoopsFromBoundaryEdges(boundaryEdges) {
  const remaining = new Map();
  boundaryEdges.forEach((edge) => {
    if (!remaining.has(edge.startKey)) {
      remaining.set(edge.startKey, []);
    }
    remaining.get(edge.startKey).push({ ...edge, used: false });
  });

  const takeNextEdge = () => {
    for (const edges of remaining.values()) {
      const edge = edges.find((candidate) => !candidate.used);
      if (edge) {
        return edge;
      }
    }
    return null;
  };

  const loops = [];
  let edge = takeNextEdge();
  while (edge) {
    const loop = [{ x: edge.start.x, y: edge.start.y }];
    let current = edge;
    let guard = 0;
    while (current && guard < 10000) {
      guard += 1;
      current.used = true;
      loop.push({ x: current.end.x, y: current.end.y });
      if (current.endKey === edge.startKey) {
        break;
      }
      const nextEdges = remaining.get(current.endKey) ?? [];
      current = nextEdges.find((candidate) => !candidate.used) ?? null;
    }
    if (
      loop.length >= 4 &&
      distanceSquared2D(loop[0], loop[loop.length - 1]) < 1e-6
    ) {
      loops.push(ensureCounterClockwise(loop.slice(0, -1)));
    }
    edge = takeNextEdge();
  }
  return loops;
}

function pointLineDistance2D(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-12) {
    return Math.sqrt(distanceSquared2D(point, lineStart));
  }
  return (
    Math.abs(
      dy * point.x -
        dx * point.y +
        lineEnd.x * lineStart.y -
        lineEnd.y * lineStart.x,
    ) / Math.sqrt(lengthSq)
  );
}

function computeCollinearEdgeOverlapSegment2D(edgeA, edgeB, epsilon = 0.25) {
  if (
    pointLineDistance2D(edgeB.start, edgeA.start, edgeA.end) > epsilon ||
    pointLineDistance2D(edgeB.end, edgeA.start, edgeA.end) > epsilon
  ) {
    return null;
  }
  const dx = edgeA.end.x - edgeA.start.x;
  const dy = edgeA.end.y - edgeA.start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= epsilon * epsilon) {
    return null;
  }
  const project = (point) =>
    ((point.x - edgeA.start.x) * dx + (point.y - edgeA.start.y) * dy) /
    lengthSq;
  const b0 = project(edgeB.start);
  const b1 = project(edgeB.end);
  const startT = Math.max(0, Math.min(b0, b1));
  const endT = Math.min(1, Math.max(b0, b1));
  if (endT <= startT) {
    return null;
  }
  const length = Math.sqrt(lengthSq) * (endT - startT);
  if (length <= epsilon) {
    return null;
  }
  return {
    start: {
      x: edgeA.start.x + dx * startT,
      y: edgeA.start.y + dy * startT,
    },
    end: {
      x: edgeA.start.x + dx * endT,
      y: edgeA.start.y + dy * endT,
    },
    length,
  };
}

function serializeSvgDebugEdge(edge, faceIndex = null) {
  return {
    faceIndex,
    edgeKey: edge.edgeKey,
    blocked: Boolean(edge.blocked),
    start: serializeSvgDebugPoint(edge.start),
    end: serializeSvgDebugPoint(edge.end),
  };
}

function parseSvgPathLoopsForDebug(d) {
  const loops = [];
  let currentLoop = [];
  const tokenPattern = /([ML])\s*([-+0-9.eE]+)\s+([-+0-9.eE]+)|Z/g;
  for (const match of String(d ?? "").matchAll(tokenPattern)) {
    if (match[0] === "Z") {
      if (currentLoop.length) {
        loops.push(currentLoop);
        currentLoop = [];
      }
      continue;
    }
    const point = { x: Number(match[2]), y: Number(match[3]) };
    if (match[1] === "M" && currentLoop.length) {
      loops.push(currentLoop);
      currentLoop = [];
    }
    currentLoop.push(point);
  }
  if (currentLoop.length) {
    loops.push(currentLoop);
  }
  return loops;
}

export function buildSvgExportFaceDebugList(polygons, paths) {
  return [
    ...polygons.map((polygon, index) => ({
      type: "polygon",
      index,
      fill: polygon.fill,
      fillOpacity: Number(polygon.fillOpacity ?? 1),
      stroke: polygon.stroke,
      strokeOpacity: Number(polygon.strokeOpacity ?? 0),
      strokeWidth: Number(polygon.strokeWidth ?? 0),
      sortDepth: roundSvgDebugNumber(Number(polygon.sortDepth ?? 0)),
      backSortDepth: roundSvgDebugNumber(
        Number(polygon.backSortDepth ?? polygon.sortDepth ?? 0),
      ),
      vertices: (
        polygon.points2d ??
        polygon.points.split(" ").map((entry) => {
          const [x, y] = entry.split(",").map(Number);
          return { x, y };
        })
      ).map(serializeSvgDebugPoint),
    })),
    ...paths.map((path, index) => ({
      type: "path",
      index,
      fill: path.fill,
      fillOpacity: Number(path.fillOpacity ?? 1),
      stroke: path.stroke,
      strokeOpacity: Number(path.strokeOpacity ?? 0),
      strokeWidth: Number(path.strokeWidth ?? 0),
      fillRule: path.fillRule ?? "nonzero",
      sortDepth: roundSvgDebugNumber(Number(path.sortDepth ?? 0)),
      backSortDepth: roundSvgDebugNumber(
        Number(path.backSortDepth ?? path.sortDepth ?? 0),
      ),
      loops: parseSvgPathLoopsForDebug(path.d).map((loop) =>
        loop.map(serializeSvgDebugPoint),
      ),
    })),
  ];
}

export function buildSvgSortTieDebugSummary(faces) {
  const groupedBySortDepth = new Map();
  faces.forEach((face, index) => {
    const sortDepthKey = roundSvgDebugNumber(
      Number(face.sortDepth ?? 0),
    ).toFixed(6);
    if (!groupedBySortDepth.has(sortDepthKey)) {
      groupedBySortDepth.set(sortDepthKey, []);
    }
    groupedBySortDepth.get(sortDepthKey).push({ face, index });
  });
  const duplicateGroups = Array.from(groupedBySortDepth.entries())
    .map(([sortDepth, entries]) => {
      const distinctBackSortDepths = Array.from(
        new Set(
          entries.map(({ face }) =>
            roundSvgDebugNumber(
              Number(face.backSortDepth ?? face.sortDepth ?? 0),
            ).toFixed(6),
          ),
        ),
      );
      const distinctFills = Array.from(
        new Set(entries.map(({ face }) => String(face.fill ?? ""))),
      );
      return {
        sortDepth,
        count: entries.length,
        distinctBackSortDepthCount: distinctBackSortDepths.length,
        backSortDepths: distinctBackSortDepths,
        fillCount: distinctFills.length,
        fills: distinctFills,
        sampleIndexes: entries.slice(0, 8).map(({ index }) => index),
      };
    })
    .filter((group) => group.count > 1)
    .sort((left, right) => right.count - left.count);
  return {
    duplicateSortDepthGroupCount: duplicateGroups.length,
    tieBreakableGroupCount: duplicateGroups.filter(
      (group) => group.distinctBackSortDepthCount > 1,
    ).length,
    mixedFillDuplicateGroupCount: duplicateGroups.filter(
      (group) => group.fillCount > 1,
    ).length,
    sampleGroups: duplicateGroups.slice(0, 20),
  };
}

export function buildTwinSvgEdgeDebugSummary(faces) {
  const groupMap = new Map();
  faces.forEach((face, index) => {
    if (!groupMap.has(face.groupKey)) {
      groupMap.set(face.groupKey, []);
    }
    groupMap.get(face.groupKey).push({ face, index });
  });

  const groups = [];
  groupMap.forEach((entries, groupKey) => {
    const edgeOwners = new Map();
    entries.forEach(({ face, index }) => {
      face.edges.forEach((edge) => {
        if (!edgeOwners.has(edge.edgeKey)) {
          edgeOwners.set(edge.edgeKey, []);
        }
        edgeOwners.get(edge.edgeKey).push({ faceIndex: index, edge });
      });
    });

    const singletonOwners = [];
    const blockedPairEdges = [];
    const multiOwnerEdges = [];
    let pairEdgeCount = 0;
    let connectablePairEdgeCount = 0;
    let blockedPairEdgeCount = 0;
    let multiOwnerEdgeCount = 0;
    let singletonEdgeCount = 0;

    edgeOwners.forEach((owners, edgeKey) => {
      if (owners.length === 1) {
        singletonEdgeCount += 1;
        singletonOwners.push(owners[0]);
        return;
      }
      if (owners.length === 2) {
        pairEdgeCount += 1;
        if (owners.some((owner) => owner.edge.blocked)) {
          blockedPairEdgeCount += 1;
          if (blockedPairEdges.length < SVG_EXPORT_DEBUG_EDGE_LIMIT) {
            blockedPairEdges.push({
              edgeKey,
              owners: owners.map((owner) => owner.faceIndex),
              start: serializeSvgDebugPoint(owners[0].edge.start),
              end: serializeSvgDebugPoint(owners[0].edge.end),
            });
          }
          return;
        }
        connectablePairEdgeCount += 1;
        return;
      }
      multiOwnerEdgeCount += 1;
      if (multiOwnerEdges.length < SVG_EXPORT_DEBUG_EDGE_LIMIT) {
        multiOwnerEdges.push({
          edgeKey,
          owners: owners.map((owner) => owner.faceIndex),
          ownerCount: owners.length,
          start: serializeSvgDebugPoint(owners[0].edge.start),
          end: serializeSvgDebugPoint(owners[0].edge.end),
        });
      }
    });

    const nearCoincidentSingletonEdges = [];
    const overlappingSingletonEdges = [];
    for (
      let leftIndex = 0;
      leftIndex < singletonOwners.length;
      leftIndex += 1
    ) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < singletonOwners.length;
        rightIndex += 1
      ) {
        const left = singletonOwners[leftIndex];
        const right = singletonOwners[rightIndex];
        const directDistance =
          distanceSquared2D(left.edge.start, right.edge.start) +
          distanceSquared2D(left.edge.end, right.edge.end);
        const reverseDistance =
          distanceSquared2D(left.edge.start, right.edge.end) +
          distanceSquared2D(left.edge.end, right.edge.start);
        if (
          Math.min(directDistance, reverseDistance) <= 0.25 &&
          nearCoincidentSingletonEdges.length < SVG_EXPORT_DEBUG_EDGE_LIMIT
        ) {
          nearCoincidentSingletonEdges.push({
            owners: [left.faceIndex, right.faceIndex],
            edges: [
              serializeSvgDebugEdge(left.edge),
              serializeSvgDebugEdge(right.edge),
            ],
            endpointDistanceSquared: roundSvgDebugNumber(
              Math.min(directDistance, reverseDistance),
            ),
          });
        }

        const overlap = computeCollinearEdgeOverlapSegment2D(
          left.edge,
          right.edge,
        );
        if (
          overlap &&
          overlappingSingletonEdges.length < SVG_EXPORT_DEBUG_EDGE_LIMIT
        ) {
          overlappingSingletonEdges.push({
            owners: [left.faceIndex, right.faceIndex],
            edgeKeys: [left.edge.edgeKey, right.edge.edgeKey],
            overlapLength: roundSvgDebugNumber(overlap.length),
            start: serializeSvgDebugPoint(overlap.start),
            end: serializeSvgDebugPoint(overlap.end),
            left: serializeSvgDebugEdge(left.edge),
            right: serializeSvgDebugEdge(right.edge),
          });
        }
      }
    }

    const firstFace = entries[0]?.face ?? null;
    groups.push({
      groupKey,
      fill: firstFace?.fill ?? null,
      fillOpacity: Number(firstFace?.fillOpacity ?? 1),
      faceCount: entries.length,
      edgeOwnerCount: edgeOwners.size,
      pairEdgeCount,
      connectablePairEdgeCount,
      blockedPairEdgeCount,
      singletonEdgeCount,
      multiOwnerEdgeCount,
      blockedPairEdges,
      multiOwnerEdges,
      nearCoincidentSingletonEdges,
      overlappingSingletonEdges,
      truncated: {
        maxEntriesPerList: SVG_EXPORT_DEBUG_EDGE_LIMIT,
        singletonEdgeCount,
      },
    });
  });

  return {
    groupCount: groups.length,
    groups,
  };
}

function projectPointParameterOnMergeEdge(point, edge) {
  const dx = edge.end.x - edge.start.x;
  const dy = edge.end.y - edge.start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-12) {
    return null;
  }
  return (
    ((point.x - edge.start.x) * dx + (point.y - edge.start.y) * dy) / lengthSq
  );
}

function addMergeEdgeSplitParameter(parameters, value, epsilon = 1e-5) {
  if (!Number.isFinite(value)) {
    return;
  }
  const clamped = Math.max(0, Math.min(1, value));
  if (
    parameters.some((parameter) => Math.abs(parameter - clamped) <= epsilon)
  ) {
    return;
  }
  parameters.push(clamped);
}

function interpolateMergeEdgePoint(edge, parameter) {
  return {
    x: edge.start.x + (edge.end.x - edge.start.x) * parameter,
    y: edge.start.y + (edge.end.y - edge.start.y) * parameter,
  };
}

function buildTwinSvgMergeFaceEdges(points, boundarySegments) {
  return points.map((start, index) => {
    const end = points[(index + 1) % points.length];
    const startKey = buildSvgPolygonVertexKey(start);
    const endKey = buildSvgPolygonVertexKey(end);
    return {
      start,
      end,
      startKey,
      endKey,
      edgeKey: buildSvgPolygonEdgeKey(startKey, endKey),
      blocked: isSegmentOnBoundarySplitLine(start, end, boundarySegments),
    };
  });
}

export function createTwinSvgMergeFace(polygon, boundarySegments) {
  const points = ensureCounterClockwise(
    polygon.points2d ??
      polygon.points.split(" ").map((entry) => {
        const [x, y] = entry.split(",").map(Number);
        return { x, y };
      }),
  );
  return {
    ...polygon,
    points2d: points,
    points: points.map((point) => `${point.x},${point.y}`).join(" "),
    edges: buildTwinSvgMergeFaceEdges(points, boundarySegments),
    groupKey: [polygon.fill, Number(polygon.fillOpacity ?? 1).toFixed(6)].join(
      "|",
    ),
  };
}

function findExactMergeSharedEdges(leftFace, rightFace) {
  const sharedEdges = [];
  leftFace.edges.forEach((leftEdge) => {
    rightFace.edges.forEach((rightEdge) => {
      if (
        leftEdge.edgeKey !== rightEdge.edgeKey ||
        leftEdge.blocked ||
        rightEdge.blocked
      ) {
        return;
      }
      sharedEdges.push({ leftEdge, rightEdge });
    });
  });
  return sharedEdges;
}

function findPartialMergeSharedEdges(leftFace, rightFace, boundarySegments) {
  const sharedEdges = [];
  leftFace.edges.forEach((leftEdge) => {
    rightFace.edges.forEach((rightEdge) => {
      if (leftEdge.blocked || rightEdge.blocked) {
        return;
      }
      const overlap = computeCollinearEdgeOverlapSegment2D(leftEdge, rightEdge);
      if (
        !overlap ||
        isSegmentOnBoundarySplitLine(
          overlap.start,
          overlap.end,
          boundarySegments,
        )
      ) {
        return;
      }
      if (leftEdge.edgeKey === rightEdge.edgeKey) {
        return;
      }
      sharedEdges.push({ leftEdge, rightEdge, overlap });
    });
  });
  return sharedEdges;
}

function buildSplitFacePairEdges(leftFace, rightFace, boundarySegments) {
  const records = [
    ...leftFace.edges.map((edge) => ({ source: "left", edge })),
    ...rightFace.edges.map((edge) => ({ source: "right", edge })),
  ];
  const splitParameters = records.map(() => [0, 1]);

  leftFace.edges.forEach((leftEdge, leftEdgeIndex) => {
    rightFace.edges.forEach((rightEdge, rightEdgeIndex) => {
      if (leftEdge.blocked || rightEdge.blocked) {
        return;
      }
      const overlap = computeCollinearEdgeOverlapSegment2D(leftEdge, rightEdge);
      if (
        !overlap ||
        isSegmentOnBoundarySplitLine(
          overlap.start,
          overlap.end,
          boundarySegments,
        )
      ) {
        return;
      }
      const leftRecordIndex = leftEdgeIndex;
      const rightRecordIndex = leftFace.edges.length + rightEdgeIndex;
      [overlap.start, overlap.end].forEach((point) => {
        addMergeEdgeSplitParameter(
          splitParameters[leftRecordIndex],
          projectPointParameterOnMergeEdge(point, leftEdge),
        );
        addMergeEdgeSplitParameter(
          splitParameters[rightRecordIndex],
          projectPointParameterOnMergeEdge(point, rightEdge),
        );
      });
    });
  });

  return records.flatMap((record, recordIndex) => {
    const parameters = splitParameters[recordIndex].sort(
      (left, right) => left - right,
    );
    const subEdges = [];
    for (let index = 0; index < parameters.length - 1; index += 1) {
      const startT = parameters[index];
      const endT = parameters[index + 1];
      if (endT - startT <= 1e-5) {
        continue;
      }
      const start = interpolateMergeEdgePoint(record.edge, startT);
      const end = interpolateMergeEdgePoint(record.edge, endT);
      if (distanceSquared2D(start, end) <= 1e-6) {
        continue;
      }
      const startKey = buildSvgPolygonVertexKey(start);
      const endKey = buildSvgPolygonVertexKey(end);
      subEdges.push({
        ...record.edge,
        source: record.source,
        start,
        end,
        startKey,
        endKey,
        edgeKey: buildSvgPolygonEdgeKey(startKey, endKey),
      });
    }
    return subEdges;
  });
}

function buildFacePairBoundaryEdgesBySplitOverlap(
  leftFace,
  rightFace,
  boundarySegments,
) {
  const splitEdges = buildSplitFacePairEdges(
    leftFace,
    rightFace,
    boundarySegments,
  );
  const edgeOwners = new Map();
  splitEdges.forEach((edge) => {
    if (!edgeOwners.has(edge.edgeKey)) {
      edgeOwners.set(edge.edgeKey, []);
    }
    edgeOwners.get(edge.edgeKey).push(edge);
  });

  let internalEdgeCount = 0;
  const boundaryEdges = splitEdges.filter((edge) => {
    const owners = edgeOwners.get(edge.edgeKey) ?? [];
    const hasLeft = owners.some((owner) => owner.source === "left");
    const hasRight = owners.some((owner) => owner.source === "right");
    if (hasLeft && hasRight && !owners.some((owner) => owner.blocked)) {
      internalEdgeCount += 1 / owners.length;
      return false;
    }
    return true;
  });

  return { boundaryEdges, internalEdgeCount };
}

function tryMergeTwinSvgFacePairByExactEdge(
  leftFace,
  rightFace,
  boundarySegments,
) {
  const sharedEdges = findExactMergeSharedEdges(leftFace, rightFace);
  if (!sharedEdges.length) {
    return null;
  }

  const edgeCounts = new Map();
  [...leftFace.edges, ...rightFace.edges].forEach((edge) => {
    edgeCounts.set(edge.edgeKey, (edgeCounts.get(edge.edgeKey) ?? 0) + 1);
  });
  const boundaryEdges = [...leftFace.edges, ...rightFace.edges].filter(
    (edge) => edgeCounts.get(edge.edgeKey) === 1,
  );
  const loops = tracePolygonLoopsFromBoundaryEdges(boundaryEdges);
  if (loops.length !== 1) {
    return null;
  }

  const mergedPoints = ensureCounterClockwise(loops[0]);
  const sourceArea =
    Math.abs(computeSignedPolygonArea2D(leftFace.points2d)) +
    Math.abs(computeSignedPolygonArea2D(rightFace.points2d));
  const mergedArea = Math.abs(computeSignedPolygonArea2D(mergedPoints));
  const areaTolerance = Math.max(1e-3, sourceArea * 1e-4);
  if (Math.abs(sourceArea - mergedArea) > areaTolerance) {
    return null;
  }

  const sortDepth = Math.max(
    Number(leftFace.sortDepth ?? 0),
    Number(rightFace.sortDepth ?? 0),
  );
  return createTwinSvgMergeFace(
    {
      ...leftFace,
      points2d: mergedPoints,
      points: mergedPoints.map((point) => `${point.x},${point.y}`).join(" "),
      sortDepth: Number.isFinite(sortDepth) ? sortDepth : leftFace.sortDepth,
    },
    boundarySegments,
  );
}

function tryMergeTwinSvgFacePairByPartialOverlap(
  leftFace,
  rightFace,
  boundarySegments,
) {
  if (
    !findPartialMergeSharedEdges(leftFace, rightFace, boundarySegments).length
  ) {
    return null;
  }

  const { boundaryEdges, internalEdgeCount } =
    buildFacePairBoundaryEdgesBySplitOverlap(
      leftFace,
      rightFace,
      boundarySegments,
    );
  if (internalEdgeCount <= 0) {
    return null;
  }

  const loops = tracePolygonLoopsFromBoundaryEdges(boundaryEdges);
  if (loops.length !== 1) {
    return null;
  }

  const mergedPoints = ensureCounterClockwise(loops[0]);
  const sourceArea =
    Math.abs(computeSignedPolygonArea2D(leftFace.points2d)) +
    Math.abs(computeSignedPolygonArea2D(rightFace.points2d));
  const mergedArea = Math.abs(computeSignedPolygonArea2D(mergedPoints));
  const areaTolerance = Math.max(1e-3, sourceArea * 1e-4);
  if (Math.abs(sourceArea - mergedArea) > areaTolerance) {
    return null;
  }

  const sortDepth = Math.max(
    Number(leftFace.sortDepth ?? 0),
    Number(rightFace.sortDepth ?? 0),
  );
  return createTwinSvgMergeFace(
    {
      ...leftFace,
      points2d: mergedPoints,
      points: mergedPoints.map((point) => `${point.x},${point.y}`).join(" "),
      sortDepth: Number.isFinite(sortDepth) ? sortDepth : leftFace.sortDepth,
    },
    boundarySegments,
  );
}

function mergeTwinSvgFaceGroupPairwise(
  groupFaces,
  boundarySegments,
  debugGroup = null,
) {
  const faces = [...groupFaces];
  let changed = true;
  let guard = 0;
  let exactMergeCount = 0;
  let partialMergeCount = 0;
  let failedExactCandidateCount = 0;
  let failedPartialCandidateCount = 0;

  while (changed && guard < 10000) {
    guard += 1;
    changed = false;
    for (let leftIndex = 0; leftIndex < faces.length; leftIndex += 1) {
      let merged = null;
      let mergedRightIndex = -1;
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < faces.length;
        rightIndex += 1
      ) {
        if (
          findExactMergeSharedEdges(faces[leftIndex], faces[rightIndex]).length
        ) {
          merged = tryMergeTwinSvgFacePairByExactEdge(
            faces[leftIndex],
            faces[rightIndex],
            boundarySegments,
          );
          if (merged) {
            mergedRightIndex = rightIndex;
            exactMergeCount += 1;
            break;
          }
          failedExactCandidateCount += 1;
        }
        if (
          !findPartialMergeSharedEdges(
            faces[leftIndex],
            faces[rightIndex],
            boundarySegments,
          ).length
        ) {
          continue;
        }
        merged = tryMergeTwinSvgFacePairByPartialOverlap(
          faces[leftIndex],
          faces[rightIndex],
          boundarySegments,
        );
        if (merged) {
          mergedRightIndex = rightIndex;
          partialMergeCount += 1;
          break;
        }
        failedPartialCandidateCount += 1;
      }
      if (!merged) {
        continue;
      }
      faces[leftIndex] = merged;
      faces.splice(mergedRightIndex, 1);
      changed = true;
      break;
    }
  }

  if (debugGroup) {
    debugGroup.iterations = guard;
    debugGroup.exactMergeCount = exactMergeCount;
    debugGroup.partialMergeCount = partialMergeCount;
    debugGroup.failedExactCandidateCount = failedExactCandidateCount;
    debugGroup.failedPartialCandidateCount = failedPartialCandidateCount;
    debugGroup.hitIterationGuard = guard >= 10000;
  }

  return faces;
}

export function mergeAdjacentSplitPolygonsByFill(polygons, boundaryLines) {
  if (polygons.length <= 1) {
    return {
      polygons,
      paths: [],
      debug: {
        inputPolygonCount: polygons.length,
        outputPolygonCount: polygons.length,
        boundaryLineCount: boundaryLines.length,
        groups: [],
      },
    };
  }

  const boundarySegments = boundaryLines
    .map((line) => ({
      start: { x: Number(line.x1), y: Number(line.y1) },
      end: { x: Number(line.x2), y: Number(line.y2) },
    }))
    .filter((segment) => distanceSquared2D(segment.start, segment.end) > 1e-6);

  const faces = polygons.map((polygon) =>
    createTwinSvgMergeFace(polygon, boundarySegments),
  );
  const debug: TwinSvgMergeDebug = {
    inputPolygonCount: polygons.length,
    boundaryLineCount: boundaryLines.length,
    boundarySegmentCount: boundarySegments.length,
    inputEdgeSummary: buildTwinSvgEdgeDebugSummary(faces),
    groups: [],
  };

  const groupMap = new Map();
  faces.forEach((face, index) => {
    if (!groupMap.has(face.groupKey)) {
      groupMap.set(face.groupKey, []);
    }
    groupMap.get(face.groupKey).push(index);
  });

  const outputPolygons = [];

  groupMap.forEach((faceIndices) => {
    const groupFaces = faceIndices.map((faceIndex) => faces[faceIndex]);
    const firstFace = groupFaces[0] ?? null;
    const groupDebug: TwinSvgMergeGroupDebug = {
      groupKey: firstFace?.groupKey ?? "",
      fill: firstFace?.fill ?? null,
      fillOpacity: Number(firstFace?.fillOpacity ?? 1),
      inputFaceCount: groupFaces.length,
    };
    const pairwiseFaces = mergeTwinSvgFaceGroupPairwise(
      groupFaces,
      boundarySegments,
      groupDebug,
    );
    groupDebug.outputFaceCount = pairwiseFaces.length;
    groupDebug.outputEdgeSummary = buildTwinSvgEdgeDebugSummary(pairwiseFaces);
    debug.groups.push(groupDebug);
    outputPolygons.push(...pairwiseFaces);
  });
  debug.outputPolygonCount = outputPolygons.length;
  debug.outputEdgeSummary = buildTwinSvgEdgeDebugSummary(outputPolygons);

  return {
    polygons: outputPolygons.map((polygon) => ({
      ...polygon,
      points: polygon.points2d
        .map((point) => `${point.x},${point.y}`)
        .join(" "),
    })),
    paths: [],
    debug,
  };
}

export function scaleExportPolygonCoordinates(polygon, scaleX, scaleY) {
  const points2d = (
    polygon.points2d ??
    polygon.points.split(" ").map((entry) => {
      const [x, y] = entry.split(",").map(Number);
      return { x, y };
    })
  ).map((point) => ({
    x: point.x * scaleX,
    y: point.y * scaleY,
    cameraZ: point.cameraZ,
  }));
  return {
    ...polygon,
    points2d,
    points: points2d.map((point) => `${point.x},${point.y}`).join(" "),
  };
}

export function scaleExportPathCoordinates(path, scaleX, scaleY) {
  const d = String(path.d ?? "").replace(
    /([ML])\s*([-+0-9.eE]+)\s+([-+0-9.eE]+)/g,
    (_, command, rawX, rawY) => {
      const x = Number(rawX) * scaleX;
      const y = Number(rawY) * scaleY;
      return `${command} ${x} ${y}`;
    },
  );
  return {
    ...path,
    d,
  };
}

export function scaleOpaqueExportTriangles(triangles, scaleX, scaleY) {
  return triangles.map((triangle) => ({
    p1: {
      ...triangle.p1,
      x: triangle.p1.x * scaleX,
      y: triangle.p1.y * scaleY,
    },
    p2: {
      ...triangle.p2,
      x: triangle.p2.x * scaleX,
      y: triangle.p2.y * scaleY,
    },
    p3: {
      ...triangle.p3,
      x: triangle.p3.x * scaleX,
      y: triangle.p3.y * scaleY,
    },
  }));
}
