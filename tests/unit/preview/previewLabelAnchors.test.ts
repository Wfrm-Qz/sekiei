import { describe, expect, it } from "vitest";
import {
  createAxisLabelAnchors,
  createFaceLabelAnchors,
} from "../../../src/preview/previewLabelAnchors.ts";
import { createDefaultTwinPreviewStyleSettings } from "../../../src/preview/previewStyleSettings.ts";

describe("preview/previewLabelAnchors", () => {
  it("face anchor factory は offset を反映した face label DOM を作る", () => {
    document.body.innerHTML = `<div id="layer"></div>`;
    const layer = document.querySelector("#layer") as HTMLElement;
    const state = {
      previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
    };
    state.previewStyleSettings.faceLabel.offset = 0.25;

    const anchors = createFaceLabelAnchors({
      elements: { faceLabelLayer: layer },
      state,
      meshData: {
        faces: [
          {
            labelParts: [{ text: "1", negative: false }],
            vertices: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
              { x: 0, y: 1, z: 0 },
            ],
            normal: { x: 0, y: 0, z: 1 },
          },
        ],
      },
      sourceName: "mesh-1",
    });

    expect(anchors).toHaveLength(1);
    expect(anchors[0].element.dataset.source).toBe("mesh-1");
    expect(anchors[0].position.z).toBeCloseTo(0.25);
    expect(layer.querySelectorAll(".face-index-token")).toHaveLength(1);
  });

  it("axis anchor factory は正負テキストと軸 style key を持つ DOM を作る", () => {
    document.body.innerHTML = `<div id="layer"></div>`;
    const layer = document.querySelector("#layer") as HTMLElement;

    const anchors = createAxisLabelAnchors({
      elements: { faceLabelLayer: layer },
      axisGuides: [
        {
          label: "a3",
          color: "#ffaa00",
          start: { x: 0, y: 0, z: 0 },
          end: { x: 0, y: 1, z: 0 },
        },
      ],
    });

    expect(anchors).toHaveLength(1);
    expect(anchors[0].positiveText).toBe("a3");
    expect(anchors[0].negativeText).toBe("-a3");
    expect(anchors[0].axisStyleKey).toBe("a3");
    expect(anchors[0].defaultColor).toBe("#ffaa00");
    expect(layer.querySelector(".axis-overlay-label")).toHaveTextContent("a3");
  });
});
