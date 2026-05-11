import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createTwinPreviewControlActions } from "../../../src/preview/previewView.ts";

describe("preview/previewView", () => {
  it("fitPreviewToObject は bounds がある object を camera view に収める", () => {
    const stage = document.createElement("div");
    Object.defineProperty(stage, "clientWidth", { value: 320 });
    Object.defineProperty(stage, "clientHeight", { value: 240 });
    const camera = new THREE.PerspectiveCamera(45, 320 / 240, 0.1, 1000);
    camera.position.set(0, 0, 10);
    const controls = {
      target: new THREE.Vector3(),
      update: vi.fn(),
      reset: vi.fn(),
    };
    const previewRoot = new THREE.Group();
    previewRoot.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2)));

    const actions = createTwinPreviewControlActions({
      state: {
        previewRoot,
        previewViewState: null,
        faceLabelAnchors: [],
        facePickTargets: [],
        isPreviewDragging: false,
        previewDragButton: null,
        previewInertiaActive: false,
        faceDisplayMode: "solid",
      },
      elements: {
        canvas: document.createElement("canvas"),
        previewStage: stage,
        xrayFaceCanvas: null,
      },
      camera: camera as never,
      controls: controls as never,
      renderer: { domElement: document.createElement("canvas") } as never,
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
      previewHelperNames: new Set<string>(),
      orthoCameraDistance: 10,
      fitMargin: 1.2,
      initialPreviewZoomMultiplier: 1,
      requestPreviewRender: vi.fn(),
      requestPreviewOverlayUpdate: vi.fn(),
      syncFaceListToPreviewFace: vi.fn(),
      getPreviewAxisGuides: () => [],
      isCrystalVisible: () => true,
      updateWideLineResolutions: vi.fn(),
      shouldUseScreenSpaceXrayFaceOverlay: () => false,
    });

    actions.fitPreviewToObject(previewRoot);

    expect(camera.position.length()).toBeGreaterThan(0);
    expect(controls.update).toHaveBeenCalled();
  });

  it("fitPreviewToObject は offset 貫入双晶でも軸ガイドの交点を回転中心に使う", () => {
    const stage = document.createElement("div");
    Object.defineProperty(stage, "clientWidth", { value: 320 });
    Object.defineProperty(stage, "clientHeight", { value: 240 });
    const camera = new THREE.OrthographicCamera(
      -160,
      160,
      120,
      -120,
      0.1,
      1000,
    );
    const controls = {
      target: new THREE.Vector3(),
      update: vi.fn(),
      reset: vi.fn(),
      _target0: new THREE.Vector3(),
      _position0: new THREE.Vector3(),
      _up0: new THREE.Vector3(),
      _zoom0: 1,
      _lastPosition: new THREE.Vector3(),
      _lastZoom: 1,
      _eye: new THREE.Vector3(),
      _movePrev: new THREE.Vector2(),
      _moveCurr: new THREE.Vector2(),
      _zoomStart: new THREE.Vector2(),
      _zoomEnd: new THREE.Vector2(),
      _panStart: new THREE.Vector2(),
      _panEnd: new THREE.Vector2(),
      _lastAngle: 0,
      state: -1,
      keyState: -1,
    };
    const previewRoot = new THREE.Group();
    const shiftedMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    shiftedMesh.position.set(5, 0, 0);
    previewRoot.add(shiftedMesh);

    const actions = createTwinPreviewControlActions({
      state: {
        parameters: {
          twin: {
            crystals: [
              { enabled: true },
              {
                enabled: true,
                twinType: "penetration",
                offsets: [
                  {
                    kind: "axis",
                    basis: "twin-axis",
                    unit: "axis-plane-intercept",
                    amount: 1,
                  },
                ],
              },
            ],
          },
        },
        previewRoot,
        buildResult: null,
        previewViewState: null,
        faceLabelAnchors: [],
        facePickTargets: [],
        isPreviewDragging: false,
        previewDragButton: null,
        previewInertiaActive: false,
        faceDisplayMode: "solid",
      },
      elements: {
        canvas: document.createElement("canvas"),
        previewStage: stage,
        xrayFaceCanvas: null,
      },
      camera: camera as never,
      controls: controls as never,
      renderer: { domElement: document.createElement("canvas") } as never,
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
      previewHelperNames: new Set<string>(),
      orthoCameraDistance: 10,
      fitMargin: 1.2,
      initialPreviewZoomMultiplier: 1,
      requestPreviewRender: vi.fn(),
      requestPreviewOverlayUpdate: vi.fn(),
      syncFaceListToPreviewFace: vi.fn(),
      getPreviewAxisGuides: () => [
        {
          label: "a",
          start: { x: 0, y: 2, z: 3 },
          end: { x: 2, y: 2, z: 3 },
        },
        {
          label: "b",
          start: { x: 1, y: 1, z: 3 },
          end: { x: 1, y: 3, z: 3 },
        },
        {
          label: "c",
          start: { x: 1, y: 2, z: 2 },
          end: { x: 1, y: 2, z: 4 },
        },
      ],
      isCrystalVisible: () => true,
      updateWideLineResolutions: vi.fn(),
      shouldUseScreenSpaceXrayFaceOverlay: () => false,
    });

    actions.fitPreviewToObject(previewRoot);

    expect(controls.target.x).toBeCloseTo(1);
    expect(controls.target.y).toBeCloseTo(2);
    expect(controls.target.z).toBeCloseTo(3);
  });

  it("orientPreviewToAxis は offset 貫入双晶でも結晶1中心を回転中心に保つ", () => {
    const stage = document.createElement("div");
    Object.defineProperty(stage, "clientWidth", { value: 320 });
    Object.defineProperty(stage, "clientHeight", { value: 240 });
    const camera = new THREE.OrthographicCamera(
      -160,
      160,
      120,
      -120,
      0.1,
      1000,
    );
    camera.position.set(0, 0, 10);
    const controls = {
      target: new THREE.Vector3(),
      update: vi.fn(),
      reset: vi.fn(),
    };
    const previewRoot = new THREE.Group();
    const axisGuides = [
      {
        label: "a",
        start: { x: 0, y: 2, z: 3 },
        end: { x: 2, y: 2, z: 3 },
      },
      {
        label: "b",
        start: { x: 1, y: 1, z: 3 },
        end: { x: 1, y: 3, z: 3 },
      },
      {
        label: "c",
        start: { x: 1, y: 2, z: 2 },
        end: { x: 1, y: 2, z: 4 },
      },
    ];

    const actions = createTwinPreviewControlActions({
      state: {
        parameters: {
          twin: {
            crystals: [
              { enabled: true },
              {
                enabled: true,
                twinType: "penetration",
                offsets: [
                  {
                    kind: "axis",
                    basis: "twin-axis",
                    unit: "axis-plane-intercept",
                    amount: 1,
                  },
                ],
              },
            ],
          },
        },
        buildResult: {
          crystalPreviewMeshData: [
            {
              vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 2, y: 4, z: 6 },
              ],
            },
            {
              vertices: [
                { x: 20, y: 0, z: 0 },
                { x: 22, y: 4, z: 6 },
              ],
            },
          ],
        },
        previewRoot,
        previewViewState: null,
        faceLabelAnchors: [],
        facePickTargets: [],
        isPreviewDragging: false,
        previewDragButton: null,
        previewInertiaActive: false,
        faceDisplayMode: "solid",
      },
      elements: {
        canvas: document.createElement("canvas"),
        previewStage: stage,
        xrayFaceCanvas: null,
      },
      camera,
      controls: controls as never,
      renderer: { domElement: document.createElement("canvas") } as never,
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
      previewHelperNames: new Set<string>(),
      orthoCameraDistance: 10,
      fitMargin: 1.2,
      initialPreviewZoomMultiplier: 1,
      requestPreviewRender: vi.fn(),
      requestPreviewOverlayUpdate: vi.fn(),
      syncFaceListToPreviewFace: vi.fn(),
      getPreviewAxisGuides: () => axisGuides,
      isCrystalVisible: () => true,
      updateWideLineResolutions: vi.fn(),
      shouldUseScreenSpaceXrayFaceOverlay: () => false,
    });

    actions.orientPreviewToAxis("a");

    expect(controls.target.x).toBeCloseTo(1);
    expect(controls.target.y).toBeCloseTo(2);
    expect(controls.target.z).toBeCloseTo(3);
  });

  it("previewRoot が無いと reset は何もしない", () => {
    const actions = createTwinPreviewControlActions({
      state: {
        previewRoot: null,
        previewViewState: null,
        faceLabelAnchors: [],
        facePickTargets: [],
        isPreviewDragging: false,
        previewDragButton: null,
        previewInertiaActive: false,
        faceDisplayMode: "solid",
      },
      elements: {
        canvas: document.createElement("canvas"),
        previewStage: document.createElement("div"),
        xrayFaceCanvas: null,
      },
      camera: new THREE.OrthographicCamera(),
      controls: {
        target: new THREE.Vector3(),
        update: vi.fn(),
        reset: vi.fn(),
      } as never,
      renderer: { domElement: document.createElement("canvas") } as never,
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
      previewHelperNames: new Set<string>(),
      orthoCameraDistance: 10,
      fitMargin: 1.2,
      initialPreviewZoomMultiplier: 1,
      requestPreviewRender: vi.fn(),
      requestPreviewOverlayUpdate: vi.fn(),
      syncFaceListToPreviewFace: vi.fn(),
      getPreviewAxisGuides: () => [],
      isCrystalVisible: () => true,
      updateWideLineResolutions: vi.fn(),
      shouldUseScreenSpaceXrayFaceOverlay: () => false,
    });

    expect(() => actions.resetPreviewViewToFit()).not.toThrow();
  });
});
