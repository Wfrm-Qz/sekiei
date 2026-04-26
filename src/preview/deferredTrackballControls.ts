import * as THREE from "three";
import type { TrackballControls } from "three/addons/controls/TrackballControls.js";

/**
 * TrackballControls を遅延読込しつつ、起動直後は軽量 proxy で受ける。
 *
 * 初期表示の bundle から controls 実装を外したい一方で、entry / preview 側は
 * `controls.target` や `addEventListener("change")` へ早い段階で依存する。
 * そのため、必要な surface API だけを持つ proxy を先に返し、実体は後から差し替える。
 */

type TrackballControlsModule =
  typeof import("three/addons/controls/TrackballControls.js");

type DeferredListener = (event: { type: string; target?: unknown }) => void;

interface DeferredTrackballControlsResult {
  controls: TrackballControls;
  loadRealTrackballControls: () => Promise<TrackballControls>;
}

const TRACKBALL_STATE_NONE = -1;
const TRACKBALL_STATE_TOUCH_ROTATE = 3;
const TRACKBALL_STATE_TOUCH_ZOOM_PAN = 4;

interface TrackballTouchPointerLike {
  pointerId: number;
}

interface TrackballPointerPositionLike {
  x: number;
  y: number;
}

interface TrackballControlsTouchInternalLike extends TrackballControls {
  state?: number;
  _pointers?: TrackballTouchPointerLike[];
  _pointerPositions?: Record<number, TrackballPointerPositionLike>;
  _moveCurr?: THREE.Vector2;
  _movePrev?: THREE.Vector2;
  _panStart?: THREE.Vector2;
  _panEnd?: THREE.Vector2;
  _zoomStart?: THREE.Vector2;
  _zoomEnd?: THREE.Vector2;
  _getMouseOnCircle?: (pageX: number, pageY: number) => THREE.Vector2;
  _onTouchStart?: (event: PointerEvent) => void;
  _onTouchMove?: (event: PointerEvent) => void;
  _onTouchEnd?: (event: PointerEvent) => void;
  _sekieiTouchEndFixInstalled?: boolean;
}

/** TrackballControls へ渡している公開設定だけを proxy に持たせる。 */
interface DeferredControlsShape {
  target: THREE.Vector3;
  enabled: boolean;
  rotateSpeed: number;
  zoomSpeed: number;
  panSpeed: number;
  dynamicDampingFactor: number;
  staticMoving: boolean;
  addEventListener: (type: string, listener: DeferredListener) => void;
  removeEventListener: (type: string, listener: DeferredListener) => void;
  update: () => void;
  handleResize: () => void;
}

/** TrackballControls の proxy と lazy loader を返す。 */
export function createDeferredTrackballControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): DeferredTrackballControlsResult {
  let realControls: TrackballControls | null = null;
  let controlsModulePromise: Promise<TrackballControlsModule> | null = null;
  let realControlsPromise: Promise<TrackballControls> | null = null;
  const listeners = new Map<string, Set<DeferredListener>>();
  const target = new THREE.Vector3();

  const proxyState: DeferredControlsShape = {
    target,
    enabled: true,
    rotateSpeed: 1,
    zoomSpeed: 1.2,
    panSpeed: 1,
    dynamicDampingFactor: 0.2,
    staticMoving: true,
    addEventListener(type, listener) {
      const bucket = listeners.get(type) ?? new Set<DeferredListener>();
      bucket.add(listener);
      listeners.set(type, bucket);
      realControls?.addEventListener(type, listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
      realControls?.removeEventListener(type, listener);
    },
    update() {
      realControls?.update();
    },
    handleResize() {
      realControls?.handleResize();
    },
  };

  /**
   * 遅延前後で同じ controls 参照を保ちつつ、property write は常に最新実体へ流す。
   *
   * 以前は plain object を TrackballControls として返していたため、lazy load 後の
   * `controls.staticMoving = false` のような更新が proxy 側にだけ残り、実体へ届かなかった。
   * 回転慣性の on/off を UI から切り替えた時に効かなくなっていた本体はここ。
   */
  const proxy = new Proxy(proxyState, {
    get(targetState, property, receiver) {
      return Reflect.get(targetState, property, receiver);
    },
    set(targetState, property, value, receiver) {
      const updated = Reflect.set(targetState, property, value, receiver);
      if (realControls && property in realControls) {
        Reflect.set(
          realControls as Record<PropertyKey, unknown>,
          property,
          value,
        );
      }
      return updated;
    },
  });

  function replayListeners(controls: TrackballControls) {
    listeners.forEach((bucket, type) => {
      bucket.forEach((listener) => controls.addEventListener(type, listener));
    });
  }

  function syncProxyStateToRealControls(controls: TrackballControls) {
    controls.enabled = proxyState.enabled;
    controls.rotateSpeed = proxyState.rotateSpeed;
    controls.zoomSpeed = proxyState.zoomSpeed;
    controls.panSpeed = proxyState.panSpeed;
    controls.dynamicDampingFactor = proxyState.dynamicDampingFactor;
    controls.staticMoving = proxyState.staticMoving;
    // proxy と real controls で同じ Vector3 を共有しないと、
    // `controls.target.copy(...)` が proxy 側だけを書き換えて
    // 実体の回転中心がずれる。
    controls.target = proxyState.target;
  }

  /**
   * 2本指操作のあと1本指へ戻る瞬間に、TrackballControls の内部 state が
   * `TOUCH_ZOOM_PAN` のまま残ることがある。
   *
   * そのままだと次の1本指 move でも pan/zoom 系の差分を引きずり、
   * スマホで「回転中心がずれた」ように見えやすい。
   * ここでは touch end 後の残 pointer 数を見て、1本だけ残る場合は
   * 回転モードへ戻し、move 系ベクトルも残 pointer 位置へ揃え直す。
   */
  function installTouchTransitionFix(controls: TrackballControls) {
    const internalControls = controls as TrackballControlsTouchInternalLike;
    if (
      internalControls._sekieiTouchEndFixInstalled ||
      typeof internalControls._onTouchEnd !== "function"
    ) {
      return;
    }

    const originalOnTouchStart =
      typeof internalControls._onTouchStart === "function"
        ? internalControls._onTouchStart.bind(controls)
        : null;
    const originalOnTouchMove =
      typeof internalControls._onTouchMove === "function"
        ? internalControls._onTouchMove.bind(controls)
        : null;
    const originalOnTouchEnd = internalControls._onTouchEnd.bind(controls);
    internalControls._sekieiTouchEndFixInstalled = true;
    if (originalOnTouchStart) {
      internalControls._onTouchStart = (event: PointerEvent) => {
        originalOnTouchStart(event);
        // スマホの 2 本指 gesture は pinch 中に midpoint が少しぶれやすく、
        // TrackballControls 標準の pan 計算へそのまま入れると target が流れて
        // 次の 1 本指回転で「回転中心が変わった」ように見えやすい。
        if (
          event.pointerType === "touch" &&
          (internalControls._pointers?.length ?? 0) >= 2 &&
          internalControls._panStart &&
          internalControls._panEnd
        ) {
          internalControls._panEnd.copy(internalControls._panStart);
        }
      };
    }
    if (originalOnTouchMove) {
      internalControls._onTouchMove = (event: PointerEvent) => {
        originalOnTouchMove(event);
        if (
          event.pointerType === "touch" &&
          (internalControls._pointers?.length ?? 0) >= 2 &&
          internalControls._panStart &&
          internalControls._panEnd
        ) {
          internalControls._panEnd.copy(internalControls._panStart);
        }
      };
    }
    internalControls._onTouchEnd = (event: PointerEvent) => {
      const hadMultiplePointers =
        (internalControls._pointers?.length ?? 0) >= 2;
      originalOnTouchEnd(event);

      if (!hadMultiplePointers) {
        return;
      }

      queueMicrotask(() => {
        const remainingPointers = internalControls._pointers ?? [];
        if (remainingPointers.length === 1) {
          const remainingPointer = remainingPointers[0];
          const position =
            internalControls._pointerPositions?.[remainingPointer.pointerId];
          internalControls.state = TRACKBALL_STATE_TOUCH_ROTATE;

          if (
            position &&
            internalControls._moveCurr &&
            internalControls._movePrev &&
            typeof internalControls._getMouseOnCircle === "function"
          ) {
            const nextPointerPosition = internalControls._getMouseOnCircle(
              position.x,
              position.y,
            );
            internalControls._moveCurr.copy(nextPointerPosition);
            internalControls._movePrev.copy(nextPointerPosition);
          }

          if (internalControls._panStart && internalControls._panEnd) {
            internalControls._panStart.copy(internalControls._panEnd);
          }
          if (internalControls._zoomStart && internalControls._zoomEnd) {
            internalControls._zoomStart.copy(internalControls._zoomEnd);
          }
          return;
        }

        if (
          remainingPointers.length === 0 &&
          internalControls.state === TRACKBALL_STATE_TOUCH_ZOOM_PAN
        ) {
          internalControls.state = TRACKBALL_STATE_NONE;
        }
      });
    };
  }

  function loadControlsModule() {
    controlsModulePromise ??=
      import("three/addons/controls/TrackballControls.js");
    return controlsModulePromise;
  }

  async function loadRealTrackballControls() {
    realControlsPromise ??= loadControlsModule().then(
      ({ TrackballControls }) => {
        const controls = new TrackballControls(
          camera as THREE.OrthographicCamera,
          domElement,
        );
        syncProxyStateToRealControls(controls);
        installTouchTransitionFix(controls);
        replayListeners(controls);
        realControls = controls;
        return controls;
      },
    );
    return realControlsPromise;
  }

  return {
    controls: proxy as unknown as TrackballControls,
    loadRealTrackballControls,
  };
}
