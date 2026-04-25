import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  buildPreviewCompositeSvg,
  buildThreeGeometry,
  buildThreeOutlineGeometry,
  renderCompositeSvgToPngBlob,
  triggerBlobDownload,
  triggerNamedBlobDownload,
  triggerNamedDownload,
} from "../../../src/io/exporters.ts";

/**
 * io/exporters の geometry 変換とダウンロード helper を確認する unit test。
 */
describe("io/exporters", () => {
  it("buildThreeGeometry は正常系で attribute と bounds を持つ geometry を返し、色欠損でも position は作る", () => {
    const withColor = buildThreeGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      colors: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    });
    expect(withColor.getAttribute("position")).toBeInstanceOf(
      THREE.BufferAttribute,
    );
    expect(withColor.getAttribute("color")).toBeInstanceOf(
      THREE.BufferAttribute,
    );
    expect(withColor.boundingSphere).not.toBeNull();

    const withoutColor = buildThreeGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });
    expect(withoutColor.getAttribute("color")).toBeUndefined();
  });

  it("buildThreeOutlineGeometry は辺を dedupe し、異常系寄りの空 faces では空 geometry を返す", () => {
    const geometry = buildThreeOutlineGeometry({
      faces: [
        {
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
          ],
        },
        {
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            { x: -1, y: 0, z: 0 },
          ],
        },
      ],
    });
    expect(geometry.getAttribute("position").count).toBe(10);

    const empty = buildThreeOutlineGeometry({ faces: [] });
    expect(empty.getAttribute("position").count).toBe(0);
  });

  it("triggerBlobDownload は object URL を作って click/revoke し、triggerNamedBlobDownload は picker と cancel を扱う", async () => {
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    const revokeObjectURLSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    try {
      triggerBlobDownload(new Blob(["hello"], { type: "text/plain" }), "a.txt");
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:test");

      const write = vi.fn();
      const close = vi.fn();
      Object.defineProperty(window, "showSaveFilePicker", {
        value: vi.fn().mockResolvedValue({
          createWritable: vi.fn().mockResolvedValue({ write, close }),
        }),
        configurable: true,
        writable: true,
      });
      const showSaveFilePickerSpy = vi.spyOn(window, "showSaveFilePicker");

      await expect(
        triggerNamedBlobDownload(
          new Blob(["named"], { type: "text/plain" }),
          "sample",
          "text/plain",
          ".txt",
        ),
      ).resolves.toBe(true);
      expect(showSaveFilePickerSpy).toHaveBeenCalled();
      expect(write).toHaveBeenCalled();
      expect(close).toHaveBeenCalled();

      showSaveFilePickerSpy.mockRejectedValueOnce({ name: "AbortError" });
      await expect(
        triggerNamedBlobDownload(
          new Blob(["named"], { type: "text/plain" }),
          "sample",
          "text/plain",
          ".txt",
        ),
      ).resolves.toBe(false);
    } finally {
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
      clickSpy.mockRestore();
    }
  });

  it("triggerNamedDownload は fallback prompt を使い、キャンセル時は false を返す", async () => {
    const promptSpy = vi.spyOn(window, "prompt");
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    const revokeObjectURLSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    try {
      Object.defineProperty(window, "showSaveFilePicker", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      promptSpy.mockReturnValueOnce("custom-name");
      await expect(
        triggerNamedDownload("hello", "default", "text/plain", ".txt"),
      ).resolves.toBe(true);
      expect(clickSpy).toHaveBeenCalled();

      promptSpy.mockReturnValueOnce(null);
      await expect(
        triggerNamedDownload("hello", "default", "text/plain", ".txt"),
      ).resolves.toBe(false);
    } finally {
      promptSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
      clickSpy.mockRestore();
    }
  });

  it("buildPreviewCompositeSvg は各レイヤーを含む SVG を返し、空配列でも SVG 文字列になる", () => {
    const rich = buildPreviewCompositeSvg({
      width: 100,
      height: 80,
      background: "#ffffff",
      imageHref: "data:image/png;base64,xxx",
      polygons: [{ points: "0,0 10,0 0,10", fill: "#ff0000" }],
      paths: [{ d: "M0 0L10 10Z", fill: "#00ff00" }],
      lines: [{ x1: 0, y1: 0, x2: 10, y2: 10, stroke: "#0000ff" }],
      textOverlays: [{ x: 5, y: 6, text: "label", align: "center" }],
    });
    expect(rich).toContain("<svg");
    expect(rich).toContain("<polygon");
    expect(rich).toContain("<path");
    expect(rich).toContain("<line");
    expect(rich).toContain("<text");

    const empty = buildPreviewCompositeSvg({ width: 10, height: 10 });
    expect(empty).toContain('viewBox="0 0 10 10"');
  });

  it("renderCompositeSvgToPngBlob は正常系で PNG Blob を返し、異常系では context 欠損を例外にする", async () => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    const originalImage = globalThis.Image;
    const originalCreateElement = document.createElement.bind(document);
    globalThis.Image = MockImage as never;

    try {
      const createElementSpy = vi
        .spyOn(document, "createElement")
        .mockImplementation((tagName: string) => {
          if (tagName !== "canvas") {
            return originalCreateElement(tagName);
          }
          return {
            width: 0,
            height: 0,
            getContext: vi.fn().mockReturnValue({
              scale: vi.fn(),
              drawImage: vi.fn(),
            }),
            toBlob: (callback: BlobCallback) =>
              callback(new Blob(["png"], { type: "image/png" })),
          } as unknown as HTMLCanvasElement;
        });

      await expect(
        renderCompositeSvgToPngBlob("<svg></svg>", 10, 10, 1),
      ).resolves.toBeInstanceOf(Blob);

      createElementSpy.mockImplementation((tagName: string) => {
        if (tagName !== "canvas") {
          return originalCreateElement(tagName);
        }
        return {
          width: 0,
          height: 0,
          getContext: vi.fn().mockReturnValue(null),
          toBlob: vi.fn(),
        } as unknown as HTMLCanvasElement;
      });
      await expect(
        renderCompositeSvgToPngBlob("<svg></svg>", 10, 10, 1),
      ).rejects.toThrow("Failed to acquire 2D canvas context.");

      createElementSpy.mockRestore();
    } finally {
      globalThis.Image = originalImage;
    }
  });
});
