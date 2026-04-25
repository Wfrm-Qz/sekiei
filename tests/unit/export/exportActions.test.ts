import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultTwinPreviewStyleSettings } from "../../../src/preview/previewStyleSettings.ts";
import { createDefaultTwinStlSplitSettings } from "../../../src/state/stlSplitSettings.ts";

const {
  triggerNamedDownload,
  triggerNamedBlobDownload,
  triggerBlobDownload,
  triggerDownload,
  serializeTwinParameters,
  buildStlExportArtifact,
  prepareGeometryForStlExport,
  splitBufferGeometryByPlaneWithJscad,
  unionBufferGeometriesWithJscad,
} = vi.hoisted(() => ({
  triggerNamedDownload: vi.fn(),
  triggerNamedBlobDownload: vi.fn(),
  triggerBlobDownload: vi.fn(),
  triggerDownload: vi.fn(),
  serializeTwinParameters: vi.fn(() => ({
    version: 2,
    crystals: [
      {
        id: "base",
        accentColor: "#2255aa",
        faces: [{ id: "f1", accentColor: "#3366cc" }],
      },
    ],
  })),
  buildStlExportArtifact: vi.fn(),
  prepareGeometryForStlExport: vi.fn(),
  splitBufferGeometryByPlaneWithJscad: vi.fn(),
  unionBufferGeometriesWithJscad: vi.fn(),
}));

vi.mock("../../../src/io/exporters.ts", () => ({
  triggerNamedDownload,
  triggerNamedBlobDownload,
  triggerBlobDownload,
  triggerDownload,
}));

vi.mock("../../../src/domain/parameters.ts", () => ({
  serializeTwinParameters,
}));

vi.mock("../../../src/io/formats/stl.ts", () => ({
  STL_FORMAT: {
    id: "stl",
    label: "STL",
    extension: "stl",
    mimeType: "model/stl",
  },
  buildStlExportArtifact,
  prepareGeometryForStlExport,
}));

vi.mock("../../../src/domain/jscadCsg.ts", () => ({
  splitBufferGeometryByPlaneWithJscad,
  unionBufferGeometriesWithJscad,
}));

import { createTwinExportActions } from "../../../src/export/exportActions.ts";

/**
 * export/exportActions の export 実行入口を確認する smoke unit test。
 */
describe("export/exportActions", () => {
  beforeEach(() => {
    triggerNamedDownload.mockReset();
    triggerNamedBlobDownload.mockReset();
    triggerBlobDownload.mockReset();
    triggerDownload.mockReset();
    serializeTwinParameters.mockClear();
    buildStlExportArtifact.mockReset();
    prepareGeometryForStlExport.mockReset();
    splitBufferGeometryByPlaneWithJscad.mockReset();
    unionBufferGeometriesWithJscad.mockReset();
    buildStlExportArtifact.mockImplementation(
      (geometry: THREE.BufferGeometry) => {
        const vertexCount = geometry.getAttribute("position")?.count ?? 0;
        const isFallback = vertexCount > 24;
        return {
          content: isFallback ? "fallback-stl" : "union-stl",
          debug: {
            topologyAfterOrientation: {
              openEdgeCount: isFallback ? 5 : 1,
              multiOwnerEdgeCount: 0,
            },
          },
        };
      },
    );
    prepareGeometryForStlExport.mockImplementation(
      (geometry: THREE.BufferGeometry) => {
        const vertexCount = geometry.getAttribute("position")?.count ?? 0;
        const isFallback = vertexCount > 24;
        return {
          geometry: geometry.clone(),
          debug: {
            topologyAfterOrientation: {
              openEdgeCount: isFallback ? 5 : 1,
              multiOwnerEdgeCount: 0,
            },
          },
        };
      },
    );
    splitBufferGeometryByPlaneWithJscad.mockImplementation(
      (geometry: THREE.BufferGeometry) => ({
        positive: geometry.clone(),
        negative: geometry.clone(),
      }),
    );
    unionBufferGeometriesWithJscad.mockImplementation(
      (geometries: THREE.BufferGeometry[]) => geometries[0]?.clone() ?? null,
    );
  });

  function createContext() {
    return {
      state: {
        parameters: {
          name: { jp: "コランダム", en: "Corundum" },
          crystalSystem: "cubic",
          axes: { a: 1, b: 1, c: 1 },
          angles: { alpha: 90, beta: 90, gamma: 90 },
          faces: [{ h: 1, k: 0, l: 0, coefficient: 1 }],
          twin: {
            crystals: [{ faces: [] }],
          },
        },
        stlSplit: createDefaultTwinStlSplitSettings("cubic"),
        buildResult: {
          finalGeometry: new THREE.BoxGeometry(1, 1, 1),
          previewFinalGeometry: new THREE.BoxGeometry(1, 1, 1),
          crystalPreviewGeometries: [new THREE.BoxGeometry(1, 1, 1)],
        },
        faceDisplayMode: "solid",
        previewRoot: new THREE.Group(),
        previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
      },
      getVisibleCrystalIndexes: vi.fn(() => [0]),
      buildPreviewExportSvg: vi.fn(() => ({
        svgMarkup: "<svg></svg>",
        debugLog: {},
      })),
      buildPreviewRasterBackedSvg: vi.fn(() => "<svg></svg>"),
      buildPreviewPngBlob: vi.fn(async () => new Blob(["png"])),
      buildPreviewJpegBlob: vi.fn(async () => new Blob(["jpeg"])),
      shouldUseVectorCrystalBodyForSvgExport: vi.fn(() => true),
      alert: vi.fn(),
    };
  }

  it("正常系として json export は保存関数を呼ぶ", async () => {
    const context = createContext();
    const actions = createTwinExportActions(context);

    await actions.exportTwinArtifact("json", "save");

    expect(serializeTwinParameters).toHaveBeenCalled();
    expect(triggerDownload).toHaveBeenCalledWith(
      expect.stringContaining('"schema": "sekiei-twin-preview-document-v1"'),
      "コランダム.json",
      "application/json",
    );
    expect(triggerDownload).toHaveBeenCalledWith(
      expect.stringContaining('"previewStyleSettings"'),
      "コランダム.json",
      "application/json",
    );
    expect(triggerDownload).toHaveBeenCalledWith(
      expect.stringContaining('"faceDisplayMode": "solid"'),
      "コランダム.json",
      "application/json",
    );
    expect(triggerDownload).toHaveBeenCalledWith(
      expect.stringContaining('"accentColor": "#2255aa"'),
      "コランダム.json",
      "application/json",
    );
    expect(triggerDownload).toHaveBeenCalledWith(
      expect.stringContaining('"accentColor": "#3366cc"'),
      "コランダム.json",
      "application/json",
    );
  });

  it("異常系として svg builder が失敗したときは alert する", async () => {
    const context = createContext();
    context.buildPreviewExportSvg.mockImplementation(() => {
      throw new Error("svg failed");
    });
    const actions = createTwinExportActions(context);

    await actions.exportTwinArtifact("svg", "save");

    expect(context.alert).toHaveBeenCalled();
  });

  it("複数結晶で文字掘り込みがあるときの STL export は text 付き fallback を優先する", async () => {
    const context = createContext();
    buildStlExportArtifact
      .mockReset()
      .mockImplementationOnce(() => ({
        content: "union-stl",
        debug: {
          topologyAfterOrientation: {
            openEdgeCount: 1,
            multiOwnerEdgeCount: 0,
          },
        },
      }))
      .mockImplementationOnce(() => ({
        content: "fallback-stl",
        debug: {
          topologyAfterOrientation: {
            openEdgeCount: 269,
            multiOwnerEdgeCount: 0,
          },
        },
      }))
      .mockImplementationOnce(() => ({
        content: "composite-stl",
        debug: {
          topologyAfterOrientation: {
            openEdgeCount: 24,
            multiOwnerEdgeCount: 0,
          },
        },
      }));
    context.state.parameters.twin = {
      crystals: [
        {
          enabled: true,
          faces: [{ text: { content: "A" } }],
        },
        {
          enabled: true,
          faces: [{ text: { content: "B" } }],
        },
      ],
    };
    context.state.buildResult = {
      finalGeometry: new THREE.BoxGeometry(1, 1, 1),
      previewFinalGeometry: new THREE.BoxGeometry(1, 1, 1),
      crystalPreviewGeometries: [
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.BoxGeometry(1, 1, 1),
      ],
      crystalStlCompositeGeometries: [
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.BoxGeometry(1, 1, 1),
      ],
    };
    const actions = createTwinExportActions(context);

    await actions.exportTwinArtifact("stl", "save");

    expect(buildStlExportArtifact).toHaveBeenCalledTimes(3);
    expect(triggerDownload).toHaveBeenCalledWith(
      "composite-stl",
      "コランダム.stl",
      "model/stl",
    );
    expect(triggerDownload).toHaveBeenCalledWith(
      expect.stringContaining('"preferTextPreservingFallback": true'),
      "コランダム-stl-debug.json",
      "application/json",
    );
    expect(triggerDownload).toHaveBeenCalledWith(
      expect.stringContaining(
        '"textPreservingFallbackStrategy": "composited-crystal-stl-geometries"',
      ),
      "コランダム-stl-debug.json",
      "application/json",
    );
    expect(triggerDownload).toHaveBeenCalledWith(
      expect.stringContaining('"compositeCandidate"'),
      "コランダム-stl-debug.json",
      "application/json",
    );
    expect(triggerDownload).toHaveBeenCalledWith(
      expect.stringContaining(
        '"selectedSource": "composited-crystal-stl-geometries"',
      ),
      "コランダム-stl-debug.json",
      "application/json",
    );
  });

  it("単結晶で文字掘り込みがあるときの STL export も composite 候補を比較して選べる", async () => {
    const context = createContext();
    buildStlExportArtifact
      .mockReset()
      .mockImplementationOnce(() => ({
        content: "union-stl",
        debug: {
          topologyAfterOrientation: {
            openEdgeCount: 20,
            multiOwnerEdgeCount: 0,
          },
        },
      }))
      .mockImplementationOnce(() => ({
        content: "fallback-stl",
        debug: {
          topologyAfterOrientation: {
            openEdgeCount: 20,
            multiOwnerEdgeCount: 0,
          },
        },
      }))
      .mockImplementationOnce(() => ({
        content: "composite-stl",
        debug: {
          topologyAfterOrientation: {
            openEdgeCount: 8,
            multiOwnerEdgeCount: 0,
          },
        },
      }));
    context.state.parameters.twin = {
      crystals: [
        {
          enabled: true,
          faces: [{ text: { content: "A" } }],
        },
      ],
    };
    context.state.buildResult = {
      finalGeometry: new THREE.BoxGeometry(1, 1, 1),
      previewFinalGeometry: new THREE.BoxGeometry(1, 1, 1),
      crystalPreviewGeometries: [new THREE.BoxGeometry(1, 1, 1)],
      crystalStlCompositeGeometries: [new THREE.BoxGeometry(1, 1, 1)],
    };
    const actions = createTwinExportActions(context);

    await actions.exportTwinArtifact("stl", "save");

    expect(buildStlExportArtifact).toHaveBeenCalledTimes(3);
    expect(triggerDownload).toHaveBeenCalledWith(
      "composite-stl",
      "コランダム.stl",
      "model/stl",
    );
    expect(triggerDownload).toHaveBeenCalledWith(
      expect.stringContaining(
        '"selectedSource": "composited-crystal-stl-geometries"',
      ),
      "コランダム-stl-debug.json",
      "application/json",
    );
  });

  it("STL 分割が有効なときは通常の STL 保存で split 経路を使う", async () => {
    const context = createContext();
    context.getVisibleCrystalIndexes.mockReturnValue([0, 1]);
    context.state.stlSplit.enabled = true;
    context.state.stlSplit.plane = { h: 1, k: 1, l: 1 };
    context.state.buildResult = {
      finalGeometry: new THREE.BoxGeometry(2, 2, 2),
      previewFinalGeometry: new THREE.BoxGeometry(2, 2, 2),
      crystalPreviewGeometries: [
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.BoxGeometry(1, 1, 1),
      ],
      crystalStlCompositeGeometries: [
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.BoxGeometry(1, 1, 1),
      ],
    };
    const actions = createTwinExportActions(context);

    await actions.exportTwinArtifact("stl", "save");

    expect(splitBufferGeometryByPlaneWithJscad).toHaveBeenCalledTimes(1);
    expect(triggerDownload).toHaveBeenCalledWith(
      "fallback-stl",
      "コランダム.stl",
      "model/stl",
    );
    expect(triggerDownload).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        '"selectedSource": "visible-crystal-plane-split"',
      ),
      "コランダム-stl-debug.json",
      "application/json",
    );
    expect(triggerDownload).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('"visibleCrystalIndexes": [\n    0,\n    1\n  ]'),
      "コランダム-stl-debug.json",
      "application/json",
    );
    expect(triggerDownload).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('"splitInputSource": "union-final-geometry"'),
      "コランダム-stl-debug.json",
      "application/json",
    );
  });

  it("STL 分割でも通常 STL と同じ fallback source を選べる", async () => {
    const context = createContext();
    context.state.stlSplit.enabled = true;
    context.state.buildResult = {
      finalGeometry: new THREE.BoxGeometry(2, 2, 2),
      previewFinalGeometry: new THREE.BoxGeometry(2, 2, 2),
      crystalPreviewGeometries: [
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.BoxGeometry(1, 1, 1),
      ],
    };
    prepareGeometryForStlExport
      .mockReset()
      .mockImplementationOnce((geometry: THREE.BufferGeometry) => ({
        geometry: geometry.clone(),
        debug: {
          topologyAfterOrientation: {
            openEdgeCount: 62,
            multiOwnerEdgeCount: 0,
          },
        },
      }))
      .mockImplementation((geometry: THREE.BufferGeometry) => ({
        geometry: geometry.clone(),
        debug: {
          topologyAfterOrientation: {
            openEdgeCount: 0,
            multiOwnerEdgeCount: 0,
          },
        },
      }));

    const actions = createTwinExportActions(context);

    await actions.exportTwinArtifact("stl", "save");

    expect(splitBufferGeometryByPlaneWithJscad).toHaveBeenCalledTimes(1);
    expect(triggerDownload).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        '"splitInputSource": "merged-crystal-preview-geometries"',
      ),
      "コランダム-stl-debug.json",
      "application/json",
    );
  });
});
