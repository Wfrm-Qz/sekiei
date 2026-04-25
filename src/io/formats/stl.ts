import * as THREE from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * STL 形式への書き出しを担当する。
 *
 * Sekiei ではまず ASCII STL のみを扱い、他形式を増やすときも
 * 同じ `exportGeometry` 形へ合わせる前提で切り出している。
 */

/** UI 表示と保存拡張子に使う STL 形式定義。 */
export const STL_FORMAT = {
  id: "stl",
  label: "STL",
  extension: "stl",
  mimeType: "model/stl",
};

/** undirected edge を安定したキー文字列へ変換する。 */
function buildEdgeKey(vertexIndexA, vertexIndexB) {
  return vertexIndexA < vertexIndexB
    ? `${vertexIndexA}:${vertexIndexB}`
    : `${vertexIndexB}:${vertexIndexA}`;
}

/** geometry を indexed triangle list として扱いやすい形へ正規化する。 */
function buildIndexedTriangleGeometry(geometry) {
  if (geometry.index) {
    return geometry.clone();
  }
  const indexed = geometry.clone();
  const positionCount = indexed.getAttribute("position")?.count ?? 0;
  const indexArray = Array.from({ length: positionCount }, (_, index) => index);
  indexed.setIndex(indexArray);
  return indexed;
}

/** indexed geometry から triangle ごとの頂点 index 配列を取り出す。 */
function buildTriangleIndexList(geometry) {
  const indexed = buildIndexedTriangleGeometry(geometry);
  const indexAttribute = indexed.getIndex();
  if (!indexAttribute) {
    return [];
  }

  const triangles = [];
  for (let index = 0; index < indexAttribute.count; index += 3) {
    triangles.push([
      indexAttribute.getX(index),
      indexAttribute.getX(index + 1),
      indexAttribute.getX(index + 2),
    ]);
  }
  return triangles;
}

/** triangle の 3 辺を directed edge として列挙する。 */
function buildDirectedTriangleEdges(triangle) {
  return [
    [triangle[0], triangle[1]],
    [triangle[1], triangle[2]],
    [triangle[2], triangle[0]],
  ];
}

/** triangle の directed edge を現在の flip 状態込みで返す。 */
function buildEffectiveDirectedEdge(incident, isFlipped) {
  return isFlipped
    ? [incident.toVertexIndex, incident.fromVertexIndex]
    : [incident.fromVertexIndex, incident.toVertexIndex];
}

/** STL 保存前 geometry の open edge / non-manifold edge を数える。 */
function analyzeIndexedGeometryTopology(geometry) {
  const triangles = buildTriangleIndexList(geometry);
  const edgeOwners = new Map();

  triangles.forEach((triangle, triangleIndex) => {
    buildDirectedTriangleEdges(triangle).forEach(
      ([fromVertexIndex, toVertexIndex]) => {
        const edgeKey = buildEdgeKey(fromVertexIndex, toVertexIndex);
        const owners = edgeOwners.get(edgeKey) ?? [];
        owners.push({
          triangleIndex,
          fromVertexIndex,
          toVertexIndex,
        });
        edgeOwners.set(edgeKey, owners);
      },
    );
  });

  const openEdges = [];
  const multiOwnerEdges = [];
  edgeOwners.forEach((owners, edgeKey) => {
    if (owners.length === 1) {
      openEdges.push({ edgeKey, owners });
      return;
    }
    if (owners.length > 2) {
      multiOwnerEdges.push({ edgeKey, owners });
    }
  });

  return {
    openEdgeCount: openEdges.length,
    multiOwnerEdgeCount: multiOwnerEdges.length,
    openEdgeSamples: openEdges.slice(0, 12).map((entry) => ({
      edgeKey: entry.edgeKey,
      owners: entry.owners.map((owner) => owner.triangleIndex),
    })),
    multiOwnerEdgeSamples: multiOwnerEdges.slice(0, 12).map((entry) => ({
      edgeKey: entry.edgeKey,
      owners: entry.owners.map((owner) => owner.triangleIndex),
    })),
  };
}

/** topology の悪さを比較しやすい数値へまとめる。 */
function scoreGeometryTopology(topology) {
  return topology.openEdgeCount * 1000 + topology.multiOwnerEdgeCount;
}

/** component ごとの重心を使って signed volume を安定に計算する。 */
function computeComponentSignedVolume(geometry, triangleIndices) {
  const positionAttribute = geometry.getAttribute("position");
  if (!positionAttribute || triangleIndices.length === 0) {
    return 0;
  }

  const centroid = new THREE.Vector3();
  const vertexA = new THREE.Vector3();
  const vertexB = new THREE.Vector3();
  const vertexC = new THREE.Vector3();
  triangleIndices.forEach((triangle) => {
    vertexA.fromBufferAttribute(positionAttribute, triangle[0]);
    vertexB.fromBufferAttribute(positionAttribute, triangle[1]);
    vertexC.fromBufferAttribute(positionAttribute, triangle[2]);
    centroid.add(vertexA).add(vertexB).add(vertexC);
  });
  centroid.divideScalar(triangleIndices.length * 3);

  let signedVolume = 0;
  triangleIndices.forEach((triangle) => {
    vertexA.fromBufferAttribute(positionAttribute, triangle[0]).sub(centroid);
    vertexB.fromBufferAttribute(positionAttribute, triangle[1]).sub(centroid);
    vertexC.fromBufferAttribute(positionAttribute, triangle[2]).sub(centroid);
    signedVolume += vertexA.dot(vertexB.clone().cross(vertexC)) / 6;
  });
  return signedVolume;
}

/**
 * indexed geometry の triangle winding を隣接面で整合する向きにそろえる。
 *
 * STL viewer / slicer で facet が裏向きになると「穴が空いた」ように見えるため、
 * export 前だけ接続成分ごとに向きを一貫化し、最後に signed volume で外向きを選ぶ。
 */
function orientIndexedGeometryForStl(geometry) {
  const indexed = buildIndexedTriangleGeometry(geometry);
  const triangles = buildTriangleIndexList(indexed);
  const edgeOwners = new Map();

  triangles.forEach((triangle, triangleIndex) => {
    buildDirectedTriangleEdges(triangle).forEach(
      ([fromVertexIndex, toVertexIndex]) => {
        const edgeKey = buildEdgeKey(fromVertexIndex, toVertexIndex);
        const owners = edgeOwners.get(edgeKey) ?? [];
        owners.push({
          triangleIndex,
          fromVertexIndex,
          toVertexIndex,
        });
        edgeOwners.set(edgeKey, owners);
      },
    );
  });

  const flippedTriangles = new Array(triangles.length).fill(false);
  const visitedTriangles = new Array(triangles.length).fill(false);
  const componentTriangleIndices = [];
  let localFlipCount = 0;
  let componentFlipCount = 0;

  for (
    let triangleIndex = 0;
    triangleIndex < triangles.length;
    triangleIndex += 1
  ) {
    if (visitedTriangles[triangleIndex]) {
      continue;
    }

    const queue = [triangleIndex];
    const component = [];
    visitedTriangles[triangleIndex] = true;

    while (queue.length > 0) {
      const currentTriangleIndex = queue.shift();
      if (currentTriangleIndex == null) {
        continue;
      }
      component.push(currentTriangleIndex);

      buildDirectedTriangleEdges(triangles[currentTriangleIndex]).forEach(
        ([fromVertexIndex, toVertexIndex]) => {
          const edgeKey = buildEdgeKey(fromVertexIndex, toVertexIndex);
          const owners = edgeOwners.get(edgeKey) ?? [];
          const currentIncident = owners.find(
            (owner) => owner.triangleIndex === currentTriangleIndex,
          );
          if (!currentIncident || owners.length < 2) {
            return;
          }

          const [effectiveFrom, effectiveTo] = buildEffectiveDirectedEdge(
            currentIncident,
            flippedTriangles[currentTriangleIndex],
          );

          owners.forEach((neighborIncident) => {
            if (
              neighborIncident.triangleIndex === currentTriangleIndex ||
              visitedTriangles[neighborIncident.triangleIndex]
            ) {
              return;
            }

            const matchesCurrentDirection =
              neighborIncident.fromVertexIndex === effectiveFrom &&
              neighborIncident.toVertexIndex === effectiveTo;
            const matchesOppositeDirection =
              neighborIncident.fromVertexIndex === effectiveTo &&
              neighborIncident.toVertexIndex === effectiveFrom;
            if (!matchesCurrentDirection && !matchesOppositeDirection) {
              return;
            }

            const shouldFlipNeighbor = matchesCurrentDirection;
            flippedTriangles[neighborIncident.triangleIndex] =
              shouldFlipNeighbor;
            if (shouldFlipNeighbor) {
              localFlipCount += 1;
            }
            visitedTriangles[neighborIncident.triangleIndex] = true;
            queue.push(neighborIncident.triangleIndex);
          });
        },
      );
    }

    componentTriangleIndices.push(component);
  }

  const orientedTriangles = triangles.map((triangle, triangleIndex) =>
    flippedTriangles[triangleIndex]
      ? [triangle[0], triangle[2], triangle[1]]
      : [...triangle],
  );

  componentTriangleIndices.forEach((component) => {
    const componentTriangles = component.map(
      (triangleIndex) => orientedTriangles[triangleIndex],
    );
    const signedVolume = computeComponentSignedVolume(
      indexed,
      componentTriangles,
    );
    if (signedVolume < 0) {
      componentFlipCount += 1;
      component.forEach((triangleIndex) => {
        const triangle = orientedTriangles[triangleIndex];
        orientedTriangles[triangleIndex] = [
          triangle[0],
          triangle[2],
          triangle[1],
        ];
      });
    }
  });

  const orientedIndexArray = orientedTriangles.flat();
  const orientedGeometry = indexed.clone();
  orientedGeometry.setIndex(orientedIndexArray);
  orientedGeometry.computeVertexNormals();

  return {
    geometry: orientedGeometry,
    debug: {
      connectedComponentCount: componentTriangleIndices.length,
      locallyFlippedTriangleCount: localFlipCount,
      globallyFlippedComponentCount: componentFlipCount,
    },
  };
}

/**
 * STL 用 weld tolerance を複数試し、もっとも閉じた topology を返す。
 *
 * twin の CSG 後 geometry はケースごとに seam の大きさが揺れるため、
 * 固定 tolerance では閉じ切れないことがある。ここでは STL 出力専用に
 * 小さい候補から順に試し、もっとも open edge が少ないものを選ぶ。
 */
function chooseBestWeldedGeometry(geometry) {
  geometry.computeBoundingBox();
  const boundingSize =
    geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3();
  const baseScale = Math.max(boundingSize.x, boundingSize.y, boundingSize.z, 1);
  const toleranceMultipliers = [1e-6, 5e-6, 1e-5, 5e-5, 1e-4, 5e-4];

  let bestCandidate = null;
  const weldCandidates = [];

  toleranceMultipliers.forEach((multiplier) => {
    const weldTolerance = baseScale * multiplier;
    const weldedGeometry = mergeVertices(geometry, weldTolerance);
    const { geometry: cleanedAfterWeld, droppedTriangleCount } =
      removeDegenerateTriangles(
        weldedGeometry.index ? weldedGeometry.toNonIndexed() : weldedGeometry,
      );
    const reweldedGeometry = mergeVertices(cleanedAfterWeld, weldTolerance);
    const topology = analyzeIndexedGeometryTopology(reweldedGeometry);
    const indexedVertexCount =
      reweldedGeometry.getAttribute("position")?.count ?? 0;
    const score = scoreGeometryTopology(topology);
    weldCandidates.push({
      weldTolerance,
      openEdgeCount: topology.openEdgeCount,
      multiOwnerEdgeCount: topology.multiOwnerEdgeCount,
      indexedVertexCount,
      droppedTriangleCount,
      score,
    });

    if (
      !bestCandidate ||
      score < bestCandidate.score ||
      (score === bestCandidate.score &&
        indexedVertexCount > bestCandidate.indexedVertexCount)
    ) {
      bestCandidate = {
        geometry: reweldedGeometry,
        weldTolerance,
        topology,
        indexedVertexCount,
        droppedTriangleCount,
        score,
      };
    }
  });

  return {
    geometry: bestCandidate.geometry,
    debug: {
      weldTolerance: bestCandidate.weldTolerance,
      indexedVertexCount: bestCandidate.indexedVertexCount,
      droppedTriangleCount: bestCandidate.droppedTriangleCount,
      topologyBeforeOrientation: bestCandidate.topology,
      weldCandidates,
    },
  };
}

/**
 * STL に書き出す前に、退化三角形を除去した geometry を作る。
 *
 * CSG 後 geometry はごく小さい三角形や同一点重複を含むことがあり、
 * slicer 側で facet が落ちると「面が一部消えて穴が空く」ように見える。
 * preview の見た目は変えず、STL 出力時だけ安全側へ正規化する。
 */
function removeDegenerateTriangles(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const positionAttribute = source.getAttribute("position");
  if (!positionAttribute || positionAttribute.count === 0) {
    return {
      geometry: source,
      droppedTriangleCount: 0,
    };
  }

  const keptPositions = [];
  let droppedTriangleCount = 0;
  const vectorA = new THREE.Vector3();
  const vectorB = new THREE.Vector3();
  const vectorC = new THREE.Vector3();
  const edgeAB = new THREE.Vector3();
  const edgeAC = new THREE.Vector3();
  const cross = new THREE.Vector3();

  for (let index = 0; index < positionAttribute.count; index += 3) {
    vectorA.fromBufferAttribute(positionAttribute, index);
    vectorB.fromBufferAttribute(positionAttribute, index + 1);
    vectorC.fromBufferAttribute(positionAttribute, index + 2);

    const isFiniteTriangle =
      Number.isFinite(vectorA.x) &&
      Number.isFinite(vectorA.y) &&
      Number.isFinite(vectorA.z) &&
      Number.isFinite(vectorB.x) &&
      Number.isFinite(vectorB.y) &&
      Number.isFinite(vectorB.z) &&
      Number.isFinite(vectorC.x) &&
      Number.isFinite(vectorC.y) &&
      Number.isFinite(vectorC.z);

    if (!isFiniteTriangle) {
      droppedTriangleCount += 1;
      continue;
    }

    edgeAB.subVectors(vectorB, vectorA);
    edgeAC.subVectors(vectorC, vectorA);
    cross.crossVectors(edgeAB, edgeAC);
    const areaTwice = cross.length();

    if (areaTwice <= 1e-10) {
      droppedTriangleCount += 1;
      continue;
    }

    keptPositions.push(
      vectorA.x,
      vectorA.y,
      vectorA.z,
      vectorB.x,
      vectorB.y,
      vectorB.z,
      vectorC.x,
      vectorC.y,
      vectorC.z,
    );
  }

  const sanitized = new THREE.BufferGeometry();
  sanitized.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(keptPositions, 3),
  );
  return {
    geometry: sanitized,
    droppedTriangleCount,
  };
}

/**
 * STL 保存用に geometry を安定化し、簡単な診断値も返す。
 *
 * 頂点 weld は微小な seam を閉じるために行い、最後は STLExporter が扱いやすい
 * non-indexed geometry へ戻す。
 */
export function prepareGeometryForStlExport(geometry) {
  const { geometry: withoutDegenerateTriangles, droppedTriangleCount } =
    removeDegenerateTriangles(geometry);
  const welded = chooseBestWeldedGeometry(withoutDegenerateTriangles);
  const oriented = orientIndexedGeometryForStl(welded.geometry);
  const topologyAfterOrientation = analyzeIndexedGeometryTopology(
    oriented.geometry,
  );
  const stlGeometry = oriented.geometry.index
    ? oriented.geometry.toNonIndexed()
    : oriented.geometry.clone();
  stlGeometry.computeVertexNormals();
  stlGeometry.computeBoundingBox();
  stlGeometry.computeBoundingSphere();

  return {
    geometry: stlGeometry,
    debug: {
      schema: "stl-export-debug-v1",
      sourceTriangleCount: Math.trunc(
        (geometry.getAttribute("position")?.count ?? 0) / 3,
      ),
      droppedTriangleCount,
      exportedTriangleCount: Math.trunc(
        (stlGeometry.getAttribute("position")?.count ?? 0) / 3,
      ),
      indexedVertexCount: welded.debug.indexedVertexCount,
      weldTolerance: welded.debug.weldTolerance,
      droppedTriangleCountAfterWeld: welded.debug.droppedTriangleCount,
      topologyBeforeOrientation: welded.debug.topologyBeforeOrientation,
      weldCandidates: welded.debug.weldCandidates,
      topologyAfterOrientation,
      orientationRepair: oriented.debug,
    },
  };
}

/** Three.js geometry を ASCII STL 文字列へ変換する。 */
export function exportGeometryAsStl(geometry) {
  return buildStlExportArtifact(geometry).content;
}

/** STL 文字列と診断情報をまとめて返す。 */
export function buildStlExportArtifact(geometry) {
  const exporter = new STLExporter();
  const prepared = prepareGeometryForStlExport(geometry);
  const mesh = new THREE.Mesh(
    prepared.geometry,
    new THREE.MeshStandardMaterial(),
  );
  return {
    content: exporter.parse(mesh, { binary: false }),
    debug: prepared.debug,
  };
}
