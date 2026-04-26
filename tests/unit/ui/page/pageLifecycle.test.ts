import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createPageLifecycleActions } from "../../../../src/ui/page/pageLifecycle.ts";

describe("ui/page/pageLifecycle", () => {
  function mountElements() {
    document.body.innerHTML = `
      <select id="locale"></select>
      <input id="preset" />
      <div id="stage"></div>
    `;
    return {
      localeSelect: document.getElementById("locale") as HTMLSelectElement,
      presetSelect: document.getElementById("preset") as HTMLInputElement,
      previewStage: document.getElementById("stage") as HTMLElement,
    };
  }

  it("init は preset 表示と初期化 callback 群を実行する", async () => {
    const elements = mountElements();
    let localeListener: (() => void) | null = null;
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    const resizeObserverObserve = vi.fn();
    const resizeObserverDisconnect = vi.fn();
    const ResizeObserverMock = vi.fn(function (this: {
      observe: typeof resizeObserverObserve;
      disconnect: typeof resizeObserverDisconnect;
    }) {
      this.observe = resizeObserverObserve;
      this.disconnect = resizeObserverDisconnect;
    });
    const originalResizeObserver = globalThis.ResizeObserver;
    vi.stubGlobal(
      "ResizeObserver",
      ResizeObserverMock as unknown as typeof ResizeObserver,
    );

    try {
      const context = {
        state: {
          parameters: { presetId: "cube-00001" },
          buildResult: { ok: true },
          presetQuery: "",
          previewRoot: { tag: "root" },
          previewViewState: null,
          previewInertiaActive: false,
          isPreviewDragging: false,
          previewInertiaStartedAt: 0,
          previewInertiaLastChangeAt: 0,
          previewOverlayDirty: false,
          previewRenderDirty: false,
        },
        elements,
        previewInertiaIdleTimeoutMs: 800,
        previewInertiaMaxDurationMs: 5000,
        initializeLocale: vi.fn(),
        setupLocaleSelect: vi.fn(),
        onLocaleChange: vi.fn((listener: () => void) => {
          localeListener = listener;
        }),
        getPresetLabelById: vi.fn(() => "Cube"),
        applyStaticTranslations: vi.fn(),
        renderCrystalSystemOptions: vi.fn(),
        renderPresetOptions: vi.fn(),
        renderFormValues: vi.fn(),
        syncPreview: vi.fn(async () => undefined),
        loadFaceTextFonts: vi.fn(async () => undefined),
        hasAnyFaceTextContent: vi.fn(() => false),
        loadRealTrackballControls: vi.fn(async () => undefined),
        controlsHandleResize: vi.fn(),
        fitPreviewToObject: vi.fn(),
        capturePreviewViewState: vi.fn(() => ({
          position: new THREE.Vector3(),
          target: new THREE.Vector3(),
          zoom: 1,
          up: new THREE.Vector3(0, 1, 0),
        })),
        requestPreviewOverlayUpdate: vi.fn(),
        requestPreviewRender: vi.fn(),
        applyLabelLayerVisibility: vi.fn(),
        syncXrayFaceOverlayVisibility: vi.fn(),
        animateFrame: vi.fn(),
        resizeRenderer: vi.fn(),
        attachHandlers: vi.fn(),
        performanceNow: vi.fn(() => 0),
        isPreviewRotating: vi.fn(() => false),
        controlsUpdate: vi.fn(),
        updateXrayTransparentFaceRenderOrder: vi.fn(),
        shouldUseScreenSpacePreviewOverlay: vi.fn(() => false),
        applyXrayOverlaySceneVisibility: vi.fn(),
        renderScene: vi.fn(),
        renderScreenSpaceXrayFaceOverlay: vi.fn(),
        updateFaceLabelOverlay: vi.fn(),
        syncFaceSectionCardHeight: vi.fn(),
      };

      createPageLifecycleActions(context).init();
      await Promise.resolve();
      await Promise.resolve();

      expect(context.state.presetQuery).toBe("Cube");
      expect(elements.presetSelect.value).toBe("Cube");
      expect(context.initializeLocale).toHaveBeenCalledTimes(1);
      expect(context.setupLocaleSelect).toHaveBeenCalledWith(
        elements.localeSelect,
      );
      expect(context.renderFormValues).toHaveBeenCalled();
      expect(context.attachHandlers).toHaveBeenCalledTimes(1);
      expect(context.syncPreview).toHaveBeenCalled();
      expect(context.fitPreviewToObject).toHaveBeenCalledWith(
        context.state.previewRoot,
      );
      expect(context.state.previewViewState).toEqual({
        position: new THREE.Vector3(),
        target: new THREE.Vector3(),
        zoom: 1,
        up: new THREE.Vector3(0, 1, 0),
      });
      expect(resizeObserverObserve).toHaveBeenCalledWith(elements.previewStage);

      localeListener?.();
      expect(context.applyStaticTranslations).toHaveBeenCalled();
      expect(context.renderPresetOptions).toHaveBeenCalled();
    } finally {
      requestAnimationFrameSpy.mockRestore();
      if (originalResizeObserver) {
        vi.stubGlobal("ResizeObserver", originalResizeObserver);
      } else {
        vi.unstubAllGlobals();
      }
    }
  });

  it("animate は慣性 timeout 後に overlay/render 状態を同期する", () => {
    const elements = mountElements();
    const context = {
      state: {
        parameters: { presetId: "cube-00001" },
        buildResult: null,
        presetQuery: "",
        previewRoot: { tag: "root" },
        previewViewState: null,
        previewInertiaActive: true,
        isPreviewDragging: false,
        previewInertiaStartedAt: 0,
        previewInertiaLastChangeAt: 0,
        previewOverlayDirty: true,
        previewRenderDirty: true,
      },
      elements,
      previewInertiaIdleTimeoutMs: 100,
      previewInertiaMaxDurationMs: 5000,
      initializeLocale: vi.fn(),
      setupLocaleSelect: vi.fn(),
      onLocaleChange: vi.fn(),
      getPresetLabelById: vi.fn(),
      applyStaticTranslations: vi.fn(),
      renderCrystalSystemOptions: vi.fn(),
      renderPresetOptions: vi.fn(),
      renderFormValues: vi.fn(),
      syncPreview: vi.fn(),
      loadFaceTextFonts: vi.fn(),
      hasAnyFaceTextContent: vi.fn(),
      loadRealTrackballControls: vi.fn(),
      controlsHandleResize: vi.fn(),
      fitPreviewToObject: vi.fn(),
      capturePreviewViewState: vi.fn(),
      requestPreviewOverlayUpdate: vi.fn(),
      requestPreviewRender: vi.fn(),
      applyLabelLayerVisibility: vi.fn(),
      syncXrayFaceOverlayVisibility: vi.fn(),
      animateFrame: vi.fn(),
      resizeRenderer: vi.fn(),
      attachHandlers: vi.fn(),
      performanceNow: vi.fn(() => 1000),
      isPreviewRotating: vi.fn(() => false),
      controlsUpdate: vi.fn(),
      updateXrayTransparentFaceRenderOrder: vi.fn(),
      shouldUseScreenSpacePreviewOverlay: vi.fn(() => true),
      applyXrayOverlaySceneVisibility: vi.fn(),
      renderScene: vi.fn(),
      renderScreenSpaceXrayFaceOverlay: vi.fn(),
      updateFaceLabelOverlay: vi.fn(),
      syncFaceSectionCardHeight: vi.fn(),
    };

    createPageLifecycleActions(context).animate();

    expect(context.state.previewInertiaActive).toBe(false);
    expect(context.applyLabelLayerVisibility).toHaveBeenCalledTimes(1);
    expect(context.syncXrayFaceOverlayVisibility).toHaveBeenCalledTimes(1);
    expect(context.requestPreviewOverlayUpdate).toHaveBeenCalledTimes(1);
    expect(context.requestPreviewRender).toHaveBeenCalledTimes(1);
    expect(context.controlsUpdate).toHaveBeenCalledTimes(1);
    expect(context.updateXrayTransparentFaceRenderOrder).toHaveBeenCalledWith(
      context.state.previewRoot,
    );
    expect(context.applyXrayOverlaySceneVisibility).toHaveBeenCalledWith(true);
    expect(context.renderScene).toHaveBeenCalledTimes(1);
    expect(context.renderScreenSpaceXrayFaceOverlay).toHaveBeenCalledTimes(1);
    expect(context.updateFaceLabelOverlay).toHaveBeenCalledTimes(1);
    expect(context.state.previewRenderDirty).toBe(false);
    expect(context.state.previewOverlayDirty).toBe(false);
  });

  it("animate は慣性 change が続いても最大継続時間後に停止する", () => {
    const elements = mountElements();
    const context = {
      state: {
        parameters: { presetId: "cube-00001" },
        buildResult: null,
        presetQuery: "",
        previewRoot: { tag: "root" },
        previewViewState: null,
        previewInertiaActive: true,
        isPreviewDragging: false,
        previewInertiaStartedAt: 0,
        previewInertiaLastChangeAt: 999,
        previewOverlayDirty: true,
        previewRenderDirty: true,
      },
      elements,
      previewInertiaIdleTimeoutMs: 800,
      previewInertiaMaxDurationMs: 1000,
      initializeLocale: vi.fn(),
      setupLocaleSelect: vi.fn(),
      onLocaleChange: vi.fn(),
      getPresetLabelById: vi.fn(),
      applyStaticTranslations: vi.fn(),
      renderCrystalSystemOptions: vi.fn(),
      renderPresetOptions: vi.fn(),
      renderFormValues: vi.fn(),
      syncPreview: vi.fn(),
      loadFaceTextFonts: vi.fn(),
      hasAnyFaceTextContent: vi.fn(),
      loadRealTrackballControls: vi.fn(),
      controlsHandleResize: vi.fn(),
      fitPreviewToObject: vi.fn(),
      capturePreviewViewState: vi.fn(),
      requestPreviewOverlayUpdate: vi.fn(),
      requestPreviewRender: vi.fn(),
      applyLabelLayerVisibility: vi.fn(),
      syncXrayFaceOverlayVisibility: vi.fn(),
      animateFrame: vi.fn(),
      resizeRenderer: vi.fn(),
      attachHandlers: vi.fn(),
      performanceNow: vi.fn(() => 1200),
      isPreviewRotating: vi.fn(() => false),
      controlsUpdate: vi.fn(),
      updateXrayTransparentFaceRenderOrder: vi.fn(),
      shouldUseScreenSpacePreviewOverlay: vi.fn(() => false),
      applyXrayOverlaySceneVisibility: vi.fn(),
      renderScene: vi.fn(),
      renderScreenSpaceXrayFaceOverlay: vi.fn(),
      updateFaceLabelOverlay: vi.fn(),
      syncFaceSectionCardHeight: vi.fn(),
    };

    createPageLifecycleActions(context).animate();

    expect(context.state.previewInertiaActive).toBe(false);
    expect(context.applyLabelLayerVisibility).toHaveBeenCalledTimes(1);
  });
});
