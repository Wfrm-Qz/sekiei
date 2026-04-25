/**
 * 双晶 preview の表示 mode を、面 profile / 線 profile として解決する module。
 *
 * mode 名に直接ぶら下がった分岐が増えると previewScene / previewXray / ridgeGeometry /
 * xrayOverlay の責務が絡むため、まずは profile として 1 か所へ寄せる。
 * 第1段階では既存挙動を維持しつつ、mode 名直書きの置き換え先を提供する。
 */

export type TwinPreviewFaceDisplayMode =
  | "grouped"
  | "solid"
  | "white"
  | "transparent"
  | "xray-solid"
  | "xray-grouped"
  | "custom";

export type TwinPreviewHiddenLineColorMode =
  | "same-as-front"
  | "tinted"
  | "custom";

export type TwinPreviewLineResolutionMode =
  | "canvas-device-pixel"
  | "stage-css-pixel";

export type TwinPreviewFaceMaterialKind = "physical" | "basic";

export type TwinPreviewFaceBaseColorMode =
  | "white"
  | "solid-default"
  | "crystal-accent";

export type TwinPreviewFaceComponentBuildMode =
  | "grouped-face-group"
  | "xray-solid-face-group"
  | "display-geometry-mesh";

/**
 * preview 線表示の profile。
 *
 * `front / hiddenSurface / occludedInterior` のうち何を残すか、mask や overlay を使うか、
 * hidden 線色をどう作るかを mode から解決する。
 */
export interface TwinPreviewLineProfile {
  mode: TwinPreviewFaceDisplayMode;
  useLayeredLines: boolean;
  useDepthMask: boolean;
  useScreenSpaceLineOverlay: boolean;
  showFrontLines: boolean;
  showHiddenSurfaceLines: boolean;
  showOccludedInteriorLines: boolean;
  hiddenSurfaceLineColorMode: TwinPreviewHiddenLineColorMode;
  hiddenSurfaceLineCustomColor: string;
  hiddenSurfaceLineOpacityScale: number;
  hiddenSurfaceLineWidthScale: number;
  occludedInteriorLineColorMode: TwinPreviewHiddenLineColorMode;
  occludedInteriorLineCustomColor: string;
  occludedInteriorLineOpacityScale: number;
  occludedInteriorLineWidthScale: number;
  resolutionMode: TwinPreviewLineResolutionMode;
  depthMaskOffsetFactor: number;
  depthMaskOffsetUnits: number;
}

export type EditableTwinPreviewLineProfile = Omit<
  TwinPreviewLineProfile,
  "mode"
>;

/**
 * preview 面表示の profile。
 *
 * 第1段階では主に仕様整理の受け皿として定義し、後続で previewScene 側の material 分岐を
 * mode 名直書きから移す前提にする。
 */
export interface TwinPreviewFaceProfile {
  mode: TwinPreviewFaceDisplayMode;
  surfaceStyle: TwinPreviewFaceDisplayMode;
  usesLighting: boolean;
  usesScreenSpaceFaceOverlay: boolean;
  materialKind: TwinPreviewFaceMaterialKind;
  baseColorMode: TwinPreviewFaceBaseColorMode;
  opacityWhenHasFinal: number;
  opacityWhenNoFinal: number;
  depthWrite: boolean;
  usePolygonOffset: boolean;
  polygonOffsetFactor: number;
  polygonOffsetUnits: number;
  useVertexColorsOnMergedGeometry: boolean;
  componentBuildMode: TwinPreviewFaceComponentBuildMode;
  preferFinalMergedGeometry: boolean;
  allowSharedSolidFaceColorMap: boolean;
  allowSharedSolidFaceOverlay: boolean;
  usesFaceGroupPalette: boolean;
  groupedFaceComponentOpacity: number | null;
}

export type EditableTwinPreviewFaceProfile = Omit<
  TwinPreviewFaceProfile,
  "mode"
>;

export function normalizeTwinPreviewFaceDisplayMode(
  mode: unknown,
): TwinPreviewFaceDisplayMode {
  switch (mode) {
    case "grouped":
    case "solid":
    case "white":
    case "transparent":
    case "xray-solid":
    case "xray-grouped":
    case "custom":
      return mode;
    default:
      return "grouped";
  }
}

export function createDefaultEditableTwinPreviewLineProfile(): EditableTwinPreviewLineProfile {
  const { mode: _mode, ...profile } = resolveTwinPreviewLineProfile("grouped");
  void _mode;
  return {
    ...profile,
    hiddenSurfaceLineOpacityScale: 0.5,
    occludedInteriorLineOpacityScale: 0.5,
  };
}

export function createDefaultEditableTwinPreviewFaceProfile(): EditableTwinPreviewFaceProfile {
  const { mode: _mode, ...profile } = resolveTwinPreviewFaceProfile("grouped");
  void _mode;
  return {
    surfaceStyle: profile.surfaceStyle,
    componentBuildMode: profile.componentBuildMode,
    baseColorMode: profile.baseColorMode,
    usesFaceGroupPalette: profile.usesFaceGroupPalette,
    materialKind: profile.materialKind,
    usesLighting: profile.usesLighting,
    usesScreenSpaceFaceOverlay: profile.usesScreenSpaceFaceOverlay,
    opacityWhenHasFinal: profile.opacityWhenHasFinal,
    opacityWhenNoFinal: profile.opacityWhenNoFinal,
    depthWrite: profile.depthWrite,
    usePolygonOffset: profile.usePolygonOffset,
    polygonOffsetFactor: profile.polygonOffsetFactor,
    polygonOffsetUnits: profile.polygonOffsetUnits,
    useVertexColorsOnMergedGeometry: profile.useVertexColorsOnMergedGeometry,
    preferFinalMergedGeometry: profile.preferFinalMergedGeometry,
    allowSharedSolidFaceColorMap: profile.allowSharedSolidFaceColorMap,
    allowSharedSolidFaceOverlay: profile.allowSharedSolidFaceOverlay,
    groupedFaceComponentOpacity: profile.groupedFaceComponentOpacity,
  };
}

export function createEditableTwinPreviewLineProfileFromMode(
  mode: string,
): EditableTwinPreviewLineProfile {
  const { mode: _mode, ...profile } = resolveTwinPreviewLineProfile(mode);
  void _mode;
  return profile;
}

export function createEditableTwinPreviewFaceProfileFromMode(
  mode: string,
): EditableTwinPreviewFaceProfile {
  const { mode: _mode, ...profile } = resolveTwinPreviewFaceProfile(mode);
  void _mode;
  return {
    surfaceStyle: profile.surfaceStyle,
    componentBuildMode: profile.componentBuildMode,
    baseColorMode: profile.baseColorMode,
    usesFaceGroupPalette: profile.usesFaceGroupPalette,
    materialKind: profile.materialKind,
    usesLighting: profile.usesLighting,
    usesScreenSpaceFaceOverlay: profile.usesScreenSpaceFaceOverlay,
    opacityWhenHasFinal: profile.opacityWhenHasFinal,
    opacityWhenNoFinal: profile.opacityWhenNoFinal,
    depthWrite: profile.depthWrite,
    usePolygonOffset: profile.usePolygonOffset,
    polygonOffsetFactor: profile.polygonOffsetFactor,
    polygonOffsetUnits: profile.polygonOffsetUnits,
    useVertexColorsOnMergedGeometry: profile.useVertexColorsOnMergedGeometry,
    preferFinalMergedGeometry: profile.preferFinalMergedGeometry,
    allowSharedSolidFaceColorMap: profile.allowSharedSolidFaceColorMap,
    allowSharedSolidFaceOverlay: profile.allowSharedSolidFaceOverlay,
    groupedFaceComponentOpacity: profile.groupedFaceComponentOpacity,
  };
}

export function resolveTwinPreviewFaceBaseColor(
  profile: TwinPreviewFaceProfile,
  options: {
    crystalAccentColor?: number | string | null;
    useVertexColors?: boolean;
  } = {},
) {
  const { crystalAccentColor = null, useVertexColors = false } = options;
  switch (profile.baseColorMode) {
    case "solid-default":
      return 0xd1b36a;
    case "crystal-accent":
      return useVertexColors ? 0xffffff : (crystalAccentColor ?? 0xffffff);
    case "white":
    default:
      return 0xffffff;
  }
}

export function resolveTwinPreviewFaceOpacity(
  profile: TwinPreviewFaceProfile,
  options: {
    hasFinal: boolean;
    preferGroupedFaceComponentOpacity?: boolean;
  },
) {
  if (
    options.preferGroupedFaceComponentOpacity &&
    profile.groupedFaceComponentOpacity != null
  ) {
    return profile.groupedFaceComponentOpacity;
  }
  return options.hasFinal
    ? profile.opacityWhenHasFinal
    : profile.opacityWhenNoFinal;
}

/** mode 名から preview 線 profile を返す。 */
export function resolveTwinPreviewLineProfile(
  mode: string,
  customProfile?: EditableTwinPreviewLineProfile | null,
): TwinPreviewLineProfile {
  switch (mode) {
    case "custom":
      return {
        mode: "custom",
        ...(customProfile ?? createDefaultEditableTwinPreviewLineProfile()),
      };
    case "transparent":
      return {
        mode: "transparent",
        useLayeredLines: true,
        useDepthMask: true,
        useScreenSpaceLineOverlay: false,
        showFrontLines: true,
        showHiddenSurfaceLines: true,
        showOccludedInteriorLines: true,
        hiddenSurfaceLineColorMode: "same-as-front",
        hiddenSurfaceLineCustomColor: "#7a7a7a",
        hiddenSurfaceLineOpacityScale: 0.82,
        hiddenSurfaceLineWidthScale: 2,
        occludedInteriorLineColorMode: "same-as-front",
        occludedInteriorLineCustomColor: "#7a7a7a",
        occludedInteriorLineOpacityScale: 0.82,
        occludedInteriorLineWidthScale: 2,
        resolutionMode: "canvas-device-pixel",
        depthMaskOffsetFactor: 0.25,
        depthMaskOffsetUnits: 0.5,
      };
    case "xray-solid":
      return {
        mode: "xray-solid",
        useLayeredLines: true,
        useDepthMask: true,
        useScreenSpaceLineOverlay: true,
        showFrontLines: true,
        showHiddenSurfaceLines: true,
        showOccludedInteriorLines: true,
        hiddenSurfaceLineColorMode: "tinted",
        hiddenSurfaceLineCustomColor: "#7a7a7a",
        hiddenSurfaceLineOpacityScale: 0.82,
        hiddenSurfaceLineWidthScale: 2,
        occludedInteriorLineColorMode: "tinted",
        occludedInteriorLineCustomColor: "#9a9a9a",
        occludedInteriorLineOpacityScale: 0.42,
        occludedInteriorLineWidthScale: 1.44,
        resolutionMode: "stage-css-pixel",
        depthMaskOffsetFactor: 1,
        depthMaskOffsetUnits: 2,
      };
    case "xray-grouped":
      return {
        mode: "xray-grouped",
        useLayeredLines: true,
        useDepthMask: true,
        useScreenSpaceLineOverlay: true,
        showFrontLines: true,
        showHiddenSurfaceLines: true,
        showOccludedInteriorLines: true,
        hiddenSurfaceLineColorMode: "tinted",
        hiddenSurfaceLineCustomColor: "#7a7a7a",
        hiddenSurfaceLineOpacityScale: 0.82,
        hiddenSurfaceLineWidthScale: 2,
        occludedInteriorLineColorMode: "tinted",
        occludedInteriorLineCustomColor: "#9a9a9a",
        occludedInteriorLineOpacityScale: 0.42,
        occludedInteriorLineWidthScale: 1.44,
        resolutionMode: "stage-css-pixel",
        depthMaskOffsetFactor: 1,
        depthMaskOffsetUnits: 2,
      };
    case "grouped":
    case "solid":
    case "white":
    default:
      return {
        mode:
          mode === "solid" || mode === "white" || mode === "grouped"
            ? mode
            : "grouped",
        useLayeredLines: false,
        useDepthMask: false,
        useScreenSpaceLineOverlay: false,
        showFrontLines: true,
        showHiddenSurfaceLines: false,
        showOccludedInteriorLines: false,
        hiddenSurfaceLineColorMode: "same-as-front",
        hiddenSurfaceLineCustomColor: "#7a7a7a",
        hiddenSurfaceLineOpacityScale: 0,
        hiddenSurfaceLineWidthScale: 2,
        occludedInteriorLineColorMode: "same-as-front",
        occludedInteriorLineCustomColor: "#9a9a9a",
        occludedInteriorLineOpacityScale: 0,
        occludedInteriorLineWidthScale: 2,
        resolutionMode: "canvas-device-pixel",
        depthMaskOffsetFactor: 1,
        depthMaskOffsetUnits: 2,
      };
  }
}

/** mode 名から preview 面 profile を返す。 */
export function resolveTwinPreviewFaceProfile(
  mode: string,
  customProfile?: EditableTwinPreviewFaceProfile | null,
): TwinPreviewFaceProfile {
  switch (mode) {
    case "custom":
      return {
        mode: "custom",
        ...(customProfile ?? createDefaultEditableTwinPreviewFaceProfile()),
      };
    case "solid":
      return {
        mode: "solid",
        surfaceStyle: "solid",
        usesLighting: true,
        usesScreenSpaceFaceOverlay: false,
        materialKind: "physical",
        baseColorMode: "crystal-accent",
        opacityWhenHasFinal: 1,
        opacityWhenNoFinal: 1,
        depthWrite: true,
        usePolygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        useVertexColorsOnMergedGeometry: false,
        componentBuildMode: "display-geometry-mesh",
        preferFinalMergedGeometry: false,
        allowSharedSolidFaceColorMap: true,
        allowSharedSolidFaceOverlay: true,
        usesFaceGroupPalette: false,
        groupedFaceComponentOpacity: null,
      };
    case "white":
      return {
        mode: "white",
        surfaceStyle: "white",
        usesLighting: true,
        usesScreenSpaceFaceOverlay: false,
        materialKind: "physical",
        baseColorMode: "white",
        opacityWhenHasFinal: 1,
        opacityWhenNoFinal: 1,
        depthWrite: true,
        usePolygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        useVertexColorsOnMergedGeometry: false,
        componentBuildMode: "display-geometry-mesh",
        preferFinalMergedGeometry: false,
        allowSharedSolidFaceColorMap: false,
        allowSharedSolidFaceOverlay: false,
        usesFaceGroupPalette: false,
        groupedFaceComponentOpacity: null,
      };
    case "transparent":
      return {
        mode: "transparent",
        surfaceStyle: "transparent",
        usesLighting: false,
        usesScreenSpaceFaceOverlay: false,
        materialKind: "basic",
        baseColorMode: "white",
        opacityWhenHasFinal: 0,
        opacityWhenNoFinal: 0,
        depthWrite: false,
        usePolygonOffset: false,
        polygonOffsetFactor: 0,
        polygonOffsetUnits: 0,
        useVertexColorsOnMergedGeometry: false,
        componentBuildMode: "display-geometry-mesh",
        preferFinalMergedGeometry: false,
        allowSharedSolidFaceColorMap: false,
        allowSharedSolidFaceOverlay: false,
        usesFaceGroupPalette: false,
        groupedFaceComponentOpacity: null,
      };
    case "xray-solid":
      return {
        mode: "xray-solid",
        surfaceStyle: "xray-solid",
        usesLighting: false,
        usesScreenSpaceFaceOverlay: true,
        materialKind: "basic",
        baseColorMode: "crystal-accent",
        opacityWhenHasFinal: 0.28,
        opacityWhenNoFinal: 0.45,
        depthWrite: false,
        usePolygonOffset: false,
        polygonOffsetFactor: 0,
        polygonOffsetUnits: 0,
        useVertexColorsOnMergedGeometry: false,
        componentBuildMode: "xray-solid-face-group",
        preferFinalMergedGeometry: false,
        allowSharedSolidFaceColorMap: false,
        allowSharedSolidFaceOverlay: false,
        usesFaceGroupPalette: false,
        groupedFaceComponentOpacity: null,
      };
    case "xray-grouped":
      return {
        mode: "xray-grouped",
        surfaceStyle: "xray-grouped",
        usesLighting: false,
        usesScreenSpaceFaceOverlay: true,
        materialKind: "basic",
        baseColorMode: "crystal-accent",
        opacityWhenHasFinal: 0.28,
        opacityWhenNoFinal: 0.45,
        depthWrite: false,
        usePolygonOffset: false,
        polygonOffsetFactor: 0,
        polygonOffsetUnits: 0,
        useVertexColorsOnMergedGeometry: false,
        componentBuildMode: "grouped-face-group",
        preferFinalMergedGeometry: false,
        allowSharedSolidFaceColorMap: false,
        allowSharedSolidFaceOverlay: false,
        usesFaceGroupPalette: true,
        groupedFaceComponentOpacity: 0.58,
      };
    case "grouped":
    default:
      return {
        mode: "grouped",
        surfaceStyle: "grouped",
        usesLighting: true,
        usesScreenSpaceFaceOverlay: false,
        materialKind: "physical",
        baseColorMode: "white",
        opacityWhenHasFinal: 1,
        opacityWhenNoFinal: 1,
        depthWrite: true,
        usePolygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        useVertexColorsOnMergedGeometry: true,
        componentBuildMode: "grouped-face-group",
        preferFinalMergedGeometry: false,
        allowSharedSolidFaceColorMap: false,
        allowSharedSolidFaceOverlay: false,
        usesFaceGroupPalette: true,
        groupedFaceComponentOpacity: null,
      };
  }
}
