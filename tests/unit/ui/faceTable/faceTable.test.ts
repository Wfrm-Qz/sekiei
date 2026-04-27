import { describe, expect, it } from "vitest";
import {
  createFace,
  normalizeFaceForSystem,
} from "../../../../src/constants.ts";
import {
  buildTwinFaceDisplayGroupsAndState,
  buildTwinFaceGroupPalette,
  buildTwinFaceGroupRenderPlan,
  buildTwinFaceRowMarkup,
  createTwinFaceMobileCardElement,
  createTwinFaceRowElement,
  createTwinFaceTextRowElement,
  compareTwinFaceItemsForSort,
} from "../../../../src/ui/faceTable/faceTable.ts";

/**
 * 面一覧 helper の回帰を防ぐ unit test。
 *
 * 折り畳み・ソート・行 markup 契約は不具合が多かったため、
 * DOM 全体ではなく pure helper の契約を固定する。
 */
describe("ui/faceTable", () => {
  function createLabels() {
    return {
      showFaceTitle: "面表示",
      expand: "展開",
      collapse: "折り畳み",
      faceTextToggleOpen: "文字",
      faceTextToggleClose: "閉じる",
      coefficient: "係数",
      faceTextContent: "刻印文字",
      faceTextFont: "フォント",
      faceTextFontSize: "文字サイズ",
      faceTextDepth: "深さ",
      faceTextOffsetU: "横位置",
      faceTextOffsetV: "縦位置",
      faceTextRotation: "回転角",
      color: "色",
      createEquivalentFace: "等価面を作成",
      deleteAllFaces: "全削除",
      delete: "削除",
      increaseField: (label) => `${label} 増加`,
      decreaseField: (label) => `${label} 減少`,
      sortAscending: (label) => `${label} 昇順`,
      sortDescending: (label) => `${label} 降順`,
    };
  }

  it("等価面キー関数を省略しても等価面は同じ色になる", () => {
    const faces = [
      {
        ...normalizeFaceForSystem(createFace({ h: 1, k: 0, l: 0 }), "cubic"),
        id: "face-a",
      },
      {
        ...normalizeFaceForSystem(createFace({ h: 0, k: 1, l: 0 }), "cubic"),
        id: "face-b",
      },
    ];

    const { faceColors } = buildTwinFaceGroupPalette(faces, "cubic");

    expect(faceColors.get("face-a")).toEqual(faceColors.get("face-b"));
  });

  it("面に explicit 色があれば grouped palette より優先する", () => {
    const faces = [
      {
        ...normalizeFaceForSystem(createFace({ h: 1, k: 0, l: 0 }), "cubic"),
        id: "face-a",
        accentColor: "#3366cc",
      },
      {
        ...normalizeFaceForSystem(createFace({ h: 0, k: 1, l: 0 }), "cubic"),
        id: "face-b",
      },
    ];

    const { faceColors } = buildTwinFaceGroupPalette(faces, "cubic");

    expect(faceColors.get("face-a")?.preview).toBe("#3366cc");
    expect(faceColors.get("face-b")?.preview).not.toBe("#3366cc");
  });

  it("無効になった折りたたみ state を捨てつつ group 単位でソートする", () => {
    const editableFaces = [
      normalizeFaceForSystem(createFace({ h: 0, k: 1, l: 0 }), "cubic"),
      normalizeFaceForSystem(createFace({ h: 1, k: 0, l: 0 }), "cubic"),
      normalizeFaceForSystem(createFace({ h: 1, k: 1, l: 1 }), "cubic"),
    ];
    const result = buildTwinFaceDisplayGroupsAndState({
      editableFaces,
      crystalSystem: "cubic",
      collapsedFaceGroups: {
        "1::obsolete": true,
      },
      editableCrystalIndex: 1,
      faceGroupStateSeparator: "::",
      getEquivalentFaceGroupKey: (face, systemId) =>
        `${systemId}:${face.h},${face.k},${face.l}`,
      faceSort: { field: "h", direction: "asc" },
      compareFaceItemsForSort: compareTwinFaceItemsForSort,
    });

    expect(Object.keys(result.collapsedFaceGroups)).toHaveLength(0);
    expect(result.groups.map((group) => group.items[0].face.h)).toEqual([
      0, 1, 1,
    ]);
  });

  it("下書き face は draftGroupKey ごとに独立した group として扱う", () => {
    const editableFaces = [
      {
        ...normalizeFaceForSystem(
          createFace({ h: 0, k: 0, l: 0, coefficient: 0, enabled: false }),
          "cubic",
        ),
        id: "draft-a",
        draftGroupKey: "draft-a",
        draftEmptyFields: ["h", "k", "l", "coefficient"],
      },
      {
        ...normalizeFaceForSystem(
          createFace({ h: 0, k: 0, l: 0, coefficient: 0, enabled: false }),
          "cubic",
        ),
        id: "draft-b",
        draftGroupKey: "draft-b",
        draftEmptyFields: ["h", "k", "l", "coefficient"],
      },
    ];

    const result = buildTwinFaceDisplayGroupsAndState({
      editableFaces,
      crystalSystem: "cubic",
      collapsedFaceGroups: {},
      editableCrystalIndex: 0,
      faceGroupStateSeparator: "::",
      getEquivalentFaceGroupKey: (face, systemId) =>
        `${systemId}:${face.h},${face.k},${face.l}`,
      faceSort: null,
      compareFaceItemsForSort: compareTwinFaceItemsForSort,
    });

    expect(result.groups).toHaveLength(2);
    expect(result.groups.map((group) => group.key)).toEqual([
      "draft-a",
      "draft-b",
    ]);
  });

  it("同じソート値の行は元 index を tie-break に使って順序を安定化する", () => {
    const left = {
      index: 1,
      face: { h: 1, k: 0, l: 0, coefficient: 1 },
    };
    const right = {
      index: 4,
      face: { h: 1, k: 0, l: 0, coefficient: 1 },
    };

    expect(compareTwinFaceItemsForSort(left, right, "h", "asc")).toBeLessThan(
      0,
    );
    expect(
      compareTwinFaceItemsForSort(left, right, "h", "desc"),
    ).toBeGreaterThan(0);
  });

  it("複数面グループは既定で折り畳み、代表行だけを表示する", () => {
    const plan = buildTwinFaceGroupRenderPlan(
      {
        key: "1|0|0",
        items: [
          {
            index: 0,
            face: { h: 1, k: 0, l: 0, coefficient: 1 },
          },
          {
            index: 1,
            face: { h: -1, k: 0, l: 0, coefficient: 1 },
          },
        ],
      },
      undefined,
    );

    expect(plan.collapsed).toBe(true);
    expect(plan.visibleItems).toHaveLength(1);
    expect(plan.visibleItems[0].index).toBe(0);
  });

  it("collapsedState が渡されたときは既定挙動より優先する", () => {
    const plan = buildTwinFaceGroupRenderPlan(
      {
        key: "1|0|0",
        items: [
          {
            index: 0,
            face: { h: 1, k: 0, l: 0, coefficient: 1 },
          },
          {
            index: 1,
            face: { h: -1, k: 0, l: 0, coefficient: 1 },
          },
        ],
      },
      false,
    );

    expect(plan.collapsed).toBe(false);
    expect(plan.visibleItems).toHaveLength(2);
  });

  it("折り畳み代表行は既存 handler が必要とする data 属性とボタンを維持する", () => {
    const markup = buildTwinFaceRowMarkup({
      groupKey: "1|0|0",
      groupItemCount: 2,
      groupColor: {
        preview: "#cc0000",
        background: "rgba(0,0,0,0.05)",
        border: "rgba(0,0,0,0.2)",
      },
      item: {
        index: 0,
        face: {
          id: "face-1",
          h: 1,
          k: 0,
          l: 0,
          coefficient: 1,
          enabled: true,
        },
      },
      useFourAxis: false,
      collapsed: true,
      isCollapsedRepresentative: true,
      isGroupStart: true,
      canCreateEquivalentFace: true,
      labels: createLabels(),
    });

    expect(markup).toContain('data-face-id="face-1"');
    expect(markup).toContain('data-group-key="1|0|0"');
    expect(markup).toContain('data-group-collapsed="true"');
    expect(markup).toContain('class="face-group-toggle"');
    expect(markup).toContain('class="remove-face-button"');
    expect(markup).toContain('data-face-field="accentColor"');
    expect(markup).not.toContain("equivalent-face-button");
  });

  it("下書き面は指数と係数を空欄表示で描画する", () => {
    const markup = buildTwinFaceRowMarkup({
      groupKey: "draft-face-1",
      groupItemCount: 1,
      groupColor: {
        preview: "#cc0000",
        background: "rgba(0,0,0,0.05)",
        border: "rgba(0,0,0,0.2)",
      },
      item: {
        index: 0,
        face: {
          id: "draft-face-1",
          h: 0,
          k: 0,
          i: 0,
          l: 0,
          coefficient: 0,
          enabled: false,
          draftEmptyFields: ["h", "k", "l", "coefficient"],
        },
      },
      useFourAxis: true,
      collapsed: false,
      isCollapsedRepresentative: false,
      isGroupStart: true,
      canCreateEquivalentFace: false,
      labels: createLabels(),
    });

    expect(markup).toContain(
      'data-face-field="h" type="number" step="1" value=""',
    );
    expect(markup).toContain(
      'data-face-field="k" type="number" step="1" value=""',
    );
    expect(markup).toContain(
      'data-face-field="l" type="number" step="1" value=""',
    );
    expect(markup).toContain('data-face-field="coefficient" type="number"');
  });

  it("指数入力は常時表示の増減ボタンを持つ", () => {
    const row = createTwinFaceRowElement({
      groupKey: "face-1",
      groupItemCount: 1,
      groupColor: {
        preview: "#cc0000",
        background: "rgba(0,0,0,0.05)",
        border: "rgba(0,0,0,0.2)",
      },
      item: {
        index: 0,
        face: {
          id: "face-1",
          h: 1,
          k: 0,
          i: -1,
          l: 0,
          coefficient: 1,
          enabled: true,
        },
      },
      useFourAxis: true,
      collapsed: false,
      isCollapsedRepresentative: false,
      isGroupStart: true,
      canCreateEquivalentFace: false,
      labels: createLabels(),
    });

    expect(row.querySelectorAll(".face-index-spin-button")).toHaveLength(6);
    expect(
      row.querySelector(
        '[data-face-index-field="h"][data-spin-direction="up"]',
      ),
    ).toHaveAccessibleName("h 増加");
    expect(
      row.querySelector(
        '[data-face-index-field="l"][data-spin-direction="down"]',
      ),
    ).toHaveAccessibleName("l 減少");
    expect(
      row.querySelector('[data-face-field="i"] + .face-index-spin-buttons'),
    ).toBeNull();
  });

  it("文字掘り込み行は content/font/size/depth/offset/rotation の入力欄を持つ", () => {
    const row = createTwinFaceTextRowElement({
      groupKey: "face-1",
      groupItemCount: 1,
      groupColor: {
        preview: "#cc0000",
        background: "rgba(0,0,0,0.05)",
        border: "rgba(0,0,0,0.2)",
      },
      item: {
        index: 0,
        face: {
          id: "face-1",
          h: 1,
          k: 0,
          l: 0,
          coefficient: 1,
          text: {
            content: "R",
            fontId: "optimer",
            fontSize: 2.4,
            depth: 0.8,
            offsetU: 0.5,
            offsetV: -0.5,
            rotationDeg: 12,
          },
        },
      },
      useFourAxis: false,
      collapsed: false,
      textExpanded: true,
      isCollapsedRepresentative: false,
      isGroupStart: false,
      canCreateEquivalentFace: false,
      labels: createLabels(),
    });

    expect(row.className).toBe("face-row face-text-row");
    expect(
      (
        row.querySelector(
          '[data-face-text-field="content"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("R");
    expect(
      (
        row.querySelector(
          '[data-face-text-field="fontId"]',
        ) as HTMLSelectElement
      ).value,
    ).toBe("optimer");
    expect(
      (
        row.querySelector(
          '[data-face-text-field="fontSize"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("2.4");
    expect(
      (row.querySelector('[data-face-text-field="depth"]') as HTMLInputElement)
        .value,
    ).toBe("0.8");
    expect(
      (
        row.querySelector(
          '[data-face-text-field="offsetU"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("0.5");
    expect(
      (
        row.querySelector(
          '[data-face-text-field="offsetV"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("-0.5");
    expect(
      (
        row.querySelector(
          '[data-face-text-field="rotationDeg"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("12");
    expect(row.hidden).toBe(false);
  });

  it("文字掘り込み行は既定で折り畳まれる", () => {
    const row = createTwinFaceTextRowElement({
      groupKey: "face-1",
      groupItemCount: 1,
      groupColor: {
        preview: "#cc0000",
        background: "rgba(0,0,0,0.05)",
        border: "rgba(0,0,0,0.2)",
      },
      item: {
        index: 0,
        face: {
          id: "face-1",
          h: 1,
          k: 0,
          l: 0,
          coefficient: 1,
          text: {
            content: "R",
          },
        },
      },
      useFourAxis: false,
      collapsed: false,
      textExpanded: false,
      isCollapsedRepresentative: false,
      isGroupStart: false,
      canCreateEquivalentFace: false,
      labels: createLabels(),
    });

    expect(row.hidden).toBe(true);
  });

  it("通常行には文字編集の開閉ボタンが入り、状態をaria-expandedへ反映する", () => {
    const row = createTwinFaceRowElement({
      groupKey: "face-1",
      groupItemCount: 1,
      groupColor: {
        preview: "#cc0000",
        background: "rgba(0,0,0,0.05)",
        border: "rgba(0,0,0,0.2)",
      },
      item: {
        index: 0,
        face: {
          id: "face-1",
          h: 1,
          k: 0,
          l: 0,
          coefficient: 1,
          enabled: true,
        },
      },
      useFourAxis: false,
      collapsed: false,
      textExpanded: false,
      isCollapsedRepresentative: false,
      isGroupStart: true,
      canCreateEquivalentFace: false,
      labels: createLabels(),
    });

    const toggleButton = row.querySelector(
      ".toggle-face-text-button",
    ) as HTMLButtonElement | null;
    expect(toggleButton).not.toBeNull();
    expect(toggleButton?.getAttribute("aria-expanded")).toBe("false");
    expect(toggleButton?.textContent).toBe("文字");
  });

  it("スマホ向けカードは指数欄と文字編集欄を内包して描画できる", () => {
    const card = createTwinFaceMobileCardElement({
      groupKey: "face-1",
      groupItemCount: 1,
      groupColor: {
        preview: "#cc0000",
        background: "rgba(0,0,0,0.05)",
        border: "rgba(0,0,0,0.2)",
      },
      item: {
        index: 0,
        face: {
          id: "face-1",
          h: 1,
          k: 0,
          l: 0,
          coefficient: 1,
          enabled: true,
          text: {
            content: "R",
          },
        },
      },
      useFourAxis: false,
      collapsed: false,
      textExpanded: true,
      isCollapsedRepresentative: false,
      isGroupStart: true,
      canCreateEquivalentFace: true,
      labels: createLabels(),
    });

    expect(card).toHaveAttribute("data-face-id", "face-1");
    expect(
      card.querySelector(".face-mobile-card__title-face")?.textContent,
    ).toBe("(1, 0, 0)");
    expect(
      card.querySelector('[data-face-field="coefficient"]'),
    ).not.toBeNull();
    expect(card.querySelectorAll(".face-index-spin-button")).toHaveLength(6);
    expect(card.querySelector(".toggle-face-text-button")).not.toBeNull();
    expect(card.querySelector(".face-mobile-card__text-editor")).not.toBeNull();
    expect(
      card.querySelector('[data-face-text-field="content"]'),
    ).not.toBeNull();
  });
});
