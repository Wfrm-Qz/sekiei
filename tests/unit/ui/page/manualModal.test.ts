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
    expect(elements.manualBody?.querySelectorAll("img")).toHaveLength(5);
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
});
