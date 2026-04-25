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
