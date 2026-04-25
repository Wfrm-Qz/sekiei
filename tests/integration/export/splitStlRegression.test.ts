import * as THREE from "three";
import { describe, expect, it } from "vitest";
import hexagonalPrismPreset from "../../../src/data/presets/hexagonal-prism-00001.json";
import { createFace, normalizeFaceForSystem } from "../../../src/constants.ts";
import { buildTwinMeshData } from "../../../src/domain/builder.ts";
import { twinPlaneNormal } from "../../../src/domain/crystalFrame.ts";
import { normalizeTwinParameters } from "../../../src/domain/parameters.ts";
import {
  splitBufferGeometryByPlaneWithJscad,
  unionBufferGeometriesWithJscad,
} from "../../../src/domain/jscadCsg.ts";
import { prepareGeometryForStlExport } from "../../../src/io/formats/stl.ts";
import { appendDerivedCrystal } from "../../../src/state/crystalMutations.ts";

function getGeometryCenter(geometry: THREE.BufferGeometry | null) {
  if (!geometry) {
    return null;
  }
  geometry.computeBoundingBox();
  return geometry.boundingBox?.getCenter(new THREE.Vector3()) ?? null;
}

function getGeometryMaxDimension(geometry: THREE.BufferGeometry | null) {
  if (!geometry) {
    return 0;
  }
  geometry.computeBoundingBox();
  const size = geometry.boundingBox?.getSize(new THREE.Vector3());
  if (!size) {
    return 0;
  }
  return Math.max(size.x, size.y, size.z, 0);
}

function mergePreviewGeometriesForStl(
  geometries: (THREE.BufferGeometry | null)[],
  scaleFactor: number,
) {
  const positions: number[] = [];

  geometries.forEach((geometry) => {
    if (!geometry) {
      return;
    }
    const clone = geometry.clone();
    clone.scale(scaleFactor, scaleFactor, scaleFactor);
    const source = clone.index ? clone.toNonIndexed() : clone.clone();
    const positionAttribute = source.getAttribute("position");
    if (!positionAttribute) {
      return;
    }
    positions.push(...positionAttribute.array);
  });

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

function countConnectedComponents(geometry: THREE.BufferGeometry | null) {
  return splitGeometryIntoConnectedComponents(geometry).length;
}

function splitGeometryIntoConnectedComponents(geometry: THREE.BufferGeometry | null) {
  if (!geometry) {
    return [] as THREE.BufferGeometry[];
  }
  const indexed = geometry.index ? geometry.clone() : geometry.clone();
  if (!indexed.index) {
    indexed.setIndex(
      Array.from(
        { length: indexed.getAttribute("position")?.count ?? 0 },
        (_, index) => index,
      ),
    );
  }
  const index = indexed.getIndex();
  if (!index) {
    return [] as THREE.BufferGeometry[];
  }

  const position = indexed.getAttribute("position");
  if (!position) {
    return [] as THREE.BufferGeometry[];
  }

  const triangles: [number, number, number][] = [];
  const vertexToTriangles = new Map<number, number[]>();
  for (let i = 0; i < index.count; i += 3) {
    const triangleIndex = i / 3;
    const triangle: [number, number, number] = [
      index.getX(i),
      index.getX(i + 1),
      index.getX(i + 2),
    ];
    triangles.push(triangle);
    triangle.forEach((vertexIndex) => {
      const owners = vertexToTriangles.get(vertexIndex) ?? [];
      owners.push(triangleIndex);
      vertexToTriangles.set(vertexIndex, owners);
    });
  }

  const visited = new Set<number>();
  const components: THREE.BufferGeometry[] = [];

  for (let triangleIndex = 0; triangleIndex < triangles.length; triangleIndex += 1) {
    if (visited.has(triangleIndex)) {
      continue;
    }
    const componentTriangles: [number, number, number][] = [];
    const queue = [triangleIndex];
    visited.add(triangleIndex);
    while (queue.length > 0) {
      const current = queue.shift()!;
      componentTriangles.push(triangles[current]);
      triangles[current].forEach((vertexIndex) => {
        (vertexToTriangles.get(vertexIndex) ?? []).forEach((neighbor) => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      });
    }

    const positions: number[] = [];
    componentTriangles.forEach((triangle) => {
      triangle.forEach((vertexIndex) => {
        positions.push(
          position.getX(vertexIndex),
          position.getY(vertexIndex),
          position.getZ(vertexIndex),
        );
      });
    });
    const componentGeometry = new THREE.BufferGeometry();
    componentGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    componentGeometry.computeVertexNormals();
    componentGeometry.computeBoundingBox();
    componentGeometry.computeBoundingSphere();
    components.push(componentGeometry);
  }

  return components;
}

function fillTriangularOpenEdgeLoops(geometry: THREE.BufferGeometry | null) {
  if (!geometry) {
    return null;
  }

  const indexed = geometry.index ? geometry.clone() : geometry.clone();
  if (!indexed.index) {
    indexed.setIndex(
      Array.from(
        { length: indexed.getAttribute("position")?.count ?? 0 },
        (_, index) => index,
      ),
    );
  }

  const positionAttribute = indexed.getAttribute("position");
  const indexAttribute = indexed.getIndex();
  if (!positionAttribute || !indexAttribute) {
    return geometry;
  }

  const buildEdgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const edgeOwners = new Map<string, { from: number; to: number }[]>();
  for (let index = 0; index < indexAttribute.count; index += 3) {
    const triangle = [
      indexAttribute.getX(index),
      indexAttribute.getX(index + 1),
      indexAttribute.getX(index + 2),
    ] as const;
    const edges = [
      [triangle[0], triangle[1]],
      [triangle[1], triangle[2]],
      [triangle[2], triangle[0]],
    ] as const;
    edges.forEach(([from, to]) => {
      const key = buildEdgeKey(from, to);
      const owners = edgeOwners.get(key) ?? [];
      owners.push({ from, to });
      edgeOwners.set(key, owners);
    });
  }

  const adjacency = new Map<number, Set<number>>();
  const unusedEdges = new Set<string>();
  const edgeVertices = new Map<string, [number, number]>();
  [...edgeOwners.entries()]
    .filter(([, owners]) => owners.length === 1)
    .forEach(([key, owners]) => {
      const owner = owners[0];
      adjacency.set(owner.from, adjacency.get(owner.from) ?? new Set());
      adjacency.set(owner.to, adjacency.get(owner.to) ?? new Set());
      adjacency.get(owner.from)?.add(owner.to);
      adjacency.get(owner.to)?.add(owner.from);
      unusedEdges.add(key);
      edgeVertices.set(key, [owner.from, owner.to]);
    });

  const loops: number[][] = [];
  while (unusedEdges.size > 0) {
    const edgeKey = unusedEdges.values().next().value as string;
    const [start, next] = edgeVertices.get(edgeKey)!;
    unusedEdges.delete(edgeKey);
    const loop = [start];
    let previous = start;
    let current = next;
    while (current !== start) {
      loop.push(current);
      const neighbors = [...(adjacency.get(current) ?? [])];
      const candidate = neighbors.find((neighbor) => {
        if (neighbor === previous) {
          return false;
        }
        return unusedEdges.has(buildEdgeKey(current, neighbor));
      });
      if (candidate == null) {
        break;
      }
      unusedEdges.delete(buildEdgeKey(current, candidate));
      previous = current;
      current = candidate;
    }
    if (current === start && loop.length === 3) {
      loops.push(loop);
    }
  }

  if (loops.length === 0) {
    return geometry;
  }

  const positions = Array.from(positionAttribute.array as ArrayLike<number>);
  loops.forEach((loop) => {
    loop.forEach((vertexIndex) => {
      positions.push(
        positionAttribute.getX(vertexIndex),
        positionAttribute.getY(vertexIndex),
        positionAttribute.getZ(vertexIndex),
      );
    });
  });

  const patched = new THREE.BufferGeometry();
  patched.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  patched.computeVertexNormals();
  patched.computeBoundingBox();
  patched.computeBoundingSphere();
  return patched;
}

function fillOpenEdgeLoops(geometry: THREE.BufferGeometry | null) {
  if (!geometry) {
    return null;
  }

  const indexed = geometry.index ? geometry.clone() : geometry.clone();
  if (!indexed.index) {
    indexed.setIndex(
      Array.from(
        { length: indexed.getAttribute("position")?.count ?? 0 },
        (_, index) => index,
      ),
    );
  }

  const position = indexed.getAttribute("position");
  const index = indexed.getIndex();
  if (!position || !index) {
    return geometry;
  }

  const buildEdgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const edgeOwners = new Map<string, { from: number; to: number }[]>();
  for (let i = 0; i < index.count; i += 3) {
    const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)] as const;
    const edges = [
      [tri[0], tri[1]],
      [tri[1], tri[2]],
      [tri[2], tri[0]],
    ] as const;
    edges.forEach(([from, to]) => {
      const key = buildEdgeKey(from, to);
      const owners = edgeOwners.get(key) ?? [];
      owners.push({ from, to });
      edgeOwners.set(key, owners);
    });
  }

  const adjacency = new Map<number, Set<number>>();
  const unusedEdges = new Set<string>();
  const edgeVertices = new Map<string, [number, number]>();
  [...edgeOwners.entries()]
    .filter(([, owners]) => owners.length === 1)
    .forEach(([key, owners]) => {
      const owner = owners[0];
      adjacency.set(owner.from, adjacency.get(owner.from) ?? new Set());
      adjacency.set(owner.to, adjacency.get(owner.to) ?? new Set());
      adjacency.get(owner.from)?.add(owner.to);
      adjacency.get(owner.to)?.add(owner.from);
      unusedEdges.add(key);
      edgeVertices.set(key, [owner.from, owner.to]);
    });

  const loops: number[][] = [];
  while (unusedEdges.size > 0) {
    const edgeKey = unusedEdges.values().next().value as string;
    const [start, next] = edgeVertices.get(edgeKey)!;
    unusedEdges.delete(edgeKey);
    const loop = [start];
    let previous = start;
    let current = next;
    while (current !== start) {
      loop.push(current);
      const neighbors = [...(adjacency.get(current) ?? [])];
      const candidate = neighbors.find((neighbor) => {
        if (neighbor === previous) {
          return false;
        }
        return unusedEdges.has(buildEdgeKey(current, neighbor));
      });
      if (candidate == null) {
        break;
      }
      unusedEdges.delete(buildEdgeKey(current, candidate));
      previous = current;
      current = candidate;
    }
    if (current === start && loop.length >= 3) {
      loops.push(loop);
    }
  }

  if (loops.length === 0) {
    return geometry;
  }

  const positions = Array.from(position.array as ArrayLike<number>);
  for (const loop of loops) {
    const vectors = loop.map((vertexIndex) =>
      new THREE.Vector3().fromBufferAttribute(position, vertexIndex),
    );
    const origin = vectors[0];
    const edgeA = new THREE.Vector3().subVectors(vectors[1], origin);
    const edgeB = new THREE.Vector3().subVectors(vectors[2], origin);
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

    let contour = vectors.map((vertex) => {
      const relative = vertex.clone().sub(origin);
      return new THREE.Vector2(
        relative.dot(tangent),
        relative.dot(bitangent),
      );
    });
    let sourceVertices = [...vectors];
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
      const triNormal = new THREE.Vector3()
        .subVectors(triangle[1], triangle[0])
        .cross(new THREE.Vector3().subVectors(triangle[2], triangle[0]));
      if (triNormal.dot(normal) < 0) {
        [triangle[1], triangle[2]] = [triangle[2], triangle[1]];
      }
      triangle.forEach((vertex) => {
        positions.push(vertex.x, vertex.y, vertex.z);
      });
    });
  }

  const patched = new THREE.BufferGeometry();
  patched.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  patched.computeVertexNormals();
  patched.computeBoundingBox();
  patched.computeBoundingSphere();
  return patched;
}

describe("export split STL regression", () => {
  it("六角柱2本の 60° 貫入双晶は通常 STL と同じ fallback source を split 元にすると閉じた片になる", () => {
    const parameters = normalizeTwinParameters(hexagonalPrismPreset.parameters);
    appendDerivedCrystal(
      parameters,
      0,
      structuredClone(parameters.twin.crystals[0]?.faces ?? parameters.faces),
    );
    parameters.twin.crystals[1].enabled = true;
    parameters.twin.crystals[1].twinType = "penetration";
    parameters.twin.crystals[1].ruleType = "axis";
    parameters.twin.crystals[1].rotationAngleDeg = 60;
    parameters.twin.crystals[1].axis = normalizeFaceForSystem(
      createFace({ h: 1, k: 1, i: -2, l: 1, coefficient: 1 }),
      parameters.crystalSystem,
    );

    const buildResult = buildTwinMeshData(parameters);
    const crystalOneCenter = getGeometryCenter(
      buildResult.crystalPreviewGeometries[0],
    );
    expect(crystalOneCenter).not.toBeNull();

    const previewMaxDimension = Math.max(
      getGeometryMaxDimension(buildResult.previewFinalGeometry),
      1,
    );
    const finalMaxDimension = getGeometryMaxDimension(buildResult.finalGeometry);
    const scaleFactor = finalMaxDimension / previewMaxDimension;
    const mergedPreviewGeometry = mergePreviewGeometriesForStl(
      buildResult.crystalPreviewGeometries,
      scaleFactor,
    );
    expect(mergedPreviewGeometry).not.toBeNull();

    const preparedPreviewSource = prepareGeometryForStlExport(
      mergedPreviewGeometry!,
    );
    expect(
      preparedPreviewSource.debug.topologyAfterOrientation.openEdgeCount,
    ).toBe(0);

    const plane = normalizeFaceForSystem(
      createFace({ h: 1, k: 9, i: -10, l: 0, coefficient: 1 }),
      parameters.crystalSystem,
    );
    const planeNormal = twinPlaneNormal(plane, parameters);
    const halfSpaceSize =
      Math.max(
        getGeometryMaxDimension(preparedPreviewSource.geometry),
        getGeometryMaxDimension(buildResult.crystalPreviewGeometries[0]),
        1,
      ) * 6;

    const split = splitBufferGeometryByPlaneWithJscad(
      preparedPreviewSource.geometry,
      crystalOneCenter!,
      planeNormal,
      halfSpaceSize,
    );

    expect(split.positive).not.toBeNull();
    expect(split.negative).not.toBeNull();

    const positivePrepared = prepareGeometryForStlExport(split.positive!);
    const negativePrepared = prepareGeometryForStlExport(split.negative!);
    const normalizedPositiveSplit = split.positive
      ? prepareGeometryForStlExport(split.positive).geometry
      : null;
    const normalizedNegativeSplit = split.negative
      ? prepareGeometryForStlExport(split.negative).geometry
      : null;
    const positiveComponents = splitGeometryIntoConnectedComponents(
      normalizedPositiveSplit,
    );
    const negativeComponents = splitGeometryIntoConnectedComponents(
      normalizedNegativeSplit,
    );
    const normalizedPositiveComponents = positiveComponents.map(
      (component) => prepareGeometryForStlExport(component).geometry,
    );
    const normalizedNegativeComponents = negativeComponents.map(
      (component) => prepareGeometryForStlExport(component).geometry,
    );
    const positiveUnion = unionBufferGeometriesWithJscad(
      normalizedPositiveComponents,
    );
    const negativeUnion = unionBufferGeometriesWithJscad(
      normalizedNegativeComponents,
    );
    const positiveUnionPrepared = positiveUnion
      ? prepareGeometryForStlExport(
          fillTriangularOpenEdgeLoops(
            prepareGeometryForStlExport(positiveUnion).geometry,
          )!,
        )
      : null;
    const negativeUnionPrepared = negativeUnion
      ? prepareGeometryForStlExport(
          fillTriangularOpenEdgeLoops(
            prepareGeometryForStlExport(negativeUnion).geometry,
          )!,
        )
      : null;

    expect(
      positivePrepared.debug.topologyAfterOrientation.openEdgeCount,
    ).toBe(0);
    expect(
      negativePrepared.debug.topologyAfterOrientation.openEdgeCount,
    ).toBe(0);
    expect(countConnectedComponents(split.positive)).toBeGreaterThanOrEqual(1);
    expect(countConnectedComponents(split.negative)).toBeGreaterThanOrEqual(1);
    expect(
      positiveUnionPrepared?.debug.topologyAfterOrientation.openEdgeCount ?? 0,
    ).toBe(0);
    expect(
      negativeUnionPrepared?.debug.topologyAfterOrientation.openEdgeCount ?? 0,
    ).toBe(0);
  });

  it("六角柱2本の 60° 貫入双晶は finalGeometry split 後に open loop を埋めると閉じた 2 片へ寄せられる", () => {
    const parameters = normalizeTwinParameters(hexagonalPrismPreset.parameters);
    appendDerivedCrystal(
      parameters,
      0,
      structuredClone(parameters.twin.crystals[0]?.faces ?? parameters.faces),
    );
    parameters.twin.crystals[1].enabled = true;
    parameters.twin.crystals[1].twinType = "penetration";
    parameters.twin.crystals[1].ruleType = "axis";
    parameters.twin.crystals[1].rotationAngleDeg = 60;
    parameters.twin.crystals[1].axis = normalizeFaceForSystem(
      createFace({ h: 1, k: 1, i: -2, l: 1, coefficient: 1 }),
      parameters.crystalSystem,
    );

    const buildResult = buildTwinMeshData(parameters);
    const crystalOneCenter = getGeometryCenter(
      buildResult.crystalPreviewGeometries[0],
    );
    expect(crystalOneCenter).not.toBeNull();
    expect(buildResult.finalGeometry).not.toBeNull();

    const plane = normalizeFaceForSystem(
      createFace({ h: 1, k: 9, i: -10, l: 0, coefficient: 1 }),
      parameters.crystalSystem,
    );
    const planeNormal = twinPlaneNormal(plane, parameters);
    const halfSpaceSize =
      Math.max(
        getGeometryMaxDimension(buildResult.finalGeometry),
        getGeometryMaxDimension(buildResult.crystalPreviewGeometries[0]),
        1,
      ) * 6;

    const split = splitBufferGeometryByPlaneWithJscad(
      buildResult.finalGeometry,
      crystalOneCenter!,
      planeNormal,
      halfSpaceSize,
    );
    const patchedPositive = fillOpenEdgeLoops(
      prepareGeometryForStlExport(split.positive!).geometry,
    );
    const patchedNegative = fillOpenEdgeLoops(
      prepareGeometryForStlExport(split.negative!).geometry,
    );
    const positivePrepared = prepareGeometryForStlExport(patchedPositive!);
    const negativePrepared = prepareGeometryForStlExport(patchedNegative!);

    expect(
      positivePrepared.debug.topologyAfterOrientation.openEdgeCount,
    ).toBe(0);
    expect(
      negativePrepared.debug.topologyAfterOrientation.openEdgeCount,
    ).toBe(0);
  });
});
