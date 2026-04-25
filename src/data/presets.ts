import { getLocalizedNameText } from "../constants.js";
import { getCurrentLocale, t } from "../i18n.js";
import {
  isTwinPreviewSettingsDocument,
  type TwinPreviewSettingsDocument,
} from "../preview/previewStyleSettings.js";

/**
 * プリセット JSON の読み込み・一覧化・現在言語向け表示名の解決を担う。
 *
 * Vite 移行後は `import.meta.glob` で静的に収集し、UI には検索向けの
 * 軽量 summary を返す構成にしている。
 *
 * 主に扱う日本語文言:
 * - カスタム入力
 * - 現在の手入力を保持します。
 */

/** built-in preset 以外の手入力状態を表す特別な疑似プリセット。 */
export const CUSTOM_PRESET = {
  id: "custom",
  label: {
    ja: "カスタム入力",
    en: "Custom Input",
  },
  description: {
    ja: "現在の手入力を保持します。",
    en: "Keeps the current manual input.",
  },
  category: "system",
  parameters: null,
  preview: null,
};

/** preset object を安全に再利用できるよう shallow clone + parameters deep clone する。 */
function clonePreset(preset) {
  return {
    ...preset,
    parameters: preset.parameters ? structuredClone(preset.parameters) : null,
    preview: preset.preview ? structuredClone(preset.preview) : null,
  };
}

/**
 * preset JSON は schema v2 document と preview 付き wrapper の両方を受ける。
 *
 * これにより、JSON export したファイルをそのまま `src/data/presets` へ置いても
 * catalog から読み込める。
 */
function resolvePresetParametersSource(source) {
  if (isTwinPreviewSettingsDocument(source)) {
    return source.parameters &&
      typeof source.parameters === "object" &&
      !Array.isArray(source.parameters)
      ? source.parameters
      : null;
  }
  return source && typeof source === "object" && !Array.isArray(source)
    ? source
    : null;
}

/** wrapper preset に preview 設定が含まれていれば保持する。 */
function resolvePresetPreviewSource(
  source: unknown,
): TwinPreviewSettingsDocument["preview"] | null {
  return isTwinPreviewSettingsDocument(source) ? source.preview : null;
}

/** 多言語文字列または plain string を、現在言語向けのテキストへ解決する。 */
function getPresetText(value, locale) {
  const normalizedLocale = locale === "ja" ? "jp" : locale;
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    return value[normalizedLocale] ?? value.ja ?? value.jp ?? value.en ?? "";
  }
  return "";
}

const PRESET_ID_FILE_NAME_PATTERN =
  /^([a-z0-9]+(?:-[a-z0-9]+)*-\d{5})(?:-[A-Za-z0-9][A-Za-z0-9-]*)?$/;

/**
 * JSON ファイル名から preset id を作る。
 *
 * 公開向け preset は `{mineral-slug}-{sequence}` を安定 ID とし、
 * 末尾 suffix はファイル名の補助情報としてだけ扱う。
 */
function fileNameToPresetId(fileName) {
  const stem = fileName.replace(/\.json$/i, "");
  return PRESET_ID_FILE_NAME_PATTERN.exec(stem)?.[1] ?? stem;
}

/**
 * `src/data/presets/*.json` を収集し、一覧表示用の catalog を組み立てる。
 *
 * Vite dev ではディレクトリ listing に頼れないため、glob で静的収集している。
 */
function loadPresetCatalog() {
  const presetModules = import.meta.glob<unknown>("./presets/*.json", {
    eager: true,
    import: "default",
  });

  return Object.entries(presetModules)
    .map(([modulePath, source]) => {
      const fileName = modulePath.split("/").at(-1) ?? "";
      const presetId = fileNameToPresetId(fileName);
      const parameters = resolvePresetParametersSource(source);
      return {
        id: presetId,
        label: parameters?.name ?? presetId,
        shortDescription:
          parameters?.metadata?.shortDescription ??
          parameters?.shortDescription ??
          "",
        description:
          parameters?.metadata?.description ?? parameters?.description ?? "",
        category: "preset",
        parameters,
        preview: resolvePresetPreviewSource(source),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id, "ja"));
}

const loadedCatalog = loadPresetCatalog();

/** UI と import/export で共有する、擬似 `custom` を含んだプリセット一覧。 */
export const PRESETS = [CUSTOM_PRESET, ...loadedCatalog.map(clonePreset)];

/** id からプリセット本体を取得する。 */
export function getPresetById(presetId) {
  return PRESETS.find((preset) => preset.id === presetId) ?? null;
}

/**
 * 検索 UI 用に、現在言語へ解決済みの軽量プリセット一覧を返す。
 *
 * `custom` は手入力保持の導線として常に先頭固定にしている。
 */
export function getSelectablePresets() {
  // preset combobox に出す日本語:
  // 「カスタム入力 / 現在の手入力を保持します。」
  const locale = getCurrentLocale();
  const collator = new Intl.Collator(locale === "ja" ? "ja" : "en");
  const selectablePresets = PRESETS.map((preset) => {
    const displayName =
      preset.id === "custom"
        ? t("preset.custom.label")
        : getLocalizedNameText(preset.label, locale) || preset.id;
    const shortDescription =
      preset.id === "custom"
        ? t("preset.custom.description")
        : getPresetText(preset.shortDescription, locale);

    return {
      id: preset.id,
      displayName,
      label: shortDescription
        ? `${displayName} - ${shortDescription}`
        : displayName,
      shortDescription,
      description:
        preset.id === "custom"
          ? t("preset.custom.description")
          : getPresetText(preset.description, locale),
      category: preset.category,
    };
  });

  const customPreset = selectablePresets.find(
    (preset) => preset.id === "custom",
  );
  const regularPresets = selectablePresets
    .filter((preset) => preset.id !== "custom")
    .sort((left, right) =>
      collator.compare(left.displayName, right.displayName),
    );

  return customPreset ? [customPreset, ...regularPresets] : regularPresets;
}
