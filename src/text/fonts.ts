/**
 * 面上テキスト用フォントの定義とキャッシュを扱う。
 *
 * 文字刻印は重くなりやすいため、JSON フォントは都度 parse せず cache して再利用する。
 */

/** UI から選べる面上テキスト用フォント一覧。 */
export const FACE_TEXT_FONTS = [
  {
    id: "helvetiker",
    label: "Helvetiker",
    source: new URL(
      "../../assets/fonts/helvetiker_regular.typeface.json",
      import.meta.url,
    ).href,
  },
  {
    id: "optimer",
    label: "Optimer",
    source: new URL(
      "../../assets/fonts/optimer_regular.typeface.json",
      import.meta.url,
    ).href,
  },
  {
    id: "gentilis",
    label: "Gentilis",
    source: new URL(
      "../../assets/fonts/gentilis_regular.typeface.json",
      import.meta.url,
    ).href,
  },
];

/** フォント JSON を parse 済みで使い回すための cache。 */
const fontCache = new Map();
let fontLoaderPromise = null;

/** FontLoader は面上テキストを使うときだけ遅延読込する。 */
async function getFontLoader() {
  if (!fontLoaderPromise) {
    fontLoaderPromise = import("three/addons/loaders/FontLoader.js").then(
      ({ FontLoader }) => new FontLoader(),
    );
  }

  return fontLoaderPromise;
}

/** 指定フォント定義を読み込み、cache 済みなら再利用する。 */
async function loadFont(definition) {
  if (fontCache.has(definition.id)) {
    return fontCache.get(definition.id);
  }

  const response = await fetch(definition.source);
  if (!response.ok) {
    throw new Error(`フォント ${definition.label} の読み込みに失敗しました。`);
  }

  const fontJson = await response.json();
  const fontLoader = await getFontLoader();
  const font = fontLoader.parse(fontJson);
  fontCache.set(definition.id, font);
  return font;
}

/** 登録済みフォントをまとめて先読みする。 */
export async function loadFaceTextFonts() {
  await Promise.all(FACE_TEXT_FONTS.map((definition) => loadFont(definition)));
}

/** font id から parse 済みフォントを返す。未取得なら先頭フォントへ fallback する。 */
export function getFaceTextFont(fontId) {
  return fontCache.get(fontId) ?? fontCache.get(FACE_TEXT_FONTS[0].id) ?? null;
}
