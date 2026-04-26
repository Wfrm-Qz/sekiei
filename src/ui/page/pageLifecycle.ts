interface PageLifecycleElementsLike {
  localeSelect: HTMLSelectElement | null;
  presetSelect: HTMLInputElement;
  previewStage: HTMLElement;
}

interface PageLifecycleStateLike {
  parameters: { presetId?: string | null };
  buildResult: unknown;
  presetQuery: string;
  previewRoot: unknown;
  previewViewState: unknown;
  previewInertiaActive: boolean;
  isPreviewDragging: boolean;
  previewInertiaStartedAt: number;
  previewInertiaLastChangeAt: number;
  previewOverlayDirty: boolean;
  previewRenderDirty: boolean;
}

interface PageLifecycleContext {
  state: PageLifecycleStateLike;
  elements: PageLifecycleElementsLike;
  previewInertiaIdleTimeoutMs: number;
  previewInertiaMaxDurationMs: number;
  initializeLocale: () => void;
  setupLocaleSelect: (select: HTMLSelectElement | null) => void;
  onLocaleChange: (listener: () => void) => void;
  getPresetLabelById: (presetId: string) => string;
  applyStaticTranslations: () => void;
  renderCrystalSystemOptions: () => void;
  renderPresetOptions: () => void;
  renderFormValues: () => void;
  syncFaceSectionCardHeight: () => void;
  syncPreview: () => Promise<void> | void;
  loadFaceTextFonts: () => Promise<unknown>;
  hasAnyFaceTextContent: () => boolean;
  loadRealTrackballControls: () => Promise<unknown>;
  controlsHandleResize: () => void;
  fitPreviewToObject: (object: unknown) => void;
  capturePreviewViewState: () => unknown;
  requestPreviewOverlayUpdate: () => void;
  requestPreviewRender: () => void;
  applyLabelLayerVisibility: () => void;
  syncXrayFaceOverlayVisibility: () => void;
  animateFrame: () => void;
  resizeRenderer: () => void;
  attachHandlers: () => void;
  performanceNow: () => number;
  isPreviewRotating: () => boolean;
  controlsUpdate: () => void;
  updateXrayTransparentFaceRenderOrder: (previewRoot: unknown) => void;
  shouldUseScreenSpacePreviewOverlay: () => boolean;
  applyXrayOverlaySceneVisibility: (useOverlay: boolean) => void;
  renderScene: () => void;
  renderScreenSpaceXrayFaceOverlay: () => void;
  updateFaceLabelOverlay: () => void;
}

export function createPageLifecycleActions(context: PageLifecycleContext) {
  function animate() {
    context.animateFrame();
    const now = context.performanceNow();
    if (
      context.state.previewInertiaActive &&
      !context.state.isPreviewDragging &&
      (now - context.state.previewInertiaLastChangeAt >
        context.previewInertiaIdleTimeoutMs ||
        now - context.state.previewInertiaStartedAt >
          context.previewInertiaMaxDurationMs)
    ) {
      context.state.previewInertiaActive = false;
      context.applyLabelLayerVisibility();
      context.syncXrayFaceOverlayVisibility();
      context.requestPreviewOverlayUpdate();
      context.requestPreviewRender();
    }
    if (
      context.state.previewRenderDirty ||
      context.state.previewInertiaActive ||
      context.state.isPreviewDragging
    ) {
      context.controlsUpdate();
    }
    if (context.state.previewOverlayDirty && !context.isPreviewRotating()) {
      context.updateFaceLabelOverlay();
    }
    const useScreenSpaceXrayOverlay =
      !context.isPreviewRotating() &&
      context.shouldUseScreenSpacePreviewOverlay();
    if (
      context.state.previewRenderDirty ||
      context.state.previewInertiaActive ||
      context.state.isPreviewDragging
    ) {
      context.updateXrayTransparentFaceRenderOrder(context.state.previewRoot);
      context.applyXrayOverlaySceneVisibility(useScreenSpaceXrayOverlay);
      context.renderScene();
      if (useScreenSpaceXrayOverlay) {
        context.renderScreenSpaceXrayFaceOverlay();
        context.state.previewOverlayDirty = false;
      }
      context.state.previewRenderDirty = false;
    }
    if (context.state.previewOverlayDirty && useScreenSpaceXrayOverlay) {
      context.renderScreenSpaceXrayFaceOverlay();
      context.state.previewOverlayDirty = false;
    }
  }

  function init() {
    let pendingFaceSectionCardHeightSync = false;
    const scheduleFaceSectionCardHeightSync = () => {
      if (pendingFaceSectionCardHeightSync) {
        return;
      }
      pendingFaceSectionCardHeightSync = true;
      requestAnimationFrame(() => {
        pendingFaceSectionCardHeightSync = false;
        context.syncFaceSectionCardHeight();
      });
    };

    context.initializeLocale();
    context.setupLocaleSelect(context.elements.localeSelect);
    if (context.state.parameters.presetId !== "custom") {
      const presetLabel = context.getPresetLabelById(
        context.state.parameters.presetId ?? "",
      );
      context.state.presetQuery = presetLabel;
      context.elements.presetSelect.value = presetLabel;
    }
    context.onLocaleChange(() => {
      if (context.state.parameters.presetId !== "custom") {
        const presetLabel = context.getPresetLabelById(
          context.state.parameters.presetId ?? "",
        );
        context.state.presetQuery = presetLabel;
        context.elements.presetSelect.value = presetLabel;
      }
      context.applyStaticTranslations();
      context.renderCrystalSystemOptions();
      context.renderPresetOptions();
      context.renderFormValues();
      scheduleFaceSectionCardHeightSync();
      if (context.state.buildResult) {
        void context.syncPreview();
      }
    });
    context.applyStaticTranslations();
    context.renderCrystalSystemOptions();
    context.renderPresetOptions();
    context.renderFormValues();
    scheduleFaceSectionCardHeightSync();
    if (
      context.state.parameters.presetId !== "custom" &&
      context.elements.presetSelect.value === ""
    ) {
      context.elements.presetSelect.value = context.state.presetQuery;
    }
    context.attachHandlers();
    context.resizeRenderer();
    void context
      .loadFaceTextFonts()
      .then(() => {
        if (context.hasAnyFaceTextContent()) {
          void context.syncPreview();
        }
      })
      .catch((error) => {
        console.warn("[Face Text] failed to preload fonts", error);
      });
    void context
      .loadRealTrackballControls()
      .then(() => {
        context.controlsHandleResize();
        if (context.state.previewRoot) {
          context.fitPreviewToObject(context.state.previewRoot);
          context.state.previewViewState = context.capturePreviewViewState();
        }
        context.requestPreviewOverlayUpdate();
        context.requestPreviewRender();
      })
      .catch((error) => {
        console.error("[Twin Preview] failed to load TrackballControls", error);
      });
    void context.syncPreview();
    animate();
    scheduleFaceSectionCardHeightSync();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!context.state.previewRoot) {
          return;
        }
        context.fitPreviewToObject(context.state.previewRoot);
        context.state.previewViewState = context.capturePreviewViewState();
        scheduleFaceSectionCardHeightSync();
      });
    });

    const handleViewportResize = () => {
      context.resizeRenderer();
      scheduleFaceSectionCardHeightSync();
    };
    const handleViewportScroll = () => {
      scheduleFaceSectionCardHeightSync();
    };

    window.addEventListener("resize", handleViewportResize);
    window.addEventListener("scroll", handleViewportScroll, { passive: true });
    window.visualViewport?.addEventListener("resize", handleViewportResize);
    window.visualViewport?.addEventListener("scroll", handleViewportScroll);
    new ResizeObserver(() => {
      handleViewportResize();
    }).observe(context.elements.previewStage);
  }

  return {
    animate,
    init,
  };
}
