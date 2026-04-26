import { describe, expect, it, vi } from "vitest";
import { createMobileLayoutActions } from "../../../../src/ui/page/mobileLayout.ts";

function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  let currentMatches = matches;

  const matchMediaMock = vi.fn(() => ({
    get matches() {
      return currentMatches;
    },
    media: "(max-width: 760px)",
    addEventListener: (_event: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_event: string, listener: () => void) => {
      listeners.delete(listener);
    },
    addListener: (listener: () => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: () => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
  }));

  vi.stubGlobal("matchMedia", matchMediaMock);

  return {
    setMatches(next: boolean) {
      currentMatches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

describe("ui/page/mobileLayout", () => {
  it("スマホ時は active tab を root dataset に反映し、button state を切り替える", () => {
    document.body.innerHTML = `
      <main id="app-main-content">
        <button data-mobile-layout-tab-button="basic"></button>
        <button data-mobile-layout-tab-button="face"></button>
        <button data-mobile-layout-tab-button="twin"></button>
      </main>
    `;

    const root = document.getElementById("app-main-content");
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "[data-mobile-layout-tab-button]",
      ),
    );
    const matchMediaControl = stubMatchMedia(true);
    const onLayoutChange = vi.fn();
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });

    try {
      const { initMobileLayout } = createMobileLayoutActions({
        root,
        tabButtons: buttons,
        onLayoutChange,
      });

      initMobileLayout();

      expect(root?.dataset.mobileLayoutMode).toBe("tabs");
      expect(root?.dataset.mobileLayoutActiveTab).toBe("basic");
      expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");

      buttons[1]?.click();

      expect(root?.dataset.mobileLayoutActiveTab).toBe("face");
      expect(buttons[0]?.getAttribute("aria-pressed")).toBe("false");
      expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");
      expect(onLayoutChange).toHaveBeenCalled();

      matchMediaControl.setMatches(false);

      expect(root?.dataset.mobileLayoutMode).toBeUndefined();
      expect(root?.dataset.mobileLayoutActiveTab).toBeUndefined();
      expect(buttons[1]?.getAttribute("aria-pressed")).toBe("false");
    } finally {
      requestAnimationFrameSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
