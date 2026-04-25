/**
 * 双晶 SVG export の plane grouping と path merge を支える helper 群。
 *
 * ここでは preview state を直接触らず、entry 配列や callback を受け取って
 * 純粋に SVG 向けの grouping / path 化だけを行う。
 */

import { computeSignedPolygonArea2D } from "./svgPolygonHelpers.js";

export function buildExportVertexKey(point) {
  return [point.x.toFixed(3), point.y.toFixed(3), point.z.toFixed(3)].join("|");
}

export function buildExportEdgeKey(startKey, endKey) {
  return startKey < endKey
    ? `${startKey}::${endKey}`
    : `${endKey}::${startKey}`;
}

export function canonicalizeExportPlane(normal, point) {
  const canonicalNormal = normal.clone().normalize();
  if (
    canonicalNormal.z < -1e-6 ||
    (Math.abs(canonicalNormal.z) <= 1e-6 && canonicalNormal.y < -1e-6) ||
    (Math.abs(canonicalNormal.z) <= 1e-6 &&
      Math.abs(canonicalNormal.y) <= 1e-6 &&
      canonicalNormal.x < 0)
  ) {
    canonicalNormal.multiplyScalar(-1);
  }
  return {
    normal: canonicalNormal,
    distance: canonicalNormal.dot(point),
  };
}

export function buildCanonicalExportPlaneKey(normal, point) {
  const plane = canonicalizeExportPlane(normal, point);
  return [
    plane.normal.x.toFixed(5),
    plane.normal.y.toFixed(5),
    plane.normal.z.toFixed(5),
    plane.distance.toFixed(5),
  ].join("|");
}

export function doesBoundaryApplyToExportPlane(
  boundaryLine,
  planeNormal,
  planePoint,
) {
  if (!boundaryLine?.planeKeys?.length || !planeNormal || !planePoint) {
    return true;
  }
  const planeKey = buildCanonicalExportPlaneKey(planeNormal, planePoint);
  return boundaryLine.planeKeys.includes(planeKey);
}

export function findMatchingExportPlaneGroup(groups, entry) {
  const plane = canonicalizeExportPlane(entry.normal, entry.worldPoints[0]);
  return (
    groups.find(
      (group) =>
        group.fill === entry.fill &&
        Math.abs(group.fillOpacity - entry.fillOpacity) < 1e-6 &&
        Math.abs(group.normal.dot(plane.normal) - 1) < 1e-4 &&
        Math.abs(group.distance - plane.distance) < 1e-4,
    ) ?? null
  );
}

export function buildBoundaryExportLineKey(line) {
  const startKey = `${Number(line.x1).toFixed(3)},${Number(line.y1).toFixed(3)}`;
  const endKey = `${Number(line.x2).toFixed(3)},${Number(line.y2).toFixed(3)}`;
  const segmentKey =
    startKey < endKey ? `${startKey}::${endKey}` : `${endKey}::${startKey}`;
  const planeKey = Array.isArray(line.planeKeys)
    ? [...line.planeKeys].sort().join("||")
    : "";
  return `${segmentKey}|${planeKey}`;
}

export function getVectorSvgBodyWorkSize(
  svgVectorBodyWorkLongEdge,
  width,
  height,
) {
  const baseWidth = Math.max(1, Number(width) || 1);
  const baseHeight = Math.max(1, Number(height) || 1);
  const scale = Math.max(
    1,
    svgVectorBodyWorkLongEdge / Math.max(baseWidth, baseHeight),
  );
  return {
    width: Math.max(1, Math.round(baseWidth * scale)),
    height: Math.max(1, Math.round(baseHeight * scale)),
  };
}

export function traceDirectedPolygonLoops(boundaryEdges) {
  const outgoing = new Map();
  boundaryEdges.forEach((edge) => {
    if (!outgoing.has(edge.startKey)) {
      outgoing.set(edge.startKey, []);
    }
    outgoing.get(edge.startKey).push(edge);
  });

  const visited = new Set();
  const loops = [];

  for (const edge of boundaryEdges) {
    const firstEdgeId = `${edge.startKey}->${edge.endKey}`;
    if (visited.has(firstEdgeId)) {
      continue;
    }

    const loop = [edge.startKey];
    let current = edge;
    let guard = 0;
    while (current && guard <= boundaryEdges.length + 2) {
      guard += 1;
      const edgeId = `${current.startKey}->${current.endKey}`;
      if (visited.has(edgeId)) {
        break;
      }
      visited.add(edgeId);
      loop.push(current.endKey);
      if (current.endKey === loop[0]) {
        break;
      }
      current =
        (outgoing.get(current.endKey) ?? []).find(
          (candidate) =>
            !visited.has(`${candidate.startKey}->${candidate.endKey}`),
        ) ?? null;
    }

    if (loop.length >= 4 && loop[loop.length - 1] === loop[0]) {
      loops.push(loop.slice(0, -1));
    }
  }

  return loops;
}

export function computeConvexHull2D(points) {
  if (points.length <= 1) {
    return [...points];
  }

  const sorted = [...points].sort((left, right) =>
    Math.abs(left.x - right.x) > 1e-8 ? left.x - right.x : left.y - right.y,
  );

  const cross = (origin, a, b) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);

  const lower = [];
  sorted.forEach((point) => {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 1e-8
    ) {
      lower.pop();
    }
    lower.push(point);
  });

  const upper = [];
  [...sorted].reverse().forEach((point) => {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 1e-8
    ) {
      upper.pop();
    }
    upper.push(point);
  });

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

export function buildMergedExportPaths(
  triangleEntries,
  width,
  height,
  blockedEdgeKeys,
  helpers,
) {
  const {
    buildPlaneBasis,
    projectFaceVerticesToPlane,
    projectWorldPointToExport,
  } = helpers;
  const groups = [];

  for (const entry of triangleEntries) {
    let group = findMatchingExportPlaneGroup(groups, entry);
    if (!group) {
      const plane = canonicalizeExportPlane(entry.normal, entry.worldPoints[0]);
      group = {
        fill: entry.fill,
        fillOpacity: entry.fillOpacity,
        normal: plane.normal,
        distance: plane.distance,
        point: entry.worldPoints[0].clone(),
        vertices: new Map(),
        planeVertices: new Map(),
        screenVertices: new Map(),
        cameraZValues: [],
        trianglePolygons: [],
        triangles: [],
        tangent: null,
        bitangent: null,
      };
      groups.push(group);
    }
    const triangleKeys = entry.worldPoints.map((point) => {
      const key = buildExportVertexKey(point);
      if (!group.vertices.has(key)) {
        group.vertices.set(key, point.clone());
      }
      return key;
    });
    const orientedWorldPoints =
      entry.normal.dot(group.normal) < 0
        ? [entry.worldPoints[0], entry.worldPoints[2], entry.worldPoints[1]]
        : entry.worldPoints;
    const orientedKeys =
      entry.normal.dot(group.normal) < 0
        ? [triangleKeys[0], triangleKeys[2], triangleKeys[1]]
        : triangleKeys;
    if (!group.tangent || !group.bitangent) {
      const { tangent, bitangent } = buildPlaneBasis(group.normal);
      group.tangent = tangent;
      group.bitangent = bitangent;
    }
    orientedWorldPoints.forEach((point, index) => {
      const key = orientedKeys[index];
      if (!group.planeVertices.has(key)) {
        const projected = projectFaceVerticesToPlane(
          [{ x: point.x, y: point.y, z: point.z }],
          group.point,
          group.tangent,
          group.bitangent,
        )[0];
        group.planeVertices.set(key, projected);
      }
      if (!group.screenVertices.has(key)) {
        const screenPoint = projectWorldPointToExport(point, width, height);
        group.screenVertices.set(key, screenPoint);
      }
    });
    group.triangles.push({
      keys: orientedKeys,
      area: Math.abs(
        computeSignedPolygonArea2D(
          orientedKeys
            .map((key) => group.planeVertices.get(key))
            .filter(Boolean),
        ),
      ),
    });

    entry.projectedPoints.forEach((point) => {
      group.cameraZValues.push(point.cameraZ);
    });
    group.trianglePolygons.push({
      points: entry.projectedPoints
        .map((point) => `${point.x},${point.y}`)
        .join(" "),
      fill: entry.fill,
      fillOpacity: entry.fillOpacity,
      stroke: "none",
      strokeOpacity: 0,
      strokeWidth: 0,
      sortDepth:
        entry.projectedPoints.reduce((sum, point) => sum + point.cameraZ, 0) /
        entry.projectedPoints.length,
    });
  }

  const paths = [];
  groups.forEach((group) => {
    const sharedEdges = new Map();
    const adjacency = new Map();
    group.triangles.forEach((triangle, triangleIndex) => {
      triangle.keys.forEach((startKey, index) => {
        const endKey = triangle.keys[(index + 1) % 3];
        const edgeKey = buildExportEdgeKey(startKey, endKey);
        if (!sharedEdges.has(edgeKey)) {
          sharedEdges.set(edgeKey, []);
        }
        sharedEdges.get(edgeKey).push(triangleIndex);
      });
    });

    sharedEdges.forEach((triangleIndices, edgeKey) => {
      if (triangleIndices.length !== 2 || blockedEdgeKeys.has(edgeKey)) {
        return;
      }
      const [left, right] = triangleIndices;
      if (!adjacency.has(left)) {
        adjacency.set(left, new Set());
      }
      if (!adjacency.has(right)) {
        adjacency.set(right, new Set());
      }
      adjacency.get(left).add(right);
      adjacency.get(right).add(left);
    });

    const visitedTriangles = new Set();
    group.triangles.forEach((_, triangleIndex) => {
      if (visitedTriangles.has(triangleIndex)) {
        return;
      }

      const stack = [triangleIndex];
      const component = [];
      visitedTriangles.add(triangleIndex);
      while (stack.length > 0) {
        const current = stack.pop();
        component.push(current);
        (adjacency.get(current) ?? []).forEach((neighbor) => {
          if (visitedTriangles.has(neighbor)) {
            return;
          }
          visitedTriangles.add(neighbor);
          stack.push(neighbor);
        });
      }

      const componentBoundaryEdges = new Map();
      component.forEach((componentTriangleIndex) => {
        const triangle = group.triangles[componentTriangleIndex];
        triangle.keys.forEach((startKey, index) => {
          const endKey = triangle.keys[(index + 1) % 3];
          const undirectedEdgeKey = buildExportEdgeKey(startKey, endKey);
          const edgeKey = `${startKey}->${endKey}`;
          const reverseKey = `${endKey}->${startKey}`;
          if (blockedEdgeKeys.has(undirectedEdgeKey)) {
            componentBoundaryEdges.set(edgeKey, { startKey, endKey });
            return;
          }
          if (componentBoundaryEdges.has(reverseKey)) {
            componentBoundaryEdges.delete(reverseKey);
          } else {
            componentBoundaryEdges.set(edgeKey, { startKey, endKey });
          }
        });
      });

      const boundaryLoops = traceDirectedPolygonLoops([
        ...componentBoundaryEdges.values(),
      ]);
      const d = boundaryLoops
        .map((loop) => {
          const points = loop
            .map((key) => group.screenVertices.get(key))
            .filter(Boolean);
          if (points.length < 3) {
            return "";
          }
          return points
            .map(
              (point, index) =>
                `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
            )
            .join(" ")
            .concat(" Z");
        })
        .filter(Boolean)
        .join(" ");

      if (!d) {
        component.forEach((componentTriangleIndex) => {
          paths.push({
            d: group.trianglePolygons[componentTriangleIndex].points
              .split(" ")
              .map(
                (entry, index) =>
                  `${index === 0 ? "M" : "L"} ${entry.replace(",", " ")}`,
              )
              .join(" ")
              .concat(" Z"),
            fill: group.fill,
            fillOpacity: group.fillOpacity,
            stroke: "none",
            strokeOpacity: 0,
            strokeWidth: 0,
            fillRule: "nonzero",
            sortDepth: group.trianglePolygons[componentTriangleIndex].sortDepth,
          });
        });
        return;
      }

      paths.push({
        d,
        fill: group.fill,
        fillOpacity: group.fillOpacity,
        stroke: "none",
        strokeOpacity: 0,
        strokeWidth: 0,
        fillRule: "nonzero",
        sortDepth:
          group.cameraZValues.reduce((sum, value) => sum + value, 0) /
          Math.max(group.cameraZValues.length, 1),
      });
    });
  });

  return paths;
}
