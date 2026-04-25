import { LEGACY_TWIN_PARAMETERS_DOCUMENT_SCHEMA } from "../../compat/legacyIdentifiers.js";

export const TWIN_PARAMETERS_DOCUMENT_SCHEMA = "sekiei-document";

const LEGACY_TWIN_PARAMETERS_DOCUMENT_SCHEMAS = new Set([
  LEGACY_TWIN_PARAMETERS_DOCUMENT_SCHEMA,
]);

/** 旧名時代に保存された JSON も import 互換として受け付ける。 */
export function isSupportedTwinParametersDocumentSchema(schema: unknown) {
  return (
    schema === TWIN_PARAMETERS_DOCUMENT_SCHEMA ||
    (typeof schema === "string" &&
      LEGACY_TWIN_PARAMETERS_DOCUMENT_SCHEMAS.has(schema))
  );
}
