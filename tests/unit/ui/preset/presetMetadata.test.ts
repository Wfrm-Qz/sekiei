import { describe, expect, it } from "vitest";
import {
  applyTwinPresetMetadataOverlay,
  applyTwinPresetMetadataSectionVisibility,
  buildTwinPresetMetadataViewModel,
  commitTwinPresetMetadataField,
  populateTwinPresetMetadataInputs,
} from "../../../../src/ui/preset/presetMetadata.ts";

/**
 * ui/presetMetadata の多言語 metadata 表示と更新を確認する unit test。
 */
describe("ui/presetMetadata", () => {
  it("buildTwinPresetMetadataViewModel は正常系で現在言語と反対言語名を解決し、欠損時は空文字へ丸める", () => {
    expect(
      buildTwinPresetMetadataViewModel(
        {
          name: { jp: "日本式双晶", en: "Japan-law twin" },
          shortDescription: "短い説明",
          description: "詳細",
          reference: "ref",
          fullReference: "full-ref",
        },
        "ja",
      ),
    ).toEqual({
      primaryName: "日本式双晶",
      alternateName: "Japan-law twin",
      shortDescription: "短い説明",
      description: "詳細",
      reference: "ref",
      fullReference: "full-ref",
    });

    expect(buildTwinPresetMetadataViewModel({}, "en")).toEqual({
      primaryName: "",
      alternateName: "",
      shortDescription: "",
      description: "",
      reference: "",
      fullReference: "",
    });
  });

  it("populateTwinPresetMetadataInputs は view model を入力欄へ反映する", () => {
    document.body.innerHTML = `
      <input id="name" />
      <input id="alt-name" />
      <input id="short-description" />
      <textarea id="description"></textarea>
      <input id="reference" />
      <textarea id="full-reference"></textarea>
    `;
    const inputs = {
      name: document.querySelector("#name") as HTMLInputElement,
      altName: document.querySelector("#alt-name") as HTMLInputElement,
      shortDescription: document.querySelector(
        "#short-description",
      ) as HTMLInputElement,
      description: document.querySelector(
        "#description",
      ) as HTMLTextAreaElement,
      reference: document.querySelector("#reference") as HTMLInputElement,
      fullReference: document.querySelector(
        "#full-reference",
      ) as HTMLTextAreaElement,
    };

    populateTwinPresetMetadataInputs(inputs, {
      primaryName: "Name",
      alternateName: "別名",
      shortDescription: "short",
      description: "desc",
      reference: "ref",
      fullReference: "full",
    });

    expect(inputs.name.value).toBe("Name");
    expect(inputs.altName.value).toBe("別名");
    expect(inputs.shortDescription.value).toBe("short");
    expect(inputs.description.value).toBe("desc");
    expect(inputs.reference.value).toBe("ref");
    expect(inputs.fullReference.value).toBe("full");
  });

  it("applyTwinPresetMetadataOverlay は内容がある時だけ overlay を表示し、異常系寄りの空内容では隠す", () => {
    document.body.innerHTML = `
      <aside id="overlay"></aside>
      <div id="name"></div>
      <div id="short"></div>
    `;
    const elements = {
      overlay: document.querySelector("#overlay") as HTMLElement,
      name: document.querySelector("#name") as HTMLElement,
      shortDescription: document.querySelector("#short") as HTMLElement,
    };

    applyTwinPresetMetadataOverlay(
      elements,
      {
        primaryName: "コランダム",
        alternateName: "Corundum",
        shortDescription: "説明",
        description: "",
        reference: "",
        fullReference: "",
      },
      true,
    );
    expect(elements.overlay.hidden).toBe(false);
    expect(elements.overlay.style.display).toBe("flex");
    expect(elements.name).toHaveTextContent("コランダム");

    applyTwinPresetMetadataOverlay(
      elements,
      {
        primaryName: "",
        alternateName: "",
        shortDescription: "",
        description: "",
        reference: "",
        fullReference: "",
      },
      true,
    );
    expect(elements.overlay.hidden).toBe(true);
    expect(elements.overlay.style.display).toBe("none");
  });

  it("applyTwinPresetMetadataSectionVisibility は展開状態に応じて表示と aria-expanded を切り替える", () => {
    document.body.innerHTML = `
      <div id="advanced"></div>
      <button id="toggle"></button>
    `;
    const elements = {
      advanced: document.querySelector("#advanced") as HTMLElement,
      toggleButton: document.querySelector("#toggle") as HTMLButtonElement,
    };

    applyTwinPresetMetadataSectionVisibility(elements, true, {
      more: "詳細表示",
      less: "折り畳み",
    });
    expect(elements.advanced.hidden).toBe(false);
    expect(elements.toggleButton).toHaveTextContent("折り畳み");
    expect(elements.toggleButton).toHaveAttribute("aria-expanded", "true");

    applyTwinPresetMetadataSectionVisibility(elements, false, {
      more: "詳細表示",
      less: "折り畳み",
    });
    expect(elements.advanced.hidden).toBe(true);
    expect(elements.toggleButton).toHaveTextContent("詳細表示");
    expect(elements.toggleButton).toHaveAttribute("aria-expanded", "false");
  });

  it("commitTwinPresetMetadataField は正常系で対象項目を書き戻し、異常系寄りでも custom preset に切り替える", () => {
    const source = {
      name: { jp: "旧名", en: "Old name" },
      shortDescription: "old",
      presetId: "corundum",
    };

    commitTwinPresetMetadataField(source, "name", "新名", "ja");
    expect(source.name?.jp).toBe("新名");
    expect(source.presetId).toBe("custom");

    commitTwinPresetMetadataField(source, "altName", "New name", "ja");
    expect(source.name?.en).toBe("New name");

    commitTwinPresetMetadataField(
      source,
      "shortDescription",
      null as never,
      "ja",
    );
    expect(source.shortDescription).toBe("");
  });
});
