const MOBILE_LAYOUT_MEDIA_QUERY = "(max-width: 760px)";
const MOBILE_LAYOUT_TABS = [
  "basic",
  "face",
  "twin",
  "display",
  "output",
] as const;

type MobileLayoutTab = (typeof MOBILE_LAYOUT_TABS)[number];

interface MobileLayoutContext {
  root: HTMLElement | null;
  tabButtons: HTMLButtonElement[];
  onLayoutChange?: (tab: MobileLayoutTab) => void;
}

function isMobileLayoutTab(
  value: string | undefined,
): value is MobileLayoutTab {
  return MOBILE_LAYOUT_TABS.includes(value as MobileLayoutTab);
}

function getTabButtonValue(button: HTMLButtonElement) {
  const value = button.dataset.mobileLayoutTabButton;
  return isMobileLayoutTab(value) ? value : null;
}

/**
 * スマホ時の「preview 上 / タブ下」レイアウト用 state を扱う。
 *
 * desktop / tablet の DOM は維持したまま、mobile だけ既存 section を
 * カテゴリ単位で出し分ける Phase 1 の試作をここで束ねる。
 */
export function createMobileLayoutActions(context: MobileLayoutContext) {
  let activeTab: MobileLayoutTab = "basic";
  const mediaQuery = window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY);

  function syncButtonState(isMobile: boolean) {
    context.tabButtons.forEach((button) => {
      const tab = getTabButtonValue(button);
      const isActive = isMobile && tab === activeTab;
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.tabIndex = 0;
    });
  }

  function applyLayoutState() {
    if (!(context.root instanceof HTMLElement)) {
      return;
    }

    const isMobile = mediaQuery.matches;
    if (isMobile) {
      context.root.dataset.mobileLayoutMode = "tabs";
      context.root.dataset.mobileLayoutActiveTab = activeTab;
    } else {
      delete context.root.dataset.mobileLayoutMode;
      delete context.root.dataset.mobileLayoutActiveTab;
    }

    syncButtonState(isMobile);
  }

  function notifyLayoutChange() {
    requestAnimationFrame(() => {
      context.onLayoutChange?.(activeTab);
    });
  }

  function setActiveTab(nextTab: MobileLayoutTab) {
    if (activeTab === nextTab) {
      return;
    }
    activeTab = nextTab;
    applyLayoutState();
    notifyLayoutChange();
  }

  function initMobileLayout() {
    context.tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const tab = getTabButtonValue(button);
        if (!tab) {
          return;
        }
        setActiveTab(tab);
      });
    });

    const handleMediaQueryChange = () => {
      applyLayoutState();
      notifyLayoutChange();
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaQueryChange);
    } else {
      mediaQuery.addListener(handleMediaQueryChange);
    }

    applyLayoutState();
  }

  return {
    initMobileLayout,
    setActiveMobileLayoutTab: setActiveTab,
  };
}
