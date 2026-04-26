import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeferredTrackballControls } from "../../../src/preview/deferredTrackballControls.ts";

describe("preview/deferredTrackballControls", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("load 前は proxy が no-op で動き、target を保持する", () => {
    const camera = new THREE.OrthographicCamera();
    const canvas = document.createElement("canvas");
    const { controls } = createDeferredTrackballControls(camera, canvas);

    controls.target.set(1, 2, 3);

    expect(() => controls.update()).not.toThrow();
    expect(() => controls.handleResize()).not.toThrow();
    expect(controls.target.toArray()).toEqual([1, 2, 3]);
  });

  it("load 後は設定と listener を real controls へ引き継ぐ", async () => {
    const camera = new THREE.OrthographicCamera();
    const canvas = document.createElement("canvas");
    const addEventListener = vi.fn();
    const update = vi.fn();
    const handleResize = vi.fn();
    const realControls = {
      target: new THREE.Vector3(),
      enabled: true,
      rotateSpeed: 0,
      zoomSpeed: 0,
      panSpeed: 0,
      dynamicDampingFactor: 0,
      staticMoving: true,
      addEventListener,
      removeEventListener: vi.fn(),
      update,
      handleResize,
    };

    vi.doMock("three/addons/controls/TrackballControls.js", () => ({
      TrackballControls: class {
        constructor() {
          return realControls;
        }
      },
    }));

    const { controls, loadRealTrackballControls } =
      createDeferredTrackballControls(camera, canvas);
    const onChange = vi.fn();
    controls.target.set(4, 5, 6);
    controls.rotateSpeed = 7;
    controls.panSpeed = 8;
    controls.addEventListener("change", onChange);

    const loaded = await loadRealTrackballControls();
    loaded.update();
    loaded.handleResize();

    expect(loaded).toBe(realControls);
    expect(realControls.target.toArray()).toEqual([4, 5, 6]);
    expect(realControls.rotateSpeed).toBe(7);
    expect(realControls.panSpeed).toBe(8);
    expect(addEventListener).toHaveBeenCalledWith("change", onChange);
    expect(update).toHaveBeenCalled();
    expect(handleResize).toHaveBeenCalled();
  });

  it("load 後の target 変更は proxy と real controls で同じ Vector3 を共有する", async () => {
    const camera = new THREE.OrthographicCamera();
    const canvas = document.createElement("canvas");
    const realControls = {
      target: new THREE.Vector3(),
      enabled: true,
      rotateSpeed: 0,
      zoomSpeed: 0,
      panSpeed: 0,
      dynamicDampingFactor: 0,
      staticMoving: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      update: vi.fn(),
      handleResize: vi.fn(),
    };

    vi.doMock("three/addons/controls/TrackballControls.js", () => ({
      TrackballControls: class {
        constructor() {
          return realControls;
        }
      },
    }));

    const { controls, loadRealTrackballControls } =
      createDeferredTrackballControls(camera, canvas);

    await loadRealTrackballControls();
    controls.target.set(7, 8, 9);

    expect(realControls.target).toBe(controls.target);
    expect(realControls.target.toArray()).toEqual([7, 8, 9]);
  });

  it("load 後の property 更新も real controls へ反映される", async () => {
    const camera = new THREE.OrthographicCamera();
    const canvas = document.createElement("canvas");
    const realControls = {
      target: new THREE.Vector3(),
      enabled: true,
      rotateSpeed: 0,
      zoomSpeed: 0,
      panSpeed: 0,
      dynamicDampingFactor: 0,
      staticMoving: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      update: vi.fn(),
      handleResize: vi.fn(),
    };

    vi.doMock("three/addons/controls/TrackballControls.js", () => ({
      TrackballControls: class {
        constructor() {
          return realControls;
        }
      },
    }));

    const { controls, loadRealTrackballControls } =
      createDeferredTrackballControls(camera, canvas);

    await loadRealTrackballControls();

    controls.staticMoving = false;
    controls.dynamicDampingFactor = 0.12;
    controls.rotateSpeed = 4;

    expect(realControls.staticMoving).toBe(false);
    expect(realControls.dynamicDampingFactor).toBe(0.12);
    expect(realControls.rotateSpeed).toBe(4);
  });

  it("touch の2本指操作では pan 差分を残さない", async () => {
    const camera = new THREE.OrthographicCamera();
    const canvas = document.createElement("canvas");
    const realControls = {
      target: new THREE.Vector3(),
      enabled: true,
      rotateSpeed: 0,
      zoomSpeed: 0,
      panSpeed: 0,
      dynamicDampingFactor: 0,
      staticMoving: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      update: vi.fn(),
      handleResize: vi.fn(),
      _pointers: [{ pointerId: 21 }, { pointerId: 22 }],
      _panStart: new THREE.Vector2(1, 2),
      _panEnd: new THREE.Vector2(5, 6),
      _onTouchStart: vi.fn(() => {
        realControls._panStart.set(3, 4);
        realControls._panEnd.set(3, 4);
      }),
      _onTouchMove: vi.fn(() => {
        realControls._panEnd.set(9, 10);
      }),
      _onTouchEnd: vi.fn(),
    };

    vi.doMock("three/addons/controls/TrackballControls.js", () => ({
      TrackballControls: class {
        constructor() {
          return realControls;
        }
      },
    }));

    const { loadRealTrackballControls } = createDeferredTrackballControls(
      camera,
      canvas,
    );

    const loaded =
      (await loadRealTrackballControls()) as typeof realControls & {
        _onTouchStart: (event: PointerEvent) => void;
        _onTouchMove: (event: PointerEvent) => void;
      };

    loaded._onTouchStart({ pointerType: "touch" } as PointerEvent);
    loaded._onTouchMove({ pointerType: "touch" } as PointerEvent);

    expect(realControls._panStart.toArray()).toEqual([3, 4]);
    expect(realControls._panEnd.toArray()).toEqual([3, 4]);
  });

  it("2本指操作のあと1本だけ残った時は touch rotate 状態へ戻す", async () => {
    const camera = new THREE.OrthographicCamera();
    const canvas = document.createElement("canvas");
    const realControls = {
      target: new THREE.Vector3(),
      enabled: true,
      rotateSpeed: 0,
      zoomSpeed: 0,
      panSpeed: 0,
      dynamicDampingFactor: 0,
      staticMoving: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      update: vi.fn(),
      handleResize: vi.fn(),
      state: 4,
      _pointers: [{ pointerId: 11 }, { pointerId: 12 }],
      _pointerPositions: {
        11: { x: 40, y: 60 },
      },
      _moveCurr: new THREE.Vector2(),
      _movePrev: new THREE.Vector2(),
      _panStart: new THREE.Vector2(1, 2),
      _panEnd: new THREE.Vector2(3, 4),
      _zoomStart: new THREE.Vector2(5, 6),
      _zoomEnd: new THREE.Vector2(7, 8),
      _getMouseOnCircle: vi.fn(() => new THREE.Vector2(0.25, 0.75)),
      _onTouchEnd: vi.fn(),
    };

    vi.doMock("three/addons/controls/TrackballControls.js", () => ({
      TrackballControls: class {
        constructor() {
          return realControls;
        }
      },
    }));

    const { loadRealTrackballControls } = createDeferredTrackballControls(
      camera,
      canvas,
    );

    const loaded =
      (await loadRealTrackballControls()) as typeof realControls & {
        _onTouchEnd: (event: PointerEvent) => void;
      };

    loaded._onTouchEnd({ pointerId: 12 } as PointerEvent);
    realControls._pointers = [{ pointerId: 11 }];

    await Promise.resolve();

    expect(realControls.state).toBe(3);
    expect(realControls._moveCurr.toArray()).toEqual([0.25, 0.75]);
    expect(realControls._movePrev.toArray()).toEqual([0.25, 0.75]);
    expect(realControls._panStart.toArray()).toEqual([3, 4]);
    expect(realControls._zoomStart.toArray()).toEqual([7, 8]);
  });
});
