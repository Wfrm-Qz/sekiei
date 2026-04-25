import * as THREE from "three";
import * as jscadModeling from "@jscad/modeling";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const { booleans, geometries } = jscadModeling;

const PLANE_SPLIT_EPSILON = 1e-5;
const CAP_LOOP_EPSILON = 1e-4;

interface MeshDataLike {
  positions?: number[];
}

function buildGeom3FromPositions(positions: ArrayLike<number>) {
  const polygons = [];

  for (let index = 0; index + 8 < positions.length; index += 9) {
    polygons.push(
      geometries.poly3.create([
        [positions[index], positions[index + 1], positions[index + 2]],
        [positions[index + 3], positions[index + 4], positions[index + 5]],
        [positions[index + 6], positions[index + 7], positions[index + 8]],
      ]),
    );
  }

  return geometries.geom3.create(polygons);
}

function buildGeom3FromMeshData(meshData: MeshDataLike) {
  return buildGeom3FromPositions(meshData.positions ?? []);
}

function buildGeom3FromBufferGeometry(geometry: THREE.BufferGeometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const positionAttribute = source.getAttribute("position");
  return buildGeom3FromPositions(positionAttribute?.array ?? []);
}

function buildGeometryFromGeom3(geometry3: unknown) {
  const positions: number[] = [];
  const polygons = geometries.geom3.toPolygons(geometry3 as never);

  for (const polygon of polygons) {
    const vertices = polygon.vertices ?? [];
    if (vertices.length < 3) {
      continue;
    }

    const vertexVectors = vertices.map(
      (vertex) => new THREE.Vector3(vertex[0], vertex[1], vertex[2]),
    );
    const edgeA = new THREE.Vector3().subVectors(
      vertexVectors[1],
      vertexVectors[0],
    );
    const edgeB = new THREE.Vector3().subVectors(
      vertexVectors[2],
      vertexVectors[0],
    );
    const normal = new THREE.Vector3().crossVectors(edgeA, edgeB).normalize();
    const reference =
      Math.abs(normal.x) < 0.9
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3()
      .crossVectors(reference, normal)
      .normalize();
    const bitangent = new THREE.Vector3()
      .crossVectors(normal, tangent)
      .normalize();
    const origin = vertexVectors[0];

    let contour = vertexVectors.map((vertex) => {
      const relative = vertex.clone().sub(origin);
      return new THREE.Vector2(
        relative.dot(tangent),
        relative.dot(bitangent),
      );
    });
    let sourceVertices = [...vertices];

    if (!THREE.ShapeUtils.isClockWise(contour)) {
      contour = [...contour].reverse();
      sourceVertices = [...sourceVertices].reverse();
    }

    const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const [aIndex, bIndex, cIndex] of triangles) {
      for (const vertex of [
        sourceVertices[aIndex],
        sourceVertices[bIndex],
        sourceVertices[cIndex],
      ]) {
        positions.push(vertex[0], vertex[1], vertex[2]);
      }
    }
  }

  if (positions.length === 0) {
    return null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function unionMeshDataWithJscad(meshDatas: MeshDataLike[]) {
  const solids = meshDatas
    .filter((meshData) => (meshData.positions?.length ?? 0) > 0)
    .map((meshData) => buildGeom3FromMeshData(meshData));

  if (solids.length === 0) {
    return new THREE.BufferGeometry();
  }

  if (solids.length === 1) {
    return buildGeometryFromGeom3(solids[0]) ?? new THREE.BufferGeometry();
  }

  const unionResult = booleans.union(...solids);
  return buildGeometryFromGeom3(unionResult) ?? new THREE.BufferGeometry();
}

export function unionBufferGeometriesWithJscad(
  geometriesList: (THREE.BufferGeometry | null)[],
) {
  const solid = unionBufferGeometriesAsJscadSolid(geometriesList);
  return solid ? buildGeometryFromGeom3(solid) : null;
}

export function unionBufferGeometriesAsJscadSolid(
  geometriesList: (THREE.BufferGeometry | null)[],
) {
  const solids = geometriesList
    .filter((geometry): geometry is THREE.BufferGeometry => Boolean(geometry))
    .map((geometry) => buildGeom3FromBufferGeometry(geometry));

  if (solids.length === 0) {
    return null;
  }

  if (solids.length === 1) {
    return solids[0];
  }

  return booleans.union(...solids);
}

interface SplitVertex {
  point: THREE.Vector3;
  distance: number;
}

function snapPointToPlane(
  point: THREE.Vector3,
  planePoint: THREE.Vector3,
  planeNormal: THREE.Vector3,
  epsilon: number,
) {
  const distance = planeNormal.dot(point.clone().sub(planePoint));
  if (Math.abs(distance) <= epsilon) {
    point.addScaledVector(planeNormal, -distance);
    return 0;
  }
  return distance;
}

function isInsideHalfSpace(
  distance: number,
  keepPositive: boolean,
  epsilon: number,
) {
  return keepPositive ? distance >= -epsilon : distance <= epsilon;
}

function interpolateSplitVertex(
  start: SplitVertex,
  end: SplitVertex,
): SplitVertex {
  const denominator = start.distance - end.distance;
  const ratio =
    Math.abs(denominator) <= Number.EPSILON ? 0 : start.distance / denominator;
  return {
    point: start.point.clone().lerp(end.point, ratio),
    distance: 0,
  };
}

function clipPolygonToHalfSpace(
  polygon: SplitVertex[],
  keepPositive: boolean,
  epsilon: number,
) {
  const clipped: SplitVertex[] = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentInside = isInsideHalfSpace(
      current.distance,
      keepPositive,
      epsilon,
    );
    const nextInside = isInsideHalfSpace(next.distance, keepPositive, epsilon);

    if (currentInside && nextInside) {
      clipped.push(next);
      continue;
    }

    if (currentInside && !nextInside) {
      clipped.push(interpolateSplitVertex(current, next));
      continue;
    }

    if (!currentInside && nextInside) {
      clipped.push(interpolateSplitVertex(current, next));
      clipped.push(next);
    }
  }

  return clipped;
}

function dedupeConsecutivePoints(points: THREE.Vector3[], epsilon: number) {
  const deduped: THREE.Vector3[] = [];

  points.forEach((point) => {
    const previous = deduped[deduped.length - 1];
    if (!previous || previous.distanceToSquared(point) > epsilon * epsilon) {
      deduped.push(point);
    }
  });

  if (
    deduped.length >= 2 &&
    deduped[0].distanceToSquared(deduped[deduped.length - 1]) <=
      epsilon * epsilon
  ) {
    deduped.pop();
  }

  return deduped;
}

function appendConvexPolygonAsTriangles(
  target: number[],
  polygon: THREE.Vector3[],
  desiredNormal: THREE.Vector3,
) {
  const sanitized = dedupeConsecutivePoints(polygon, PLANE_SPLIT_EPSILON);
  if (sanitized.length < 3) {
    return;
  }

  const polygonNormal = new THREE.Vector3();
  for (let index = 1; index + 1 < sanitized.length; index += 1) {
    polygonNormal
      .crossVectors(
        new THREE.Vector3().subVectors(sanitized[index], sanitized[0]),
        new THREE.Vector3().subVectors(sanitized[index + 1], sanitized[0]),
      )
      .normalize();
    if (polygonNormal.lengthSq() > 0) {
      break;
    }
  }

  const vertices =
    polygonNormal.dot(desiredNormal) >= 0 ? sanitized : [...sanitized].reverse();

  for (let index = 1; index + 1 < vertices.length; index += 1) {
    [vertices[0], vertices[index], vertices[index + 1]].forEach((vertex) => {
      target.push(vertex.x, vertex.y, vertex.z);
    });
  }
}

function quantizePoint(point: THREE.Vector3, epsilon: number) {
  return [
    Math.round(point.x / epsilon),
    Math.round(point.y / epsilon),
    Math.round(point.z / epsilon),
  ].join(":");
}

function buildPlaneBasis(normal: THREE.Vector3) {
  const reference =
    Math.abs(normal.x) < 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3()
    .crossVectors(reference, normal)
    .normalize();
  const bitangent = new THREE.Vector3()
    .crossVectors(normal, tangent)
    .normalize();
  return { tangent, bitangent };
}

function buildLoopsFromBoundarySegments(
  segments: { start: THREE.Vector3; end: THREE.Vector3 }[],
  epsilon: number,
) {
  const pointByKey = new Map<string, THREE.Vector3>();
  const adjacency = new Map<string, Set<string>>();
  const unusedEdges = new Set<string>();

  const registerPoint = (point: THREE.Vector3) => {
    const key = quantizePoint(point, epsilon);
    if (!pointByKey.has(key)) {
      pointByKey.set(key, point.clone());
    }
    adjacency.set(key, adjacency.get(key) ?? new Set());
    return key;
  };

  segments.forEach(({ start, end }) => {
    const startKey = registerPoint(start);
    const endKey = registerPoint(end);
    if (startKey === endKey) {
      return;
    }
    adjacency.get(startKey)?.add(endKey);
    adjacency.get(endKey)?.add(startKey);
    unusedEdges.add(
      startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`,
    );
  });

  const markUsed = (keyA: string, keyB: string) => {
    unusedEdges.delete(keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`);
  };

  const loops: THREE.Vector3[][] = [];

  while (unusedEdges.size > 0) {
    const edge = unusedEdges.values().next().value as string;
    const [startKey, nextKey] = edge.split("|");
    const loopKeys = [startKey];
    let previousKey: string | null = startKey;
    let currentKey = nextKey;
    markUsed(startKey, nextKey);

    while (currentKey !== startKey) {
      loopKeys.push(currentKey);
      const neighbors = [...(adjacency.get(currentKey) ?? [])];
      const candidate = neighbors.find((neighborKey) => {
        if (neighborKey === previousKey) {
          return false;
        }
        const edgeKey =
          currentKey < neighborKey
            ? `${currentKey}|${neighborKey}`
            : `${neighborKey}|${currentKey}`;
        return unusedEdges.has(edgeKey);
      });
      if (!candidate) {
        break;
      }
      markUsed(currentKey, candidate);
      previousKey = currentKey;
      currentKey = candidate;
    }

    if (currentKey === startKey && loopKeys.length >= 3) {
      loops.push(
        dedupeConsecutivePoints(
          loopKeys
            .map((key) => pointByKey.get(key)?.clone())
            .filter((point): point is THREE.Vector3 => Boolean(point)),
          epsilon,
        ),
      );
    }
  }

  return loops.filter((loop) => loop.length >= 3);
}

function collectPolygonCutSegment(
  polygon: SplitVertex[],
  epsilon: number,
) {
  const points: THREE.Vector3[] = [];

  const addPoint = (point: THREE.Vector3) => {
    if (
      points.some(
        (existing) => existing.distanceToSquared(point) <= epsilon * epsilon,
      )
    ) {
      return;
    }
    points.push(point.clone());
  };

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentOnPlane = Math.abs(current.distance) <= epsilon;
    const nextOnPlane = Math.abs(next.distance) <= epsilon;

    if (currentOnPlane) {
      addPoint(current.point);
    }

    if (currentOnPlane && nextOnPlane) {
      continue;
    }

    const crossesPlane =
      (current.distance < -epsilon && next.distance > epsilon) ||
      (current.distance > epsilon && next.distance < -epsilon);
    if (crossesPlane) {
      addPoint(interpolateSplitVertex(current, next).point);
    }
  }

  if (points.length !== 2) {
    return null;
  }

  return {
    start: points[0],
    end: points[1],
  };
}

function appendCapPolygons(
  target: number[],
  loops: THREE.Vector3[][],
  planeNormal: THREE.Vector3,
  desiredNormal: THREE.Vector3,
) {
  const { tangent, bitangent } = buildPlaneBasis(planeNormal);

  loops.forEach((loop) => {
    const origin = loop[0];
    let contour = loop.map((point) => {
      const relative = point.clone().sub(origin);
      return new THREE.Vector2(
        relative.dot(tangent),
        relative.dot(bitangent),
      );
    });
    let sourceVertices = [...loop];

    if (!THREE.ShapeUtils.isClockWise(contour)) {
      contour = [...contour].reverse();
      sourceVertices = [...sourceVertices].reverse();
    }

    const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
    triangles.forEach(([aIndex, bIndex, cIndex]) => {
      const triangle = [
        sourceVertices[aIndex],
        sourceVertices[bIndex],
        sourceVertices[cIndex],
      ];
      const normal = new THREE.Vector3()
        .subVectors(triangle[1], triangle[0])
        .cross(new THREE.Vector3().subVectors(triangle[2], triangle[0]));
      if (normal.dot(desiredNormal) < 0) {
        [triangle[1], triangle[2]] = [triangle[2], triangle[1]];
      }
      triangle.forEach((vertex) => {
        target.push(vertex.x, vertex.y, vertex.z);
      });
    });
  });
}

function buildGeometryFromPositions(positions: number[]) {
  if (positions.length === 0) {
    return null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function weldGeometryForPlaneSplit(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const size = geometry.boundingBox?.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size?.x ?? 0, size?.y ?? 0, size?.z ?? 0, 1);
  const weldTolerance = maxDimension * 1e-5;
  return mergeVertices(
    geometry.index ? geometry.toNonIndexed() : geometry.clone(),
    weldTolerance,
  );
}

export function splitJscadSolidByPlaneWithJscad(
  sourceSolid: unknown,
  planePoint: THREE.Vector3,
  planeNormal: THREE.Vector3,
  halfSpaceSize: number,
) {
  const geometry = sourceSolid ? buildGeometryFromGeom3(sourceSolid) : null;
  return splitBufferGeometryByPlaneWithJscad(
    geometry,
    planePoint,
    planeNormal,
    halfSpaceSize,
  );
}

export function splitBufferGeometryByPlaneWithJscad(
  geometry: THREE.BufferGeometry | null,
  planePoint: THREE.Vector3,
  planeNormal: THREE.Vector3,
  halfSpaceSize: number,
) {
  void halfSpaceSize;
  if (!geometry) {
    return {
      positive: null,
      negative: null,
    };
  }

  const source = weldGeometryForPlaneSplit(geometry).toNonIndexed();
  const positionAttribute = source.getAttribute("position");
  if (!positionAttribute || positionAttribute.count === 0) {
    return {
      positive: null,
      negative: null,
    };
  }

  const normal = planeNormal.clone().normalize();
  const positivePositions: number[] = [];
  const negativePositions: number[] = [];
  const cutSegments: { start: THREE.Vector3; end: THREE.Vector3 }[] = [];

  for (let index = 0; index + 2 < positionAttribute.count; index += 3) {
    const splitPolygon: SplitVertex[] = [0, 1, 2].map((offset) => {
      const point = new THREE.Vector3().fromBufferAttribute(
        positionAttribute,
        index + offset,
      );
      const distance = snapPointToPlane(
        point,
        planePoint,
        normal,
        PLANE_SPLIT_EPSILON,
      );
      return { point, distance };
    });

    const positivePolygon = clipPolygonToHalfSpace(
      splitPolygon,
      true,
      PLANE_SPLIT_EPSILON,
    ).map((vertex) => vertex.point.clone());
    const negativePolygon = clipPolygonToHalfSpace(
      splitPolygon,
      false,
      PLANE_SPLIT_EPSILON,
    ).map((vertex) => vertex.point.clone());

    appendConvexPolygonAsTriangles(positivePositions, positivePolygon, normal);
    appendConvexPolygonAsTriangles(
      negativePositions,
      negativePolygon,
      normal.clone().multiplyScalar(-1),
    );

    const cutSegment = collectPolygonCutSegment(splitPolygon, CAP_LOOP_EPSILON);
    if (cutSegment) {
      cutSegments.push(cutSegment);
    }
  }

  const loops = buildLoopsFromBoundarySegments(cutSegments, CAP_LOOP_EPSILON);
  appendCapPolygons(
    positivePositions,
    loops,
    normal,
    normal.clone().multiplyScalar(-1),
  );
  appendCapPolygons(negativePositions, loops, normal, normal);

  return {
    positive: buildGeometryFromPositions(positivePositions),
    negative: buildGeometryFromPositions(negativePositions),
  };
}
