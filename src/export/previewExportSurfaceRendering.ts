import * as THREE from "three";
import type { CrystalSystemId } from "../domain/crystalSystems.js";
import type { TwinPreviewFaceProfile } from "../preview/previewProfiles.js";

interface PreviewExportSurfaceFaceLike {
  id?: string | null;
  coefficient?: number | string | null;
}

interface PreviewExportSurfaceCrystalEntryLike {
  index: number;
  meshData?: unknown;
}

interface PreviewExportSurfaceStateLike {
  parameters: {
    crystalSystem: CrystalSystemId;
  };
  previewRoot: THREE.Group | null;
}

export interface PreviewSvgLightingContext {
  ambient: { color: THREE.Color; intensity: number } | null;
  directionals: {
    color: THREE.Color;
    intensity: number;
    direction: THREE.Vector3;
  }[];
  normalization: number;
}

export function buildPreviewSvgLightingContext(options: {
  previewAmbientLight: THREE.AmbientLight;
  previewKeyLight: THREE.DirectionalLight;
  previewFillLight: THREE.DirectionalLight;
}): PreviewSvgLightingContext {
  const ambient = options.previewAmbientLight.visible
    ? {
        color: options.previewAmbientLight.color.clone(),
        intensity: options.previewAmbientLight.intensity,
      }
    : null;

  const directionals = [options.previewKeyLight, options.previewFillLight]
    .filter((light) => light.visible)
    .map((light) => {
      const lightPosition = new THREE.Vector3();
      const targetPosition = new THREE.Vector3();
      light.getWorldPosition(lightPosition);
      light.target.getWorldPosition(targetPosition);
      return {
        color: light.color.clone(),
        intensity: light.intensity,
        direction: lightPosition.sub(targetPosition).normalize(),
      };
    })
    .filter((entry) => entry.direction.lengthSq() > 0);

  const normalization =
    (ambient?.intensity ?? 0) +
    directionals.reduce((sum, entry) => sum + entry.intensity, 0);

  return {
    ambient,
    directionals,
    normalization: normalization > 0 ? normalization : 1,
  };
}

export function applyPreviewLightingToSvgFill(
  fill: string,
  worldNormal: THREE.Vector3 | null | undefined,
  lightingContext: PreviewSvgLightingContext | null,
) {
  if (!lightingContext || !worldNormal || worldNormal.lengthSq() === 0) {
    return fill;
  }

  const baseColor = new THREE.Color(fill);
  const normal = worldNormal.clone().normalize();
  const lightMix = new THREE.Color(0, 0, 0);

  if (lightingContext.ambient) {
    lightMix.add(
      lightingContext.ambient.color
        .clone()
        .multiplyScalar(lightingContext.ambient.intensity),
    );
  }

  lightingContext.directionals.forEach((entry) => {
    const diffuse = Math.max(normal.dot(entry.direction), 0);
    if (diffuse <= 0) {
      return;
    }
    lightMix.add(entry.color.clone().multiplyScalar(entry.intensity * diffuse));
  });

  lightMix.multiplyScalar(1 / lightingContext.normalization);

  const litColor = new THREE.Color(
    THREE.MathUtils.clamp(baseColor.r * lightMix.r, 0, 1),
    THREE.MathUtils.clamp(baseColor.g * lightMix.g, 0, 1),
    THREE.MathUtils.clamp(baseColor.b * lightMix.b, 0, 1),
  );

  return `#${litColor.getHexString()}`;
}

export function getRenderablePreviewMeshesForExport(options: {
  previewRoot: THREE.Group | null;
  hasNamedAncestor: (object: THREE.Object3D | null, name: string) => boolean;
}) {
  if (!options.previewRoot) {
    return [];
  }
  const meshes: THREE.Mesh[] = [];
  options.previewRoot.traverse((object) => {
    if (
      !object.isMesh ||
      options.hasNamedAncestor(object, "face-pick-targets") ||
      options.hasNamedAncestor(object, "preview-ridge-lines") ||
      options.hasNamedAncestor(object, "axis-guides") ||
      options.hasNamedAncestor(object, "split-plane-guides") ||
      options.hasNamedAncestor(object, "twin-rule-guides") ||
      options.hasNamedAncestor(object, "shared-solid-face-overlays") ||
      object.name === "xray-line-depth-mask-mesh" ||
      options.hasNamedAncestor(object, "xray-line-depth-mask")
    ) {
      return;
    }
    if (!object.visible && object.userData?.xrayTransparentFace !== true) {
      return;
    }
    meshes.push(object);
  });
  return meshes;
}

export function getApproximateMultiCrystalExportColor(options: {
  visibleCrystalEntries: PreviewExportSurfaceCrystalEntryLike[];
  faceProfile: Pick<TwinPreviewFaceProfile, "usesFaceGroupPalette">;
  state: PreviewExportSurfaceStateLike;
  getTwinCrystalFaces: (
    parameters: PreviewExportSurfaceStateLike["parameters"],
    index: number,
  ) => PreviewExportSurfaceFaceLike[];
  buildTwinFaceGroupPalette: (
    sourceFaces: PreviewExportSurfaceFaceLike[],
    crystalSystem: string,
  ) => {
    faceColors: Map<string | null | undefined, { preview: string }>;
    groupColors: Map<string, { preview: string }>;
  };
  getCrystalAccentColor: (index: number) => string;
  averageColors: (colors: THREE.Color[]) => THREE.Color;
}) {
  if (!options.faceProfile.usesFaceGroupPalette) {
    return options.averageColors(
      options.visibleCrystalEntries.map(
        ({ index }) => new THREE.Color(options.getCrystalAccentColor(index)),
      ),
    );
  }

  const groupColors: THREE.Color[] = [];
  options.visibleCrystalEntries.forEach(({ index }) => {
    const sourceFaces = options.getTwinCrystalFaces(
      options.state.parameters,
      index,
    );
    const palette = options.buildTwinFaceGroupPalette(
      sourceFaces,
      options.state.parameters.crystalSystem,
    );
    palette.groupColors.forEach((colorSet) => {
      groupColors.push(new THREE.Color(colorSet.preview));
    });
  });
  return options.averageColors(groupColors);
}

export function createPreviewExportColorResolver(options: {
  width: number;
  height: number;
  previewRoot: THREE.Group | null;
  camera: THREE.Camera;
  raycaster: THREE.Raycaster;
  buildPreviewBoundsSphere: () => { radius: number };
  projectWorldPointToExport: (
    worldPoint: THREE.Vector3,
    width: number,
    height: number,
  ) => { x: number; y: number; projectedZ: number; cameraZ: number };
  getExportMaterial: (
    object: THREE.Object3D & { material?: unknown },
  ) => unknown;
  hasNamedAncestor: (object: THREE.Object3D | null, name: string) => boolean;
}) {
  const meshes = getRenderablePreviewMeshesForExport({
    previewRoot: options.previewRoot,
    hasNamedAncestor: options.hasNamedAncestor,
  });
  if (!meshes.length) {
    return null;
  }
  const boundsRadius = Math.max(options.buildPreviewBoundsSphere().radius, 1);
  const rayOffset = Math.max(boundsRadius * 1e-5, 1e-4);
  const rayFar = Math.max(boundsRadius * 0.05, rayOffset * 10);

  const resolveFillFromIntersection = (
    hit: THREE.Intersection | undefined,
    fallbackFill: string,
  ) => {
    if (!hit) {
      return fallbackFill;
    }

    const material = options.getExportMaterial(hit.object);
    const geometry = hit.object.geometry;
    const colorAttribute = geometry?.getAttribute?.("color");
    if (
      material &&
      typeof material === "object" &&
      "vertexColors" in material &&
      material.vertexColors &&
      colorAttribute &&
      hit.face
    ) {
      const color = new THREE.Color(
        (colorAttribute.getX(hit.face.a) +
          colorAttribute.getX(hit.face.b) +
          colorAttribute.getX(hit.face.c)) /
          3,
        (colorAttribute.getY(hit.face.a) +
          colorAttribute.getY(hit.face.b) +
          colorAttribute.getY(hit.face.c)) /
          3,
        (colorAttribute.getZ(hit.face.a) +
          colorAttribute.getZ(hit.face.b) +
          colorAttribute.getZ(hit.face.c)) /
          3,
      );
      return `#${color.getHexString()}`;
    }

    if (
      material &&
      typeof material === "object" &&
      "color" in material &&
      material.color
    ) {
      return `#${new THREE.Color(material.color as THREE.ColorRepresentation).getHexString()}`;
    }
    return fallbackFill;
  };

  const sampleFillAtProjectedPoint = (
    projectedPoint: { x: number; y: number },
    fallbackFill: string,
  ) => {
    const ndc = new THREE.Vector2(
      (projectedPoint.x / options.width) * 2 - 1,
      1 - (projectedPoint.y / options.height) * 2,
    );
    options.raycaster.setFromCamera(ndc, options.camera);
    const hits = options.raycaster.intersectObjects(meshes, true);
    const hit = hits.find(
      (candidate) =>
        candidate.object?.visible ||
        candidate.object?.userData?.xrayTransparentFace === true,
    );
    return resolveFillFromIntersection(hit, fallbackFill);
  };

  const sampleFillAtWorldPoint = (
    worldPoint: THREE.Vector3 | null | undefined,
    worldNormal: THREE.Vector3 | null | undefined,
    fallbackFill: string,
  ) => {
    if (!worldPoint || !worldNormal || worldNormal.lengthSq() === 0) {
      return fallbackFill;
    }

    const outwardNormal = worldNormal.clone().normalize();
    const inwardDirection = outwardNormal.clone().negate();
    const rayOrigin = worldPoint
      .clone()
      .add(outwardNormal.multiplyScalar(rayOffset));
    const previousNear = options.raycaster.near;
    const previousFar = options.raycaster.far;
    options.raycaster.near = 0;
    options.raycaster.far = rayFar;
    options.raycaster.set(rayOrigin, inwardDirection);
    const hits = options.raycaster.intersectObjects(meshes, true);
    options.raycaster.near = previousNear;
    options.raycaster.far = previousFar;
    const hit = hits.find(
      (candidate) =>
        candidate.object?.visible ||
        candidate.object?.userData?.xrayTransparentFace === true,
    );
    return resolveFillFromIntersection(hit, fallbackFill);
  };

  return (
    {
      projectedPoints,
      worldPoints,
      worldNormal,
    }: {
      projectedPoints?: { x: number; y: number }[];
      worldPoints?: THREE.Vector3[];
      worldNormal?: THREE.Vector3 | null;
    },
    fallbackFill: string,
  ) => {
    const sampleEntries: {
      projected?: { x: number; y: number };
      world: THREE.Vector3 | null;
    }[] = [];
    if (
      Array.isArray(projectedPoints) &&
      projectedPoints.length >= 3 &&
      Array.isArray(worldPoints) &&
      worldPoints.length >= 3
    ) {
      const [pa, pb, pc] = projectedPoints;
      const [wa, wb, wc] = worldPoints;
      sampleEntries.push(
        {
          projected: {
            x: (pa.x + pb.x + pc.x) / 3,
            y: (pa.y + pb.y + pc.y) / 3,
          },
          world: wa
            .clone()
            .add(wb)
            .add(wc)
            .multiplyScalar(1 / 3),
        },
        {
          projected: {
            x: (pa.x * 2 + pb.x + pc.x) / 4,
            y: (pa.y * 2 + pb.y + pc.y) / 4,
          },
          world: wa
            .clone()
            .multiplyScalar(2)
            .add(wb)
            .add(wc)
            .multiplyScalar(1 / 4),
        },
        {
          projected: {
            x: (pa.x + pb.x * 2 + pc.x) / 4,
            y: (pa.y + pb.y * 2 + pc.y) / 4,
          },
          world: wa
            .clone()
            .add(wb.clone().multiplyScalar(2))
            .add(wc)
            .multiplyScalar(1 / 4),
        },
        {
          projected: {
            x: (pa.x + pb.x + pc.x * 2) / 4,
            y: (pa.y + pb.y + pc.y * 2) / 4,
          },
          world: wa
            .clone()
            .add(wb)
            .add(wc.clone().multiplyScalar(2))
            .multiplyScalar(1 / 4),
        },
      );
    } else if (projectedPoints) {
      sampleEntries.push({
        projected: projectedPoints[0],
        world: worldPoints?.[0] ?? null,
      });
    }

    const counts = new Map<string, number>();
    sampleEntries.forEach(({ projected, world }) => {
      const worldFill = sampleFillAtWorldPoint(
        world,
        worldNormal,
        fallbackFill,
      );
      const fill =
        worldFill === fallbackFill && projected
          ? sampleFillAtProjectedPoint(projected, fallbackFill)
          : worldFill;
      counts.set(fill, (counts.get(fill) ?? 0) + 1);
    });

    let bestFill = fallbackFill;
    let bestCount = -1;
    counts.forEach((count, fill) => {
      if (count > bestCount) {
        bestFill = fill;
        bestCount = count;
      }
    });
    return bestFill;
  };
}
