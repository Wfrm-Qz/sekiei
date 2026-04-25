/**
 * 双晶 parameter 関連の facade。
 *
 * 既定値、schema v2 書き出し、normalize / import 互換を
 * `domain/parameters/` 配下へ分割し、この file は入口だけを担う。
 */

export {
  createDefaultTwinAxisRule,
  createDefaultTwinParameters,
  twinRuleTypeForTwinType,
} from "./parameters/defaults.js";
export { serializeTwinParameters } from "./parameters/schemaV2.js";
export {
  normalizeTwinParameters,
  readTwinParametersContent,
  readTwinParametersFile,
  validateTwinImportShape,
} from "./parameters/normalize.js";
