import * as THREE from "three";
import { buildThreeGeometry } from "../io/exporters.js";

interface PreviewExportSurfaceFaceLike {
  id?: string | null;
}

interface PreviewExportSurfaceMeshFaceLike {
  id?: string | null;
  normal?: { x: number; y: number; z: number } | null;
  vertices?: { x: number; y: number; z: number }[];
}

interface PreviewExportSurfaceMeshDataLike {
  faces?: PreviewExportSurfaceMeshFaceLike[] | null;
  faceVertexCounts?: { id?: string | null; vertexCount: number }[];
  [key: string]: unknown;
}

interface PreviewExportSurfaceEntryLike {
  index: number;
  meshData: PreviewExportSurfaceMeshDataLike | null;
}

export function mergeExportSurfaceGeometries(
  geometries: (THREE.BufferGeometry | null)[],
) {
  const positions: number[] = [];
  const colors: number[] = [];
  let hasColors = false;

  for (const geometry of geometries.filter(Boolean) as THREE.BufferGeometry[]) {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    const positionAttribute = source.getAttribute("position");
    const colorAttribute = source.getAttribute("color");

    if (!positionAttribute) {
      if (source !== geometry) {
        source.dispose();
      }
      continue;
    }

    for (let index = 0; index < positionAttribute.count; index += 1) {
      positions.push(
        positionAttribute.getX(index),
        positionAttribute.getY(index),
        positionAttribute.getZ(index),
      );

      if (colorAttribute) {
        hasColors = true;
        colors.push(
          colorAttribute.getX(index),
          colorAttribute.getY(index),
          colorAttribute.getZ(index),
        );
      }
    }

    if (source !== geometry) {
      source.dispose();
    }
  }

  if (positions.length === 0) {
    return null;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  if (hasColors && colors.length === positions.length) {
    merged.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  }
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

export function buildXrayExportSurfaceGeometry(options: {
  visibleCrystalEntries: PreviewExportSurfaceEntryLike[];
  useGroupedColors: boolean;
  getTwinCrystalFaces: (index: number) => PreviewExportSurfaceFaceLike[];
  buildDisplayGeometry: (
    meshData: PreviewExportSurfaceMeshDataLike | null,
    sourceFaces: PreviewExportSurfaceFaceLike[],
  ) => THREE.BufferGeometry | null;
  buildFlatFaceColors: (
    meshData: PreviewExportSurfaceMeshDataLike,
    colorHex: string,
  ) => number[];
  getCrystalAccentColor: (index: number) => string;
}) {
  const temporaryGeometries: THREE.BufferGeometry[] = [];

  options.visibleCrystalEntries.forEach(({ index, meshData }) => {
    if (!meshData) {
      return;
    }
    const sourceFaces = options.getTwinCrystalFaces(index);
    const geometry = options.useGroupedColors
      ? options.buildDisplayGeometry(meshData, sourceFaces)
      : buildThreeGeometry({
          ...meshData,
          colors: options.buildFlatFaceColors(
            meshData,
            `#${new THREE.Color(options.getCrystalAccentColor(index)).getHexString()}`,
          ),
        });
    if (geometry) {
      temporaryGeometries.push(geometry);
    }
  });

  const geometry = mergeExportSurfaceGeometries(temporaryGeometries);
  if (geometry) {
    temporaryGeometries.push(geometry);
  }

  return {
    geometry,
    useVertexColors: options.useGroupedColors,
    temporaryGeometries,
  };
}

export function collectTransparentXrayExportTriangles(options: {
  width: number;
  height: number;
  rootMatrix?: THREE.Matrix4 | null;
  previewRoot: THREE.Group | null;
  visibleCrystalEntries: PreviewExportSurfaceEntryLike[];
  fillOpacity: number;
  usesFaceGroupPalette: boolean;
  getTwinCrystalFaces: (index: number) => PreviewExportSurfaceFaceLike[];
  getCrystalAccentColor: (index: number) => string;
  resolveXrayPreviewFaceColor: (
    faceId: string | null | undefined,
    sourceFaces: PreviewExportSurfaceFaceLike[],
    crystalIndex: number,
  ) => string;
  projectWorldPointToExport: (
    worldPoint: THREE.Vector3,
    width: number,
    height: number,
  ) => { x: number; y: number; projectedZ: number; cameraZ: number };
}) {
  const triangleEntries = [];
  const rawTrianglePolygons = [];
  const opaqueTriangles = [];
  const transformMatrix =
    options.rootMatrix ??
    options.previewRoot?.matrixWorld ??
    new THREE.Matrix4();

  options.visibleCrystalEntries.forEach(({ index, meshData }) => {
    if (!meshData) {
      return;
    }

    const sourceFaces = options.getTwinCrystalFaces(index);
    const accentFill = `#${new THREE.Color(options.getCrystalAccentColor(index)).getHexString()}`;
    (meshData.faces ?? []).forEach((face, faceIndex) => {
      const vertices = face.vertices ?? [];
      if (vertices.length < 3 || !face?.normal) {
        return;
      }

      const planeNormal = new THREE.Vector3(
        face.normal.x,
        face.normal.y,
        face.normal.z,
      )
        .transformDirection(transformMatrix)
        .normalize();
      const planePoint = new THREE.Vector3(
        vertices[0].x,
        vertices[0].y,
        vertices[0].z,
      ).applyMatrix4(transformMatrix);
      const fallbackFace =
        sourceFaces.find((candidate) => candidate.id === face.id) ??
        sourceFaces[faceIndex] ??
        null;
      const fill = options.usesFaceGroupPalette
        ? options.resolveXrayPreviewFaceColor(
            face.id ?? fallbackFace?.id ?? null,
            sourceFaces,
            index,
          )
        : accentFill;

      for (
        let vertexIndex = 1;
        vertexIndex < vertices.length - 1;
        vertexIndex += 1
      ) {
        const triangleVertices = [
          vertices[0],
          vertices[vertexIndex],
          vertices[vertexIndex + 1],
        ];
        const worldPoints = triangleVertices.map((vertex) =>
          new THREE.Vector3(vertex.x, vertex.y, vertex.z).applyMatrix4(
            transformMatrix,
          ),
        );
        const projectedPoints = worldPoints.map((point) =>
          options.projectWorldPointToExport(
            point,
            options.width,
            options.height,
          ),
        );
        const sortDepth =
          projectedPoints.reduce((sum, point) => sum + point.cameraZ, 0) /
          projectedPoints.length;
        triangleEntries.push({
          worldPoints,
          projectedPoints,
          normal: planeNormal.clone(),
          fill,
          fillOpacity: options.fillOpacity,
          sourceCrystalIndex: index,
          faceId: face.id ?? fallbackFace?.id ?? null,
          planeNormal: planeNormal.clone(),
          planePoint: planePoint.clone(),
        });
        rawTrianglePolygons.push({
          points2d: projectedPoints.map((point) => ({
            x: point.x,
            y: point.y,
            cameraZ: point.cameraZ,
          })),
          points: projectedPoints
            .map((point) => `${point.x},${point.y}`)
            .join(" "),
          fill,
          fillOpacity: options.fillOpacity,
          stroke: fill,
          strokeOpacity: options.fillOpacity,
          strokeWidth: 0,
          sortDepth,
          backSortDepth: Math.min(
            ...projectedPoints.map((point) => point.cameraZ),
          ),
          sourceCrystalIndex: index,
          faceId: face.id ?? fallbackFace?.id ?? null,
          planeNormal: planeNormal.clone(),
          planePoint: planePoint.clone(),
        });
        opaqueTriangles.push({
          p1: projectedPoints[0],
          p2: projectedPoints[1],
          p3: projectedPoints[2],
        });
      }
    });
  });

  return {
    triangleEntries,
    rawTrianglePolygons,
    opaqueTriangles,
  };
}
