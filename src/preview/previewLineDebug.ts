import * as THREE from "three";

interface PreviewLineSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
}

function buildLineSegmentsFromPositions(positions: number[]) {
  const segments: PreviewLineSegment[] = [];
  for (let index = 0; index + 5 < positions.length; index += 6) {
    segments.push({
      start: new THREE.Vector3(
        positions[index],
        positions[index + 1],
        positions[index + 2],
      ),
      end: new THREE.Vector3(
        positions[index + 3],
        positions[index + 4],
        positions[index + 5],
      ),
    });
  }
  return segments;
}

function getSegmentIntersectionParameters(
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
  return { tA, tB, point: pointA };
}

function getPointToSegmentDistance(
  point: THREE.Vector3,
  start: THREE.Vector3,
  end: THREE.Vector3,
) {
  const direction = end.clone().sub(start);
  const lengthSq = direction.lengthSq();
  if (lengthSq <= 1e-12) {
    return point.distanceTo(start);
  }
  const t = THREE.MathUtils.clamp(
    point.clone().sub(start).dot(direction) / lengthSq,
    0,
    1,
  );
  return point.distanceTo(start.clone().addScaledVector(direction, t));
}

function buildEndpointClusterKey(point: THREE.Vector3) {
  return `${point.x.toFixed(5)}|${point.y.toFixed(5)}|${point.z.toFixed(5)}`;
}

function buildSegmentDebugStats(
  ridgeSegments: PreviewLineSegment[],
  intersectionSegments: PreviewLineSegment[],
) {
  const crossingSamples: {
    ridgeIndex: number;
    intersectionIndex: number;
    tRidge: number;
    tIntersection: number;
    point: { x: number; y: number; z: number };
  }[] = [];
  let ridgeSegmentsStillCrossingCount = 0;

  ridgeSegments.forEach((ridgeSegment, ridgeIndex) => {
    let crosses = false;
    intersectionSegments.forEach((intersectionSegment, intersectionIndex) => {
      const hit = getSegmentIntersectionParameters(
        ridgeSegment.start,
        ridgeSegment.end,
        intersectionSegment.start,
        intersectionSegment.end,
      );
      if (!hit) {
        return;
      }
      crosses = true;
      if (crossingSamples.length < 8) {
        crossingSamples.push({
          ridgeIndex,
          intersectionIndex,
          tRidge: Number(hit.tA.toFixed(6)),
          tIntersection: Number(hit.tB.toFixed(6)),
          point: {
            x: Number(hit.point.x.toFixed(6)),
            y: Number(hit.point.y.toFixed(6)),
            z: Number(hit.point.z.toFixed(6)),
          },
        });
      }
    });
    if (crosses) {
      ridgeSegmentsStillCrossingCount += 1;
    }
  });

  const ridgeEndpointSamples: {
    ridgeIndex: number;
    endpointKind: "start" | "end";
    minDistance: number;
    nearestIntersectionIndex: number | null;
  }[] = [];
  let ridgeEndpointsNearIntersectionCount = 0;
  const endpointClusters = new Map<
    string,
    {
      point: THREE.Vector3;
      nearestIntersectionIndex: number | null;
      segmentRefs: {
        ridgeIndex: number;
        endpointKind: "start" | "end";
        length: number;
        direction: THREE.Vector3;
      }[];
    }
  >();

  ridgeSegments.forEach((ridgeSegment, ridgeIndex) => {
    const segmentDirection = ridgeSegment.end.clone().sub(ridgeSegment.start);
    const segmentLength = segmentDirection.length();
    (
      [
        ["start", ridgeSegment.start],
        ["end", ridgeSegment.end],
      ] as const
    ).forEach(([endpointKind, endpoint]) => {
      let minDistance = Number.POSITIVE_INFINITY;
      let nearestIntersectionIndex: number | null = null;
      intersectionSegments.forEach((intersectionSegment, intersectionIndex) => {
        const distance = getPointToSegmentDistance(
          endpoint,
          intersectionSegment.start,
          intersectionSegment.end,
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestIntersectionIndex = intersectionIndex;
        }
      });
      if (minDistance <= 1e-3) {
        ridgeEndpointsNearIntersectionCount += 1;
        const clusterKey = buildEndpointClusterKey(endpoint);
        const existing = endpointClusters.get(clusterKey) ?? {
          point: endpoint.clone(),
          nearestIntersectionIndex,
          segmentRefs: [],
        };
        existing.segmentRefs.push({
          ridgeIndex,
          endpointKind,
          length: Number(segmentLength.toFixed(6)),
          direction:
            endpointKind === "start"
              ? ridgeSegment.end.clone().sub(ridgeSegment.start).normalize()
              : ridgeSegment.start.clone().sub(ridgeSegment.end).normalize(),
        });
        endpointClusters.set(clusterKey, existing);
      }
      if (ridgeEndpointSamples.length < 8) {
        ridgeEndpointSamples.push({
          ridgeIndex,
          endpointKind,
          minDistance: Number(minDistance.toFixed(6)),
          nearestIntersectionIndex,
        });
      }
    });
  });

  return {
    ridgeSegmentCount: ridgeSegments.length,
    intersectionSegmentCount: intersectionSegments.length,
    ridgeSegmentsStillCrossingCount,
    ridgeEndpointsNearIntersectionCount,
    crossingSamples,
    ridgeEndpointSamples,
    endpointClusters: [...endpointClusters.values()]
      .filter((cluster) => cluster.segmentRefs.length > 0)
      .sort((left, right) => right.segmentRefs.length - left.segmentRefs.length)
      .slice(0, 8)
      .map((cluster) => ({
        point: {
          x: Number(cluster.point.x.toFixed(6)),
          y: Number(cluster.point.y.toFixed(6)),
          z: Number(cluster.point.z.toFixed(6)),
        },
        nearestIntersectionIndex: cluster.nearestIntersectionIndex,
        segmentCount: cluster.segmentRefs.length,
        segments: cluster.segmentRefs.slice(0, 6).map((segment) => ({
          ridgeIndex: segment.ridgeIndex,
          endpointKind: segment.endpointKind,
          length: segment.length,
          direction: {
            x: Number(segment.direction.x.toFixed(6)),
            y: Number(segment.direction.y.toFixed(6)),
            z: Number(segment.direction.z.toFixed(6)),
          },
        })),
      })),
  };
}

/** xray 稜線と交線の交差状況を debug snapshot 向けに要約する。 */
export function buildXrayLineDebugSummary(
  ridgeLineData: {
    surfacePositions: number[];
    occludedInteriorPositions: number[];
  },
  intersectionPositions: number[],
  faceDisplayMode: string,
) {
  const surfaceSegments = buildLineSegmentsFromPositions(
    ridgeLineData.surfacePositions,
  );
  const occludedInteriorSegments = buildLineSegmentsFromPositions(
    ridgeLineData.occludedInteriorPositions,
  );
  const allSegments = [...surfaceSegments, ...occludedInteriorSegments];
  const intersectionSegments = buildLineSegmentsFromPositions(
    intersectionPositions,
  );
  const combined = buildSegmentDebugStats(allSegments, intersectionSegments);
  const surface = buildSegmentDebugStats(surfaceSegments, intersectionSegments);
  const occludedInterior = buildSegmentDebugStats(
    occludedInteriorSegments,
    intersectionSegments,
  );

  return {
    schema: "twin-preview-line-debug-v1",
    faceDisplayMode,
    ridgeSegmentCount: combined.ridgeSegmentCount,
    occludedInteriorSegmentCount: occludedInterior.ridgeSegmentCount,
    intersectionSegmentCount: combined.intersectionSegmentCount,
    ridgeSegmentsStillCrossingCount: combined.ridgeSegmentsStillCrossingCount,
    ridgeEndpointsNearIntersectionCount:
      combined.ridgeEndpointsNearIntersectionCount,
    crossingSamples: combined.crossingSamples,
    ridgeEndpointSamples: combined.ridgeEndpointSamples,
    surface,
    occludedInterior,
  };
}
