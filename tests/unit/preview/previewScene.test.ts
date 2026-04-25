import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createDefaultTwinPreviewStyleSettings } from "../../../src/preview/previewStyleSettings.ts";
import { createTwinPreviewSceneActions } from "../../../src/preview/previewScene.ts";
import { createDefaultTwinStlSplitSettings } from "../../../src/state/stlSplitSettings.ts";

/**
 * preview/previewScene の scene graph 構築入口を確認する unit test。
 */
describe("preview/previewScene", () => {
  function createContext(overrides: Record<string, unknown> = {}) {
    const state = {
      parameters: {
        crystalSystem: "cubic",
        twin: { enabled: false, crystals: [] },
      },
      stlSplit: createDefaultTwinStlSplitSettings("cubic"),
      buildResult: null,
      previewRoot: null,
      activeFaceCrystalIndex: 0,
      axisGuideGroup: null,
      splitPlaneGuideGroup: null,
      twinRuleGuideGroup: null,
      facePickTargetGroup: null,
      facePickTargets: [],
      ridgeLines: null,
      intersectionRidgeLines: null,
      faceLabelAnchors: [],
      axisLabelAnchors: [],
      twinRuleLabelAnchors: [],
      faceDisplayMode: "grouped",
      previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
      showRidgeLines: true,
      showIntersectionRidgeLines: true,
      showTwinRuleGuide: true,
      showSplitPlaneGuide: false,
      showAxisLinesInner: true,
      showAxisLinesOuter: true,
      showAxisLabels: true,
      ...overrides,
    };

    return createTwinPreviewSceneActions({
      state,
      elements: {
        faceLabelLayer: document.createElement("div"),
      },
      getCrystalAccentColor: () => "#d35b53",
      isCrystalVisible: () => true,
      requestPreviewRender: vi.fn(),
      applyLabelLayerVisibility: vi.fn(),
      createAxisLabelAnchors: vi.fn().mockReturnValue([]),
      createFaceLabelAnchors: vi.fn().mockReturnValue([]),
      createWideLineFromPoints: () => new THREE.Group(),
      createPreviewLineFromPoints: () => new THREE.Group(),
      createGroupedFaceMeshGroup: () => new THREE.Group(),
      createXraySolidFaceMeshGroup: () => new THREE.Group(),
      buildDisplayGeometry: () => new THREE.BufferGeometry(),
      buildFlatFaceColors: () => [],
      createWireframeFromGeometry: () => new THREE.Group(),
      createWireframeFromPositions: () => new THREE.Group(),
      buildVisibleRidgeLineData: () => ({
        surfacePositions: [],
        occludedInteriorPositions: [],
      }),
      buildVisibleRidgeLinePositions: () => [],
      buildCrossCrystalIntersectionLinePositions: () => [],
      buildSharedSolidFaceColorMap: () => new Map(),
      buildSolidSharedFaceOverlayGroup: () => null,
      createXrayLineDepthMaskGroup: () => null,
      applyXrayPreviewMeshState: vi.fn(),
      buildFaceCenter: () => new THREE.Vector3(),
      buildAxisInnerSegment: () => null,
      buildAxisOuterSegments: () => [],
    });
  }

  it("getPreviewAxisGuides は正常系で基準結晶 axisGuides を返し、異常系では空配列になる", () => {
    const actions = createContext({
      buildResult: {
        crystalPreviewMeshData: [{ axisGuides: [{ label: "a" }] }],
      },
    });
    expect(actions.getPreviewAxisGuides()).toEqual([{ label: "a" }]);
    expect(createContext().getPreviewAxisGuides()).toEqual([]);
  });

  it("buildPreviewBoundsSphere は頂点群から sphere を作り、異常系では半径1へ fallback する", () => {
    const actions = createContext({
      buildResult: {
        crystalPreviewMeshData: [
          {
            vertices: [
              { x: -1, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
          },
        ],
      },
    });
    const sphere = actions.buildPreviewBoundsSphere();
    expect(sphere.radius).toBeGreaterThan(0);

    const fallbackSphere = createContext().buildPreviewBoundsSphere();
    expect(fallbackSphere.radius).toBe(1);
  });

  it("buildPreviewGroup は正常系で空でない group を返し、異常系では null になる", () => {
    const actions = createContext({
      buildResult: {
        crystalPreviewMeshData: [
          {
            vertices: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
              { x: 0, y: 1, z: 0 },
            ],
            faces: [
              {
                id: "face-1",
                normal: { x: 0, y: 0, z: 1 },
                vertices: [
                  { x: 0, y: 0, z: 0 },
                  { x: 1, y: 0, z: 0 },
                  { x: 0, y: 1, z: 0 },
                ],
              },
            ],
            axisGuides: [{ label: "a", color: "#f00" }],
          },
        ],
      },
      parameters: {
        crystalSystem: "cubic",
        twin: { enabled: false, crystals: [{ enabled: true }] },
      },
    });

    expect(actions.buildPreviewGroup()).toBeInstanceOf(THREE.Group);
    expect(createContext().buildPreviewGroup()).toBeNull();
  });

  it("transparent では line depth mask を scene graph に積む", () => {
    const createXrayLineDepthMaskGroup = vi
      .fn()
      .mockReturnValue(new THREE.Group());
    const actions = createTwinPreviewSceneActions({
      state: {
        parameters: {
          crystalSystem: "cubic",
          twin: { enabled: false, crystals: [{ enabled: true }] },
        },
        stlSplit: createDefaultTwinStlSplitSettings("cubic"),
        buildResult: {
          previewFinalGeometry: new THREE.BufferGeometry(),
          crystalPreviewMeshData: [
            {
              vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
              ],
              faces: [
                {
                  id: "face-1",
                  normal: { x: 0, y: 0, z: 1 },
                  vertices: [
                    { x: 0, y: 0, z: 0 },
                    { x: 1, y: 0, z: 0 },
                    { x: 0, y: 1, z: 0 },
                  ],
                },
              ],
            },
          ],
        },
        previewRoot: null,
        activeFaceCrystalIndex: 0,
        axisGuideGroup: null,
        splitPlaneGuideGroup: null,
        twinRuleGuideGroup: null,
        facePickTargetGroup: null,
        facePickTargets: [],
        ridgeLines: null,
        intersectionRidgeLines: null,
        faceLabelAnchors: [],
        axisLabelAnchors: [],
        twinRuleLabelAnchors: [],
        faceDisplayMode: "transparent",
        previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
        showRidgeLines: true,
        showIntersectionRidgeLines: true,
        showTwinRuleGuide: true,
        showSplitPlaneGuide: false,
        showAxisLinesInner: true,
        showAxisLinesOuter: true,
        showAxisLabels: true,
      },
      elements: {
        faceLabelLayer: document.createElement("div"),
      },
      getCrystalAccentColor: () => "#d35b53",
      isCrystalVisible: () => true,
      requestPreviewRender: vi.fn(),
      applyLabelLayerVisibility: vi.fn(),
      createAxisLabelAnchors: vi.fn().mockReturnValue([]),
      createFaceLabelAnchors: vi.fn().mockReturnValue([]),
      createWideLineFromPoints: () => new THREE.Group(),
      createPreviewLineFromPoints: () => new THREE.Group(),
      createGroupedFaceMeshGroup: () => new THREE.Group(),
      createXraySolidFaceMeshGroup: () => new THREE.Group(),
      buildDisplayGeometry: () => new THREE.BufferGeometry(),
      buildFlatFaceColors: () => [],
      createWireframeFromGeometry: () => new THREE.Group(),
      createWireframeFromPositions: () => new THREE.Group(),
      buildVisibleRidgeLineData: () => ({
        surfacePositions: [],
        occludedInteriorPositions: [],
      }),
      buildVisibleRidgeLinePositions: () => [],
      buildCrossCrystalIntersectionLinePositions: () => [],
      buildSharedSolidFaceColorMap: () => new Map(),
      buildSolidSharedFaceOverlayGroup: () => null,
      createXrayLineDepthMaskGroup,
      applyXrayPreviewMeshState: vi.fn(),
      buildFaceCenter: () => new THREE.Vector3(),
      buildAxisInnerSegment: () => null,
      buildAxisOuterSegments: () => [],
    });

    actions.buildPreviewGroup();

    expect(createXrayLineDepthMaskGroup).toHaveBeenCalled();
  });

  it("四軸系の a3 軸線は従来どおり専用の橙色を使う", () => {
    const createWideLineFromPoints = vi.fn(() => new THREE.Group());
    const actions = createTwinPreviewSceneActions({
      state: {
        parameters: {
          crystalSystem: "trigonal",
          twin: { enabled: false, crystals: [{ enabled: true }] },
        },
        stlSplit: createDefaultTwinStlSplitSettings("trigonal"),
        buildResult: {
          crystalPreviewMeshData: [
            {
              vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
              ],
              faces: [
                {
                  id: "face-1",
                  normal: { x: 0, y: 0, z: 1 },
                  vertices: [
                    { x: 0, y: 0, z: 0 },
                    { x: 1, y: 0, z: 0 },
                    { x: 0, y: 1, z: 0 },
                  ],
                },
              ],
              axisGuides: [{ label: "a3", color: "#c08a2d" }],
            },
          ],
        },
        previewRoot: null,
        activeFaceCrystalIndex: 0,
        axisGuideGroup: null,
        splitPlaneGuideGroup: null,
        twinRuleGuideGroup: null,
        facePickTargetGroup: null,
        facePickTargets: [],
        ridgeLines: null,
        intersectionRidgeLines: null,
        faceLabelAnchors: [],
        axisLabelAnchors: [],
        twinRuleLabelAnchors: [],
        faceDisplayMode: "grouped",
        previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
        showRidgeLines: true,
        showIntersectionRidgeLines: true,
        showTwinRuleGuide: true,
        showSplitPlaneGuide: false,
        showAxisLinesInner: true,
        showAxisLinesOuter: true,
        showAxisLabels: true,
      },
      elements: {
        faceLabelLayer: document.createElement("div"),
      },
      getCrystalAccentColor: () => "#d35b53",
      isCrystalVisible: () => true,
      requestPreviewRender: vi.fn(),
      applyLabelLayerVisibility: vi.fn(),
      createAxisLabelAnchors: vi.fn().mockReturnValue([]),
      createFaceLabelAnchors: vi.fn().mockReturnValue([]),
      createWideLineFromPoints,
      createPreviewLineFromPoints: () => new THREE.Group(),
      createGroupedFaceMeshGroup: () => new THREE.Group(),
      createXraySolidFaceMeshGroup: () => new THREE.Group(),
      buildDisplayGeometry: () => new THREE.BufferGeometry(),
      buildFlatFaceColors: () => [],
      createWireframeFromGeometry: () => new THREE.Group(),
      createWireframeFromPositions: () => new THREE.Group(),
      buildVisibleRidgeLineData: () => ({
        surfacePositions: [],
        occludedInteriorPositions: [],
      }),
      buildVisibleRidgeLinePositions: () => [],
      buildCrossCrystalIntersectionLinePositions: () => [],
      buildSharedSolidFaceColorMap: () => new Map(),
      buildSolidSharedFaceOverlayGroup: () => null,
      createXrayLineDepthMaskGroup: () => null,
      applyXrayPreviewMeshState: vi.fn(),
      buildFaceCenter: () => new THREE.Vector3(),
      buildAxisInnerSegment: () => ({
        start: new THREE.Vector3(0, 0, 0),
        end: new THREE.Vector3(1, 0, 0),
      }),
      buildAxisOuterSegments: () => [],
    });

    actions.buildPreviewGroup();

    expect(createWideLineFromPoints).toHaveBeenCalledWith(
      expect.any(Array),
      "#c08a2d",
      0.95,
      false,
      2,
    );
  });

  it("xray では surface と occludedInterior の稜線を別 object として積む", () => {
    const createWireframeFromPositions = vi.fn(() => new THREE.Group());
    const actions = createTwinPreviewSceneActions({
      state: {
        parameters: {
          crystalSystem: "cubic",
          twin: {
            enabled: false,
            crystals: [{ enabled: true }, { enabled: true }],
          },
        },
        stlSplit: createDefaultTwinStlSplitSettings("cubic"),
        buildResult: {
          finalGeometry: new THREE.BufferGeometry(),
          crystalPreviewMeshData: [
            {
              vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
              ],
              faces: [
                {
                  id: "face-1",
                  normal: { x: 0, y: 0, z: 1 },
                  vertices: [
                    { x: 0, y: 0, z: 0 },
                    { x: 1, y: 0, z: 0 },
                    { x: 0, y: 1, z: 0 },
                  ],
                },
              ],
            },
            {
              vertices: [
                { x: 0, y: 0, z: 0 },
                { x: -1, y: 0, z: 0 },
                { x: 0, y: -1, z: 0 },
              ],
              faces: [
                {
                  id: "face-2",
                  normal: { x: 0, y: 0, z: 1 },
                  vertices: [
                    { x: 0, y: 0, z: 0 },
                    { x: -1, y: 0, z: 0 },
                    { x: 0, y: -1, z: 0 },
                  ],
                },
              ],
            },
            {
              vertices: [
                { x: 0, y: 0, z: 0 },
                { x: -1, y: 0, z: 0 },
                { x: 0, y: -1, z: 0 },
              ],
              faces: [
                {
                  id: "face-2",
                  normal: { x: 0, y: 0, z: 1 },
                  vertices: [
                    { x: 0, y: 0, z: 0 },
                    { x: -1, y: 0, z: 0 },
                    { x: 0, y: -1, z: 0 },
                  ],
                },
              ],
            },
          ],
        },
        previewRoot: null,
        activeFaceCrystalIndex: 0,
        axisGuideGroup: null,
        splitPlaneGuideGroup: null,
        twinRuleGuideGroup: null,
        facePickTargetGroup: null,
        facePickTargets: [],
        ridgeLines: null,
        intersectionRidgeLines: null,
        faceLabelAnchors: [],
        axisLabelAnchors: [],
        twinRuleLabelAnchors: [],
        faceDisplayMode: "xray-solid",
        previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
        showRidgeLines: true,
        showIntersectionRidgeLines: false,
        showTwinRuleGuide: false,
        showSplitPlaneGuide: false,
        showAxisLinesInner: true,
        showAxisLinesOuter: true,
        showAxisLabels: true,
      },
      elements: {
        faceLabelLayer: document.createElement("div"),
      },
      getCrystalAccentColor: () => "#d35b53",
      isCrystalVisible: () => true,
      requestPreviewRender: vi.fn(),
      applyLabelLayerVisibility: vi.fn(),
      createAxisLabelAnchors: vi.fn().mockReturnValue([]),
      createFaceLabelAnchors: vi.fn().mockReturnValue([]),
      createWideLineFromPoints: () => new THREE.Group(),
      createPreviewLineFromPoints: () => new THREE.Group(),
      createGroupedFaceMeshGroup: () => new THREE.Group(),
      createXraySolidFaceMeshGroup: () => new THREE.Group(),
      buildDisplayGeometry: () => new THREE.BufferGeometry(),
      buildFlatFaceColors: () => [],
      createWireframeFromGeometry: () => new THREE.Group(),
      createWireframeFromPositions,
      buildVisibleRidgeLineData: () => ({
        surfacePositions: [0, 0, 0, 1, 0, 0],
        occludedInteriorPositions: [0, 0, 0, 0, 1, 0],
      }),
      buildVisibleRidgeLinePositions: () => [],
      buildCrossCrystalIntersectionLinePositions: () => [],
      buildSharedSolidFaceColorMap: () => new Map(),
      buildSolidSharedFaceOverlayGroup: () => null,
      createXrayLineDepthMaskGroup: () => null,
      applyXrayPreviewMeshState: vi.fn(),
      buildFaceCenter: () => new THREE.Vector3(),
      buildAxisInnerSegment: () => null,
      buildAxisOuterSegments: () => [],
    });

    const group = actions.buildPreviewGroup();

    expect(group).toBeInstanceOf(THREE.Group);
    expect(createWireframeFromPositions).toHaveBeenCalledTimes(2);
    expect(group?.getObjectByName("preview-ridge-lines-surface")).toBeTruthy();
    expect(
      group?.getObjectByName("preview-ridge-lines-occluded-interior"),
    ).toBeTruthy();
  });

  it("稜線と交線の opacity 設定を line factory へ渡す", () => {
    const createWireframeFromPositions = vi.fn(() => new THREE.Group());
    const previewStyleSettings = createDefaultTwinPreviewStyleSettings();
    previewStyleSettings.ridgeLines.opacity = 0.37;
    previewStyleSettings.intersectionLines.opacity = 0.61;
    const actions = createTwinPreviewSceneActions({
      state: {
        parameters: {
          crystalSystem: "cubic",
          twin: {
            enabled: false,
            crystals: [{ enabled: true }, { enabled: true }],
          },
        },
        stlSplit: createDefaultTwinStlSplitSettings("cubic"),
        buildResult: {
          finalGeometry: new THREE.BufferGeometry(),
          crystalPreviewMeshData: [
            {
              vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
              ],
              faces: [
                {
                  id: "face-1",
                  normal: { x: 0, y: 0, z: 1 },
                  vertices: [
                    { x: 0, y: 0, z: 0 },
                    { x: 1, y: 0, z: 0 },
                    { x: 0, y: 1, z: 0 },
                  ],
                },
              ],
            },
          ],
        },
        previewRoot: null,
        activeFaceCrystalIndex: 0,
        axisGuideGroup: null,
        splitPlaneGuideGroup: null,
        twinRuleGuideGroup: null,
        facePickTargetGroup: null,
        facePickTargets: [],
        ridgeLines: null,
        intersectionRidgeLines: null,
        faceLabelAnchors: [],
        axisLabelAnchors: [],
        twinRuleLabelAnchors: [],
        faceDisplayMode: "grouped",
        previewStyleSettings,
        showRidgeLines: true,
        showIntersectionRidgeLines: true,
        showTwinRuleGuide: false,
        showSplitPlaneGuide: false,
        showAxisLinesInner: true,
        showAxisLinesOuter: true,
        showAxisLabels: true,
      },
      elements: {
        faceLabelLayer: document.createElement("div"),
      },
      getCrystalAccentColor: () => "#d35b53",
      isCrystalVisible: () => true,
      requestPreviewRender: vi.fn(),
      applyLabelLayerVisibility: vi.fn(),
      createAxisLabelAnchors: vi.fn().mockReturnValue([]),
      createFaceLabelAnchors: vi.fn().mockReturnValue([]),
      createWideLineFromPoints: () => new THREE.Group(),
      createPreviewLineFromPoints: () => new THREE.Group(),
      createGroupedFaceMeshGroup: () => new THREE.Group(),
      createXraySolidFaceMeshGroup: () => new THREE.Group(),
      buildDisplayGeometry: () => new THREE.BufferGeometry(),
      buildFlatFaceColors: () => [],
      createWireframeFromGeometry: () => new THREE.Group(),
      createWireframeFromPositions,
      buildVisibleRidgeLineData: () => ({
        surfacePositions: [0, 0, 0, 1, 0, 0],
        occludedInteriorPositions: [],
      }),
      buildVisibleRidgeLinePositions: () => [],
      buildCrossCrystalIntersectionLinePositions: () => [0, 0, 0, 0, 1, 0],
      buildSharedSolidFaceColorMap: () => new Map(),
      buildSolidSharedFaceOverlayGroup: () => null,
      createXrayLineDepthMaskGroup: () => null,
      applyXrayPreviewMeshState: vi.fn(),
      buildFaceCenter: () => new THREE.Vector3(),
      buildAxisInnerSegment: () => null,
      buildAxisOuterSegments: () => [],
    });

    actions.buildPreviewGroup();

    expect(createWireframeFromPositions).toHaveBeenCalledWith(
      [0, 0, 0, 1, 0, 0],
      expect.objectContaining({ opacity: 0.37, lineKind: "ridge" }),
    );

    const createIntersectionWireframeFromPositions = vi.fn(
      () => new THREE.Group(),
    );
    const intersectionActions = createTwinPreviewSceneActions({
      state: {
        parameters: {
          crystalSystem: "cubic",
          twin: {
            enabled: false,
            crystals: [{ enabled: true }, { enabled: true }],
          },
        },
        stlSplit: createDefaultTwinStlSplitSettings("cubic"),
        buildResult: {
          finalGeometry: new THREE.BufferGeometry(),
          crystalPreviewMeshData: [
            {
              vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
              ],
              faces: [
                {
                  id: "face-1",
                  normal: { x: 0, y: 0, z: 1 },
                  vertices: [
                    { x: 0, y: 0, z: 0 },
                    { x: 1, y: 0, z: 0 },
                    { x: 0, y: 1, z: 0 },
                  ],
                },
              ],
            },
            {
              vertices: [
                { x: 0, y: 0, z: 0 },
                { x: -1, y: 0, z: 0 },
                { x: 0, y: -1, z: 0 },
              ],
              faces: [
                {
                  id: "face-2",
                  normal: { x: 0, y: 0, z: 1 },
                  vertices: [
                    { x: 0, y: 0, z: 0 },
                    { x: -1, y: 0, z: 0 },
                    { x: 0, y: -1, z: 0 },
                  ],
                },
              ],
            },
          ],
        },
        previewRoot: null,
        activeFaceCrystalIndex: 0,
        axisGuideGroup: null,
        splitPlaneGuideGroup: null,
        twinRuleGuideGroup: null,
        facePickTargetGroup: null,
        facePickTargets: [],
        ridgeLines: null,
        intersectionRidgeLines: null,
        faceLabelAnchors: [],
        axisLabelAnchors: [],
        twinRuleLabelAnchors: [],
        faceDisplayMode: "grouped",
        previewStyleSettings,
        showRidgeLines: true,
        showIntersectionRidgeLines: true,
        showTwinRuleGuide: false,
        showSplitPlaneGuide: false,
        showAxisLinesInner: true,
        showAxisLinesOuter: true,
        showAxisLabels: true,
      },
      elements: {
        faceLabelLayer: document.createElement("div"),
      },
      getCrystalAccentColor: () => "#d35b53",
      isCrystalVisible: () => true,
      requestPreviewRender: vi.fn(),
      applyLabelLayerVisibility: vi.fn(),
      createAxisLabelAnchors: vi.fn().mockReturnValue([]),
      createFaceLabelAnchors: vi.fn().mockReturnValue([]),
      createWideLineFromPoints: () => new THREE.Group(),
      createPreviewLineFromPoints: () => new THREE.Group(),
      createGroupedFaceMeshGroup: () => new THREE.Group(),
      createXraySolidFaceMeshGroup: () => new THREE.Group(),
      buildDisplayGeometry: () => new THREE.BufferGeometry(),
      buildFlatFaceColors: () => [],
      createWireframeFromGeometry: () => new THREE.Group(),
      createWireframeFromPositions: createIntersectionWireframeFromPositions,
      buildVisibleRidgeLineData: () => ({
        surfacePositions: [],
        occludedInteriorPositions: [],
      }),
      buildVisibleRidgeLinePositions: () => [],
      buildCrossCrystalIntersectionLinePositions: () => [0, 0, 0, 0, 1, 0],
      buildSharedSolidFaceColorMap: () => new Map(),
      buildSolidSharedFaceOverlayGroup: () => null,
      createXrayLineDepthMaskGroup: () => null,
      applyXrayPreviewMeshState: vi.fn(),
      buildFaceCenter: () => new THREE.Vector3(),
      buildAxisInnerSegment: () => null,
      buildAxisOuterSegments: () => [],
    });

    intersectionActions.buildPreviewGroup();

    expect(createIntersectionWireframeFromPositions).toHaveBeenCalledWith(
      [0, 0, 0, 0, 1, 0],
      expect.objectContaining({ opacity: 0.61, lineKind: "intersection" }),
    );
  });

  it("分割面トグルが有効なときは split-plane-guides を scene graph に積む", () => {
    const actions = createTwinPreviewSceneActions({
      state: {
        parameters: {
          crystalSystem: "cubic",
          axes: { a: 1, b: 1, c: 1 },
          angles: { alpha: 90, beta: 90, gamma: 90 },
          twin: { enabled: false, crystals: [{ enabled: true }] },
        },
        stlSplit: {
          enabled: true,
          plane: { h: 1, k: 1, l: 1 },
        },
        buildResult: {
          crystalPreviewMeshData: [
            {
              vertices: [
                { x: -1, y: -1, z: 0 },
                { x: 1, y: -1, z: 0 },
                { x: 1, y: 1, z: 0 },
                { x: -1, y: 1, z: 0 },
              ],
              faces: [
                {
                  id: "face-1",
                  normal: { x: 0, y: 0, z: 1 },
                  vertices: [
                    { x: -1, y: -1, z: 0 },
                    { x: 1, y: -1, z: 0 },
                    { x: 1, y: 1, z: 0 },
                  ],
                },
              ],
            },
          ],
        },
        previewRoot: null,
        activeFaceCrystalIndex: 0,
        axisGuideGroup: null,
        splitPlaneGuideGroup: null,
        twinRuleGuideGroup: null,
        facePickTargetGroup: null,
        facePickTargets: [],
        ridgeLines: null,
        intersectionRidgeLines: null,
        faceLabelAnchors: [],
        axisLabelAnchors: [],
        twinRuleLabelAnchors: [],
        faceDisplayMode: "grouped",
        previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
        showRidgeLines: true,
        showIntersectionRidgeLines: true,
        showTwinRuleGuide: false,
        showSplitPlaneGuide: true,
        showAxisLinesInner: true,
        showAxisLinesOuter: true,
        showAxisLabels: true,
      },
      elements: {
        faceLabelLayer: document.createElement("div"),
      },
      getCrystalAccentColor: () => "#d35b53",
      isCrystalVisible: () => true,
      requestPreviewRender: vi.fn(),
      applyLabelLayerVisibility: vi.fn(),
      createAxisLabelAnchors: vi.fn().mockReturnValue([]),
      createFaceLabelAnchors: vi.fn().mockReturnValue([]),
      createWideLineFromPoints: () => new THREE.Group(),
      createPreviewLineFromPoints: () => new THREE.Group(),
      createGroupedFaceMeshGroup: () => new THREE.Group(),
      createXraySolidFaceMeshGroup: () => new THREE.Group(),
      buildDisplayGeometry: () => new THREE.BufferGeometry(),
      buildFlatFaceColors: () => [],
      createWireframeFromGeometry: () => new THREE.Group(),
      createWireframeFromPositions: () => new THREE.Group(),
      buildVisibleRidgeLineData: () => ({
        surfacePositions: [],
        occludedInteriorPositions: [],
      }),
      buildVisibleRidgeLinePositions: () => [],
      buildCrossCrystalIntersectionLinePositions: () => [],
      buildSharedSolidFaceColorMap: () => new Map(),
      buildSolidSharedFaceOverlayGroup: () => null,
      createXrayLineDepthMaskGroup: () => null,
      applyXrayPreviewMeshState: vi.fn(),
      buildFaceCenter: () => new THREE.Vector3(),
      buildAxisInnerSegment: () => null,
      buildAxisOuterSegments: () => [],
    });

    const group = actions.buildPreviewGroup();

    expect(group?.getObjectByName("split-plane-guides")).toBeTruthy();
  });
});
