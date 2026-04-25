import { LEGACY_TWIN_PREVIEW_SETTINGS_DOCUMENT_SCHEMA } from "../compat/legacyIdentifiers.js";
import type {
  EditableTwinPreviewFaceProfile,
  EditableTwinPreviewLineProfile,
} from "./previewProfiles.js";
import {
  createDefaultEditableTwinPreviewFaceProfile,
  createDefaultEditableTwinPreviewLineProfile,
  normalizeTwinPreviewFaceDisplayMode,
  type TwinPreviewFaceDisplayMode,
} from "./previewProfiles.js";

export interface TwinPreviewTextStyleSettings {
  color?: string;
  colors?: {
    a: string;
    b: string;
    a3: string;
    c: string;
  };
  fontFamily: string;
  fontSizePx: number;
}

export interface TwinPreviewFaceLabelStyleSettings extends TwinPreviewTextStyleSettings {
  offset: number;
}

export interface TwinPreviewAxisLineStyleSettings {
  colors: {
    a: string;
    b: string;
    a3: string;
    c: string;
  };
  innerWidth: number;
  outerWidth: number;
}

export interface TwinPreviewLineStyleSettings {
  color: string;
  width: number;
  opacity: number;
}

export interface TwinPreviewStyleSettings {
  faceLabel: TwinPreviewFaceLabelStyleSettings;
  axisLabel: TwinPreviewTextStyleSettings;
  twinRuleLabel: TwinPreviewTextStyleSettings;
  presetMetadataName: TwinPreviewTextStyleSettings;
  presetMetadataDescription: TwinPreviewTextStyleSettings;
  axisLines: TwinPreviewAxisLineStyleSettings;
  ridgeLines: TwinPreviewLineStyleSettings;
  intersectionLines: TwinPreviewLineStyleSettings;
  customLineProfile: EditableTwinPreviewLineProfile;
  customFaceProfile: EditableTwinPreviewFaceProfile;
}

export const TWIN_PREVIEW_SETTINGS_DOCUMENT_SCHEMA =
  "sekiei-twin-preview-document-v1";

const LEGACY_TWIN_PREVIEW_SETTINGS_DOCUMENT_SCHEMAS = new Set([
  LEGACY_TWIN_PREVIEW_SETTINGS_DOCUMENT_SCHEMA,
]);

function isSupportedTwinPreviewSettingsDocumentSchema(schema: unknown) {
  return (
    schema === TWIN_PREVIEW_SETTINGS_DOCUMENT_SCHEMA ||
    (typeof schema === "string" &&
      LEGACY_TWIN_PREVIEW_SETTINGS_DOCUMENT_SCHEMAS.has(schema))
  );
}

export interface TwinPreviewSettingsDocument {
  schema: typeof TWIN_PREVIEW_SETTINGS_DOCUMENT_SCHEMA;
  parameters: unknown;
  preview: {
    faceDisplayMode: TwinPreviewFaceDisplayMode;
    previewStyleSettings: TwinPreviewStyleSettings;
  };
}

export const PREVIEW_FONT_FAMILY_OPTIONS = [
  { value: '"Segoe UI", "BIZ UDPGothic", sans-serif', label: "Segoe UI" },
  {
    value: '"BIZ UDPGothic", "Hiragino Sans", sans-serif',
    label: "BIZ UDPGothic",
  },
  { value: '"Times New Roman", serif', label: "Times New Roman" },
  { value: '"Georgia", serif', label: "Georgia" },
  { value: '"Consolas", monospace', label: "Consolas" },
];

export function createDefaultTwinPreviewStyleSettings(): TwinPreviewStyleSettings {
  return {
    faceLabel: {
      color: "#1f2a37",
      fontFamily: '"Segoe UI", "BIZ UDPGothic", sans-serif',
      fontSizePx: 14,
      offset: 0.05,
    },
    axisLabel: {
      colors: {
        a: "#cc3d3d",
        b: "#2f8f46",
        a3: "#c08a2d",
        c: "#005bac",
      },
      fontFamily: '"Segoe UI", "BIZ UDPGothic", sans-serif',
      fontSizePx: 48,
    },
    twinRuleLabel: {
      color: "#8b5fd1",
      fontFamily: '"Segoe UI", "BIZ UDPGothic", sans-serif',
      fontSizePx: 24,
    },
    presetMetadataName: {
      color: "#1f2a37",
      fontFamily: '"Segoe UI", "BIZ UDPGothic", sans-serif',
      fontSizePx: 48,
    },
    presetMetadataDescription: {
      color: "#516171",
      fontFamily: '"Segoe UI", "BIZ UDPGothic", sans-serif',
      fontSizePx: 24,
    },
    axisLines: {
      colors: {
        a: "#cc3d3d",
        b: "#2f8f46",
        a3: "#c08a2d",
        c: "#005bac",
      },
      innerWidth: 2,
      outerWidth: 2,
    },
    ridgeLines: {
      color: "#181818",
      width: 2,
      opacity: 1,
    },
    intersectionLines: {
      color: "#181818",
      width: 1,
      opacity: 1,
    },
    customLineProfile: createDefaultEditableTwinPreviewLineProfile(),
    customFaceProfile: createDefaultEditableTwinPreviewFaceProfile(),
  };
}

export function readTwinPreviewStyleValue(
  settings: TwinPreviewStyleSettings,
  key: string,
): string | number | boolean | null {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (current && typeof current === "object" && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, settings) as string | number | boolean | null;
}

export function writeTwinPreviewStyleValue(
  settings: TwinPreviewStyleSettings,
  key: string,
  value: unknown,
) {
  const next = structuredClone(settings);
  const segments = key.split(".");
  let current: Record<string, unknown> = next as unknown as Record<
    string,
    unknown
  >;
  for (let index = 0; index < segments.length - 1; index += 1) {
    current = current[segments[index]] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
  return next;
}

export function resolveTwinAxisStyleKey(label?: string | null) {
  if (label === "a3") {
    return "a3";
  }
  if (label === "c") {
    return "c";
  }
  if (label === "b" || label === "a2") {
    return "b";
  }
  return "a";
}

function mergeTwinPreviewStyleValue<T>(defaults: T, raw: unknown): T {
  if (typeof defaults === "string") {
    return (typeof raw === "string" ? raw : defaults) as T;
  }
  if (typeof defaults === "number") {
    return (
      typeof raw === "number" && Number.isFinite(raw) ? raw : defaults
    ) as T;
  }
  if (typeof defaults === "boolean") {
    return (typeof raw === "boolean" ? raw : defaults) as T;
  }
  if (
    defaults &&
    typeof defaults === "object" &&
    !Array.isArray(defaults) &&
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw)
  ) {
    const merged = structuredClone(defaults) as Record<string, unknown>;
    const source = raw as Record<string, unknown>;
    Object.keys(merged).forEach((key) => {
      merged[key] = mergeTwinPreviewStyleValue(merged[key], source[key]);
    });
    return merged as T;
  }
  if (defaults && typeof defaults === "object" && !Array.isArray(defaults)) {
    return structuredClone(defaults);
  }
  return defaults;
}

/** 保存済み preview 設定を既定値へ安全に merge して、追加項目を補った runtime 形へ戻す。 */
export function normalizeTwinPreviewStyleSettings(
  raw: unknown,
): TwinPreviewStyleSettings {
  return mergeTwinPreviewStyleValue(
    createDefaultTwinPreviewStyleSettings(),
    raw,
  );
}

/**
 * 結晶 parameters と preview 詳細設定を一緒に保存する JSON 形を作る。
 *
 * 結晶ごとの `accentColor` や face ごとの `accentColor` は preview 設定ではなく
 * `parameters.crystals[].accentColor` / `parameters.crystals[].faces[].accentColor`
 * 側で保存する。
 */
export function createTwinPreviewSettingsDocument(options: {
  parameters: unknown;
  faceDisplayMode: unknown;
  previewStyleSettings: TwinPreviewStyleSettings;
}): TwinPreviewSettingsDocument {
  return {
    schema: TWIN_PREVIEW_SETTINGS_DOCUMENT_SCHEMA,
    parameters: options.parameters,
    preview: {
      faceDisplayMode: normalizeTwinPreviewFaceDisplayMode(
        options.faceDisplayMode,
      ),
      previewStyleSettings: normalizeTwinPreviewStyleSettings(
        options.previewStyleSettings,
      ),
    },
  };
}

/** JSON import 時に preview 設定同梱 document かどうかを判定する。 */
export function isTwinPreviewSettingsDocument(
  raw: unknown,
): raw is TwinPreviewSettingsDocument {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return false;
  }
  const candidate = raw as Record<string, unknown>;
  return (
    isSupportedTwinPreviewSettingsDocumentSchema(candidate.schema) &&
    "parameters" in candidate &&
    candidate.preview != null &&
    typeof candidate.preview === "object" &&
    !Array.isArray(candidate.preview)
  );
}
