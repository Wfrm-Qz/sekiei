import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createTwinPreviewGeometryActions } from "../../../src/preview/previewGeometry.ts";
import { createDefaultTwinPreviewStyleSettings } from "../../../src/preview/previewStyleSettings.ts";

/**
 * preview/previewGeometry の preview 用幾何 helper を確認する unit test。
 */
describe("preview/previewGeometry", () => {
  function createActions(
    faceDisplayMode = "solid",
    previewStyleSettings = createDefaultTwinPreviewStyleSettings(),
  ) {
    return createTwinPreviewGeometryActions({
      state: {
        faceDisplayMode,
        previewStyleSettings,
        parameters: {
          crystalSystem: "cubic",
        },
      },
      getCrystalAccentColor: () => "#d35b53",
      createWireframeFromPositionAttribute: (positionAttribute) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", positionAttribute);
        return new THREE.LineSegments(
          geometry,
          new THREE.LineBasicMaterial({ color: 0xffffff }),
        );
      },
    });
  }

  it("buildFaceCenter / buildPlaneBasis / projectFaceVerticesToPlane は正常系で幾何計算でき、空頂点では原点へ fallback する", () => {
    const actions = createActions();
    const center = actions.buildFaceCenter([
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 0, y: 2, z: 0 },
    ]);
    expect(center.toArray()).toEqual([2 / 3, 2 / 3, 0]);
    expect(actions.buildFaceCenter([]).toArray()).toEqual([0, 0, 0]);

    const { tangent, bitangent } = actions.buildPlaneBasis(
      new THREE.Vector3(0, 0, 1),
    );
    expect(Math.abs(tangent.dot(new THREE.Vector3(0, 0, 1)))).toBeLessThan(
      1e-6,
    );
    expect(Math.abs(bitangent.dot(new THREE.Vector3(0, 0, 1)))).toBeLessThan(
      1e-6,
    );

    const projected = actions.projectFaceVerticesToPlane(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      new THREE.Vector3(0, 0, 0),
      tangent,
      bitangent,
    );
    expect(projected).toHaveLength(2);
    expect(projected[0]).toEqual({ x: 0, y: 0 });
  });

  it("buildFlatFaceColors / buildPreviewFaceColors は正常系で per-vertex color を作り、異常系寄りの grouped 以外では空配列も返す", () => {
    const actions = createActions("solid");
    const meshData = {
      faceVertexCounts: [
        { id: "face-1", vertexCount: 3 },
        { id: "face-2", vertexCount: 6 },
      ],
    };
    const flatColors = actions.buildFlatFaceColors(meshData, "#ff0000");
    expect(flatColors).toHaveLength(27);

    const previewColors = actions.buildPreviewFaceColors(
      meshData,
      [{ id: "face-1", h: 1, k: 0, l: 0 }],
      {
        faceColorHexByFaceId: new Map([["1:face-1", "#00ff00"]]),
        crystalIndex: 1,
      },
    );
    expect(previewColors).toHaveLength(27);

    const groupedActions = createActions("grouped");
    expect(
      groupedActions.buildPreviewFaceColors(meshData, [{ id: "face-1" }]),
    ).toHaveLength(27);

    const solidActions = createActions("solid");
    expect(
      solidActions.buildPreviewFaceColors(meshData, [{ id: "face-1" }]),
    ).toEqual([]);

    const solidSharedColors = solidActions.buildPreviewFaceColors(
      meshData,
      [{ id: "face-1" }, { id: "face-2" }],
      {
        faceColorHexByFaceId: new Map([["1:face-1", "#00ff00"]]),
        crystalIndex: 1,
        crystalAccentColor: "#d35b53",
      },
    );
    expect(solidSharedColors).toHaveLength(27);
    expect(solidSharedColors.slice(0, 3)).toEqual([0, 1, 0]);
    const accentColor = new THREE.Color("#d35b53");
    expect(solidSharedColors.slice(9, 12)).toEqual([
      accentColor.r,
      accentColor.g,
      accentColor.b,
    ]);
  });

  it("buildDisplayGeometry / createWireframeFromGeometry は geometry を返し、空 meshData では null になる", () => {
    const actions = createActions();
    const geometry = actions.buildDisplayGeometry(
      {
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        faceVertexCounts: [{ id: "face-1", vertexCount: 3 }],
      },
      [{ id: "face-1" }],
    );
    expect(geometry).toBeInstanceOf(THREE.BufferGeometry);

    const wireframe = actions.createWireframeFromGeometry(geometry!);
    expect(wireframe).toBeInstanceOf(THREE.Object3D);

    expect(actions.buildDisplayGeometry(null, [])).toBeNull();
  });

  it("isPointInsideConvexFace3D / collectAxisSurfaceIntersectionParameters は正常系で交差を検出し、異常系では空になる", () => {
    const actions = createActions();
    const vertices = [
      { x: -1, y: -1, z: 0 },
      { x: 1, y: -1, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: -1, y: 1, z: 0 },
    ];
    const normal = new THREE.Vector3(0, 0, 1);

    expect(
      actions.isPointInsideConvexFace3D(
        new THREE.Vector3(0, 0, 0),
        vertices,
        normal,
      ),
    ).toBe(true);
    expect(
      actions.isPointInsideConvexFace3D(
        new THREE.Vector3(3, 0, 0),
        vertices,
        normal,
      ),
    ).toBe(false);

    const hits = actions.collectAxisSurfaceIntersectionParameters(
      {
        start: { x: 0, y: 0, z: -2 },
        end: { x: 0, y: 0, z: 2 },
      },
      [{ vertices, normal: { x: 0, y: 0, z: 1 } }],
    );
    expect(hits).toHaveLength(1);
    expect(actions.collectAxisSurfaceIntersectionParameters({}, [])).toEqual(
      [],
    );
  });

  it("buildAxisOuterSegments / buildAxisInnerSegment は正常系で clip された segment を返し、異常系では null / 空配列になる", () => {
    const actions = createActions();
    const lowerClipFace = {
      vertices: [
        { x: -1, y: -1, z: -1 },
        { x: 1, y: -1, z: -1 },
        { x: 1, y: 1, z: -1 },
        { x: -1, y: 1, z: -1 },
      ],
      normal: { x: 0, y: 0, z: 1 },
    };
    const upperClipFace = {
      vertices: [
        { x: -1, y: -1, z: 1 },
        { x: 1, y: -1, z: 1 },
        { x: 1, y: 1, z: 1 },
        { x: -1, y: 1, z: 1 },
      ],
      normal: { x: 0, y: 0, z: 1 },
    };
    const axis = {
      start: { x: 0, y: 0, z: -2 },
      end: { x: 0, y: 0, z: 2 },
    };

    const inner = actions.buildAxisInnerSegment(axis, [
      lowerClipFace,
      upperClipFace,
    ]);
    expect(inner).not.toBeNull();
    expect(inner!.start.z).toBeGreaterThan(-2);
    expect(inner!.end.z).toBeLessThan(2);

    const outer = actions.buildAxisOuterSegments(axis, [
      lowerClipFace,
      upperClipFace,
    ]);
    expect(outer.length).toBeGreaterThan(0);
    expect(actions.buildAxisInnerSegment({}, [])).toBeNull();
    expect(actions.buildAxisOuterSegments({}, [])).toEqual([]);
  });

  it("shared-face 系 helper は正常系で overlay/group map を作り、異常系寄りの単独結晶では空になる", () => {
    const actions = createActions();
    const visibleEntries = [
      {
        index: 0,
        meshData: {
          faces: [
            {
              id: "base-face",
              normal: { x: 0, y: 0, z: 1 },
              vertices: [
                { x: -1, y: -1, z: 0 },
                { x: 1, y: -1, z: 0 },
                { x: 1, y: 1, z: 0 },
                { x: -1, y: 1, z: 0 },
              ],
            },
          ],
        },
      },
      {
        index: 1,
        meshData: {
          faces: [
            {
              id: "derived-face",
              normal: { x: 0, y: 0, z: 1 },
              vertices: [
                { x: -1, y: -1, z: 0 },
                { x: 1, y: -1, z: 0 },
                { x: 1, y: 1, z: 0 },
                { x: -1, y: 1, z: 0 },
              ],
            },
          ],
        },
      },
    ];

    const colorMap = actions.buildSharedSolidFaceColorMap(visibleEntries);
    expect(colorMap.get("0:base-face")).toMatch(/^#/);
    expect(colorMap.get("1:derived-face")).toMatch(/^#/);

    const overlay = actions.buildSolidSharedFaceOverlayGroup(visibleEntries);
    expect(overlay).not.toBeNull();
    expect(overlay!.children.length).toBeGreaterThan(0);

    expect(actions.buildSharedSolidFaceColorMap([visibleEntries[0]])).toEqual(
      new Map(),
    );
    expect(
      actions.buildSolidSharedFaceOverlayGroup([visibleEntries[0]]),
    ).toBeNull();
  });

  it("shared solid face color map は face id だけではなく crystal index ごとに分離して保持する", () => {
    const actions = createActions();
    const visibleEntries = [
      {
        index: 0,
        meshData: {
          faces: [
            {
              id: "shared-face",
              normal: { x: 0, y: 0, z: 1 },
              vertices: [
                { x: -1, y: -1, z: 0 },
                { x: 1, y: -1, z: 0 },
                { x: 1, y: 1, z: 0 },
                { x: -1, y: 1, z: 0 },
              ],
            },
          ],
        },
      },
      {
        index: 1,
        meshData: {
          faces: [
            {
              id: "shared-face",
              normal: { x: 0, y: 0, z: 1 },
              vertices: [
                { x: -1, y: -1, z: 0 },
                { x: 1, y: -1, z: 0 },
                { x: 1, y: 1, z: 0 },
                { x: -1, y: 1, z: 0 },
              ],
            },
          ],
        },
      },
    ];

    const colorMap = actions.buildSharedSolidFaceColorMap(visibleEntries);
    expect(colorMap.has("shared-face")).toBe(false);
    expect(colorMap.get("0:shared-face")).toMatch(/^#/);
    expect(colorMap.get("1:shared-face")).toMatch(/^#/);
  });

  it("grouped mesh helper は triangulated geometry を使い、xray-solid helper も Object3D を返す", () => {
    const groupedActions = createActions("grouped");
    const meshData = {
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, -1, 0, 0],
      faceVertexCounts: [{ id: "face-1", vertexCount: 6 }],
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
    };
    const grouped = groupedActions.createGroupedFaceMeshGroup(
      meshData,
      "source",
      [{ id: "face-1", coefficient: 1 }],
    );
    expect(grouped).toBeInstanceOf(THREE.Group);
    expect(grouped.children).toHaveLength(1);
    const groupedMesh = grouped.children[0] as THREE.Mesh;
    expect(groupedMesh.geometry.getAttribute("position").count).toBe(6);

    const xrayActions = createActions("xray-grouped");
    const xrayGrouped = xrayActions.createGroupedFaceMeshGroup(
      meshData,
      "source",
      [{ id: "face-1", coefficient: 1 }],
    );
    expect(xrayGrouped).toBeInstanceOf(THREE.Group);

    const xraySolid = xrayActions.createXraySolidFaceMeshGroup(
      meshData,
      "source",
      1,
      true,
    );
    expect(xraySolid).toBeInstanceOf(THREE.Group);
  });

  it("custom profile の面属性は grouped/xray-solid の component build に反映される", () => {
    const styleSettings = createDefaultTwinPreviewStyleSettings();
    const meshData = {
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
    };

    styleSettings.customFaceProfile = {
      ...styleSettings.customFaceProfile,
      surfaceStyle: "grouped",
      componentBuildMode: "grouped-face-group",
      materialKind: "basic",
      usesLighting: false,
      depthWrite: false,
      usePolygonOffset: false,
      baseColorMode: "solid-default",
      groupedFaceComponentOpacity: 0.33,
      usesFaceGroupPalette: false,
    };
    const groupedActions = createActions("custom", styleSettings);
    const grouped = groupedActions.createGroupedFaceMeshGroup(
      meshData,
      "custom-grouped",
      [{ id: "face-1", coefficient: 1 }],
    );
    const groupedMesh = grouped.children[0] as THREE.Mesh;
    expect(groupedMesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect((groupedMesh.material as THREE.MeshBasicMaterial).opacity).toBe(
      0.33,
    );
    expect((groupedMesh.material as THREE.MeshBasicMaterial).depthWrite).toBe(
      false,
    );

    styleSettings.customFaceProfile = {
      ...styleSettings.customFaceProfile,
      surfaceStyle: "xray-solid",
      componentBuildMode: "xray-solid-face-group",
      materialKind: "physical",
      usesLighting: true,
      usesScreenSpaceFaceOverlay: false,
      baseColorMode: "solid-default",
      opacityWhenHasFinal: 0.41,
      depthWrite: true,
      usePolygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 3,
    };
    const xrayActions = createActions("custom", styleSettings);
    const xraySolid = xrayActions.createXraySolidFaceMeshGroup(
      meshData,
      "custom-xray-solid",
      0,
      true,
    );
    const xrayMesh = xraySolid.children[0] as THREE.Mesh;
    expect(xrayMesh.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect((xrayMesh.material as THREE.MeshPhysicalMaterial).opacity).toBe(
      0.41,
    );
    expect(
      (xrayMesh.material as THREE.MeshPhysicalMaterial).polygonOffsetFactor,
    ).toBe(2);
    expect(
      (xrayMesh.material as THREE.MeshPhysicalMaterial).polygonOffsetUnits,
    ).toBe(3);
  });
});
