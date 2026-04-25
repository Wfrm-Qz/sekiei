/**
 * Sekiei 改名前に使っていた識別子を、互換読込専用でまとめる。
 *
 * 現在の保存・表示名は `sekiei-*` に統一しつつ、旧版で保存した
 * locale / schema を読み込めるように、このファイルだけが旧識別子を知る。
 */
export const LEGACY_LOCALE_STORAGE_KEY = "crystralmaker.locale";

export const LEGACY_TWIN_PARAMETERS_DOCUMENT_SCHEMA = "crystralmaker-document";

export const LEGACY_TWIN_PREVIEW_SETTINGS_DOCUMENT_SCHEMA =
  "crystralmaker-twin-preview-document-v1";
