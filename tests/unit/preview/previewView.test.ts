import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  createTwinPreviewControlActions,
  createTwinPreviewLifecycleActions,
  createTwinPreviewLightingActions,
} from "../../../src/preview/previewView.ts";

/**
 * preview/previewView の照明・lifecycle・controls 入口を確認する unit test。
 */
describe("preview/previewView", () => {
  it("createTwinPreviewLightingActions は正常系で light 色を白へ揃える", () => {
    const ambient = new THREE.AmbientLight(0x123456);
    const key = new THREE.DirectionalLight(0x654321);
    const fill = new THREE.DirectionalLight(0xff00ff);

    createTwinPreviewLightingActions({
      previewAmbientLight: ambient,
      previewKeyLight: key,
      previewFillLight: fill,
    }).applyPreviewLightingMode();

    expect(ambient.color.getHex()).toBe(0xffffff);
    expect(key.color.getHex()).toBe(0xffffff);
    expect(fill.color.getHex()).toBe(0xffffff);
  });

  it("createTwinPreviewLifecycleActions は group を root へ適用し、異常系の null group では state を reset する", () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    const context = {
      state: {
        parameters: { crystalSystem: "cubic" },
        buildResult: { basePreviewMeshData: null },
        previewRoot: root,
        axisGuideGroup: new THREE.Group(),
        twinRuleGuideGroup: new THREE.Group(),
        facePickTargetGroup: new THREE.Group(),
        facePickTargets: [new THREE.Group()],
        ridgeLines: new THREE.Group(),
        axisLabelAnchors: [1],
        twinRuleLabelAnchors: [1],
        previewModelQuaternion: null,
        previewModelSystem: null,
        previewViewState: null,
      },
      scene,
      elements: {
        faceLabelLayer: document.createElement("div"),
      },
      initialBAxisRotationRad: 0,
      initialCAxisRotationRad: 0,
      fitPreviewToObject: vi.fn(),
      capturePreviewViewState: vi.fn().mockReturnValue({
        position: new THREE.Vector3(),
        target: new THREE.Vector3(),
        zoom: 1,
        up: new THREE.Vector3(0, 1, 0),
      }),
      renderAxisViewButtons: vi.fn(),
      requestPreviewOverlayUpdate: vi.fn(),
      requestPreviewRender: vi.fn(),
    };
    scene.add(root);
    const actions = createTwinPreviewLifecycleActions(context);

    const group = new THREE.Group();
    group.add(new THREE.Group());
    const result = actions.applyPreviewGroup(group);
    expect(result.hadPreviewRoot).toBe(true);
    expect(root.children.length).toBe(1);

    actions.applyPreviewGroup(null);
    expect(context.state.facePickTargets).toEqual([]);
    expect(context.state.ridgeLines).toBeNull();
    expect(context.state.axisLabelAnchors).toEqual([]);
  });

  it.each(["monoclinic", "triclinic"] as const)(
    "%s の初期姿勢では c 軸が +Y 方向へ揃う",
    (crystalSystem) => {
      const scene = new THREE.Scene();
      const root = new THREE.Group();
      const context = {
        state: {
          parameters: { crystalSystem },
          buildResult: {
            basePreviewMeshData: {
              axisGuides: [
                {
                  label: "a",
                  start: { x: 0, y: 0, z: 0 },
                  end: { x: 1, y: 0, z: 0 },
                },
                {
                  label: "b",
                  start: { x: 0, y: 0, z: 0 },
                  end: { x: 0.2, y: 1, z: 0.1 },
                },
                {
                  label: "c",
                  start: { x: 0, y: 0, z: 0 },
                  end: { x: 0, y: 2, z: 1 },
                },
              ],
            },
          },
          previewRoot: root,
          axisGuideGroup: null,
          twinRuleGuideGroup: null,
          facePickTargetGroup: null,
          facePickTargets: [],
          ridgeLines: null,
          axisLabelAnchors: [],
          twinRuleLabelAnchors: [],
          previewModelQuaternion: null,
          previewModelSystem: null,
          previewViewState: null,
        },
        scene,
        elements: {
          faceLabelLayer: document.createElement("div"),
        },
        initialBAxisRotationRad: 0,
        initialCAxisRotationRad: 0,
        fitPreviewToObject: vi.fn(),
        capturePreviewViewState: vi.fn().mockReturnValue({
          position: new THREE.Vector3(),
          target: new THREE.Vector3(),
          zoom: 1,
          up: new THREE.Vector3(0, 1, 0),
        }),
        renderAxisViewButtons: vi.fn(),
        requestPreviewOverlayUpdate: vi.fn(),
        requestPreviewRender: vi.fn(),
      };
      scene.add(root);
      const actions = createTwinPreviewLifecycleActions(context);
      const group = new THREE.Group();
      group.add(new THREE.Group());

      actions.applyPreviewGroup(group);

      const transformedCDirection = new THREE.Vector3(0, 2, 1)
        .normalize()
        .applyQuaternion(root.quaternion)
        .normalize();

      expect(Math.abs(transformedCDirection.x)).toBeLessThan(1e-6);
      expect(Math.abs(transformedCDirection.z)).toBeLessThan(1e-6);
      expect(transformedCDirection.y).toBeGreaterThan(0.999999);
    },
  );

  it("createTwinPreviewControlActions は正常系で view state を取得し、異常系の reset でも例外にしない", () => {
    document.body.innerHTML = `
      <div id="stage"></div>
      <canvas id="canvas"></canvas>
    `;
    const stage = document.querySelector("#stage") as HTMLElement;
    Object.defineProperty(stage, "clientWidth", {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(stage, "clientHeight", {
      value: 300,
      configurable: true,
    });
    const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
    canvas.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const camera = new THREE.OrthographicCamera(
      -200,
      200,
      150,
      -150,
      0.1,
      1000,
    );
    camera.position.set(0, 0, 10);
    const renderer = {
      setSize: vi.fn(),
    } as unknown as THREE.WebGLRenderer;
    const controls = {
      target: new THREE.Vector3(),
      _target0: new THREE.Vector3(),
      _position0: new THREE.Vector3(),
      _up0: new THREE.Vector3(),
      _zoom0: 1,
      _lastPosition: new THREE.Vector3(),
      _lastZoom: 1,
      _eye: new THREE.Vector3(),
      _movePrev: new THREE.Vector2(1, 2),
      _moveCurr: new THREE.Vector2(3, 4),
      _zoomStart: new THREE.Vector2(5, 6),
      _zoomEnd: new THREE.Vector2(7, 8),
      _panStart: new THREE.Vector2(9, 10),
      _panEnd: new THREE.Vector2(11, 12),
      _lastAngle: 0.5,
      state: 1,
      keyState: 1,
      handleResize: vi.fn(),
      update: vi.fn(),
    } as never;

    const actions = createTwinPreviewControlActions({
      state: {
        parameters: { crystals: [{ enabled: true }] },
        buildResult: null,
        previewRoot: new THREE.Group(),
        previewViewState: null,
        facePickTargets: [],
        isPreviewDragging: false,
        previewDragButton: null,
        previewInertiaActive: false,
        faceDisplayMode: "grouped",
      },
      elements: {
        canvas,
        previewStage: stage,
        xrayFaceCanvas: document.createElement("canvas"),
      },
      camera,
      controls,
      renderer,
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
      shouldUseScreenSpaceXrayFaceOverlay: () => false,
      isCrystalVisible: () => true,
      updateWideLineResolutions: vi.fn(),
    });

    const viewState = actions.capturePreviewViewState();
    expect(viewState.position).toBeInstanceOf(THREE.Vector3);
    expect(viewState.target).toBeInstanceOf(THREE.Vector3);
    expect(viewState.zoom).toBe(1);

    expect(() => actions.resetPreviewViewToFit()).not.toThrow();
    expect(() => actions.resizeRenderer()).not.toThrow();
    expect(controls._target0.equals(controls.target)).toBe(true);
    expect(controls._position0.equals(camera.position)).toBe(true);
    expect(controls._up0.equals(camera.up)).toBe(true);
    expect(controls._zoom0).toBe(camera.zoom);
    expect(controls._movePrev.equals(controls._moveCurr)).toBe(true);
    expect(controls._zoomStart.equals(controls._zoomEnd)).toBe(true);
    expect(controls._panStart.equals(controls._panEnd)).toBe(true);
    expect(controls._lastAngle).toBe(0);
    expect(controls.state).toBe(-1);
    expect(controls.keyState).toBe(-1);
  });
});
