import { describe, expect, it } from "vitest";

import { createManualModalActions } from "../../../../src/ui/page/manualModal.ts";
import { queryAppPageElements } from "../../../../src/ui/page/pageElements.ts";

function mountManualModal() {
  document.body.innerHTML = `
    <button id="before-manual" type="button">before</button>
    <div id="app-manual-modal" hidden>
      <div id="app-manual-backdrop"></div>
      <section>
        <button id="app-manual-close-button" type="button">×</button>
        <div id="app-manual-body"></div>
        <button id="app-manual-dismiss-button" type="button">閉じる</button>
      </section>
    </div>
  `;
  return queryAppPageElements();
}

describe("ui/page/manualModal", () => {
  it("マニュアルをモーダル内へ描画して開閉できる", () => {
    const elements = mountManualModal();
    const trigger = document.querySelector<HTMLButtonElement>("#before-manual");
    trigger?.focus();
    const { initManualModal, openManual } = createManualModalActions({
      elements,
    });

    initManualModal();
    openManual();

    expect(elements.manualModal).not.toHaveAttribute("hidden");
    expect(document.body).toHaveClass("manual-modal-open");
    expect(elements.manualBody).toHaveTextContent("できること");
    expect(elements.manualBody).not.toHaveTextContent("User Manual");
    expect(elements.manualBody?.querySelectorAll("img")).toHaveLength(13);
    expect(elements.manualDismissButton).toHaveFocus();

    elements.manualDismissButton?.click();

    expect(elements.manualModal).toHaveAttribute("hidden");
    expect(document.body).not.toHaveClass("manual-modal-open");
    expect(trigger).toHaveFocus();
  });

  it("背景クリックで閉じる", () => {
    const elements = mountManualModal();
    const { initManualModal, openManual } = createManualModalActions({
      elements,
    });

    initManualModal();
    openManual();
    elements.manualBackdrop?.click();

    expect(elements.manualModal).toHaveAttribute("hidden");
  });

  it("見出しから目次を作り、項目クリックで本文見出しへ移動できる", () => {
    const elements = mountManualModal();
    const { initManualModal, openManual } = createManualModalActions({
      elements,
    });

    initManualModal();
    openManual();

    const toc = elements.manualBody?.querySelector(".manual-modal__toc");
    const tocLinks = Array.from(
      elements.manualBody?.querySelectorAll<HTMLButtonElement>(
        ".manual-modal__toc-link",
      ) ?? [],
    );

    expect(toc).toHaveAccessibleName("目次");
    expect(tocLinks.length).toBeGreaterThan(8);
    expect(tocLinks[0]).toHaveTextContent("はじめに");

    const faceListLink = tocLinks.find((link) =>
      link.textContent?.includes("面一覧"),
    );
    faceListLink?.click();

    expect(faceListLink).toHaveAttribute("aria-current", "true");
    expect(document.activeElement).toHaveTextContent("面一覧");
  });
});
