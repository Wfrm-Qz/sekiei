import * as THREE from "three";

/**
 * Three.js geometry 化と、ブラウザ向けダウンロード処理をまとめる。
 *
 * 単結晶 / 双晶 / SVG / PNG など複数の出力導線から呼ばれるため、
 * DOM 依存の保存処理と geometry 変換をここへ集約している。
 */

/** 稜線 dedupe 用に頂点座標を丸めたキーへ変換する。 */
function buildVertexKey(vertex) {
  const round = (value) => Math.round(value * 1e6) / 1e6;
  return `${round(vertex.x)}|${round(vertex.y)}|${round(vertex.z)}`;
}

/** meshData を Three.js の `BufferGeometry` へ変換する。 */
export function buildThreeGeometry(meshData) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(meshData.positions, 3),
  );
  if (meshData.colors?.length) {
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(meshData.colors, 3),
    );
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * 面ポリゴンから外周線用 geometry を作る。
 *
 * 同じ辺を重複追加しないよう edgeMap で dedupe している。
 */
export function buildThreeOutlineGeometry(meshData) {
  const edgeMap = new Map();

  for (const face of meshData.faces ?? []) {
    const vertices = face.vertices ?? [];
    for (let index = 0; index < vertices.length; index += 1) {
      const start = vertices[index];
      const end = vertices[(index + 1) % vertices.length];
      const startKey = buildVertexKey(start);
      const endKey = buildVertexKey(end);
      const edgeKey = [startKey, endKey].sort().join("::");

      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, [start, end]);
      }
    }
  }

  const positions = [];
  for (const [start, end] of edgeMap.values()) {
    positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  return geometry;
}

/** 文字列 content を Blob 化してダウンロードさせる。 */
export function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  triggerBlobDownload(blob, filename);
}

/** Blob を object URL 経由でダウンロードさせる。 */
export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** 文字列 content に対して「名前を付けて保存」導線を提供する。 */
export async function triggerNamedDownload(
  content,
  defaultFilename,
  mimeType,
  extension = "",
) {
  const blob = new Blob([content], { type: mimeType });
  return triggerNamedBlobDownload(blob, defaultFilename, mimeType, extension);
}

/**
 * Blob に対して「名前を付けて保存」を行う。
 *
 * File System Access API が使える環境では picker を優先し、
 * 使えない環境では prompt + 従来ダウンロードへ fallback する。
 */
export async function triggerNamedBlobDownload(
  blob,
  defaultFilename,
  mimeType,
  extension = "",
) {
  const suggestedName =
    extension && !defaultFilename.endsWith(extension)
      ? `${defaultFilename}${extension}`
      : defaultFilename;

  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: mimeType,
            accept: {
              [mimeType]: extension ? [extension] : [],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      if (error?.name === "AbortError") {
        return false;
      }
    }
  }

  const enteredName = window.prompt(
    "保存するファイル名を入力してください。",
    suggestedName,
  );
  if (!enteredName) {
    return false;
  }
  const filename =
    extension && !enteredName.toLowerCase().endsWith(extension.toLowerCase())
      ? `${enteredName}${extension}`
      : enteredName;
  triggerBlobDownload(blob, filename);
  return true;
}

/** SVG 組み立て時に属性値へ埋める文字列を XML エスケープする。 */
function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * プレビューの合成結果をそのまま 1 枚の SVG 文字列へ組み立てる。
 *
 * polygon/path/line/text を順番に並べるため、呼び出し側は描画順まで確定して渡す必要がある。
 */
export function buildPreviewCompositeSvg({
  width,
  height,
  background = null,
  imageHref = "",
  polygons = [],
  paths = [],
  lines = [],
  textOverlays = [],
}) {
  const backgroundMarkup = background
    ? `<rect width="${width}" height="${height}" fill="${escapeXml(background)}" />`
    : "";
  const pathMarkup = paths
    .map((path) => {
      const fill = escapeXml(path.fill ?? "#cccccc");
      const fillOpacity = Number.isFinite(Number(path.fillOpacity))
        ? Number(path.fillOpacity)
        : 1;
      const stroke = escapeXml(path.stroke ?? "none");
      const strokeOpacity = Number.isFinite(Number(path.strokeOpacity))
        ? Number(path.strokeOpacity)
        : 1;
      const strokeWidth = Number.isFinite(Number(path.strokeWidth))
        ? Number(path.strokeWidth)
        : 0;
      const fillRule = escapeXml(path.fillRule ?? "nonzero");
      return `<path d="${escapeXml(path.d ?? "")}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}" fill-rule="${fillRule}" stroke-linejoin="round" />`;
    })
    .join("");
  const polygonMarkup = polygons
    .map((polygon) => {
      const fill = escapeXml(polygon.fill ?? "#cccccc");
      const fillOpacity = Number.isFinite(Number(polygon.fillOpacity))
        ? Number(polygon.fillOpacity)
        : 1;
      const stroke = escapeXml(polygon.stroke ?? fill);
      const strokeOpacity = Number.isFinite(Number(polygon.strokeOpacity))
        ? Number(polygon.strokeOpacity)
        : fillOpacity;
      const strokeWidth = Number.isFinite(Number(polygon.strokeWidth))
        ? Number(polygon.strokeWidth)
        : 0;
      return `<polygon points="${escapeXml(polygon.points)}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`;
    })
    .join("");

  const lineMarkup = lines
    .map((line) => {
      const stroke = escapeXml(line.stroke ?? "#000000");
      const strokeOpacity = Number.isFinite(Number(line.strokeOpacity))
        ? Number(line.strokeOpacity)
        : 1;
      const strokeWidth = Number.isFinite(Number(line.strokeWidth))
        ? Number(line.strokeWidth)
        : 1;
      return `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}" stroke-linecap="round" />`;
    })
    .join("");
  const imageMarkup = imageHref
    ? `<image href="${escapeXml(imageHref)}" width="${width}" height="${height}" preserveAspectRatio="none" />`
    : "";

  const textMarkup = textOverlays
    .map((overlay) => {
      const textAnchor = overlay.align === "center" ? "middle" : "start";
      const fontSize = Number(overlay.fontSize) || 16;
      const fontWeight = overlay.fontWeight ?? "400";
      const fontFamily = escapeXml(overlay.fontFamily ?? "sans-serif");
      const fill = escapeXml(overlay.color ?? "#000000");
      const x = Number(overlay.x) || 0;
      const y = Number(overlay.y) || 0;
      const lines = String(overlay.text ?? "").split(/\r?\n/);
      const tspans = lines
        .map((line, index) => {
          const dy = index === 0 ? "0" : `${fontSize * 1.1}`;
          return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
        })
        .join("");
      return `<text x="${x}" y="${y}" text-anchor="${textAnchor}" dominant-baseline="middle" fill="${fill}" font-size="${fontSize}" font-weight="${fontWeight}" font-family="${fontFamily}">${tspans}</text>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${backgroundMarkup}
  ${imageMarkup}
  ${pathMarkup}
  ${polygonMarkup}
  ${lineMarkup}
  ${textMarkup}
</svg>`;
}

export async function renderCompositeSvgToPngBlob(
  svgMarkup,
  width,
  height,
  scale = 1,
) {
  const safeScale = Math.max(1, scale);
  const svgBlob = new Blob([svgMarkup], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () =>
        reject(new Error("Failed to render SVG image."));
      nextImage.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * safeScale));
    canvas.height = Math.max(1, Math.round(height * safeScale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to acquire 2D canvas context.");
    }
    context.scale(safeScale, safeScale);
    context.drawImage(image, 0, 0, width, height);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          resolve(pngBlob);
          return;
        }
        reject(new Error("Failed to create PNG blob."));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
/**
 * Three.js geometry 化と、ブラウザ向けダウンロード処理をまとめる。
 *
 * 単結晶 / 双晶 / SVG / PNG など複数の出力導線から呼ばれるため、
 * DOM 依存の保存処理と geometry 変換をここへ集約している。
 */
