import { STL_FORMAT, buildStlExportArtifact } from "./formats/stl.js";

/**
 * 単結晶 / 双晶で共通利用する 3D モデル出力形式の registry を定義する。
 *
 * UI に見せる形式一覧と、実際に geometry から artifact を作る関数を
 * 同じ場所で束ね、出力形式追加時の差分を小さく保つ。
 */

/** 実際の artifact builder 付き registry。UI にはこのまま渡さず一段薄めて公開する。 */
const EXPORT_FORMAT_REGISTRY = [
  {
    ...STL_FORMAT,
    buildArtifact: buildStlExportArtifact,
  },
];

/** UI 用の公開形式一覧。実体の artifact builder は含めない。 */
export const EXPORT_FORMATS = EXPORT_FORMAT_REGISTRY.map((format) =>
  Object.fromEntries(
    Object.entries(format).filter(([key]) => key !== "buildArtifact"),
  ),
);

/** format id から registry 上の出力形式定義を返す。見つからなければ先頭形式を fallback にする。 */
export function getExportFormat(formatId) {
  return (
    EXPORT_FORMAT_REGISTRY.find((format) => format.id === formatId) ??
    EXPORT_FORMAT_REGISTRY[0]
  );
}

/** geometry を指定形式で書き出すための artifact を構築する。 */
export function buildExportArtifact(formatId, geometry) {
  const format = getExportFormat(formatId);
  return {
    ...format,
    ...format.buildArtifact(geometry),
  };
}
